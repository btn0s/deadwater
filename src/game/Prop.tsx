import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { createPS2Material, prepTexture } from '../ps2/PS2Material'
import { addCollider } from './collision'

interface PropProps {
  url: string
  position: [number, number, number]
  rotationY?: number
  scale?: number
  collide?: boolean
}

export function Prop({ url, position, rotationY = 0, scale = 1, collide = true }: PropProps) {
  const { scene } = useGLTF(url)
  const group = useRef<THREE.Group>(null)

  const cloned = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const src = obj.material as THREE.MeshStandardMaterial
        const map = src.map ? prepTexture(src.map) : null
        // emissive parts (lamp bulbs/glass) render fullbright, era-style
        const fullbright = !!src.emissiveMap || src.emissiveIntensity > 0.5
        obj.material = createPS2Material({ map, fullbright })
        obj.castShadow = false
        obj.receiveShadow = false
      }
    })
    return c
  }, [scene])

  useEffect(() => {
    if (!collide || !group.current) return
    const box = new THREE.Box3().setFromObject(group.current)
    return addCollider({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z })
  }, [collide])

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
}

Object.values(MODELS).forEach((url) => useGLTF.preload(url))
