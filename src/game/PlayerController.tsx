import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { moveWithCollision } from './collision'

const EYE_HEIGHT = 1.65
const WALK_SPEED = 4.0
const RUN_SPEED = 6.4
const PLAYER_RADIUS = 0.35
const GROUND_ACCEL = 11 // exponential approach rate toward wish velocity
const AIR_ACCEL = 2.5
const GRAVITY = -14
const JUMP_SPEED = 4.6
const LOOK_SENSITIVITY = 0.0022
const MAX_PITCH = Math.PI / 2 - 0.05

interface Props {
  onLockChange?: (locked: boolean) => void
  spawn?: [number, number]
  initialYaw?: number
}

export function PlayerController({ onLockChange, spawn = [0, 8], initialYaw = 0 }: Props) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)

  const keys = useRef<Record<string, boolean>>({})
  const locked = useRef(false)
  const yaw = useRef(initialYaw)
  const pitch = useRef(0)
  const pos = useRef({ x: spawn[0], z: spawn[1] })
  const vel = useRef({ x: 0, z: 0 })
  const yOffset = useRef(0) // jump height above floor
  const yVel = useRef(0)
  const grounded = useRef(true)
  const bobTime = useRef(0)

  useEffect(() => {
    const canvas = gl.domElement

    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      keys.current[e.code] = down
      if (down && e.code === 'Space') e.preventDefault()
    }
    const keyDown = onKey(true)
    const keyUp = onKey(false)

    const onMouseMove = (e: MouseEvent) => {
      if (!locked.current) return
      yaw.current -= e.movementX * LOOK_SENSITIVITY
      pitch.current -= e.movementY * LOOK_SENSITIVITY
      pitch.current = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch.current))
    }

    const onLock = () => {
      locked.current = document.pointerLockElement === canvas
      onLockChange?.(locked.current)
      if (!locked.current) keys.current = {}
    }

    const onClick = () => {
      if (!locked.current) canvas.requestPointerLock()
    }

    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('pointerlockchange', onLock)
    canvas.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('pointerlockchange', onLock)
      canvas.removeEventListener('click', onClick)
    }
  }, [gl, onLockChange])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const k = keys.current

    // wish direction in world space from yaw
    let ix = 0
    let iz = 0
    if (k.KeyW) iz -= 1
    if (k.KeyS) iz += 1
    if (k.KeyA) ix -= 1
    if (k.KeyD) ix += 1
    const len = Math.hypot(ix, iz)
    const speed = k.ShiftLeft || k.ShiftRight ? RUN_SPEED : WALK_SPEED
    let wishX = 0
    let wishZ = 0
    if (len > 0 && locked.current) {
      const sin = Math.sin(yaw.current)
      const cos = Math.cos(yaw.current)
      wishX = ((ix * cos + iz * sin) / len) * speed
      wishZ = ((iz * cos - ix * sin) / len) * speed
    }

    // exponential velocity approach — reads like the analog-stick ramp of the era
    const accel = grounded.current ? GROUND_ACCEL : AIR_ACCEL
    const blend = 1 - Math.exp(-accel * dt)
    vel.current.x += (wishX - vel.current.x) * blend
    vel.current.z += (wishZ - vel.current.z) * blend

    moveWithCollision(pos.current, vel.current.x * dt, vel.current.z * dt, PLAYER_RADIUS)

    // jump / gravity
    if (grounded.current && locked.current && k.Space) {
      yVel.current = JUMP_SPEED
      grounded.current = false
    }
    if (!grounded.current) {
      yVel.current += GRAVITY * dt
      yOffset.current += yVel.current * dt
      if (yOffset.current <= 0) {
        yOffset.current = 0
        yVel.current = 0
        grounded.current = true
      }
    }

    // head bob, scaled by ground speed
    const planarSpeed = Math.hypot(vel.current.x, vel.current.z)
    const bobStrength = grounded.current ? Math.min(planarSpeed / WALK_SPEED, 1.6) : 0
    bobTime.current += dt * planarSpeed * 1.7
    const bobY = Math.sin(bobTime.current * 2) * 0.028 * bobStrength
    const bobX = Math.cos(bobTime.current) * 0.014 * bobStrength

    camera.rotation.order = 'YXZ'
    camera.rotation.set(pitch.current, yaw.current, 0)
    const strafeX = Math.cos(yaw.current) * bobX
    const strafeZ = -Math.sin(yaw.current) * bobX
    camera.position.set(
      pos.current.x + strafeX,
      EYE_HEIGHT + yOffset.current + bobY,
      pos.current.z + strafeZ,
    )
  })

  return null
}
