import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createPS2Material } from '../ps2/PS2Material'
import { moveWithCollision } from './collision'
import { player } from './playerState'
import { mulberry32 } from './rand'

// room interior bounds for waypoint picking
const BOUND_X = 19.2
const BOUND_Z = 11.2
const WALL_MARGIN = 1.4 // rats prefer running within this distance of a wall
const RAT_RADIUS = 0.08
const FLEE_DIST_SQ = 2.6 * 2.6
const AVOID_TARGET_DIST_SQ = 3.5 * 3.5
const ARRIVE_DIST_SQ = 0.05

interface RatState {
  phase: 'idle' | 'dash'
  timer: number
  target: { x: number; z: number }
  yaw: number
  speed: number
  runTime: number
  fleeCooldown: number
}

interface RatProps {
  seed: number
  spawn: [number, number]
}

/** Low-poly scurrying rat: dark body, bead head, wire tail — pure set dressing. */
export function Rat({ seed, spawn }: RatProps) {
  const group = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const rand = useMemo(() => mulberry32(seed), [seed])

  const material = useMemo(() => createPS2Material({ color: 0x453c33 }), [])

  const state = useRef<RatState>({
    phase: 'idle',
    timer: 0.5 + seed % 3,
    target: { x: spawn[0], z: spawn[1] },
    yaw: 0,
    speed: 2.6,
    runTime: 0,
    fleeCooldown: 0,
  })
  const pos = useRef({ x: spawn[0], z: spawn[1] })

  const pickTarget = (fleeFrom?: { x: number; z: number }) => {
    const s = state.current
    if (fleeFrom) {
      const dx = pos.current.x - fleeFrom.x
      const dz = pos.current.z - fleeFrom.z
      const len = Math.hypot(dx, dz) || 1
      s.target.x = THREE.MathUtils.clamp(pos.current.x + (dx / len) * (3 + rand() * 2), -BOUND_X, BOUND_X)
      s.target.z = THREE.MathUtils.clamp(pos.current.z + (dz / len) * (3 + rand() * 2), -BOUND_Z, BOUND_Z)
      s.speed = 3.8 + rand()
    } else {
      // wander, but never toward the player: re-roll waypoints that land close
      for (let attempt = 0; attempt < 6; attempt++) {
        if (rand() < 0.65) {
          // hug a wall: pick a point in the perimeter band
          const alongX = rand() < 0.5
          if (alongX) {
            s.target.x = -BOUND_X + rand() * BOUND_X * 2
            s.target.z = (BOUND_Z - rand() * WALL_MARGIN) * (rand() < 0.5 ? -1 : 1)
          } else {
            s.target.x = (BOUND_X - rand() * WALL_MARGIN) * (rand() < 0.5 ? -1 : 1)
            s.target.z = -BOUND_Z + rand() * BOUND_Z * 2
          }
        } else {
          s.target.x = -BOUND_X + rand() * BOUND_X * 2
          s.target.z = -BOUND_Z + rand() * BOUND_Z * 2
        }
        const tdx = s.target.x - player.x
        const tdz = s.target.z - player.z
        if (tdx * tdx + tdz * tdz > AVOID_TARGET_DIST_SQ) break
      }
      s.speed = 2.4 + rand() * 1.2
    }
    s.phase = 'dash'
    s.runTime = 0
  }

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const s = state.current
    const p = pos.current

    // player too close? bolt — even mid-dash, unless we just did
    s.fleeCooldown -= dt
    const pdx = p.x - player.x
    const pdz = p.z - player.z
    if (pdx * pdx + pdz * pdz < FLEE_DIST_SQ && s.fleeCooldown <= 0) {
      pickTarget({ x: player.x, z: player.z })
      s.fleeCooldown = 0.5
    }

    if (s.phase === 'idle') {
      s.timer -= dt
      if (s.timer <= 0) pickTarget()
    } else {
      const dx = s.target.x - p.x
      const dz = s.target.z - p.z
      const distSq = dx * dx + dz * dz
      if (distSq < ARRIVE_DIST_SQ) {
        s.phase = 'idle'
        s.timer = 0.4 + rand() * 2.2
      } else {
        const len = Math.sqrt(distSq)
        const desiredYaw = Math.atan2(-dz, dx)
        // quick snappy turn
        let dy = desiredYaw - s.yaw
        dy = Math.atan2(Math.sin(dy), Math.cos(dy))
        s.yaw += dy * Math.min(1, 14 * dt)
        const step = Math.min(s.speed * dt, len)
        const before = { x: p.x, z: p.z }
        moveWithCollision(p, (dx / len) * step, (dz / len) * step, RAT_RADIUS)
        s.runTime += dt
        // stuck against something? give up and re-roll
        if (Math.hypot(p.x - before.x, p.z - before.z) < step * 0.2) {
          s.phase = 'idle'
          s.timer = 0.2 + rand() * 0.6
        }
        if (s.runTime > 6) {
          s.phase = 'idle'
          s.timer = 0.5
        }
      }
    }

    if (group.current) {
      group.current.position.set(p.x, 0, p.z)
      group.current.rotation.y = s.yaw
    }
    if (body.current) {
      // gallop bounce while dashing, faint sniffing bob while idle
      body.current.position.y =
        s.phase === 'dash'
          ? Math.abs(Math.sin(s.runTime * 16)) * 0.014
          : Math.sin(s.timer * 7) * 0.003
    }
  })

  return (
    <group ref={group} position={[spawn[0], 0, spawn[1]]}>
      <group ref={body}>
        {/* body */}
        <mesh material={material} position={[0, 0.07, 0]} scale={[1.7, 0.9, 1]}>
          <sphereGeometry args={[0.085, 6, 5]} />
        </mesh>
        {/* head */}
        <mesh material={material} position={[0.15, 0.06, 0]} scale={[1.5, 0.9, 0.9]}>
          <sphereGeometry args={[0.045, 5, 4]} />
        </mesh>
        {/* ears */}
        <mesh material={material} position={[0.15, 0.105, 0.028]}>
          <sphereGeometry args={[0.017, 4, 3]} />
        </mesh>
        <mesh material={material} position={[0.15, 0.105, -0.028]}>
          <sphereGeometry args={[0.017, 4, 3]} />
        </mesh>
        {/* tail */}
        <mesh material={material} position={[-0.24, 0.055, 0]} rotation={[0, 0, Math.PI / 2 - 0.12]}>
          <cylinderGeometry args={[0.005, 0.011, 0.24, 4]} />
        </mesh>
      </group>
    </group>
  )
}
