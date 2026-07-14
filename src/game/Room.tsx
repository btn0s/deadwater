import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { createPS2Material, prepTexture, rawColor, lightPositions, lightColors, lightRadii } from '../ps2/PS2Material'
import { CuboidCollider } from '@react-three/rapier'
import { addCollider } from './collision'
import { Prop, SplitProp, MODELS } from './Prop'
import { PaperWad } from './PaperWad'

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
const LAMP_INTENSITY = 1.0

const PILLARS: [number, number][] = [
  [-12, -6.8],
  [0, -6.8],
  [12, -6.8],
  [-12, 6.8],
  [0, 6.8],
  [12, 6.8],
]

interface SurfaceProps {
  size: [number, number]
  segments: [number, number]
  position: [number, number, number]
  rotation?: [number, number, number]
  map: THREE.Texture
  repeat: [number, number]
  color?: number
}

function Surface({ size, segments, position, rotation = [0, 0, 0], map, repeat, color }: SurfaceProps) {
  const material = useMemo(() => createPS2Material({ map, repeat, color }), [map, repeat, color])
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
      lightColors[i].copy(rawColor(LAMP_COLOR)).multiplyScalar(LAMP_INTENSITY)
      lightRadii[i] = 18
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
      lightColors[FLICKER_INDEX].copy(rawColor(LAMP_COLOR)).multiplyScalar(level)
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
      danger: '/textures/PaintedMetal017.jpg',
    },
    (loaded) => Object.values(loaded).forEach(prepTexture),
  )

  const pillarMaterial = useMemo(
    () => createPS2Material({ map: textures.wall, repeat: [1, 4] }),
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

      {/* floor / ceiling — floor tinted down so it sits darker than the walls */}
      <Surface size={[W, D]} segments={[40, 24]} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} map={textures.floor} repeat={[13, 8]} color={0x6e6e6e} />
      <Surface size={[W, D]} segments={[40, 24]} position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]} map={textures.steel} repeat={[20, 12]} color={0xb4b4b4} />

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

      {/* roller door on the north wall, with warning signage */}
      <Surface size={[5, 4.6]} segments={[6, 6]} position={[-10, 2.3, -D / 2 + 0.04]} map={textures.steel} repeat={[4, 2.2]} />
      <Surface size={[1.2, 1.2]} segments={[2, 2]} position={[-10, 2.6, -D / 2 + 0.06]} map={textures.danger} repeat={[1, 1]} />
      <Surface size={[1.1, 1.1]} segments={[2, 2]} position={[-13.2, 1.9, -D / 2 + 0.06]} map={textures.danger} repeat={[1, 1]} />
      <Surface size={[1.1, 1.1]} segments={[2, 2]} position={[W / 2 - 0.06, 1.8, 2.5]} rotation={[0, -Math.PI / 2, 0]} map={textures.danger} repeat={[1, 1]} />

      {/* pillars */}
      {PILLARS.map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, H / 2, z]} material={pillarMaterial}>
          <boxGeometry args={[0.7, H, 0.7, 2, 10, 2]} />
        </mesh>
      ))}

      {/* hanging fluorescents at each light position */}
      {LAMP_XZ.map(([x, z]) => (
        <Prop key={`lamp${x},${z}`} url={MODELS.hangingLamp} position={[x, H, z]} collide={false} physics="none" />
      ))}

      {/* clutter — barrels, crates, ammo boxes */}
      <Prop url={MODELS.barrel} position={[-16.5, 0, -9]} />
      <Prop url={MODELS.barrel} position={[-15.4, 0, -9.3]} rotationY={1.2} />
      <Prop url={MODELS.barrel} position={[-16, 0, -8.1]} rotationY={2.6} />
      <Prop url={MODELS.barrelExplosive} position={[-14.6, 0, -8.4]} rotationY={0.7} />
      <Prop url={MODELS.barrelExplosive} position={[0.95, 0, 7.7]} rotationY={2.1} />
      <Prop url={MODELS.barrel} position={[-18.5, 0, 3]} rotationY={0.4} />
      <Prop url={MODELS.barrel} position={[-18.2, 0, 4.3]} rotationY={4.1} />

      <Prop url={MODELS.cardboardBox} position={[17.5, 0, -3]} grabbable />
      <Prop url={MODELS.cardboardBox} position={[17.4, 0, -1.7]} rotationY={0.4} grabbable />
      <Prop url={MODELS.cardboardBox} position={[17.45, 0.55, -2.4]} rotationY={0.9} collide={false} grabbable />
      <Prop url={MODELS.cardboardBox} position={[8, 0, 10.6]} rotationY={1.9} grabbable />
      <Prop url={MODELS.cardboardBox} position={[9.3, 0, 10.4]} rotationY={0.2} grabbable />

      <Prop url={MODELS.ammoBox} position={[4, 0, -2.5]} rotationY={0.3} grabbable />
      <Prop url={MODELS.ammoBox} position={[4.7, 0, -1.9]} rotationY={1.8} grabbable />
      <Prop url={MODELS.ammoBox} position={[4.3, 0.34, -2.2]} rotationY={0.9} collide={false} grabbable />

      {/* static physics shell for junk to rest against */}
      <CuboidCollider args={[W / 2 + 1, 0.5, D / 2 + 1]} position={[0, -0.5, 0]} />
      <CuboidCollider args={[W / 2 + 1, 0.5, D / 2 + 1]} position={[0, H + 0.5, 0]} />
      <CuboidCollider args={[W / 2 + 1, H / 2, 0.5]} position={[0, H / 2, -D / 2 - 0.5]} />
      <CuboidCollider args={[W / 2 + 1, H / 2, 0.5]} position={[0, H / 2, D / 2 + 0.5]} />
      <CuboidCollider args={[0.5, H / 2, D / 2 + 1]} position={[-W / 2 - 0.5, H / 2, 0]} />
      <CuboidCollider args={[0.5, H / 2, D / 2 + 1]} position={[W / 2 + 0.5, H / 2, 0]} />
      {PILLARS.map(([x, z]) => (
        <CuboidCollider key={`p${x},${z}`} args={[0.35, H / 2, 0.35]} position={[x, H / 2, z]} />
      ))}

      {/* graspable junk — crates, cans, trash */}
      <Prop url={MODELS.woodenCrate} position={[-6.5, 0, -10]} rotationY={0.3} grabbable />
      <Prop url={MODELS.plasticCrate} position={[-5.4, 0, -10.3]} rotationY={1.1} grabbable />
      <Prop url={MODELS.plasticCrate} position={[-5.9, 0, -9.2]} rotationY={2.4} grabbable />
      <SplitProp
        url={MODELS.militaryCrate}
        position={[12.8, 0, 9.8]}
        rotationY={2.9}
        groupBy={(n) => (n.endsWith('_a') ? 'a' : 'b')}
      />
      <Prop url={MODELS.trashCan} position={[18.6, 0, 7.5]} rotationY={0.6} physics="trimesh" />
      <Prop url={MODELS.trashbag} position={[17.7, 0, 6.4]} rotationY={1.7} collide={false} grabbable />
      <Prop url={MODELS.trashbag} position={[18.3, 0, 5.6]} rotationY={4.2} collide={false} grabbable />
      <Prop url={MODELS.jerrycan} position={[-17.9, 0, 2.1]} rotationY={2.2} collide={false} grabbable />
      <Prop url={MODELS.oilTin} position={[-15.9, 0, -7.4]} rotationY={0.8} collide={false} grabbable />
      <Prop url={MODELS.canRusted} position={[6.2, 0, 3.4]} rotationY={1.2} collide={false} grabbable />
      <Prop url={MODELS.canRusted} position={[-3.8, 0, 1.6]} rotationY={3.9} collide={false} grabbable />
      <SplitProp url={MODELS.foodCans} position={[3.9, 0.68, -2.1]} rotationY={0.5} />
      <SplitProp url={MODELS.foodCans} position={[13.4, 0, 9.1]} rotationY={2.8} />

      {/* crumpled paper scattered on the floor */}
      <PaperWad position={[2.2, 0, 4.8]} seed={11} />
      <PaperWad position={[-1.4, 0, -3.2]} seed={23} size={0.075} />
      <PaperWad position={[7.6, 0, -6.1]} seed={37} size={0.1} />
      <PaperWad position={[-8.9, 0, 5.4]} seed={41} size={0.08} />
      <PaperWad position={[16.2, 0, 1.2]} seed={53} />
      <PaperWad position={[-13.6, 0, -2.7]} seed={67} size={0.11} />
      <PaperWad position={[10.4, 0, 4.9]} seed={71} size={0.07} />
    </group>
  )
}
