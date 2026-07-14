import { useEffect, useMemo, useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { CuboidCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { createPS2Material, prepTexture } from '../ps2/PS2Material'
import { addCollider } from './collision'

const LEN = 4
const DEPTH = 1.1
const HEIGHT = 2.4
const SHELF_YS = [0.12, 1.0, 1.85]

/**
 * Industrial pallet-rack shelving: four uprights and three shelf boards.
 * Static architecture — junk can be placed (or thrown) onto the shelves.
 */
export function Rack({ position, rotationY = 0, inert = false }: { position: [number, number]; rotationY?: number; inert?: boolean }) {
  const plates = useTexture('/textures/MetalPlates006.jpg', prepTexture)
  const frameMaterial = useMemo(() => createPS2Material({ color: 0x5a5148 }), [])
  const shelfMaterial = useMemo(() => createPS2Material({ map: plates, repeat: [3, 1], color: 0x9aa0a4 }), [plates])
  const group = useRef<THREE.Group>(null)

  // player AABB from the rotated footprint
  useEffect(() => {
    if (inert) return
    const cos = Math.abs(Math.cos(rotationY))
    const sin = Math.abs(Math.sin(rotationY))
    const hx = (LEN * cos + DEPTH * sin) / 2
    const hz = (LEN * sin + DEPTH * cos) / 2
    return addCollider({
      minX: position[0] - hx,
      maxX: position[0] + hx,
      minZ: position[1] - hz,
      maxZ: position[1] + hz,
    })
  }, [position, rotationY, inert])

  return (
    <group ref={group} position={[position[0], 0, position[1]]} rotation-y={rotationY}>
      {/* uprights */}
      {[-LEN / 2 + 0.06, LEN / 2 - 0.06].map((x) =>
        [-DEPTH / 2 + 0.06, DEPTH / 2 - 0.06].map((z) => (
          <mesh key={`${x},${z}`} material={frameMaterial} position={[x, HEIGHT / 2, z]}>
            <boxGeometry args={[0.09, HEIGHT, 0.09]} />
          </mesh>
        )),
      )}
      {/* shelves, with fixed colliders so goods rest on them */}
      {SHELF_YS.map((y) => (
        <group key={y}>
          <mesh material={shelfMaterial} position={[0, y, 0]}>
            <boxGeometry args={[LEN, 0.07, DEPTH]} />
          </mesh>
          {!inert && <CuboidCollider args={[LEN / 2, 0.035, DEPTH / 2]} position={[0, y, 0]} />}
        </group>
      ))}
      {/* top beam */}
      <mesh material={frameMaterial} position={[0, HEIGHT, 0]}>
        <boxGeometry args={[LEN, 0.08, DEPTH]} />
      </mesh>
    </group>
  )
}
