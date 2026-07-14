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
import { Prop, MODELS } from './Prop'
import { PaperWad } from './PaperWad'

/*
 * Dock office in the SW corner, opposite the bay doors. Uses the warehouse's
 * west and south walls; we build the north wall (window band), the east wall
 * (door + window band), and a flat roof at 3m.
 *
 *   x -20..-15.8, z 6.2..12, door on the east wall at z 6.9..7.9
 */

const X0 = -20
const X1 = -15.8
const CXO = (X0 + X1) / 2
const Z0 = 6.2
const Z1 = 12
const H = 3
const LIGHT_INDEX = 10

export function Office() {
  const plaster = useTexture('/textures/Plaster001.jpg', prepTexture)
  const wallMaterial = useMemo(
    () => createPS2Material({ map: plaster, repeat: [2.5, 1.8], color: 0xaebdaa }),
    [plaster],
  )
  const trimMaterial = useMemo(() => createPS2Material({ color: 0x474b4f }), [])

  // interior light
  useEffect(() => {
    lightPositions[LIGHT_INDEX].set(CXO, 2.55, 9.2)
    lightColors[LIGHT_INDEX].copy(rawColorFromString('#e8dcc0')).multiplyScalar(0.9)
    lightRadii[LIGHT_INDEX] = 7.5
    lightSpots[LIGHT_INDEX] = 1
  }, [])

  // player blocking: north wall solid; east wall split around the door
  useEffect(() => {
    const removers = [
      addCollider({ minX: X0, maxX: X1, minZ: Z0 - 0.06, maxZ: Z0 + 0.06 }),
      addCollider({ minX: X1 - 0.06, maxX: X1 + 0.06, minZ: Z0, maxZ: 6.9 }),
      addCollider({ minX: X1 - 0.06, maxX: X1 + 0.06, minZ: 7.9, maxZ: Z1 }),
    ]
    return () => removers.forEach((r) => r())
  }, [])

  return (
    <group>
      {/* ---- north wall: sill, header, piers around the window (x -19..-17) ---- */}
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
      {/* window mullion */}
      <mesh material={trimMaterial} position={[-18, 1.6, Z0]}>
        <boxGeometry args={[0.06, 1.2, 0.08]} />
      </mesh>

      {/* ---- east wall: door (z 6.9..7.9) + window (z 9..11) ---- */}
      <mesh material={wallMaterial} position={[X1, 1.5, 6.55]}>
        <boxGeometry args={[0.12, H, 0.7]} />
      </mesh>
      <mesh material={wallMaterial} position={[X1, 2.6, 7.4]}>
        <boxGeometry args={[0.12, 0.8, 1]} />
      </mesh>
      <mesh material={wallMaterial} position={[X1, 1.5, 8.45]}>
        <boxGeometry args={[0.12, H, 1.1]} />
      </mesh>
      <mesh material={wallMaterial} position={[X1, 0.5, 10]}>
        <boxGeometry args={[0.12, 1, 2]} />
      </mesh>
      <mesh material={wallMaterial} position={[X1, 2.6, 10]}>
        <boxGeometry args={[0.12, 0.8, 2]} />
      </mesh>
      <mesh material={wallMaterial} position={[X1, 1.5, 11.5]}>
        <boxGeometry args={[0.12, H, 1]} />
      </mesh>
      <mesh material={trimMaterial} position={[X1, 1.6, 10]}>
        <boxGeometry args={[0.08, 1.2, 0.06]} />
      </mesh>

      {/* flat roof */}
      <mesh material={trimMaterial} position={[CXO, H + 0.07, (Z0 + Z1) / 2]}>
        <boxGeometry args={[X1 - X0 + 0.15, 0.15, Z1 - Z0 + 0.15]} />
      </mesh>

      {/* interior */}
      <Prop url={MODELS.hangingLamp} position={[CXO, H, 9.2]} collide={false} physics="none" />
      <Prop url={MODELS.table} position={[-18.6, 0, 9.8]} rotationY={0.15} />
      <Prop url={MODELS.chair} position={[-17.6, 0, 9.1]} rotationY={-1.9} collide={false} grabbable />
      <Prop url={MODELS.binder} position={[-18.6, 0.78, 9.6]} rotationY={0.5} collide={false} grabbable />
      <Prop url={MODELS.cabinet} position={[-16.7, 0, 11.4]} rotationY={Math.PI} />
      <Prop url={MODELS.canRusted} position={[-19.3, 0, 7]} rotationY={2.2} collide={false} grabbable />
      <PaperWad position={[-17.2, 0, 8.3]} seed={91} size={0.08} />
      <PaperWad position={[-19, 0, 10.9]} seed={97} size={0.09} />

      {/* physics shell (window bays stay solid — call it glass) */}
      <CuboidCollider args={[(X1 - X0) / 2, H / 2, 0.06]} position={[CXO, H / 2, Z0]} />
      <CuboidCollider args={[0.06, H / 2, 0.35]} position={[X1, H / 2, 6.55]} />
      <CuboidCollider args={[0.06, H / 2, 2.05]} position={[X1, H / 2, 9.95]} />
      <CuboidCollider args={[(X1 - X0) / 2, 0.08, (Z1 - Z0) / 2]} position={[CXO, H + 0.07, (Z0 + Z1) / 2]} />
    </group>
  )
}
