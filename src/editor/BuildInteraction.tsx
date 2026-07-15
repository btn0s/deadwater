import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneNode, Transform } from '../engine/types'
import { sceneStore, useSceneEditor } from '../engine/sceneStore'
import { setBuildInteractionActions } from './buildInteractionActions'

const CENTER = new THREE.Vector2(0, 0)
const MAX_AIM_DISTANCE = 16
const GRID_SIZE = 0.25
const DEFAULT_PLACEMENT_DISTANCE = 4
const MIN_HOLD_DISTANCE = 1
const MAX_HOLD_DISTANCE = 24

interface HeldTransform {
  id: string
  object: THREE.Object3D
  original: Transform
  distance: number
}

function eulerOf(transform: Transform): [number, number, number] {
  const rotation = transform.rot
  if (rotation === undefined) return [0, 0, 0]
  return typeof rotation === 'number' ? [0, rotation, 0] : rotation
}

function round(value: number): number {
  return +value.toFixed(3)
}

function nodeIdFromHit(object: THREE.Object3D, nodes: SceneNode[]): string | null {
  const ids = new Set(nodes.map((node) => node.id))
  let current: THREE.Object3D | null = object
  while (current) {
    const raw = current.userData.nodeId
    if (typeof raw === 'string') {
      const instanceRoot = raw.split('::')[0]
      if (ids.has(instanceRoot)) return instanceRoot
      if (ids.has(raw)) return raw
    }
    current = current.parent
  }
  return null
}

function belongsTo(object: THREE.Object3D, owner: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object
  while (current) {
    if (current === owner) return true
    current = current.parent
  }
  return false
}

function inputOwnsShortcut(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)
}

/** Center-reticle scene-node manipulation for the first-person build editor. */
export function BuildInteraction() {
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const gl = useThree((state) => state.gl)
  const raycaster = useRef(new THREE.Raycaster())
  const held = useRef<HeldTransform | null>(null)
  const target = useRef(new THREE.Vector3())
  const localTarget = useRef(new THREE.Vector3())
  const placementDistance = useRef(DEFAULT_PLACEMENT_DISTANCE)
  const marker = useRef<THREE.Group>(null)

  const raycast = (exclude?: THREE.Object3D) => {
    const level = scene.getObjectByName('level')
    if (!level) return null
    const ray = raycaster.current
    ray.setFromCamera(CENTER, camera)
    ray.far = MAX_HOLD_DISTANCE
    return ray.intersectObject(level, true).find((hit) => !exclude || !belongsTo(hit.object, exclude)) ?? null
  }

  const targetFromRay = (distance: number, exclude?: THREE.Object3D) => {
    const ray = raycaster.current
    ray.setFromCamera(CENTER, camera)
    ray.far = MAX_HOLD_DISTANCE
    const hit = raycast(exclude)
    if (hit && hit.distance <= Math.max(MAX_AIM_DISTANCE, distance + 1.5)) {
      target.current.copy(hit.point)
    } else {
      ray.ray.at(distance, target.current)
    }
    if (sceneStore.get().buildSnap) {
      target.current.set(
        Math.round(target.current.x / GRID_SIZE) * GRID_SIZE,
        Math.round(target.current.y / GRID_SIZE) * GRID_SIZE,
        Math.round(target.current.z / GRID_SIZE) * GRID_SIZE,
      )
    }
    return target.current
  }

  const beginHold = (id: string): boolean => {
    if (held.current) return false
    const state = sceneStore.get()
    const node = state.nodes.find((candidate) => candidate.id === id && !candidate.library)
    const object = scene.getObjectByName(id)
    if (!node || !object) return false
    const worldPosition = object.getWorldPosition(new THREE.Vector3())
    held.current = {
      id,
      object,
      original: structuredClone(node.transform),
      distance: THREE.MathUtils.clamp(camera.position.distanceTo(worldPosition), MIN_HOLD_DISTANCE, MAX_HOLD_DISTANCE),
    }
    sceneStore.select(id)
    sceneStore.setBuildHoldingId(id)
    return true
  }

  const cancelHold = () => {
    const current = held.current
    if (!current) return
    current.object.position.fromArray(current.original.pos)
    current.object.rotation.set(...eulerOf(current.original))
    current.object.scale.setScalar(current.original.scale ?? 1)
    current.object.updateMatrixWorld(true)
    held.current = null
    sceneStore.setBuildHoldingId(null)
  }

  const commitHold = () => {
    const current = held.current
    if (!current) return
    const node = sceneStore.get().nodes.find((candidate) => candidate.id === current.id)
    if (!node) {
      cancelHold()
      return
    }
    const rotation: number | [number, number, number] = Array.isArray(current.original.rot)
      ? [round(current.object.rotation.x), round(current.object.rotation.y), round(current.object.rotation.z)]
      : round(current.object.rotation.y)
    const transform: Transform = {
      ...node.transform,
      pos: [round(current.object.position.x), round(current.object.position.y), round(current.object.position.z)],
      rot: rotation,
    }
    held.current = null
    sceneStore.setBuildHoldingId(null)
    sceneStore.updateTransform(current.id, transform)
  }

  const openPanel = (panel: 'catalog' | 'inspector') => {
    commitHold()
    sceneStore.setBuildPanel(panel)
    if (document.pointerLockElement) void document.exitPointerLock()
  }

  const closePanel = () => {
    sceneStore.setBuildPanel(null)
    try {
      void gl.domElement.requestPointerLock().catch(() => {})
    } catch {
      // The build view will offer a click-to-resume card.
    }
  }

  useFrame(() => {
    const state = sceneStore.get()
    const current = held.current
    if (current) {
      const worldTarget = targetFromRay(current.distance, current.object)
      localTarget.current.copy(worldTarget)
      current.object.parent?.worldToLocal(localTarget.current)
      current.object.position.copy(localTarget.current)
      current.object.updateMatrixWorld(true)
      sceneStore.setBuildAimedId(current.id)
    } else {
      const hit = raycast()
      const aimedId = hit && hit.distance <= MAX_AIM_DISTANCE
        ? nodeIdFromHit(hit.object, state.nodes)
        : null
      sceneStore.setBuildAimedId(aimedId)
      if (state.placing) targetFromRay(placementDistance.current)
    }

    if (marker.current) {
      marker.current.visible = Boolean(current || state.placing)
      if (marker.current.visible) marker.current.position.copy(target.current)
    }
  })

  useEffect(() => {
    const canvas = gl.domElement
    const onWheel = (event: WheelEvent) => {
      if (!sceneStore.get().buildLocked) return
      const current = held.current
      if (current) {
        current.distance = THREE.MathUtils.clamp(
          current.distance + Math.sign(event.deltaY) * 0.5,
          MIN_HOLD_DISTANCE,
          MAX_HOLD_DISTANCE,
        )
        event.preventDefault()
      } else if (sceneStore.get().placing) {
        placementDistance.current = THREE.MathUtils.clamp(
          placementDistance.current + Math.sign(event.deltaY) * 0.5,
          MIN_HOLD_DISTANCE,
          MAX_HOLD_DISTANCE,
        )
        event.preventDefault()
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const state = sceneStore.get()
      if (event.code === 'Escape' && state.buildPanel) {
        closePanel()
        return
      }
      if (inputOwnsShortcut(event.target)) return
      const shortcut = event.metaKey || event.ctrlKey

      if (shortcut && event.code === 'KeyZ') {
        event.preventDefault()
        cancelHold()
        if (event.shiftKey) sceneStore.redo()
        else sceneStore.undo()
        return
      }
      if (shortcut && event.code === 'KeyS') {
        event.preventDefault()
        commitHold()
        void sceneStore.save()
        return
      }
      if (shortcut && event.code === 'KeyD') {
        event.preventDefault()
        commitHold()
        const sourceId = sceneStore.get().selectedId
        if (!sourceId) return
        const copyId = sceneStore.duplicate(sourceId)
        if (copyId) requestAnimationFrame(() => beginHold(copyId))
        return
      }
      if (event.code === 'KeyQ' && !event.repeat) {
        event.preventDefault()
        if (state.buildPanel === 'catalog') closePanel()
        else openPanel('catalog')
        return
      }
      if (event.code === 'KeyI' && !event.repeat) {
        event.preventDefault()
        if (state.buildPanel === 'inspector') closePanel()
        else openPanel('inspector')
        return
      }
      if (event.code === 'KeyN' && !event.repeat) {
        sceneStore.setBuildMoveMode(state.buildMoveMode === 'walk' ? 'fly' : 'walk')
        return
      }
      if (event.code === 'KeyG' && !event.repeat) {
        sceneStore.setBuildSnap(!state.buildSnap)
        return
      }
      if (event.code === 'Escape') {
        if (held.current) cancelHold()
        else if (state.placing) sceneStore.setPlacing(null)
        return
      }
      if ((event.code === 'Delete' || event.code === 'Backspace') && !event.repeat) {
        event.preventDefault()
        const id = held.current?.id ?? state.selectedId
        cancelHold()
        if (id) sceneStore.remove(id)
        return
      }
      if (!state.buildLocked || state.buildPanel || event.repeat) return
      if (event.code === 'KeyR' && held.current) {
        held.current.object.rotation.y += THREE.MathUtils.degToRad(event.shiftKey ? 1 : 15)
        held.current.object.updateMatrixWorld(true)
        return
      }
      if (event.code !== 'KeyE') return

      event.preventDefault()
      if (state.placing) {
        const point = targetFromRay(placementDistance.current)
        const placedId = sceneStore.placeAt(point.x, point.y, point.z)
        sceneStore.setPlacing(null)
        if (placedId) sceneStore.select(placedId)
      } else if (held.current) {
        commitHold()
      } else if (state.buildAimedId) {
        beginHold(state.buildAimedId)
      }
    }

    const hook = {
      begin: (id: string) => beginHold(id),
      commit: () => commitHold(),
      cancel: () => cancelHold(),
      snapshot: () => ({
        ...sceneStore.get(),
        nodes: undefined,
        nodeCount: sceneStore.get().nodes.length,
        target: target.current.toArray(),
      }),
    }
    const actions = { commit: commitHold, cancel: cancelHold }
    setBuildInteractionActions(actions)
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__buildEditor = hook
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      cancelHold()
      canvas.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown, true)
      const targetWindow = window as unknown as Record<string, unknown>
      if (targetWindow.__buildEditor === hook) delete targetWindow.__buildEditor
      setBuildInteractionActions(null)
      sceneStore.setBuildAimedId(null)
    }
    // Event owners are stable R3F objects; editor state is read from sceneStore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, scene])

  return (
    <>
      <group ref={marker} visible={false}>
        <mesh>
          <sphereGeometry args={[0.08, 8, 6]} />
          <meshBasicMaterial color="#a8ffb0" wireframe depthTest={false} />
        </mesh>
      </group>
      <SelectionBounds />
    </>
  )
}

function SelectionBounds() {
  const scene = useThree((state) => state.scene)
  const { selectedId, buildHoldingId } = useSceneEditor()
  const box = useMemo(() => new THREE.Box3(), [])
  const helper = useMemo(() => new THREE.Box3Helper(box, 0x87e89a), [box])

  useEffect(() => () => {
    helper.geometry.dispose()
    if (Array.isArray(helper.material)) helper.material.forEach((material) => material.dispose())
    else helper.material.dispose()
  }, [helper])

  useFrame(() => {
    const object = selectedId ? scene.getObjectByName(selectedId) : null
    if (!object) {
      helper.visible = false
      return
    }
    box.setFromObject(object)
    helper.visible = !box.isEmpty()
    if (helper.visible) {
      const material = helper.material
      if (!Array.isArray(material) && material instanceof THREE.LineBasicMaterial) {
        material.color.set(buildHoldingId ? 0xf0c76e : 0x87e89a)
      }
      helper.updateMatrixWorld(true)
    }
  })

  return <primitive object={helper} />
}
