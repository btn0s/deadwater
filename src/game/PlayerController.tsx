import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { moveWithCollision } from './collision'
import { player } from './playerState'
import { play } from './audio'

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

  // fixed PS2 projection: 60° vertical FOV at 4:3, and `manual` so R3F's
  // resize handler never rewrites the aspect (the internal buffer is fixed-size)
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera & { manual?: boolean }
    cam.fov = 60
    cam.aspect = 4 / 3
    cam.near = 0.1
    cam.far = 120
    cam.manual = true
    cam.updateProjectionMatrix()
  }, [camera])

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
      player.locked = locked.current
      onLockChange?.(locked.current)
      if (!locked.current) keys.current = {}
    }

    const onClick = () => {
      if (!locked.current) canvas.requestPointerLock()
    }

    player.teleport = (x: number, z: number, newYaw?: number, newPitch?: number) => {
      pos.current.x = x
      pos.current.z = z
      vel.current.x = 0
      vel.current.z = 0
      if (newYaw !== undefined) yaw.current = newYaw
      if (newPitch !== undefined) pitch.current = newPitch
      player.x = x
      player.z = z
    }

    if (import.meta.env.DEV) {
      // escape hatch for automated testing: pointer lock is unavailable in
      // embedded/headless browsers
      ;(window as unknown as Record<string, unknown>).__playerPos = () => ({
        x: +pos.current.x.toFixed(2),
        z: +pos.current.z.toFixed(2),
        yaw: +yaw.current.toFixed(2),
      })
      ;(window as unknown as Record<string, unknown>).__teleport = player.teleport
      ;(window as unknown as Record<string, unknown>).__devLock = (v: boolean) => {
        locked.current = v
        player.locked = v
        onLockChange?.(v)
      }
    }

    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('pointerlockchange', onLock)
    canvas.addEventListener('click', onClick)
    onLock() // the menu's CLOCK IN locks before this controller mounts
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
    player.x = pos.current.x
    player.z = pos.current.z

    // jump / gravity
    if (grounded.current && locked.current && k.Space) {
      yVel.current = JUMP_SPEED
      grounded.current = false
      play('jump')
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
    player.grounded = grounded.current

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
