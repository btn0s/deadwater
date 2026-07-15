import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { moveWithCollision } from '../game/collision'
import { sceneStore } from '../engine/sceneStore'

const EYE_HEIGHT = 1.65
const WALK_SPEED = 4
const RUN_SPEED = 10
const FLY_SPEED = 8
const FLY_FAST_SPEED = 24
const PLAYER_RADIUS = 0.35
const LOOK_SENSITIVITY = 0.0022
const MAX_PITCH = Math.PI / 2 - 0.04

interface Props {
  onLockChange?: (locked: boolean) => void
  spawn?: [number, number]
  initialYaw?: number
}

/** Pointer-locked player-height navigation for the private build editor. */
export function BuildPlayerControls({
  onLockChange,
  spawn = [-18.3, 1.6],
  initialYaw = -1.35,
}: Props) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const keys = useRef<Record<string, boolean>>({})
  const locked = useRef(false)
  const yaw = useRef(initialYaw)
  const pitch = useRef(0)
  const position = useRef(new THREE.Vector3(spawn[0], EYE_HEIGHT, spawn[1]))
  const move = useRef(new THREE.Vector3())

  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera & { manual?: boolean }
    perspective.fov = 60
    perspective.near = 0.1
    perspective.far = 300
    perspective.manual = false
    perspective.updateProjectionMatrix()
    camera.position.copy(position.current)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(pitch.current, yaw.current, 0)
  }, [camera])

  useEffect(() => {
    const canvas = gl.domElement

    const publishLock = (next: boolean) => {
      locked.current = next
      if (!next) keys.current = {}
      sceneStore.setBuildLocked(next)
      onLockChange?.(next)
    }
    const onPointerLock = () => publishLock(document.pointerLockElement === canvas)
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || locked.current || sceneStore.get().buildPanel) return
      void canvas.requestPointerLock().catch(() => {})
    }
    const onMouseMove = (event: MouseEvent) => {
      if (!locked.current) return
      yaw.current -= event.movementX * LOOK_SENSITIVITY
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - event.movementY * LOOK_SENSITIVITY,
        -MAX_PITCH,
        MAX_PITCH,
      )
    }
    const setKey = (down: boolean) => (event: KeyboardEvent) => {
      if (down && !locked.current) return
      keys.current[event.code] = down
      if (locked.current && event.code === 'Space') event.preventDefault()
    }
    const onKeyDown = setKey(true)
    const onKeyUp = setKey(false)
    const clearKeys = () => {
      keys.current = {}
    }

    const hook = {
      pose: () => ({
        x: +position.current.x.toFixed(2),
        y: +position.current.y.toFixed(2),
        z: +position.current.z.toFixed(2),
        yaw: +yaw.current.toFixed(3),
        pitch: +pitch.current.toFixed(3),
        locked: locked.current,
      }),
      teleport: (x: number, y: number, z: number, nextYaw = yaw.current, nextPitch = pitch.current) => {
        position.current.set(x, y, z)
        yaw.current = nextYaw
        pitch.current = nextPitch
      },
      lock: (next: boolean) => publishLock(next),
    }
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__buildPlayer = hook
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('pointerlockchange', onPointerLock)
    document.addEventListener('mousemove', onMouseMove)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', clearKeys)
    document.addEventListener('visibilitychange', clearKeys)
    onPointerLock()
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('pointerlockchange', onPointerLock)
      document.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', clearKeys)
      document.removeEventListener('visibilitychange', clearKeys)
      const target = window as unknown as Record<string, unknown>
      if (target.__buildPlayer === hook) delete target.__buildPlayer
      sceneStore.setBuildLocked(false)
    }
  }, [gl, onLockChange])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const key = keys.current
    const forward = (key.KeyS ? 1 : 0) - (key.KeyW ? 1 : 0)
    const strafe = (key.KeyD ? 1 : 0) - (key.KeyA ? 1 : 0)
    const length = Math.hypot(strafe, forward)
    const mode = sceneStore.get().buildMoveMode
    const fast = key.ShiftLeft || key.ShiftRight

    if (length > 0 && locked.current) {
      const speed = mode === 'fly'
        ? (fast ? FLY_FAST_SPEED : FLY_SPEED)
        : (fast ? RUN_SPEED : WALK_SPEED)
      const sin = Math.sin(yaw.current)
      const cos = Math.cos(yaw.current)
      const dx = ((strafe * cos + forward * sin) / length) * speed * dt
      const dz = ((forward * cos - strafe * sin) / length) * speed * dt
      if (mode === 'walk') {
        moveWithCollision(position.current, dx, dz, PLAYER_RADIUS)
      } else {
        position.current.x += dx
        position.current.z += dz
      }
    }

    if (mode === 'fly' && locked.current) {
      const vertical = (key.Space ? 1 : 0) - (key.KeyC ? 1 : 0)
      const speed = fast ? FLY_FAST_SPEED : FLY_SPEED
      position.current.y += vertical * speed * dt
    } else if (mode === 'walk') {
      position.current.y = EYE_HEIGHT
    }

    move.current.copy(position.current)
    camera.position.copy(move.current)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(pitch.current, yaw.current, 0)
  })

  return null
}
