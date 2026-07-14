import { useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { createPS2Material, prepTexture } from '../ps2/PS2Material'
import { useGrabbable } from './grabbables'

interface PropProps {
  url: string
  position: [number, number, number]
  rotationY?: number
  scale?: number
  collide?: boolean
  grabbable?: boolean
}

/** Swap every mesh's material for the PS2 vertex-lit equivalent, in place. */
function applyPS2Materials(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const src = (Array.isArray(obj.material) ? obj.material[0] : obj.material) as THREE.MeshStandardMaterial
      const map = src.map ? prepTexture(src.map) : null
      // emissive parts (lamp bulbs/glass) render fullbright, era-style
      const fullbright = !!src.emissiveMap
      obj.material = createPS2Material({ map, fullbright })
      obj.castShadow = false
      obj.receiveShadow = false
    }
  })
}

export function Prop({ url, position, rotationY = 0, scale = 1, collide = true, grabbable = false }: PropProps) {
  const { scene } = useGLTF(url)
  const group = useRef<THREE.Group>(null)

  const cloned = useMemo(() => {
    const c = scene.clone(true)
    applyPS2Materials(c)
    return c
  }, [scene])

  useGrabbable(group, { collide, grabbable })

  return (
    <group ref={group} position={position} rotation-y={rotationY} scale={scale}>
      <primitive object={cloned} />
    </group>
  )
}

interface SplitPropProps {
  url: string
  position: [number, number, number]
  rotationY?: number
  /** maps a mesh name to a piece key; meshes sharing a key move as one piece.
   * Default: every mesh is its own piece. */
  groupBy?: (meshName: string) => string
}

/** minimum horizontal extent before a piece blocks the player */
const COLLIDE_EXTENT = 0.45

function Piece({ object, position, rotationY, collide }: {
  object: THREE.Group
  position: [number, number, number]
  rotationY: number
  collide: boolean
}) {
  const group = useRef<THREE.Group>(null)
  useGrabbable(group, { collide, grabbable: true })
  return (
    <group ref={group} position={position} rotation-y={rotationY}>
      <primitive object={object} />
    </group>
  )
}

/**
 * Like Prop, but every piece of the model (grouped by `groupBy`) becomes its
 * own independently grabbable object with a pivot recentered on the piece.
 */
export function SplitProp({ url, position, rotationY = 0, groupBy = (n) => n }: SplitPropProps) {
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

    // recenter each piece's pivot on its horizontal bounds center
    return [...buckets.values()].map((meshes) => {
      const container = new THREE.Group()
      meshes.forEach((m) => container.add(m))
      const box = new THREE.Box3().setFromObject(container)
      const center = box.getCenter(new THREE.Vector3())
      const offset = new THREE.Vector3(center.x, 0, center.z)
      meshes.forEach((m) => m.position.sub(offset))
      const extent = Math.max(box.max.x - box.min.x, box.max.z - box.min.z)
      return { container, offset, collide: extent > COLLIDE_EXTENT }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  const sin = Math.sin(rotationY)
  const cos = Math.cos(rotationY)
  return (
    <>
      {pieces.map((p, i) => (
        <Piece
          key={i}
          object={p.container}
          position={[
            position[0] + p.offset.x * cos + p.offset.z * sin,
            position[1],
            position[2] - p.offset.x * sin + p.offset.z * cos,
          ]}
          rotationY={rotationY}
          collide={p.collide}
        />
      ))}
    </>
  )
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
}

Object.values(MODELS).forEach((url) => useGLTF.preload(url))
