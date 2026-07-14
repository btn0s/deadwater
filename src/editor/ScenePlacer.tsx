import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { sceneStore as editorStore } from '../engine/sceneStore'

/**
 * Placement raycasting for click-to-place and palette drag-and-drop.
 * Rays test the whole level (group name "level"), so assets land on walls,
 * shelves, and other props — not just the floor. A fallback y=0 plane
 * catches empty space.
 */
export function ScenePlacer() {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    const el = gl.domElement
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

    const hitPoint = (clientX: number, clientY: number): THREE.Vector3 | null => {
      const rect = el.getBoundingClientRect()
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const level = scene.getObjectByName('level')
      if (level) {
        const hits = raycaster.intersectObject(level, true)
        if (hits.length > 0) return hits[0].point
      }
      const p = new THREE.Vector3()
      return raycaster.ray.intersectPlane(floor, p) ? p : null
    }

    const place = (clientX: number, clientY: number, keepArmed: boolean) => {
      if (!editorStore.get().placing) return false
      const p = hitPoint(clientX, clientY)
      if (!p) return false
      editorStore.placeAt(p.x, p.y, p.z)
      if (!keepArmed) editorStore.setPlacing(null)
      return true
    }

    // click-to-place (left button, only while an asset is armed)
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      if (place(e.clientX, e.clientY, e.shiftKey)) {
        e.stopPropagation()
      }
    }
    // palette drag-and-drop
    const onDragOver = (e: DragEvent) => {
      if (editorStore.get().placing) e.preventDefault()
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      place(e.clientX, e.clientY, e.shiftKey)
    }

    // capture phase so placement wins over item-select handlers
    el.addEventListener('pointerdown', onPointerDown, true)
    el.addEventListener('dragover', onDragOver)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown, true)
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('drop', onDrop)
    }
  }, [gl, camera, scene])

  return null
}
