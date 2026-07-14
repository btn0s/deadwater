import { useEffect, useMemo } from 'react'
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
import { SewerWater } from './SewerWater'
import { addCollider } from './collision'
import { Lamp } from './Lamp'

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

// channel: railed walkway edges, 45-degree graded banks, narrow flat bottom
const CH_Z0 = -29
const CH_Z1 = -25
const CH_CZ = (CH_Z0 + CH_Z1) / 2
const CH_W = CH_Z1 - CH_Z0 // 4
const CH_DEPTH = 1.5
const BANK_RUN = 1.5 // horizontal run of each graded bank
const BANK_LEN = Math.hypot(BANK_RUN, CH_DEPTH)
const WATER_Y = -0.95
// waterline width on the 45-degree banks, plus a little overlap
const WATER_W = 2 * (CH_W / 2 + WATER_Y) + 0.15

// grate bridge across the channel
const BRIDGE_CX = 0
const BRIDGE_W = 2

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
  for (let z = CH_CZ - WATER_W / 2 + 0.15; z < CH_CZ + WATER_W / 2; z += 0.34) {
    bars.push(
      <mesh key={z} material={barMaterial} position={[x + facing * 0.1, -0.45, z]}>
        <boxGeometry args={[0.06, 2.3, 0.06]} />
      </mesh>,
    )
  }
  return <group>{bars}</group>
}

/**
 * Big station pump, PS2-style primitive assembly: concrete plinth, horizontal
 * volute, motor box, flanges, valve wheel, suction line down the bank into the
 * water, and an outlet riser up to the trunk line.
 */
function PumpUnit({ x, plates, steel, concrete }: {
  x: number
  plates: THREE.Texture
  steel: THREE.Texture
  concrete: THREE.Texture
}) {
  const bodyMaterial = useMemo(() => createPS2Material({ map: plates, repeat: [2, 1] }), [plates])
  const motorMaterial = useMemo(() => createPS2Material({ map: steel, repeat: [1.5, 1], color: 0x9aa886 }), [steel])
  const plinthMaterial = useMemo(() => createPS2Material({ map: concrete, repeat: [2, 1], color: 0x5c5c5c }), [concrete])
  const darkMaterial = useMemo(() => createPS2Material({ color: 0x3c4045 }), [])

  const Z = -32.2 // unit centerline
  useEffect(
    () => addCollider({ minX: x - 1.4, maxX: x + 1.4, minZ: Z - 0.95, maxZ: Z + 0.95 }),
    [x],
  )

  return (
    <group position={[x, 0, Z]}>
      {/* plinth */}
      <mesh material={plinthMaterial} position={[0, 0.15, 0]}>
        <boxGeometry args={[2.7, 0.3, 1.7]} />
      </mesh>
      {/* volute (pump body) */}
      <mesh material={bodyMaterial} position={[-0.45, 0.95, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.55, 0.55, 1.3, 10]} />
      </mesh>
      {/* flanges */}
      <mesh material={darkMaterial} position={[-1.14, 0.95, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.63, 0.63, 0.1, 10]} />
      </mesh>
      <mesh material={darkMaterial} position={[0.24, 0.95, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.63, 0.63, 0.1, 10]} />
      </mesh>
      {/* coupling + motor */}
      <mesh material={darkMaterial} position={[0.45, 0.95, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.35, 8]} />
      </mesh>
      <mesh material={motorMaterial} position={[1.05, 0.93, 0]}>
        <boxGeometry args={[0.85, 0.85, 0.85]} />
      </mesh>
      {/* outlet riser to the trunk line, with valve wheel */}
      <mesh material={bodyMaterial} position={[-0.45, 2.4, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 3, 8]} />
      </mesh>
      <mesh material={bodyMaterial} position={[-0.45, 3.9, (Z0 + 0.55 - Z) / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.24, 0.24, Math.abs(Z0 + 0.55 - Z), 8]} />
      </mesh>
      <mesh material={darkMaterial} position={[-0.45, 1.9, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.035, 6, 10]} />
      </mesh>
      {/* suction line: down the bank into the water */}
      <mesh material={bodyMaterial} position={[-0.45, -0.5, 3.72]} rotation={[2.38, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 1.9, 8]} />
      </mesh>
      <mesh material={bodyMaterial} position={[-0.45, 0.2, 2.0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 3.0, 8]} />
      </mesh>
    </group>
  )
}

const RAIL_COLOR = 0x53575c
const RAIL_H = 1.02

/** guard railing running along the x axis at a fixed z */
function RailingX({ x0, x1, z }: { x0: number; x1: number; z: number }) {
  const material = useMemo(() => createPS2Material({ color: RAIL_COLOR }), [])
  const len = x1 - x0
  const cx = (x0 + x1) / 2
  const posts = []
  for (let x = x0 + 0.3; x < x1; x += 2) {
    posts.push(
      <mesh key={x} material={material} position={[x, RAIL_H / 2, z]}>
        <boxGeometry args={[0.05, RAIL_H, 0.05]} />
      </mesh>,
    )
  }
  return (
    <group>
      {posts}
      <mesh material={material} position={[cx, RAIL_H, z]}>
        <boxGeometry args={[len, 0.07, 0.07]} />
      </mesh>
      <mesh material={material} position={[cx, RAIL_H * 0.55, z]}>
        <boxGeometry args={[len, 0.05, 0.05]} />
      </mesh>
    </group>
  )
}

/** guard railing running along the z axis at a fixed x */
function RailingZ({ z0, z1, x }: { z0: number; z1: number; x: number }) {
  const material = useMemo(() => createPS2Material({ color: RAIL_COLOR }), [])
  const len = z1 - z0
  const cz = (z0 + z1) / 2
  const posts = []
  for (let z = z0 + 0.3; z < z1; z += 1.9) {
    posts.push(
      <mesh key={z} material={material} position={[x, RAIL_H / 2, z]}>
        <boxGeometry args={[0.05, RAIL_H, 0.05]} />
      </mesh>,
    )
  }
  return (
    <group>
      {posts}
      <mesh material={material} position={[x, RAIL_H, cz]}>
        <boxGeometry args={[0.07, 0.07, len]} />
      </mesh>
      <mesh material={material} position={[x, RAIL_H * 0.55, cz]}>
        <boxGeometry args={[0.05, 0.05, len]} />
      </mesh>
    </group>
  )
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

  const pipeMaterial = useMemo(
    () => createPS2Material({ map: textures.plates, repeat: [6, 1] }),
    [textures.plates],
  )
  const voidMaterial = useMemo(() => createPS2Material({ color: 0x000000, fullbright: true }), [])

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
      <Lamp position={[HALL_CX, HALL_H, HALL_CZ]} lightIndex={6} />

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

      {/* ---------- channel: graded banks down to a narrow flat bottom ---------- */}
      <Surface size={[RW, CH_W - 2 * BANK_RUN]} segments={[24, 2]} position={[CX, -CH_DEPTH, CH_CZ]} rotation={[-Math.PI / 2, 0, 0]} map={textures.floor} repeat={[10, 0.5]} color={0x4a4a4a} />
      {/* south bank, descending northward */}
      <Surface size={[RW, BANK_LEN]} segments={[24, 2]} position={[CX, -CH_DEPTH / 2, CH_Z1 - BANK_RUN / 2]} rotation={[-Math.PI / 2 - Math.PI / 4, 0, 0]} map={textures.wall} repeat={[10, 0.9]} color={0x8a8a8a} bombing={1} />
      {/* north bank, descending southward */}
      <Surface size={[RW, BANK_LEN]} segments={[24, 2]} position={[CX, -CH_DEPTH / 2, CH_Z0 + BANK_RUN / 2]} rotation={[-Math.PI / 4, 0, 0]} map={textures.wall} repeat={[10, 0.9]} color={0x8a8a8a} bombing={1} />
      {/* water */}
      <SewerWater position={[CX, WATER_Y, CH_CZ]} size={[RW + 0.2, WATER_W]} />

      {/* walkway guard railings, split around the bridge */}
      <RailingX x0={X0} x1={BRIDGE_CX - BRIDGE_W / 2} z={CH_Z1} />
      <RailingX x0={BRIDGE_CX + BRIDGE_W / 2} x1={X1} z={CH_Z1} />
      <RailingX x0={X0} x1={BRIDGE_CX - BRIDGE_W / 2} z={CH_Z0} />
      <RailingX x0={BRIDGE_CX + BRIDGE_W / 2} x1={X1} z={CH_Z0} />
      {/* bridge edge railings */}
      <RailingZ z0={CH_Z0} z1={CH_Z1} x={BRIDGE_CX - BRIDGE_W / 2} />
      <RailingZ z0={CH_Z0} z1={CH_Z1} x={BRIDGE_CX + BRIDGE_W / 2} />

      {/* outfall voids + grates at both ends of the channel */}
      <mesh material={voidMaterial} position={[X0 + 0.02, -0.4, CH_CZ]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[CH_W, 2.3]} />
      </mesh>
      <mesh material={voidMaterial} position={[X1 - 0.02, -0.4, CH_CZ]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[CH_W, 2.3]} />
      </mesh>
      <Grate x={X0} facing={1} />
      <Grate x={X1} facing={-1} />

      {/* ---------- pipes resting along the north bank, just above the waterline ---------- */}
      <mesh material={pipeMaterial} position={[CX, -0.62, CH_Z0 + 0.55]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.22, RW - 0.2, 8]} />
      </mesh>
      <mesh material={pipeMaterial} position={[CX, -0.32, CH_Z0 + 0.32]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.3, 0.3, RW - 0.2, 8]} />
      </mesh>
      {/* big trunk line along the north wall, with a feeder dropping to the compressor */}
      <mesh material={pipeMaterial} position={[CX, 3.9, Z0 + 0.55]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.45, 0.45, RW - 0.2, 8]} />
      </mesh>
      <mesh material={pipeMaterial} position={[-16.5, 1.95, Z0 + 0.55]}>
        <cylinderGeometry args={[0.16, 0.16, 3.9, 8]} />
      </mesh>

      {/* ---------- grate bridge over the channel ---------- */}
      <mesh material={pipeMaterial} position={[BRIDGE_CX, -0.02, CH_CZ]}>
        <boxGeometry args={[BRIDGE_W, 0.1, CH_W + 0.4]} />
      </mesh>

      {/* signage by the hallway mouth, sewer side */}
      <Surface size={[1.1, 1.1]} segments={[2, 2]} position={[HALL_X1 + 1.6, 1.8, Z1 - 0.04]} rotation={[0, Math.PI, 0]} map={textures.danger} repeat={[1, 1]} />

      {/* lamps over the platforms */}
      <Lamp position={[CX, H, -22.5]} lightIndex={7} />
      <Lamp position={[CX, H, -31.5]} lightIndex={8} />

      {/* pump station on the north platform, kept clear of the walkway */}
      <PumpUnit x={-16.5} plates={textures.plates} steel={textures.steel} concrete={textures.floor} />
      <PumpUnit x={-6} plates={textures.plates} steel={textures.steel} concrete={textures.floor} />
      {/* (machinery-bay props are layout.json items too) */}

      {/* movable props live in layout.json (see PlacedItems) */}

      {/* ---------- physics shell so junk can be thrown in ---------- */}
      {/* hallway */}
      <CuboidCollider args={[1.5, 0.5, 4]} position={[HALL_CX, -0.5, HALL_CZ]} />
      <CuboidCollider args={[0.25, HALL_H / 2, 4]} position={[HALL_X0 - 0.25, HALL_H / 2, HALL_CZ]} />
      <CuboidCollider args={[0.25, HALL_H / 2, 4]} position={[HALL_X1 + 0.25, HALL_H / 2, HALL_CZ]} />
      <CuboidCollider args={[1.5, 0.5, 4]} position={[HALL_CX, HALL_H + 0.5, HALL_CZ]} />
      {/* platforms + channel */}
      <CuboidCollider args={[RW / 2, 0.5, 2.5]} position={[CX, -0.5, -22.5]} />
      <CuboidCollider args={[RW / 2, 0.5, 2.5]} position={[CX, -0.5, -31.5]} />
      <CuboidCollider args={[RW / 2, 0.5, CH_W / 2 - BANK_RUN]} position={[CX, -CH_DEPTH - 0.5, CH_CZ]} />
      {/* graded banks: rotated slabs so junk slides down into the water */}
      <CuboidCollider args={[RW / 2, 0.1, BANK_LEN / 2]} position={[CX, -CH_DEPTH / 2 - 0.07, CH_Z1 - BANK_RUN / 2]} rotation={[-Math.PI / 4, 0, 0]} />
      <CuboidCollider args={[RW / 2, 0.1, BANK_LEN / 2]} position={[CX, -CH_DEPTH / 2 - 0.07, CH_Z0 + BANK_RUN / 2]} rotation={[Math.PI / 4, 0, 0]} />
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
