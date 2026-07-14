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

export function Prop({ url, position, rotationY = 0, scale = 1, collide = true, grabbable = false }: PropProps) {
  const { scene } = useGLTF(url)
  const group = useRef<THREE.Group>(null)

  const cloned = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const src = obj.material as THREE.MeshStandardMaterial
        const map = src.map ? prepTexture(src.map) : null
        // emissive parts (lamp bulbs/glass) render fullbright, era-style
        const fullbright = !!src.emissiveMap
        obj.material = createPS2Material({ map, fullbright })
        obj.castShadow = false
        obj.receiveShadow = false
      }
    })
    return c
  }, [scene])

  useGrabbable(group, { collide, grabbable })

  return (
    <group ref={group} position={position} rotation-y={rotationY} scale={scale}>
      <primitive object={cloned} />
    </group>
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
