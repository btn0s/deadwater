import { useSyncExternalStore, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { player } from './playerState'
import { findGrabbable, type Grabbable } from './grabbables'
import { carry } from './Carry'
import { inventory } from './inventory'
import { equipmentActionSnapshot, runPrimaryAction } from './equipmentActions'
import { flashlightSnapshot } from './Flashlight'
import { lightGroupsSnapshot } from './lightGroups'

/**
 * Usable things in the world (doors, switches, pickups). Interaction is
 * RETICLE-driven: a ray from the crosshair against the scene — the prompt
 * appears and E fires only when you're actually looking at the thing, and
 * geometry in between blocks it (no using switches through walls).
 */

export interface Interactable {
  /** the node's visual root; the ray must hit one of its meshes */
  object: THREE.Object3D
  label: string
  /** absent = inert (a locked door): the prompt shows but E does nothing */
  action?: () => void
  /** semantic resolver category; ordinary doors and switches default to world */
  kind?: 'world' | 'pickup'
  /** doors fade to black around their action; switches etc. fire instantly */
  fade?: boolean
  /** reach in meters (default 2.4) */
  maxDist?: number
}

const items = new Set<Interactable>()
let aimDebug: {
  interactable: string | null
  kind: Interactable['kind'] | null
  grabbableStyle: Grabbable['carryStyle'] | null
} = { interactable: null, kind: null, grabbableStyle: null }

export function registerInteractable(entry: Interactable): () => void {
  entry.object.userData.interactable = entry
  items.add(entry)
  return () => {
    items.delete(entry)
    delete entry.object.userData.interactable
  }
}

function findInteractable(hit: THREE.Object3D): Interactable | null {
  let o: THREE.Object3D | null = hit
  while (o) {
    if (o.userData.interactable) return o.userData.interactable as Interactable
    o = o.parent
  }
  return null
}

// ---- HUD prompt (subscribed by the App overlay) ----
export interface InteractionPrompt {
  input: 'E'
  label: string
  kind: 'action' | 'manipulate' | 'holding'
}

let prompt: InteractionPrompt | null = null
const subs = new Set<() => void>()
function setPrompt(next: InteractionPrompt | null) {
  if (
    next?.input === prompt?.input &&
    next?.label === prompt?.label &&
    next?.kind === prompt?.kind
  ) return
  prompt = next
  subs.forEach((fn) => fn())
}
export function usePrompt(): InteractionPrompt | null {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    () => prompt,
  )
}

// ---- fade transition (subscribed by the App overlay) ----
let faded = false
const fadeSubs = new Set<() => void>()
export function useFade(): boolean {
  return useSyncExternalStore(
    (fn) => {
      fadeSubs.add(fn)
      return () => fadeSubs.delete(fn)
    },
    () => faded,
  )
}
let transitioning = false
/** fade to black, run fn at the darkest point, fade back */
export function fadeThrough(fn: () => void, holdMs = 280) {
  if (transitioning) return
  transitioning = true
  faded = true
  fadeSubs.forEach((s) => s())
  setTimeout(() => {
    fn()
    setTimeout(() => {
      faded = false
      fadeSubs.forEach((s) => s())
      transitioning = false
    }, holdMs)
  }, holdMs)
}

const MAX_REACH = 2.4
const CENTER = new THREE.Vector2(0, 0)

/** Mount once inside the Canvas (game mode). */
export function InteractionSystem() {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const raycaster = useRef(new THREE.Raycaster())
  const aimed = useRef<Interactable | null>(null)
  const aimedGrab = useRef<Grabbable | null>(null)

  useFrame(() => {
    let target: Interactable | null = null
    let grab: Grabbable | null = null
    if (player.locked && !transitioning) {
      const rc = raycaster.current
      rc.setFromCamera(CENTER, camera)
      rc.far = MAX_REACH
      const level = scene.getObjectByName('level')
      if (level) {
        // first solid thing the reticle touches — occluders naturally block
        const hits = rc.intersectObject(level, true)
        for (const h of hits) {
          const g = findGrabbable(h.object)
          // A centered carried prop sits directly on the reticle. Ignore all
          // of its mesh hits so a switch or door behind it can still win E.
          if (g && carry.isHolding(g)) continue

          const it = findInteractable(h.object)
          if (it) {
            if (h.distance <= (it.maxDist ?? MAX_REACH)) target = it
            break
          }
          // no interactable: maybe it's a prop you can pick up with E
          if (g) {
            grab = g
            break
          }
          break // solid occluder
        }
      }
    }
    aimed.current = target
    aimedGrab.current = grab
    aimDebug = {
      interactable: target?.label ?? null,
      kind: target?.kind ?? null,
      grabbableStyle: grab?.carryStyle ?? null,
    }
    if (target && target.kind !== 'pickup') {
      setPrompt({ input: 'E', label: target.label, kind: 'action' })
    } else if (carry.isHolding()) {
      setPrompt({ input: 'E', label: 'PUT DOWN', kind: 'holding' })
    } else if (target?.kind === 'pickup') {
      setPrompt({ input: 'E', label: target.label, kind: 'manipulate' })
    } else if (grab) {
      setPrompt({ input: 'E', label: 'PICK UP', kind: 'manipulate' })
    } else {
      setPrompt(null)
    }
  })

  useEffect(() => {
    const canvas = gl.domElement
    const onContextMenu = (e: Event) => e.preventDefault()
    const runWorldAction = (it: Interactable) => {
      if (!it.action) return
      if (it.fade === false) it.action()
      else fadeThrough(it.action)
    }
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || !player.locked || transitioning || carry.isHolding()) return
      runPrimaryAction(inventory.equipped()?.id)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE' || e.repeat || !player.locked || transitioning) return

      const target = aimed.current
      // Classic resolver priority: focused world action, current carry,
      // focused inventory pickup, then focused loose prop.
      if (target && target.kind !== 'pickup') {
        e.stopImmediatePropagation()
        runWorldAction(target)
        return
      }
      if (carry.isHolding()) {
        e.stopImmediatePropagation()
        carry.putDown(camera, scene)
        return
      }
      if (target?.kind === 'pickup') {
        e.stopImmediatePropagation()
        runWorldAction(target)
        return
      }
      const grab = aimedGrab.current
      if (grab) {
        e.stopImmediatePropagation()
        carry.pickUp(grab, camera)
      }
    }

    canvas.addEventListener('contextmenu', onContextMenu)
    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      canvas.removeEventListener('contextmenu', onContextMenu)
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown, true)
      setPrompt(null)
    }
  }, [camera, gl, scene])

  return null
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__interactionState = () => ({
    inventory: inventory.get(),
    carry: carry.snapshot(),
    flashlight: flashlightSnapshot(),
    actions: equipmentActionSnapshot(),
    disabledLightGroups: lightGroupsSnapshot(),
    aim: aimDebug,
  })
}
