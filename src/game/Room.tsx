import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { useControls } from 'leva'
import * as THREE from 'three'
import {
  createPS2Material,
  prepTexture,
  rawColorFromString,
  ambientColor,
  fogSettings,
  lightPositions,
  lightColors,
  lightRadii,
  lightSpots,
} from '../ps2/PS2Material'
import { CuboidCollider } from '@react-three/rapier'
import { addCollider } from './collision'
import { Prop, SplitProp, MODELS } from './Prop'
import { PaperWad } from './PaperWad'
import { Rat } from './Rat'

// warehouse: 40m x 24m footprint, 6m ceiling
const W = 40
const D = 24
const H = 6

// every tileable texture available to the tweak panel
const TEXTURE_URLS: Record<string, string> = {
  Concrete016: '/textures/Concrete016.jpg',
  Concrete030: '/textures/Concrete030.jpg',
  Concrete031: '/textures/Concrete031.jpg',
  Concrete034: '/textures/Concrete034.jpg',
  Concrete036: '/textures/Concrete036.jpg',
  Plaster001: '/textures/Plaster001.jpg',
  PaintedPlaster005: '/textures/PaintedPlaster005.jpg',
  Bricks084: '/textures/Bricks084.jpg',
  CorrugatedSteel005: '/textures/CorrugatedSteel005.jpg',
  MetalPlates006: '/textures/MetalPlates006.jpg',
  DangerSign: '/textures/PaintedMetal017.jpg',
}
const TEXTURE_OPTIONS = Object.keys(TEXTURE_URLS)

const LAMP_XZ: [number, number][] = [
  [-13, -5.5],
  [0, -5.5],
  [13, -5.5],
  [-13, 5.5],
  [0, 5.5],
  [13, 5.5],
]
const FLICKER_INDEX = 4

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
  color?: number | string
  bombing?: number
}

function Surface({ size, segments, position, rotation = [0, 0, 0], map, repeat, color, bombing = 0 }: SurfaceProps) {
  const material = useMemo(
    () => createPS2Material({ map, repeat, color, bombing }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, repeat[0], repeat[1], color, bombing],
  )
  useEffect(() => () => material.dispose(), [material])
  return (
    <mesh position={position} rotation={rotation} material={material}>
      <planeGeometry args={[size[0], size[1], segments[0], segments[1]]} />
    </mesh>
  )
}

interface LightSettings {
  lampColor: string
  intensity: number
  radius: number
  flicker: boolean
}

function Lights({ lampColor, intensity, radius, flicker }: LightSettings) {
  const flickerState = useRef({ on: true, nextToggle: 0.5 })
  const settings = useRef<LightSettings>({ lampColor, intensity, radius, flicker })
  settings.current = { lampColor, intensity, radius, flicker }

  useEffect(() => {
    LAMP_XZ.forEach(([x, z], i) => {
      lightPositions[i].set(x, 4.6, z)
      lightColors[i].copy(rawColorFromString(lampColor)).multiplyScalar(intensity)
      lightRadii[i] = radius
      lightSpots[i] = 1 // shaded fixtures: no upward spill
    })
  }, [lampColor, intensity, radius])

  useFrame(({ clock }) => {
    const s = settings.current
    const f = flickerState.current
    if (!s.flicker) return
    const t = clock.elapsedTime
    if (t > f.nextToggle) {
      f.on = !f.on
      // long stretches lit, short violent dropouts — HL2 fluorescent cadence
      f.nextToggle = t + (f.on ? 0.4 + Math.random() * 2.5 : 0.04 + Math.random() * 0.18)
      const level = f.on ? s.intensity : 0.08
      lightColors[FLICKER_INDEX].copy(rawColorFromString(s.lampColor)).multiplyScalar(level)
    }
  })

  return null
}

export function Room() {
  const textures = useTexture(TEXTURE_URLS, (loaded) => Object.values(loaded).forEach(prepTexture))

  const walls = useControls('Walls', {
    texture: { value: 'Concrete031', options: TEXTURE_OPTIONS },
    repeatX: { value: 16, min: 1, max: 40, step: 0.5 },
    repeatY: { value: 2, min: 0.5, max: 10, step: 0.1 },
    tint: '#ffffff',
    breakupTiling: true,
    breakupScale: { value: 1, min: 0.25, max: 4, step: 0.25 },
  })

  const floor = useControls('Floor', {
    texture: { value: 'Concrete034', options: TEXTURE_OPTIONS },
    repeatX: { value: 13, min: 1, max: 40, step: 0.5 },
    repeatY: { value: 8, min: 1, max: 30, step: 0.5 },
    tint: '#6e6e6e',
    breakupTiling: false,
    breakupScale: { value: 1, min: 0.25, max: 4, step: 0.25 },
  })

  const ceiling = useControls('Ceiling', {
    texture: { value: 'CorrugatedSteel005', options: TEXTURE_OPTIONS },
    repeatX: { value: 20, min: 1, max: 30, step: 0.5 },
    repeatY: { value: 12, min: 1, max: 30, step: 0.5 },
    tint: '#b4b4b4',
    breakupTiling: true,
    breakupScale: { value: 1, min: 0.25, max: 4, step: 0.25 },
  })

  const lighting = useControls('Lighting', {
    ambient: '#1a1c20',
    lampColor: '#d8e6c8',
    intensity: { value: 1.2, min: 0, max: 2, step: 0.05 },
    radius: { value: 18, min: 4, max: 40, step: 0.5 },
    flicker: true,
  })

  const fog = useControls('Fog', {
    color: '#07080a',
    near: { value: 10, min: 0, max: 40, step: 0.5 },
    far: { value: 48, min: 10, max: 120, step: 1 },
  })

  // push ambient + fog into the shared shader uniforms
  useEffect(() => {
    ambientColor.copy(rawColorFromString(lighting.ambient))
  }, [lighting.ambient])
  useEffect(() => {
    fogSettings.color.copy(rawColorFromString(fog.color))
    fogSettings.near.value = fog.near
    fogSettings.far.value = fog.far
  }, [fog.color, fog.near, fog.far])

  const wallMap = textures[walls.texture]
  const floorMap = textures[floor.texture]
  const ceilingMap = textures[ceiling.texture]

  const pillarMaterial = useMemo(() => {
    const m = createPS2Material({ map: wallMap, repeat: [1, 4], color: walls.tint })
    return m
  }, [wallMap, walls.tint])
  useEffect(() => () => pillarMaterial.dispose(), [pillarMaterial])

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

  const wallRepeat: [number, number] = [walls.repeatX, walls.repeatY]
  const wallRepeatSide: [number, number] = [walls.repeatX * (D / W), walls.repeatY]
  const wallBombing = walls.breakupTiling ? walls.breakupScale : 0

  return (
    <group>
      <Lights lampColor={lighting.lampColor} intensity={lighting.intensity} radius={lighting.radius} flicker={lighting.flicker} />

      {/* floor / ceiling — floor tinted down so it sits darker than the walls */}
      <Surface size={[W, D]} segments={[40, 24]} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} map={floorMap} repeat={[floor.repeatX, floor.repeatY]} color={floor.tint} bombing={floor.breakupTiling ? floor.breakupScale : 0} />
      <Surface size={[W, D]} segments={[40, 24]} position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]} map={ceilingMap} repeat={[ceiling.repeatX, ceiling.repeatY]} color={ceiling.tint} bombing={ceiling.breakupTiling ? ceiling.breakupScale : 0} />

      {/* walls */}
      <Surface size={[W, H]} segments={[40, 8]} position={[0, H / 2, -D / 2]} map={wallMap} repeat={wallRepeat} color={walls.tint} bombing={wallBombing} />
      <Surface size={[W, H]} segments={[40, 8]} position={[0, H / 2, D / 2]} rotation={[0, Math.PI, 0]} map={wallMap} repeat={wallRepeat} color={walls.tint} bombing={wallBombing} />
      <Surface size={[D, H]} segments={[24, 8]} position={[-W / 2, H / 2, 0]} rotation={[0, Math.PI / 2, 0]} map={wallMap} repeat={wallRepeatSide} color={walls.tint} bombing={wallBombing} />
      <Surface size={[D, H]} segments={[24, 8]} position={[W / 2, H / 2, 0]} rotation={[0, -Math.PI / 2, 0]} map={wallMap} repeat={wallRepeatSide} color={walls.tint} bombing={wallBombing} />

      {/* roller door on the north wall, with warning signage */}
      <Surface size={[5, 4.6]} segments={[6, 6]} position={[-10, 2.3, -D / 2 + 0.04]} map={textures.CorrugatedSteel005} repeat={[4, 2.2]} />
      <Surface size={[1.2, 1.2]} segments={[2, 2]} position={[-10, 2.6, -D / 2 + 0.06]} map={textures.DangerSign} repeat={[1, 1]} />
      <Surface size={[1.1, 1.1]} segments={[2, 2]} position={[-13.2, 1.9, -D / 2 + 0.06]} map={textures.DangerSign} repeat={[1, 1]} />
      <Surface size={[1.1, 1.1]} segments={[2, 2]} position={[W / 2 - 0.06, 1.8, 2.5]} rotation={[0, -Math.PI / 2, 0]} map={textures.DangerSign} repeat={[1, 1]} />

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

      {/* ---- barrel depot, NW corner ---- */}
      <Prop url={MODELS.barrel} position={[-16.5, 0, -9]} />
      <Prop url={MODELS.barrel} position={[-15.4, 0, -9.3]} rotationY={1.2} />
      <Prop url={MODELS.barrel} position={[-16, 0, -8.1]} rotationY={2.6} />
      <Prop url={MODELS.barrelExplosive} position={[-14.6, 0, -8.4]} rotationY={0.7} />
      <Prop url={MODELS.jerrycan} position={[-14.8, 0, -7.1]} rotationY={2.2} collide={false} grabbable />
      <Prop url={MODELS.oilTin} position={[-15.7, 0, -7]} rotationY={0.8} collide={false} grabbable />
      <PaperWad position={[-13.9, 0, -7.6]} seed={67} size={0.11} />
      <Prop url={MODELS.barrel} position={[-18.5, 0, 3]} rotationY={0.4} />
      <Prop url={MODELS.barrel} position={[-18.2, 0, 4.3]} rotationY={4.1} />

      {/* ---- loading zone by the roller door ---- */}
      <SplitProp
        url={MODELS.militaryCrate}
        position={[-11.6, 0, -10.1]}
        rotationY={0.35}
        groupBy={(n) => (n.endsWith('_a') ? 'a' : 'b')}
      />
      <Prop url={MODELS.woodenCrate} position={[-8.3, 0, -10.4]} rotationY={0.2} grabbable />
      <Prop url={MODELS.plasticCrate} position={[-9.5, 0, -9.4]} rotationY={1.9} grabbable />
      <Prop url={MODELS.cardboardBox} position={[-7, 0, -9.7]} rotationY={0.5} grabbable />
      <Prop url={MODELS.cardboardBox} position={[-7.1, 0.56, -9.8] } rotationY={1.1} collide={false} grabbable />
      <Prop url={MODELS.cardboardBox} position={[-6.1, 0, -10.5]} rotationY={2.8} grabbable />
      <PaperWad position={[-9.9, 0, -8.4]} seed={41} size={0.08} />
      <PaperWad position={[-6.8, 0, -8.9]} seed={37} size={0.1} />

      {/* ---- work area, center-east ---- */}
      <Prop url={MODELS.ammoBox} position={[4, 0, -2.5]} rotationY={0.3} grabbable />
      <Prop url={MODELS.ammoBox} position={[4.7, 0, -1.9]} rotationY={1.8} grabbable />
      <Prop url={MODELS.ammoBox} position={[4.3, 0.34, -2.2]} rotationY={0.9} collide={false} grabbable />
      <Prop url={MODELS.barrelExplosive} position={[0.95, 0, 7.7]} rotationY={2.1} />
      <Prop url={MODELS.cardboardBox} position={[17.5, 0, -3]} grabbable />
      <Prop url={MODELS.cardboardBox} position={[17.4, 0, -1.7]} rotationY={0.4} grabbable />
      <Prop url={MODELS.cardboardBox} position={[17.45, 0.55, -2.4]} rotationY={0.9} collide={false} grabbable />

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

      {/* ---- trash corner, SE — cans, bags, spilled junk ---- */}
      <Prop url={MODELS.trashCan} position={[18.6, 0, 7.5]} rotationY={0.6} physics="trimesh" />
      <Prop url={MODELS.trashCan} position={[17.5, 0, 10.7]} rotationY={2.3} physics="trimesh" />
      <Prop url={MODELS.trashbag} position={[17.8, 0, 6.3]} rotationY={1.7} collide={false} grabbable />
      <Prop url={MODELS.trashbag} position={[18.5, 0, 5.4]} rotationY={4.2} collide={false} grabbable />
      <Prop url={MODELS.trashbag} position={[16.4, 0, 10.9]} rotationY={0.9} collide={false} grabbable />
      <Prop url={MODELS.canRusted} position={[17.2, 0, 8.6]} rotationY={1.2} collide={false} grabbable />
      <Prop url={MODELS.canRusted} position={[18.1, 0, 9.4]} rotationY={3.9} collide={false} grabbable />
      <Prop url={MODELS.canRusted} position={[16.6, 0, 7.9]} rotationY={5.1} collide={false} grabbable />
      <Prop url={MODELS.oilTin} position={[17.9, 0, 10.2]} rotationY={2.6} collide={false} grabbable />
      <SplitProp url={MODELS.foodCans} position={[16.9, 0, 9.9]} rotationY={2.8} />
      <PaperWad position={[16.2, 0, 8.9]} seed={53} />
      <PaperWad position={[17.6, 0, 8]} seed={11} size={0.08} />
      <PaperWad position={[18.9, 0, 8.9]} seed={23} size={0.075} />
      <PaperWad position={[15.8, 0, 10.1]} seed={71} size={0.1} />

      {/* ---- stray junk between zones ---- */}
      <SplitProp url={MODELS.foodCans} position={[3.9, 0.68, -2.1]} rotationY={0.5} />
      <Prop url={MODELS.plasticCrate} position={[-5.9, 0, 9.9]} rotationY={2.4} grabbable />
      <Prop url={MODELS.cardboardBox} position={[8, 0, 10.6]} rotationY={1.9} grabbable />
      <Prop url={MODELS.canRusted} position={[-3.8, 0, 1.6]} rotationY={3.9} collide={false} grabbable />
      <PaperWad position={[2.2, 0, 4.8]} seed={13} />
      <PaperWad position={[-9.1, 0, 5.4]} seed={43} size={0.08} />
      <PaperWad position={[10.4, 0, 4.9]} seed={73} size={0.07} />

      {/* rats */}
      <Rat seed={101} spawn={[10, -10.5]} />
      <Rat seed={211} spawn={[-15, 9]} />
      <Rat seed={307} spawn={[18, -2]} />
      <Rat seed={401} spawn={[-4, 11]} />
      <Rat seed={503} spawn={[2, -10.5]} />
    </group>
  )
}
