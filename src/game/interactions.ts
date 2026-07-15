import { useSyncExternalStore, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { player } from './playerState'

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
  /** doors fade to black around their action; switches etc. fire instantly */
  fade?: boolean
  /** reach in meters (default 2.4) */
  maxDist?: number
}

const items = new Set<Interactable>()

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
let prompt: string | null = null
const subs = new Set<() => void>()
function setPrompt(next: string | null) {
  if (next === prompt) return
  prompt = next
  subs.forEach((fn) => fn())
}
export function usePrompt(): string | null {
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
  const raycaster = useRef(new THREE.Raycaster())
  const aimed = useRef<Interactable | null>(null)

  useFrame(() => {
    let target: Interactable | null = null
    if (player.locked && !transitioning && items.size > 0) {
      const rc = raycaster.current
      rc.setFromCamera(CENTER, camera)
      rc.far = MAX_REACH
      const level = scene.getObjectByName('level')
      if (level) {
        // first solid thing the reticle touches — occluders naturally block
        const hits = rc.intersectObject(level, true)
        for (const h of hits) {
          const it = findInteractable(h.object)
          if (it) {
            if (h.distance <= (it.maxDist ?? MAX_REACH)) target = it
            break // whatever is hit first decides: interactable or occluder
          }
        }
      }
    }
    aimed.current = target
    setPrompt(target?.label ?? null)
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE' || !player.locked || transitioning) return
      const it = aimed.current
      if (it) {
        e.stopImmediatePropagation()
        if (!it.action) return
        if (it.fade === false) it.action()
        else fadeThrough(it.action)
      }
    }
    // capture phase so the door wins over the E-opens-editor shortcut
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return null
}
