import { useEffect, useMemo, useRef } from 'react'
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
import { Prop, SplitProp, FbxProp, MODELS, FBX_MODELS } from './Prop'
import { PaperWad } from './PaperWad'
import { Rat } from './Rat'
import { TrashPile } from './TrashPile'
import { Surface } from './Surface'
import { SewerWing } from './SewerWing'
import { Rack } from './Rack'
import { LoadingDock } from './LoadingDock'
import { Office } from './Office'

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

/**
 * A shipment unit: wooden pallet with packages stacked on it. The medium
 * blockout vocabulary of a receiving dock — placed in lanes, not scattered.
 */
function LoadedPallet({ position, rotationY = 0, variant = 0 }: {
  position: [number, number]
  rotationY?: number
  variant?: 0 | 1 | 2
}) {
  const sin = Math.sin(rotationY)
  const cos = Math.cos(rotationY)
  const at = (ox: number, oy: number, oz: number): [number, number, number] => [
    position[0] + ox * cos + oz * sin,
    oy,
    position[1] - ox * sin + oz * cos,
  ]
  return (
    <group>
      <FbxProp url={FBX_MODELS.pallet.url} textureUrl={FBX_MODELS.pallet.tex} position={[position[0], 0, position[1]]} rotationY={rotationY} grabbable />
      {variant === 0 && (
        <>
          <Prop url={MODELS.cardboardBox} position={at(-0.25, 0.17, 0.2)} rotationY={rotationY + 0.05} collide={false} grabbable />
          <Prop url={MODELS.cardboardBox} position={at(0.3, 0.17, -0.15)} rotationY={rotationY + 1.62} collide={false} grabbable />
          <Prop url={MODELS.cardboardBox} position={at(0, 0.73, 0)} rotationY={rotationY + 0.9} collide={false} grabbable />
        </>
      )}
      {variant === 1 && (
        <>
          <Prop url={MODELS.woodenCrate} position={at(0, 0.17, 0)} rotationY={rotationY + 0.03} grabbable />
          <Prop url={MODELS.cardboardBox} position={at(-0.15, 0.8, 0.1)} rotationY={rotationY + 0.5} collide={false} grabbable />
        </>
      )}
      {variant === 2 && (
        <>
          <Prop url={MODELS.plasticCrate} position={at(-0.3, 0.17, -0.2)} rotationY={rotationY + 0.08} grabbable />
          <Prop url={MODELS.plasticCrate} position={at(0.35, 0.17, 0.15)} rotationY={rotationY + 1.55} grabbable />
          <Prop url={MODELS.ammoBox} position={at(0, 0.78, 0)} rotationY={rotationY + 0.4} collide={false} grabbable />
        </>
      )}
    </group>
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

      {/* ---- north wall storage, west of the hallway (approach stays clear) ---- */}
      <SplitProp
        url={MODELS.militaryCrate}
        position={[-15.4, 0, -10.5]}
        rotationY={0.35}
        groupBy={(n) => (n.endsWith('_a') ? 'a' : 'b')}
      />
      <Prop url={MODELS.woodenCrate} position={[-17.6, 0, -10.3]} rotationY={0.2} grabbable />
      <Prop url={MODELS.plasticCrate} position={[-13.9, 0, -9.8]} rotationY={1.9} grabbable />

      {/* ---- staged boxes east of the hallway, tucked to the wall ---- */}
      <Prop url={MODELS.cardboardBox} position={[-5.6, 0, -10.7]} rotationY={0.5} grabbable />
      <Prop url={MODELS.cardboardBox} position={[-5.7, 0.56, -10.8]} rotationY={1.1} collide={false} grabbable />
      <Prop url={MODELS.cardboardBox} position={[-4.7, 0, -11]} rotationY={2.8} grabbable />
      <PaperWad position={[-6.8, 0, -8.9]} seed={37} size={0.1} />

      {/* ---- storage racking along the south wall ----
           big (racks) -> medium (barrels, crate stacks at the ends) -> small (wads) */}
      <Rack position={[3, 11.35]} />
      <Rack position={[7, 11.35]} />
      <Rack position={[11, 11.35]} />
      {/* goods on the shelves (settle onto shelf colliders) */}
      <Prop url={MODELS.cardboardBox} position={[2, 1.1, 11.35]} rotationY={0.1} collide={false} grabbable />
      <Prop url={MODELS.cardboardBox} position={[3.8, 1.1, 11.3]} rotationY={1.6} collide={false} grabbable />
      <Prop url={MODELS.cardboardBox} position={[3.6, 0.2, 11.4]} rotationY={0.4} collide={false} grabbable />
      <Prop url={MODELS.ammoBox} position={[6.5, 1.1, 11.4]} rotationY={0.2} collide={false} grabbable />
      <Prop url={MODELS.ammoBox} position={[7.1, 1.1, 11.3]} rotationY={1.7} collide={false} grabbable />
      <Prop url={MODELS.oilTin} position={[7.9, 1.1, 11.3]} rotationY={2.2} collide={false} grabbable />
      <Prop url={MODELS.jerrycan} position={[7.5, 0.2, 11.5]} rotationY={1.2} collide={false} grabbable />
      <Prop url={MODELS.cardboardBox} position={[2.5, 1.95, 11.35]} rotationY={0.3} collide={false} grabbable />
      <Prop url={MODELS.cardboardBox} position={[10.4, 0.2, 11.4]} rotationY={2.9} collide={false} grabbable />
      <SplitProp url={MODELS.foodCans} position={[11.1, 1.12, 11.35]} rotationY={0.5} />
      <Prop url={MODELS.plasticCrate} position={[11.8, 1.12, 11.4]} rotationY={0.15} collide={false} grabbable />
      {/* end-of-row clusters */}
      <Prop url={MODELS.barrel} position={[0.2, 0, 11.1]} rotationY={1.9} />
      <Prop url={MODELS.barrel} position={[0.5, 0, 10]} rotationY={4.2} />
      <Prop url={MODELS.woodenCrate} position={[13.8, 0, 11.2]} rotationY={0.05} grabbable />
      <Prop url={MODELS.plasticCrate} position={[13.75, 0.62, 11.15]} rotationY={0.12} collide={false} grabbable />
      <PaperWad position={[13, 0, 10.2]} seed={13} size={0.08} />
      <PaperWad position={[1.3, 0, 9.4]} seed={17} size={0.07} />

      {/* ---- receiving lanes: loaded pallets staged in front of the bays,
           pallet truck parked mid-job — the room's story is an interrupted
           unload, not scattered junk ---- */}
      <LoadedPallet position={[15.3, 1.3]} rotationY={0.06} variant={0} />
      <LoadedPallet position={[15.5, -1.5]} rotationY={-0.09} variant={1} />
      <LoadedPallet position={[12.6, 0.1]} rotationY={0.14} variant={2} />
      <LoadedPallet position={[5, 9.5]} rotationY={1.55} variant={1} />

      {/* ---- central staging block: palletized inventory awaiting put-away,
           two neat rows with one empty slot — fills the mid-floor with an
           organized mass, aisles all around ---- */}
      <LoadedPallet position={[-1.6, -0.9]} rotationY={0.04} variant={1} />
      <LoadedPallet position={[0.3, -0.9]} rotationY={-0.07} variant={0} />
      <LoadedPallet position={[2.2, -0.9]} rotationY={0.11} variant={2} />
      <LoadedPallet position={[-1.6, 1.1]} rotationY={-0.05} variant={2} />
      <LoadedPallet position={[0.3, 1.1]} rotationY={0.09} variant={1} />
      {/* empty slot at (2.2, 1.1) — bare pallet, its load already shelved */}
      <FbxProp url={FBX_MODELS.pallet.url} textureUrl={FBX_MODELS.pallet.tex} position={[2.2, 0, 1.1]} rotationY={0.18} grabbable />
      <FbxProp url={FBX_MODELS.palletTruck.url} textureUrl={FBX_MODELS.palletTruck.tex} position={[13.9, 0, 1.9]} rotationY={3.05} />
      <FbxProp url={FBX_MODELS.trolley.url} textureUrl={FBX_MODELS.trolley.tex} position={[15.8, 0, -5.6]} rotationY={1.15} scale={0.7} />
      {/* empty pallet stack against the wall between bays */}
      <FbxProp url={FBX_MODELS.pallet.url} textureUrl={FBX_MODELS.pallet.tex} position={[18.4, 0, -3.8]} rotationY={0.05} grabbable />
      <FbxProp url={FBX_MODELS.pallet.url} textureUrl={FBX_MODELS.pallet.tex} position={[18.35, 0.16, -3.85]} rotationY={0.16} collide={false} grabbable />
      <FbxProp url={FBX_MODELS.pallet.url} textureUrl={FBX_MODELS.pallet.tex} position={[18.42, 0.32, -3.75]} rotationY={-0.06} collide={false} grabbable />
      <FbxProp url={FBX_MODELS.fireExtinguisher.url} textureUrl={FBX_MODELS.fireExtinguisher.tex} position={[19.5, 0, -4.4]} rotationY={3.6} scale={0.25} collide={false} grabbable />
      {/* wet-floor sign beside the sewer hallway mouth, out of the walk path */}
      <FbxProp url={FBX_MODELS.cautionSign.url} textureUrl={FBX_MODELS.cautionSign.tex} position={[-12.3, 0, -11]} rotationY={0.8} collide={false} grabbable />

      {/* ---- wall dressing by the hallway ---- */}
      <FbxProp url={FBX_MODELS.electricalBox.url} textureUrl={FBX_MODELS.electricalBox.tex} position={[-5.6, 1.25, -11.85]} physics="none" collide={false} />
      <FbxProp url={FBX_MODELS.electricalBox2.url} textureUrl={FBX_MODELS.electricalBox2.tex} position={[-4.2, 1.4, -11.85]} physics="none" collide={false} />
      <FbxProp url={FBX_MODELS.waterBarrel.url} textureUrl={FBX_MODELS.waterBarrel.tex} position={[-17.3, 0, -7.4]} rotationY={2.8} />

      {/* ---- stock corner, NE ---- */}
      <Prop url={MODELS.cardboardBox} position={[17.5, 0, -3]} grabbable />
      <Prop url={MODELS.cardboardBox} position={[17.4, 0, -1.7]} rotationY={0.4} grabbable />
      <Prop url={MODELS.cardboardBox} position={[17.45, 0.55, -2.4]} rotationY={0.9} collide={false} grabbable />
      <Prop url={MODELS.jerrycan} position={[18.3, 0, -4.1]} rotationY={0.9} collide={false} grabbable />
      <PaperWad position={[16.3, 0, -1]} seed={29} size={0.09} />

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

      {/* ---- trash corner, SE — THE trash zone: one can, one mound ---- */}
      <Prop url={MODELS.trashCan} position={[18.6, 0, 7.5]} rotationY={0.6} physics="trimesh" />
      <Prop url={MODELS.trashbag} position={[17.8, 0, 6.3]} rotationY={1.7} collide={false} grabbable />
      <TrashPile position={[16.8, 9]} radius={1.5} height={0.42} seed={900} items={8} />

      {/* ---- west wall storage, tucked against the office's south side ---- */}
      <Prop url={MODELS.barrel} position={[-18.5, 0, 3.7]} rotationY={0.4} />
      <Prop url={MODELS.barrel} position={[-18.2, 0, 5]} rotationY={4.1} />
      <Prop url={MODELS.plasticCrate} position={[-18.4, 0, 6.4]} rotationY={2.4} grabbable />

      {/* ---- hazard cue by the hallway mouth ---- */}
      <Prop url={MODELS.barrelExplosive} position={[-13.6, 0, -10.8]} rotationY={2.1} />

      {/* ---- pillar-base dressing, one quiet touch ---- */}
      <Prop url={MODELS.cardboardBox} position={[12.8, 0, -6.3]} rotationY={0.7} grabbable />
      <PaperWad position={[11.4, 0, -7.4]} seed={43} size={0.08} />

      {/* rats */}
      <Rat seed={101} spawn={[10, -10.5]} />
      <Rat seed={211} spawn={[-15, 9]} />
      <Rat seed={307} spawn={[18, -2]} />
      <Rat seed={401} spawn={[-4, 11]} />
      <Rat seed={503} spawn={[2, -10.5]} />
    </group>
  )
}
