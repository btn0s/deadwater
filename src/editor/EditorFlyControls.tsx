import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { sceneStore as editorStore } from '../engine/sceneStore'

const LOOK_SPEED = 0.0032
const BASE_SPEED = 8
const FAST_MULT = 3.2
const MAX_PITCH = Math.PI / 2 - 0.03

/**
 * Unreal-style editor fly cam: hold RIGHT mouse to look; while held, WASD
 * moves (view-relative), Q/E go down/up, shift is turbo. No roll, ever —
 * yaw/pitch only, so the horizon stays level (unlike three's FlyControls).
 * With the mouse up, all keys are free for editor hotkeys.
 */
export function EditorFlyControls() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const keys = useRef<Record<string, boolean>>({})
  const look = useRef({ yaw: 0, pitch: 0, active: false })

  useEffect(() => {
    const el = gl.domElement

    // adopt the camera's current orientation so engaging fly doesn't snap
    const syncFromCamera = () => {
      const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
      look.current.yaw = e.y
      look.current.pitch = e.x
    }

    const onContext = (e: Event) => e.preventDefault()
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 2) return
      syncFromCamera()
      look.current.active = true
      editorStore.setFlying(true)
      el.setPointerCapture(e.pointerId)
    }
    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 2) return
      look.current.active = false
      editorStore.setFlying(false)
      keys.current = {}
      el.releasePointerCapture(e.pointerId)
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!look.current.active) return
      look.current.yaw -= e.movementX * LOOK_SPEED
      look.current.pitch = THREE.MathUtils.clamp(look.current.pitch - e.movementY * LOOK_SPEED, -MAX_PITCH, MAX_PITCH)
    }
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      if (look.current.active) {
        keys.current[e.code] = down
        e.preventDefault()
      } else if (!down) {
        keys.current[e.code] = false
      }
    }
    const kd = onKey(true)
    const ku = onKey(false)

    el.addEventListener('contextmenu', onContext)
    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    return () => {
      el.removeEventListener('contextmenu', onContext)
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      editorStore.setFlying(false)
    }
  }, [camera, gl])

  useFrame((_, rawDt) => {
    const l = look.current
    if (!l.active) return
    const dt = Math.min(rawDt, 0.05)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(l.pitch, l.yaw, 0)

    const k = keys.current
    const speed = (k.ShiftLeft || k.ShiftRight ? BASE_SPEED * FAST_MULT : BASE_SPEED) * dt
    const move = new THREE.Vector3(
      (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0),
      (k.KeyE ? 1 : 0) - (k.KeyQ ? 1 : 0),
      (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0),
    )
    if (move.lengthSq() === 0) return
    move.normalize().multiplyScalar(speed)
    // WASD view-relative, Q/E world-vertical
    const vertical = move.y
    move.y = 0
    move.applyQuaternion(camera.quaternion)
    move.y += vertical
    camera.position.add(move)
  })

  return null
}
