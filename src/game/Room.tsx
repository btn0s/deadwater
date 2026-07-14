import { Suspense, useEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import {
  createPS2Material,
  prepTexture,
  rawColorFromString,
  ambientColor,
  fogSettings,
} from '../ps2/PS2Material'
import { CuboidCollider } from '@react-three/rapier'
import { addCollider } from './collision'
import { Rat } from './Rat'
import { Surface } from './Surface'
import { SewerWing } from './SewerWing'
import { LoadingDock } from './LoadingDock'
import { Office } from './Office'
import { PlacedItems } from './PlacedItems'
import { useEditor } from './editorStore'

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
export const TEXTURE_OPTIONS = Object.keys(TEXTURE_URLS)

const PILLARS: [number, number][] = [
  [-12, -6.8],
  [0, -6.8],
  [12, -6.8],
  [-12, 6.8],
  [0, 6.8],
  [12, 6.8],
]

export function Room() {
  const textures = useTexture(TEXTURE_URLS, (loaded) => Object.values(loaded).forEach(prepTexture))

  // world settings live in layout.json, edited via the editor's World tab
  const { world } = useEditor()
  const { walls, floor, ceiling } = world

  // push ambient + fog into the shared shader uniforms
  useEffect(() => {
    ambientColor.copy(rawColorFromString(world.ambient))
  }, [world.ambient])
  useEffect(() => {
    fogSettings.color.copy(rawColorFromString(world.fog.color))
    fogSettings.near.value = world.fog.near
    fogSettings.far.value = world.fog.far
  }, [world.fog.color, world.fog.near, world.fog.far])

  const wallMap = textures[walls.texture] ?? textures.Concrete031
  const floorMap = textures[floor.texture] ?? textures.Concrete034
  const ceilingMap = textures[ceiling.texture] ?? textures.CorrugatedSteel005

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
  const wallBombing = walls.bombing

  return (
    <group>
      <SewerWing />
      <LoadingDock />
      <Office />

      {/* floor / ceiling — floor tinted down so it sits darker than the walls */}
      <Surface size={[W, D]} segments={[40, 24]} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} map={floorMap} repeat={[floor.repeatX, floor.repeatY]} color={floor.tint} bombing={floor.bombing} />
      <Surface size={[W, D]} segments={[40, 24]} position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]} map={ceilingMap} repeat={[ceiling.repeatX, ceiling.repeatY]} color={ceiling.tint} bombing={ceiling.bombing} />

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

      {/* lamps are layout items now (kind: 'lamp') — see PlacedItems */}

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
