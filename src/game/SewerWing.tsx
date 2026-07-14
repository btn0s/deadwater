import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import {
  createPS2Material,
  prepTexture,
  rawColorFromString,
  lightPositions,
  lightColors,
  lightRadii,
  lightSpots,
} from '../ps2/PS2Material'
import { Surface } from './Surface'
import { addCollider } from './collision'
import { Prop, MODELS } from './Prop'

/*
 * Layout (top view; main warehouse is south, z increases downward):
 *
 *   z=-34  ┌──────────────────────────┐
 *          │  north platform          │
 *   z=-29  ├───────[ channel ]────────┤   water flows east
 *   z=-25  ├──────────────────────────┤
 *          │  south platform          │
 *   z=-20  └───────┐      ┌───────────┘
 *                  │ hall │               x=-11.5..-8.5
 *   z=-12  ────────┘      └──────────  main warehouse north wall
 */

// hallway
const HALL_X0 = -11.5
const HALL_X1 = -8.5
const HALL_CX = (HALL_X0 + HALL_X1) / 2
const HALL_Z0 = -20
const HALL_Z1 = -12
const HALL_CZ = (HALL_Z0 + HALL_Z1) / 2
const HALL_H = 3

// sewer room
const X0 = -22
const X1 = 2
const CX = (X0 + X1) / 2
const RW = X1 - X0 // 24
const Z0 = -34
const Z1 = -20
const CZ = (Z0 + Z1) / 2
const RD = Z1 - Z0 // 14
const H = 5

// channel
const CH_Z0 = -29
const CH_Z1 = -25
const CH_CZ = (CH_Z0 + CH_Z1) / 2
const CH_W = CH_Z1 - CH_Z0 // 4
const CH_DEPTH = 1.5
const WATER_Y = -0.95

// grate bridge across the channel
const BRIDGE_CX = 0
const BRIDGE_W = 2

/** murky sewage water: procedural streaky tile, scrolled along the channel */
function makeWaterTexture(): THREE.DataTexture {
  const size = 64
  const data = new Uint8Array(size * size * 4)
  const base = [24, 46, 42]
  const crest = [96, 138, 118]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s =
        Math.sin(x * 0.35 + Math.sin(y * 0.45) * 2.2) +
        Math.sin((x + y * 2.3) * 0.16) +
        Math.sin(y * 0.55 + Math.sin(x * 0.22) * 1.7)
      const t = Math.pow(THREE.MathUtils.clamp(s / 3 + 0.5, 0, 1), 1.6)
      const i = (y * size + x) * 4
      data[i] = base[0] + (crest[0] - base[0]) * t
      data[i + 1] = base[1] + (crest[1] - base[1]) * t
      data[i + 2] = base[2] + (crest[2] - base[2]) * t
      data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, size, size)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapNearestFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

function SewerLights() {
  useEffect(() => {
    const set = (i: number, x: number, y: number, z: number, hex: string, intensity: number, radius: number) => {
      lightPositions[i].set(x, y, z)
      lightColors[i].copy(rawColorFromString(hex)).multiplyScalar(intensity)
      lightRadii[i] = radius
      lightSpots[i] = 1
    }
    set(6, HALL_CX, 2.4, HALL_CZ, '#d8e6c8', 0.9, 9)
    set(7, CX, 4.2, -22.5, '#d8e6c8', 1.1, 14)
    set(8, CX, 4.2, -31.5, '#cfe0c0', 1.0, 14)
    set(9, -16, 3.0, CH_CZ, '#9fd8a8', 0.7, 11) // sickly green over the water
  }, [])
  return null
}

/** vertical bars over the channel outfall openings */
function Grate({ x, facing }: { x: number; facing: 1 | -1 }) {
  const barMaterial = useMemo(() => createPS2Material({ color: 0x33363a }), [])
  const bars = []
  for (let z = CH_Z0 + 0.25; z < CH_Z1; z += 0.36) {
    bars.push(
      <mesh key={z} material={barMaterial} position={[x + facing * 0.1, -0.45, z]}>
        <boxGeometry args={[0.06, 2.3, 0.06]} />
      </mesh>,
    )
  }
  return <group>{bars}</group>
}

export function SewerWing() {
  const textures = useTexture(
    {
      wall: '/textures/Concrete036.jpg',
      floor: '/textures/Concrete034.jpg',
      steel: '/textures/CorrugatedSteel005.jpg',
      plates: '/textures/MetalPlates006.jpg',
      danger: '/textures/PaintedMetal017.jpg',
    },
    (loaded) => Object.values(loaded).forEach(prepTexture),
  )

  const waterMaterial = useMemo(
    () => createPS2Material({ map: makeWaterTexture(), repeat: [6, 2] }),
    [],
  )
  const pipeMaterial = useMemo(
    () => createPS2Material({ map: textures.plates, repeat: [6, 1] }),
    [textures.plates],
  )
  const voidMaterial = useMemo(() => createPS2Material({ color: 0x000000, fullbright: true }), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const offset = waterMaterial.uniforms.uUvOffset.value as THREE.Vector2
    offset.x = t * 0.045 // slow drift toward the east grate
    offset.y = Math.sin(t * 0.4) * 0.015
  })

  // player-blocking AABBs for the wing
  useEffect(() => {
    const removers = [
      // hallway walls
      addCollider({ minX: HALL_X0 - 0.5, maxX: HALL_X0, minZ: HALL_Z0 - 0.5, maxZ: HALL_Z1 }),
      addCollider({ minX: HALL_X1, maxX: HALL_X1 + 0.5, minZ: HALL_Z0 - 0.5, maxZ: HALL_Z1 }),
      // sewer south wall segments flanking the hallway
      addCollider({ minX: X0, maxX: HALL_X0, minZ: Z1 - 0.5, maxZ: Z1 }),
      addCollider({ minX: HALL_X1, maxX: X1, minZ: Z1 - 0.5, maxZ: Z1 }),
      // perimeter
      addCollider({ minX: X0 - 0.5, maxX: X0, minZ: Z0, maxZ: Z1 }),
      addCollider({ minX: X1, maxX: X1 + 0.5, minZ: Z0, maxZ: Z1 }),
      addCollider({ minX: X0, maxX: X1, minZ: Z0 - 0.5, maxZ: Z0 }),
      // channel curbs, with a gap for the bridge
      addCollider({ minX: X0, maxX: BRIDGE_CX - BRIDGE_W / 2, minZ: CH_Z1 - 0.15, maxZ: CH_Z1 + 0.05 }),
      addCollider({ minX: BRIDGE_CX + BRIDGE_W / 2, maxX: X1, minZ: CH_Z1 - 0.15, maxZ: CH_Z1 + 0.05 }),
      addCollider({ minX: X0, maxX: BRIDGE_CX - BRIDGE_W / 2, minZ: CH_Z0 - 0.05, maxZ: CH_Z0 + 0.15 }),
      addCollider({ minX: BRIDGE_CX + BRIDGE_W / 2, maxX: X1, minZ: CH_Z0 - 0.05, maxZ: CH_Z0 + 0.15 }),
      // bridge side rails
      addCollider({ minX: BRIDGE_CX - BRIDGE_W / 2 - 0.2, maxX: BRIDGE_CX - BRIDGE_W / 2, minZ: CH_Z0, maxZ: CH_Z1 }),
      addCollider({ minX: BRIDGE_CX + BRIDGE_W / 2, maxX: BRIDGE_CX + BRIDGE_W / 2 + 0.2, minZ: CH_Z0, maxZ: CH_Z1 }),
    ]
    return () => removers.forEach((r) => r())
  }, [])

  return (
    <group>
      <SewerLights />

      {/* ---------- hallway ---------- */}
      <Surface size={[3, 8]} segments={[4, 8]} position={[HALL_CX, 0, HALL_CZ]} rotation={[-Math.PI / 2, 0, 0]} map={textures.floor} repeat={[2, 5]} color={0x6e6e6e} />
      <Surface size={[3, 8]} segments={[4, 8]} position={[HALL_CX, HALL_H, HALL_CZ]} rotation={[Math.PI / 2, 0, 0]} map={textures.steel} repeat={[2, 5]} color={0xb4b4b4} />
      <Surface size={[8, HALL_H]} segments={[8, 4]} position={[HALL_X0, HALL_H / 2, HALL_CZ]} rotation={[0, Math.PI / 2, 0]} map={textures.wall} repeat={[4, 1.5]} bombing={1} />
      <Surface size={[8, HALL_H]} segments={[8, 4]} position={[HALL_X1, HALL_H / 2, HALL_CZ]} rotation={[0, -Math.PI / 2, 0]} map={textures.wall} repeat={[4, 1.5]} bombing={1} />
      <Prop url={MODELS.hangingLamp} position={[HALL_CX, HALL_H, HALL_CZ]} collide={false} physics="none" />

      {/* ---------- sewer room shell ---------- */}
      {/* platforms */}
      <Surface size={[RW, 5]} segments={[24, 5]} position={[CX, 0, -22.5]} rotation={[-Math.PI / 2, 0, 0]} map={textures.floor} repeat={[8, 2]} color={0x686868} bombing={1} />
      <Surface size={[RW, 5]} segments={[24, 5]} position={[CX, 0, -31.5]} rotation={[-Math.PI / 2, 0, 0]} map={textures.floor} repeat={[8, 2]} color={0x686868} bombing={1} />
      {/* ceiling */}
      <Surface size={[RW, RD]} segments={[24, 14]} position={[CX, H, CZ]} rotation={[Math.PI / 2, 0, 0]} map={textures.steel} repeat={[12, 7]} color={0x9c9c9c} bombing={1} />
      {/* walls */}
      <Surface size={[10.5, H]} segments={[11, 6]} position={[(X0 + HALL_X0) / 2, H / 2, Z1]} rotation={[0, Math.PI, 0]} map={textures.wall} repeat={[5, 2]} bombing={1} />
      <Surface size={[10.5, H]} segments={[11, 6]} position={[(HALL_X1 + X1) / 2, H / 2, Z1]} rotation={[0, Math.PI, 0]} map={textures.wall} repeat={[5, 2]} bombing={1} />
      <Surface size={[3, H - HALL_H]} segments={[3, 2]} position={[HALL_CX, (H + HALL_H) / 2, Z1]} rotation={[0, Math.PI, 0]} map={textures.wall} repeat={[1.5, 0.8]} />
      <Surface size={[RW, H]} segments={[24, 6]} position={[CX, H / 2, Z0]} map={textures.wall} repeat={[10, 2]} bombing={1} />
      <Surface size={[RD, H]} segments={[14, 6]} position={[X0, H / 2, CZ]} rotation={[0, Math.PI / 2, 0]} map={textures.wall} repeat={[6, 2]} bombing={1} />
      <Surface size={[RD, H]} segments={[14, 6]} position={[X1, H / 2, CZ]} rotation={[0, -Math.PI / 2, 0]} map={textures.wall} repeat={[6, 2]} bombing={1} />

      {/* ---------- channel ---------- */}
      <Surface size={[RW, CH_W]} segments={[24, 4]} position={[CX, -CH_DEPTH, CH_CZ]} rotation={[-Math.PI / 2, 0, 0]} map={textures.floor} repeat={[10, 1.5]} color={0x4a4a4a} />
      <Surface size={[RW, CH_DEPTH]} segments={[24, 2]} position={[CX, -CH_DEPTH / 2, CH_Z1]} rotation={[0, Math.PI, 0]} map={textures.wall} repeat={[10, 0.6]} color={0x777777} />
      <Surface size={[RW, CH_DEPTH]} segments={[24, 2]} position={[CX, -CH_DEPTH / 2, CH_Z0]} map={textures.wall} repeat={[10, 0.6]} color={0x777777} />
      {/* water */}
      <mesh material={waterMaterial} position={[CX, WATER_Y, CH_CZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[RW + 0.2, CH_W + 0.2, 24, 4]} />
      </mesh>

      {/* outfall voids + grates at both ends of the channel */}
      <mesh material={voidMaterial} position={[X0 + 0.02, -0.4, CH_CZ]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[CH_W, 2.3]} />
      </mesh>
      <mesh material={voidMaterial} position={[X1 - 0.02, -0.4, CH_CZ]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[CH_W, 2.3]} />
      </mesh>
      <Grate x={X0} facing={1} />
      <Grate x={X1} facing={-1} />

      {/* ---------- pipes along the north channel wall ---------- */}
      <mesh material={pipeMaterial} position={[CX, 0.9, CH_Z0 - 0.35]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.22, RW - 0.2, 8]} />
      </mesh>
      <mesh material={pipeMaterial} position={[CX, 1.6, CH_Z0 - 0.35]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.3, 0.3, RW - 0.2, 8]} />
      </mesh>
      {/* big trunk line along the north wall */}
      <mesh material={pipeMaterial} position={[CX, 3.9, Z0 + 0.55]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.45, 0.45, RW - 0.2, 8]} />
      </mesh>

      {/* ---------- grate bridge over the channel ---------- */}
      <mesh material={pipeMaterial} position={[BRIDGE_CX, -0.02, CH_CZ]}>
        <boxGeometry args={[BRIDGE_W, 0.1, CH_W + 0.4]} />
      </mesh>

      {/* signage by the hallway mouth, sewer side */}
      <Surface size={[1.1, 1.1]} segments={[2, 2]} position={[HALL_X1 + 1.6, 1.8, Z1 - 0.04]} rotation={[0, Math.PI, 0]} map={textures.danger} repeat={[1, 1]} />

      {/* lamps over the platforms */}
      <Prop url={MODELS.hangingLamp} position={[CX, H, -22.5]} collide={false} physics="none" />
      <Prop url={MODELS.hangingLamp} position={[CX, H, -31.5]} collide={false} physics="none" />

      {/* junk in the wing */}
      <Prop url={MODELS.barrel} position={[-20.5, 0, -21.5]} rotationY={1.9} />
      <Prop url={MODELS.canRusted} position={[-13, 0, -23.5]} rotationY={2.4} collide={false} grabbable />
      <Prop url={MODELS.trashbag} position={[0.6, 0, -21]} rotationY={3.4} collide={false} grabbable />

      {/* ---------- physics shell so junk can be thrown in ---------- */}
      {/* hallway */}
      <CuboidCollider args={[1.5, 0.5, 4]} position={[HALL_CX, -0.5, HALL_CZ]} />
      <CuboidCollider args={[0.25, HALL_H / 2, 4]} position={[HALL_X0 - 0.25, HALL_H / 2, HALL_CZ]} />
      <CuboidCollider args={[0.25, HALL_H / 2, 4]} position={[HALL_X1 + 0.25, HALL_H / 2, HALL_CZ]} />
      <CuboidCollider args={[1.5, 0.5, 4]} position={[HALL_CX, HALL_H + 0.5, HALL_CZ]} />
      {/* platforms + channel */}
      <CuboidCollider args={[RW / 2, 0.5, 2.5]} position={[CX, -0.5, -22.5]} />
      <CuboidCollider args={[RW / 2, 0.5, 2.5]} position={[CX, -0.5, -31.5]} />
      <CuboidCollider args={[RW / 2, 0.5, CH_W / 2]} position={[CX, -CH_DEPTH - 0.5, CH_CZ]} />
      <CuboidCollider args={[RW / 2, CH_DEPTH / 2, 0.25]} position={[CX, -CH_DEPTH / 2, CH_Z1 + 0.25]} />
      <CuboidCollider args={[RW / 2, CH_DEPTH / 2, 0.25]} position={[CX, -CH_DEPTH / 2, CH_Z0 - 0.25]} />
      {/* bridge deck */}
      <CuboidCollider args={[BRIDGE_W / 2, 0.05, CH_W / 2 + 0.2]} position={[BRIDGE_CX, -0.02, CH_CZ]} />
      {/* room walls + ceiling */}
      <CuboidCollider args={[0.5, H / 2, RD / 2]} position={[X0 - 0.5, H / 2, CZ]} />
      <CuboidCollider args={[0.5, H / 2, RD / 2]} position={[X1 + 0.5, H / 2, CZ]} />
      <CuboidCollider args={[RW / 2, H / 2, 0.5]} position={[CX, H / 2, Z0 - 0.5]} />
      <CuboidCollider args={[(HALL_X0 - X0) / 2, H / 2, 0.25]} position={[(X0 + HALL_X0) / 2, H / 2, Z1 - 0.25]} />
      <CuboidCollider args={[(X1 - HALL_X1) / 2, H / 2, 0.25]} position={[(HALL_X1 + X1) / 2, H / 2, Z1 - 0.25]} />
      <CuboidCollider args={[1.5, (H - HALL_H) / 2, 0.25]} position={[HALL_CX, (H + HALL_H) / 2, Z1 - 0.25]} />
      <CuboidCollider args={[RW / 2, 0.5, RD / 2]} position={[CX, H + 0.5, CZ]} />
    </group>
  )
}
