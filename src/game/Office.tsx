import { useEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { CuboidCollider } from '@react-three/rapier'
import {
  createPS2Material,
  prepTexture,
  rawColorFromString,
  lightPositions,
  lightColors,
  lightRadii,
  lightSpots,
} from '../ps2/PS2Material'
import { addCollider } from './collision'

/*
 * Dock office centered on the west wall, opposite the bay doors. Uses the
 * building's west wall as its back; we build north/south walls, the east
 * wall (door + window band facing the floor), and a flat roof at 3m.
 *
 *   x -20..-15.8, z -2.9..2.9; door on the east wall at z -2.2..-1.2
 */

const X0 = -20
const X1 = -15.8
const CXO = (X0 + X1) / 2
const Z0 = -2.9
const Z1 = 2.9
const H = 3
const LIGHT_INDEX = 10

const DESK_H = 0.74

/** L-shaped corner desk built from primitives: one arm under the east
 * window, one along the south wall, meeting in the SE interior corner. */
function CornerDesk() {
  const topMaterial = useMemo(() => createPS2Material({ color: 0x8a6f4d }), [])
  const frameMaterial = useMemo(() => createPS2Material({ color: 0x3a3d40 }), [])

  // arm along the east wall (under the window): z 0.4..2.84
  // arm along the south wall: x -18.3..-16.6
  useEffect(() => {
    const removers = [
      addCollider({ minX: -16.62, maxX: -15.86, minZ: 0.4, maxZ: 2.84 }),
      addCollider({ minX: -18.3, maxX: -16.6, minZ: 2.1, maxZ: 2.84 }),
    ]
    return () => removers.forEach((r) => r())
  }, [])

  return (
    <group>
      <mesh material={topMaterial} position={[-16.24, DESK_H, 1.62]}>
        <boxGeometry args={[0.76, 0.06, 2.44]} />
      </mesh>
      <mesh material={topMaterial} position={[-17.45, DESK_H, 2.47]}>
        <boxGeometry args={[1.7, 0.06, 0.74]} />
      </mesh>
      {/* panel legs */}
      <mesh material={frameMaterial} position={[-16.24, DESK_H / 2, 0.45]}>
        <boxGeometry args={[0.72, DESK_H, 0.05]} />
      </mesh>
      <mesh material={frameMaterial} position={[-18.26, DESK_H / 2, 2.47]}>
        <boxGeometry args={[0.05, DESK_H, 0.7]} />
      </mesh>
      <mesh material={frameMaterial} position={[-16.24, DESK_H / 2, 2.6]}>
        <boxGeometry args={[0.72, DESK_H, 0.05]} />
      </mesh>
      {/* solid desk mass for physics so junk rests on top */}
      <CuboidCollider args={[0.38, DESK_H / 2 + 0.03, 1.22]} position={[-16.24, DESK_H / 2, 1.62]} />
      <CuboidCollider args={[0.85, DESK_H / 2 + 0.03, 0.37]} position={[-17.45, DESK_H / 2, 2.47]} />
    </group>
  )
}

export function Office() {
  const plaster = useTexture('/textures/Plaster001.jpg', prepTexture)
  const wallMaterial = useMemo(
    () => createPS2Material({ map: plaster, repeat: [2.5, 1.8], color: 0xaebdaa }),
    [plaster],
  )
  const trimMaterial = useMemo(() => createPS2Material({ color: 0x474b4f }), [])

  // interior light — no oversized fixture prop, just the light itself
  useEffect(() => {
    lightPositions[LIGHT_INDEX].set(CXO, 2.55, 0)
    lightColors[LIGHT_INDEX].copy(rawColorFromString('#e8dcc0')).multiplyScalar(0.9)
    lightRadii[LIGHT_INDEX] = 7.5
    lightSpots[LIGHT_INDEX] = 1
  }, [])

  // player blocking: north/south walls solid; east wall split around the door
  useEffect(() => {
    const removers = [
      addCollider({ minX: X0, maxX: X1, minZ: Z0 - 0.06, maxZ: Z0 + 0.06 }),
      addCollider({ minX: X0, maxX: X1, minZ: Z1 - 0.06, maxZ: Z1 + 0.06 }),
      addCollider({ minX: X1 - 0.06, maxX: X1 + 0.06, minZ: Z0, maxZ: -2.2 }),
      addCollider({ minX: X1 - 0.06, maxX: X1 + 0.06, minZ: -1.2, maxZ: Z1 }),
    ]
    return () => removers.forEach((r) => r())
  }, [])

  return (
    <group>
      {/* ---- north wall: window band x -19..-17 ---- */}
      <mesh material={wallMaterial} position={[CXO, 0.5, Z0]}>
        <boxGeometry args={[X1 - X0, 1, 0.12]} />
      </mesh>
      <mesh material={wallMaterial} position={[CXO, 2.6, Z0]}>
        <boxGeometry args={[X1 - X0, 0.8, 0.12]} />
      </mesh>
      <mesh material={wallMaterial} position={[-19.5, 1.6, Z0]}>
        <boxGeometry args={[1, 1.2, 0.12]} />
      </mesh>
      <mesh material={wallMaterial} position={[-16.4, 1.6, Z0]}>
        <boxGeometry args={[1.2, 1.2, 0.12]} />
      </mesh>
      <mesh material={trimMaterial} position={[-18, 1.6, Z0]}>
        <boxGeometry args={[0.06, 1.2, 0.08]} />
      </mesh>

      {/* ---- south wall: solid ---- */}
      <mesh material={wallMaterial} position={[CXO, H / 2, Z1]}>
        <boxGeometry args={[X1 - X0, H, 0.12]} />
      </mesh>

      {/* ---- east wall: door (z -2.2..-1.2) + window (z -0.3..1.7) ---- */}
      <mesh material={wallMaterial} position={[X1, 1.5, -2.55]}>
        <boxGeometry args={[0.12, H, 0.7]} />
      </mesh>
      <mesh material={wallMaterial} position={[X1, 2.6, -1.7]}>
        <boxGeometry args={[0.12, 0.8, 1]} />
      </mesh>
      <mesh material={wallMaterial} position={[X1, 1.5, -0.75]}>
        <boxGeometry args={[0.12, H, 0.9]} />
      </mesh>
      <mesh material={wallMaterial} position={[X1, 0.5, 0.7]}>
        <boxGeometry args={[0.12, 1, 2]} />
      </mesh>
      <mesh material={wallMaterial} position={[X1, 2.6, 0.7]}>
        <boxGeometry args={[0.12, 0.8, 2]} />
      </mesh>
      <mesh material={wallMaterial} position={[X1, 1.5, 2.3]}>
        <boxGeometry args={[0.12, H, 1.2]} />
      </mesh>
      <mesh material={trimMaterial} position={[X1, 1.6, 0.7]}>
        <boxGeometry args={[0.08, 1.2, 0.06]} />
      </mesh>

      {/* flat roof */}
      <mesh material={trimMaterial} position={[CXO, H + 0.07, (Z0 + Z1) / 2]}>
        <boxGeometry args={[X1 - X0 + 0.15, 0.15, Z1 - Z0 + 0.15]} />
      </mesh>

      {/* interior — L-shaped corner desk against the window wall, in the
          corner opposite the door */}
      <CornerDesk />

      {/* physics shell (window bays stay solid — call it glass) */}
      <CuboidCollider args={[(X1 - X0) / 2, H / 2, 0.06]} position={[CXO, H / 2, Z0]} />
      <CuboidCollider args={[(X1 - X0) / 2, H / 2, 0.06]} position={[CXO, H / 2, Z1]} />
      <CuboidCollider args={[0.06, H / 2, 0.35]} position={[X1, H / 2, -2.55]} />
      <CuboidCollider args={[0.06, H / 2, 2.05]} position={[X1, H / 2, 0.85]} />
      <CuboidCollider args={[(X1 - X0) / 2, 0.08, (Z1 - Z0) / 2]} position={[CXO, H + 0.07, (Z0 + Z1) / 2]} />
    </group>
  )
}
