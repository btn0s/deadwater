import { useEffect, useMemo, useRef } from 'react'
import { useGLTF, useFBX, useTexture } from '@react-three/drei'
import { RigidBody, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { createPS2Material, prepTexture } from '../ps2/PS2Material'
import { addCollider } from './collision'
import { registerGrabbable } from './grabbables'

/** Swap every mesh's material for the PS2 vertex-lit equivalent, in place. */
export function applyPS2Materials(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const src = (Array.isArray(obj.material) ? obj.material[0] : obj.material) as THREE.MeshStandardMaterial
      // "glass" can live on the mesh OR the material name (gltf sub-primitives
      // get generic mesh names like Cylinder_1)
      if (obj.name.toLowerCase().includes('glass') || src.name?.toLowerCase().includes('glass')) {
        // bulb glass renders as a lit diffuser: fullbright, warm lamp white —
        // PS2 games drew light sources as unlit bright geometry
        obj.material = createPS2Material({ fullbright: true, color: 0xf3f0da })
      } else {
        // housing stays scene-lit; emissive texels (the bulb) glow additively
        const map = src.map ? prepTexture(src.map) : null
        const emissiveMap = src.emissiveMap ? prepTexture(src.emissiveMap) : null
        obj.material = createPS2Material({ map, emissiveMap })
      }
      obj.castShadow = false
      obj.receiveShadow = false
    }
  })
}

/** Dynamic physics body that the telekinesis system can pick up. */
export function GrabbablePiece({ object, position, rotationY = 0, inert = false }: {
  object: THREE.Object3D
  position: [number, number, number]
  rotationY?: number
  /** editor mode: render visuals only — no physics, no grab registration */
  inert?: boolean
}) {
  const body = useRef<RapierRigidBody>(null)
  const inner = useRef<THREE.Group>(null)

  useEffect(() => {
    if (inert || !body.current || !inner.current) return
    const box = new THREE.Box3().setFromObject(inner.current)
    const radius = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2
    return registerGrabbable({ root: inner.current, body: body.current, radius })
  }, [inert])

  if (inert) {
    return (
      <group position={position} rotation={[0, rotationY, 0]}>
        <primitive object={object} />
      </group>
    )
  }

  return (
    <RigidBody
      ref={body}
      colliders="hull"
      position={position}
      rotation={[0, rotationY, 0]}
      linearDamping={0.2}
      angularDamping={0.8}
      ccd
    >
      <group ref={inner}>
        <primitive object={object} />
      </group>
    </RigidBody>
  )
}

interface PropProps {
  url: string
  position: [number, number, number]
  rotationY?: number
  scale?: number
  /** static props only: block the player with an AABB */
  collide?: boolean
  grabbable?: boolean
  /** static props only: fixed physics collider shape for junk to rest against */
  physics?: 'hull' | 'trimesh' | 'none'
  /** editor mode: visuals only */
  inert?: boolean
}

export function Prop({ url, position, rotationY = 0, scale = 1, collide = true, grabbable = false, physics = 'hull', inert = false }: PropProps) {
  const { scene } = useGLTF(url)
  const group = useRef<THREE.Group>(null)

  const cloned = useMemo(() => {
    const c = scene.clone(true)
    applyPS2Materials(c)
    return c
  }, [scene])

  // static props register a player-blocking AABB once
  useEffect(() => {
    if (inert || grabbable || !collide || !group.current) return
    const box = new THREE.Box3().setFromObject(group.current)
    return addCollider({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z })
  }, [collide, grabbable, inert])

  if (grabbable) {
    return <GrabbablePiece object={cloned} position={position} rotationY={rotationY} inert={inert} />
  }

  const visual = (
    <group ref={group} position={position} rotation-y={rotationY} scale={scale}>
      <primitive object={cloned} />
    </group>
  )
  if (inert || physics === 'none') return visual
  return (
    <RigidBody type="fixed" colliders={physics}>
      {visual}
    </RigidBody>
  )
}

interface SplitPropProps {
  url: string
  position: [number, number, number]
  rotationY?: number
  /** maps a mesh name to a piece key; meshes sharing a key move as one piece.
   * Default: every mesh is its own piece. */
  groupBy?: (meshName: string) => string
  inert?: boolean
}

/**
 * Like Prop, but every piece of the model (grouped by `groupBy`) becomes its
 * own independently grabbable object with a pivot recentered on the piece.
 */
export function SplitProp({ url, position, rotationY = 0, groupBy = (n) => n, inert = false }: SplitPropProps) {
  const { scene } = useGLTF(url)

  const pieces = useMemo(() => {
    const c = scene.clone(true)
    applyPS2Materials(c)
    c.updateMatrixWorld(true)

    // bake each mesh's model-space transform, bucketed into pieces
    const buckets = new Map<string, THREE.Mesh[]>()
    c.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mesh = new THREE.Mesh(obj.geometry, obj.material)
        mesh.applyMatrix4(obj.matrixWorld)
        const key = groupBy(obj.name)
        buckets.get(key)?.push(mesh) ?? buckets.set(key, [mesh])
      }
    })

    // recenter each piece's pivot on its bounds center so it spins in place
    return [...buckets.values()].map((meshes) => {
      const container = new THREE.Group()
      meshes.forEach((m) => container.add(m))
      const box = new THREE.Box3().setFromObject(container)
      const center = box.getCenter(new THREE.Vector3())
      const offset = new THREE.Vector3(center.x, 0, center.z)
      meshes.forEach((m) => m.position.sub(offset))
      return { container, offset }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  const sin = Math.sin(rotationY)
  const cos = Math.cos(rotationY)
  return (
    <>
      {pieces.map((p, i) => (
        <GrabbablePiece
          key={i}
          object={p.container}
          position={[
            position[0] + p.offset.x * cos + p.offset.z * sin,
            position[1],
            position[2] - p.offset.x * sin + p.offset.z * cos,
          ]}
          rotationY={rotationY}
          inert={inert}
        />
      ))}
    </>
  )
}

interface FbxPropProps {
  url: string
  textureUrl: string
  position: [number, number, number]
  rotationY?: number
  scale?: number
  collide?: boolean
  grabbable?: boolean
  physics?: 'hull' | 'trimesh' | 'none'
  inert?: boolean
}

/**
 * FBX prop (itch.io packs): loads the mesh + its base-color map explicitly,
 * swaps in the PS2 material, and normalizes cm-scale exports to meters.
 */
export function FbxProp({ url, textureUrl, position, rotationY = 0, scale = 1, collide = true, grabbable = false, physics = 'hull', inert = false }: FbxPropProps) {
  const fbx = useFBX(url)
  const map = useTexture(textureUrl)
  const group = useRef<THREE.Group>(null)

  const cloned = useMemo(() => {
    const c = fbx.clone(true)
    const box = new THREE.Box3().setFromObject(c)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    // cm-unit exports come in ~100x too big
    const unit = maxDim > 8 ? 0.01 : 1
    c.scale.setScalar(unit * scale)
    // rebase so the model's lowest point sits at y=0
    c.updateMatrixWorld(true)
    const scaled = new THREE.Box3().setFromObject(c)
    c.position.y -= scaled.min.y
    const material = createPS2Material({ map: prepTexture(map) })
    c.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.material = material
        obj.castShadow = false
        obj.receiveShadow = false
      }
    })
    return c
  }, [fbx, map, scale])

  useEffect(() => {
    if (inert || grabbable || !collide || !group.current) return
    const box = new THREE.Box3().setFromObject(group.current)
    return addCollider({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z })
  }, [collide, grabbable, inert])

  if (grabbable) {
    return <GrabbablePiece object={cloned} position={position} rotationY={rotationY} inert={inert} />
  }
  const visual = (
    <group ref={group} position={position} rotation-y={rotationY}>
      <primitive object={cloned} />
    </group>
  )
  if (inert || physics === 'none') return visual
  return (
    <RigidBody type="fixed" colliders={physics}>
      {visual}
    </RigidBody>
  )
}

const IP = '/models/industrial-pack'
const IP2 = '/models/industrial-pack2'
export const FBX_MODELS = {
  palletTruck: { url: `${IP}/PalletTruck/PalletTruck.fbx`, tex: `${IP}/PalletTruck/PalletTruck_Base_Color.png` },
  trolley: { url: `${IP}/Platform_Trolley/Platform_Trolley.fbx`, tex: `${IP}/Platform_Trolley/Platform_Trolley_Base_Color.png` },
  electricalBox: { url: `${IP}/ElectricalBox/ElectricalBox.fbx`, tex: `${IP}/ElectricalBox/ElectricalBox_Base_Color.png` },
  electricalBox2: { url: `${IP}/ElectricalBox02/ElectricalBox02.fbx`, tex: `${IP}/ElectricalBox02/ElectricalBox02_Base_Color.png` },
  cableDrum: { url: `${IP}/CableDrum/CableDrum.fbx`, tex: `${IP}/CableDrum/CableDrum_Base_Color.png` },
  workLight: { url: `${IP}/WorkLight/WorkLight.fbx`, tex: `${IP}/WorkLight/WorkLight_Base_Color.png` },
  workLight2: { url: `${IP}/Worklight02/WorkLight02.fbx`, tex: `${IP}/Worklight02/WorkLight02_Base_Color.png` },
  gasCylinder: { url: `${IP}/Gas_Cylinder/Gas_Cylinder.fbx`, tex: `${IP}/Gas_Cylinder/Gas_Cylinder_Base_Color.png` },
  gasCan: { url: `${IP}/Gas_can/Gas_Canister.fbx`, tex: `${IP}/Gas_can/GasCan_Base_Color.png` },
  waterBarrel: { url: `${IP}/Water_Barrel/Water_Barrel.fbx`, tex: `${IP}/Water_Barrel/Water_Barrel_Base_Color.png` },
  explosiveBarrel2: { url: `${IP}/ExplosiveBarrel/ExplosiveBarrel.fbx`, tex: `${IP}/ExplosiveBarrel/ExplosiveBarrel_Base_Color.png` },
  carJack: { url: `${IP}/Car_Jack/CarJack.fbx`, tex: `${IP}/Car_Jack/CarJack_Base_Color.png` },
  pallet: { url: `${IP2}/Wood_Pallet/Wood_Pallet.fbx`, tex: `${IP2}/Wood_Pallet/Wood_Pallet_Base_Color.png` },
  locker: { url: `${IP2}/Locker/Locker.fbx`, tex: `${IP2}/Locker/Locker_Base_Color.png` },
  cautionSign: { url: `${IP2}/CautionSign_WetFloor/Caution_Sign.fbx`, tex: `${IP2}/CautionSign_WetFloor/Caution_Sign_Base_Color.png` },
  fireExtinguisher: { url: `${IP2}/Fire_Extinguisher/Fire_extinguisher.fbx`, tex: `${IP2}/Fire_Extinguisher/Fire_extinguisher_Base_Color.png` },
  cementMixer: { url: `${IP2}/Cement_Mixer/Cement_Mixer.fbx`, tex: `${IP2}/Cement_Mixer/Cement_Mixer_Base_Color.png` },
  generator2: { url: `${IP2}/Generator/Generator.fbx`, tex: `${IP2}/Generator/Generator_Base_Color.png` },
  motorOil: { url: `${IP2}/Motor_Oil/Motor_Oil.fbx`, tex: `${IP2}/Motor_Oil/Motor_Oil_Base_Color.png` },
  sprayCan: { url: `${IP2}/SprayCan/Spray_can.fbx`, tex: `${IP2}/SprayCan/SprayCan_Base_Color.png` },
}

export const MODELS = {
  barrelExplosive: '/models/Barrel_01/Barrel_01_1k.gltf',
  barrel: '/models/barrel_03/barrel_03_1k.gltf',
  cardboardBox: '/models/cardboard_box_01/cardboard_box_01_1k.gltf',
  ammoBox: '/models/ammo_box/ammo_box_1k.gltf',
  hangingLamp: '/models/hanging_industrial_lamp/hanging_industrial_lamp_1k.gltf',
  canRusted: '/models/can_rusted/can_rusted_1k.gltf',
  foodCans: '/models/russian_food_cans_01/russian_food_cans_01_1k.gltf',
  jerrycan: '/models/metal_jerrycan/metal_jerrycan_1k.gltf',
  oilTin: '/models/oil_tin/oil_tin_1k.gltf',
  plasticCrate: '/models/plastic_crate_01/plastic_crate_01_1k.gltf',
  woodenCrate: '/models/wooden_crate_01/wooden_crate_01_1k.gltf',
  militaryCrate: '/models/old_military_crate/old_military_crate_1k.gltf',
  trashCan: '/models/metal_trash_can/metal_trash_can_1k.gltf',
  trashbag: '/models/trashbag/trashbag_1k.gltf',
  compressor: '/models/old_military_compressor/old_military_compressor_1k.gltf',
  generator: '/models/portable_generator/portable_generator_1k.gltf',
  propaneTank: '/models/propane_tank/propane_tank_1k.gltf',
  table: '/models/WoodenTable_02/WoodenTable_02_1k.gltf',
  chair: '/models/painted_wooden_chair_01/painted_wooden_chair_01_1k.gltf',
  cabinet: '/models/drawer_cabinet/drawer_cabinet_1k.gltf',
  binder: '/models/binder_notebook/binder_notebook_1k.gltf',
  toolbox: '/models/metal_toolbox/metal_toolbox_1k.gltf',
}

Object.values(MODELS).forEach((url) => useGLTF.preload(url))
