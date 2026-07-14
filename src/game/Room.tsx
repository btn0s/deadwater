import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { useControls } from 'leva'
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
import { Lamp } from './Lamp'
import { Rat } from './Rat'
import { Surface } from './Surface'
import { SewerWing } from './SewerWing'
import { LoadingDock } from './LoadingDock'
import { Office } from './Office'
import { PlacedItems } from './PlacedItems'

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
      // north wall, split around the hallway opening
      addCollider({ minX: -W / 2 - 1, maxX: -11.5, minZ: -D / 2 - 1, maxZ: -D / 2 }),
      addCollider({ minX: -8.5, maxX: W / 2 + 1, minZ: -D / 2 - 1, maxZ: -D / 2 }),
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
      <SewerWing />
      <LoadingDock />
      <Office />

      {/* floor / ceiling — floor tinted down so it sits darker than the walls */}
      <Surface size={[W, D]} segments={[40, 24]} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} map={floorMap} repeat={[floor.repeatX, floor.repeatY]} color={floor.tint} bombing={floor.breakupTiling ? floor.breakupScale : 0} />
      <Surface size={[W, D]} segments={[40, 24]} position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]} map={ceilingMap} repeat={[ceiling.repeatX, ceiling.repeatY]} color={ceiling.tint} bombing={ceiling.breakupTiling ? ceiling.breakupScale : 0} />

      {/* walls — north wall is split around the hallway opening (x -11.5..-8.5, 3m tall) */}
      <Surface size={[8.5, H]} segments={[9, 8]} position={[-15.75, H / 2, -D / 2]} map={wallMap} repeat={[walls.repeatX * (8.5 / W), walls.repeatY]} color={walls.tint} bombing={wallBombing} />
      <Surface size={[28.5, H]} segments={[29, 8]} position={[5.75, H / 2, -D / 2]} map={wallMap} repeat={[walls.repeatX * (28.5 / W), walls.repeatY]} color={walls.tint} bombing={wallBombing} />
      <Surface size={[3, 3]} segments={[3, 4]} position={[-10, 4.5, -D / 2]} map={wallMap} repeat={[walls.repeatX * (3 / W), walls.repeatY / 2]} color={walls.tint} bombing={wallBombing} />
      <Surface size={[3, 3]} segments={[3, 4]} position={[-10, 4.5, -D / 2 - 0.01]} rotation={[0, Math.PI, 0]} map={wallMap} repeat={[walls.repeatX * (3 / W), walls.repeatY / 2]} color={walls.tint} />
      <Surface size={[W, H]} segments={[40, 8]} position={[0, H / 2, D / 2]} rotation={[0, Math.PI, 0]} map={wallMap} repeat={wallRepeat} color={walls.tint} bombing={wallBombing} />
      <Surface size={[D, H]} segments={[24, 8]} position={[-W / 2, H / 2, 0]} rotation={[0, Math.PI / 2, 0]} map={wallMap} repeat={wallRepeatSide} color={walls.tint} bombing={wallBombing} />
      <Surface size={[D, H]} segments={[24, 8]} position={[W / 2, H / 2, 0]} rotation={[0, -Math.PI / 2, 0]} map={wallMap} repeat={wallRepeatSide} color={walls.tint} bombing={wallBombing} />

      {/* warning signage beside the hallway mouth */}
      <Surface size={[1.1, 1.1]} segments={[2, 2]} position={[-13.2, 1.9, -D / 2 + 0.06]} map={textures.DangerSign} repeat={[1, 1]} />
      <Surface size={[1.1, 1.1]} segments={[2, 2]} position={[W / 2 - 0.06, 1.8, 2.5]} rotation={[0, -Math.PI / 2, 0]} map={textures.DangerSign} repeat={[1, 1]} />

      {/* pillars */}
      {PILLARS.map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, H / 2, z]} material={pillarMaterial}>
          <boxGeometry args={[0.7, H, 0.7, 2, 10, 2]} />
        </mesh>
      ))}

      {/* hanging fluorescents at each light position; glass glow tracks the light */}
      {LAMP_XZ.map(([x, z], i) => (
        <Lamp key={`lamp${x},${z}`} position={[x, H, z]} lightIndex={i} />
      ))}

      {/* all placeable props live in src/game/layout.json — edit in-game via
          the editor mode (E key / window.__editor) and SAVE */}
      <Suspense fallback={null}>
        <PlacedItems />
      </Suspense>

      {/* static physics shell for junk to rest against */}
      <CuboidCollider args={[W / 2 + 1, 0.5, D / 2 + 1]} position={[0, -0.5, 0]} />
      <CuboidCollider args={[W / 2 + 1, 0.5, D / 2 + 1]} position={[0, H + 0.5, 0]} />
      {/* north wall split around the hallway opening */}
      <CuboidCollider args={[4.75, H / 2, 0.5]} position={[-16.25, H / 2, -D / 2 - 0.5]} />
      <CuboidCollider args={[14.75, H / 2, 0.5]} position={[6.25, H / 2, -D / 2 - 0.5]} />
      <CuboidCollider args={[1.5, 1.5, 0.5]} position={[-10, 4.5, -D / 2 - 0.5]} />
      <CuboidCollider args={[W / 2 + 1, H / 2, 0.5]} position={[0, H / 2, D / 2 + 0.5]} />
      <CuboidCollider args={[0.5, H / 2, D / 2 + 1]} position={[-W / 2 - 0.5, H / 2, 0]} />
      <CuboidCollider args={[0.5, H / 2, D / 2 + 1]} position={[W / 2 + 0.5, H / 2, 0]} />
      {PILLARS.map(([x, z]) => (
        <CuboidCollider key={`p${x},${z}`} args={[0.35, H / 2, 0.35]} position={[x, H / 2, z]} />
      ))}

      {/* rats */}
      <Rat seed={101} spawn={[10, -10.5]} />
      <Rat seed={211} spawn={[-15, 9]} />
      <Rat seed={307} spawn={[18, -2]} />
      <Rat seed={401} spawn={[-4, 11]} />
      <Rat seed={503} spawn={[2, -10.5]} />
    </group>
  )
}
