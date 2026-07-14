import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { createPS2Material, prepTexture, lightPositions, lightColors, lightRadii } from '../ps2/PS2Material'
import { addCollider } from './collision'
import { Prop, MODELS } from './Prop'

// warehouse: 40m x 24m footprint, 6m ceiling
const W = 40
const D = 24
const H = 6

const LAMP_XZ: [number, number][] = [
  [-13, -5.5],
  [0, -5.5],
  [13, -5.5],
  [-13, 5.5],
  [0, 5.5],
  [13, 5.5],
]
const FLICKER_INDEX = 4
const LAMP_COLOR = 0xd8e6c8 // dying fluorescent green-white
const LAMP_INTENSITY = 0.85

const PILLARS: [number, number][] = [
  [-12, -6],
  [0, -6],
  [12, -6],
  [-12, 6],
  [0, 6],
  [12, 6],
]

interface SurfaceProps {
  size: [number, number]
  segments: [number, number]
  position: [number, number, number]
  rotation?: [number, number, number]
  map: THREE.Texture
  repeat: [number, number]
}

function Surface({ size, segments, position, rotation = [0, 0, 0], map, repeat }: SurfaceProps) {
  const material = useMemo(() => createPS2Material({ map, repeat }), [map, repeat])
  return (
    <mesh position={position} rotation={rotation} material={material}>
      <planeGeometry args={[size[0], size[1], segments[0], segments[1]]} />
    </mesh>
  )
}

function Lights() {
  const flickerState = useRef({ on: true, nextToggle: 0.5 })

  useEffect(() => {
    LAMP_XZ.forEach(([x, z], i) => {
      lightPositions[i].set(x, 4.6, z)
      lightColors[i].setHex(LAMP_COLOR).multiplyScalar(LAMP_INTENSITY)
      lightRadii[i] = 16
    })
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const f = flickerState.current
    if (t > f.nextToggle) {
      f.on = !f.on
      // long stretches lit, short violent dropouts — HL2 fluorescent cadence
      f.nextToggle = t + (f.on ? 0.4 + Math.random() * 2.5 : 0.04 + Math.random() * 0.18)
      const level = f.on ? LAMP_INTENSITY : 0.08
      lightColors[FLICKER_INDEX].setHex(LAMP_COLOR).multiplyScalar(level)
    }
  })

  return null
}

export function Room() {
  const textures = useTexture(
    {
      floor: '/textures/Concrete034.jpg',
      wall: '/textures/Concrete016.jpg',
      steel: '/textures/CorrugatedSteel005.jpg',
      plates: '/textures/MetalPlates006.jpg',
      paint: '/textures/PaintedMetal017.jpg',
    },
    (loaded) => Object.values(loaded).forEach(prepTexture),
  )

  const pillarMaterial = useMemo(
    () => createPS2Material({ map: textures.wall, repeat: [1, 4], color: 0xb8b8b8 }),
    [textures.wall],
  )

  // static world colliders: four walls + pillars
  useEffect(() => {
    const removers = [
      addCollider({ minX: -W / 2 - 1, maxX: W / 2 + 1, minZ: -D / 2 - 1, maxZ: -D / 2 }),
      addCollider({ minX: -W / 2 - 1, maxX: W / 2 + 1, minZ: D / 2, maxZ: D / 2 + 1 }),
      addCollider({ minX: -W / 2 - 1, maxX: -W / 2, minZ: -D / 2 - 1, maxZ: D / 2 + 1 }),
      addCollider({ minX: W / 2, maxX: W / 2 + 1, minZ: -D / 2 - 1, maxZ: D / 2 + 1 }),
      ...PILLARS.map(([x, z]) =>
        addCollider({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 }),
      ),
    ]
    return () => removers.forEach((r) => r())
  }, [])

  return (
    <group>
      <Lights />

      {/* floor / ceiling */}
      <Surface size={[W, D]} segments={[40, 24]} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} map={textures.floor} repeat={[13, 8]} />
      <Surface size={[W, D]} segments={[40, 24]} position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]} map={textures.paint} repeat={[13, 8]} />

      {/* walls */}
      <Surface size={[W, H]} segments={[40, 8]} position={[0, H / 2, -D / 2]} map={textures.wall} repeat={[16, 2.4]} />
      <Surface size={[W, H]} segments={[40, 8]} position={[0, H / 2, D / 2]} rotation={[0, Math.PI, 0]} map={textures.wall} repeat={[16, 2.4]} />
      <Surface size={[D, H]} segments={[24, 8]} position={[-W / 2, H / 2, 0]} rotation={[0, Math.PI / 2, 0]} map={textures.wall} repeat={[10, 2.4]} />
      <Surface size={[D, H]} segments={[24, 8]} position={[W / 2, H / 2, 0]} rotation={[0, -Math.PI / 2, 0]} map={textures.wall} repeat={[10, 2.4]} />

      {/* corrugated steel dado band around the walls */}
      <Surface size={[W, 2.2]} segments={[40, 3]} position={[0, 1.1, -D / 2 + 0.02]} map={textures.steel} repeat={[18, 1]} />
      <Surface size={[W, 2.2]} segments={[40, 3]} position={[0, 1.1, D / 2 - 0.02]} rotation={[0, Math.PI, 0]} map={textures.steel} repeat={[18, 1]} />
      <Surface size={[D, 2.2]} segments={[24, 3]} position={[-W / 2 + 0.02, 1.1, 0]} rotation={[0, Math.PI / 2, 0]} map={textures.steel} repeat={[11, 1]} />
      <Surface size={[D, 2.2]} segments={[24, 3]} position={[W / 2 - 0.02, 1.1, 0]} rotation={[0, -Math.PI / 2, 0]} map={textures.steel} repeat={[11, 1]} />

      {/* blast door on the north wall */}
      <Surface size={[5, 4.6]} segments={[6, 6]} position={[-10, 2.3, -D / 2 + 0.04]} map={textures.plates} repeat={[2, 2]} />

      {/* pillars */}
      {PILLARS.map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, H / 2, z]} material={pillarMaterial}>
          <boxGeometry args={[0.7, H, 0.7, 2, 10, 2]} />
        </mesh>
      ))}

      {/* hanging fluorescents at each light position */}
      {LAMP_XZ.map(([x, z]) => (
        <Prop key={`lamp${x},${z}`} url={MODELS.hangingLamp} position={[x, H, z]} collide={false} />
      ))}

      {/* clutter — barrels, crates, ammo boxes */}
      <Prop url={MODELS.barrel} position={[-16.5, 0, -9]} />
      <Prop url={MODELS.barrel} position={[-15.4, 0, -9.3]} rotationY={1.2} />
      <Prop url={MODELS.barrel} position={[-16, 0, -8.1]} rotationY={2.6} />
      <Prop url={MODELS.barrelExplosive} position={[-14.6, 0, -8.4]} rotationY={0.7} />
      <Prop url={MODELS.barrelExplosive} position={[0.95, 0, 6.95]} rotationY={2.1} />
      <Prop url={MODELS.barrel} position={[-18.5, 0, 3]} rotationY={0.4} />
      <Prop url={MODELS.barrel} position={[-18.2, 0, 4.3]} rotationY={4.1} />

      <Prop url={MODELS.cardboardBox} position={[17.5, 0, -3]} />
      <Prop url={MODELS.cardboardBox} position={[17.4, 0, -1.7]} rotationY={0.4} />
      <Prop url={MODELS.cardboardBox} position={[17.45, 0.55, -2.4]} rotationY={0.9} collide={false} />
      <Prop url={MODELS.cardboardBox} position={[8, 0, 10.6]} rotationY={1.9} />
      <Prop url={MODELS.cardboardBox} position={[9.3, 0, 10.4]} rotationY={0.2} />

      <Prop url={MODELS.ammoBox} position={[4, 0, -2.5]} rotationY={0.3} />
      <Prop url={MODELS.ammoBox} position={[4.7, 0, -1.9]} rotationY={1.8} />
      <Prop url={MODELS.ammoBox} position={[4.3, 0.34, -2.2]} rotationY={0.9} collide={false} />
    </group>
  )
}
