import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { createPS2Material } from '../ps2/PS2Material'
import { useGrabbable } from './grabbables'

// deterministic PRNG so each wad crumples the same way every mount
function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface PaperWadProps {
  position: [number, number, number]
  seed?: number
  size?: number
}

/** Low-poly crumpled paper ball — a jittered icosahedron with flat facets. */
export function PaperWad({ position, seed = 1, size = 0.09 }: PaperWadProps) {
  const group = useRef<THREE.Group>(null)

  const { geometry, material, rotation } = useMemo(() => {
    const rand = mulberry32(seed)
    const geo = new THREE.IcosahedronGeometry(size, 1)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const scale = 0.72 + rand() * 0.55
      pos.setXYZ(i, pos.getX(i) * scale, pos.getY(i) * scale, pos.getZ(i) * scale)
    }
    const flat = geo.toNonIndexed()
    flat.computeVertexNormals()
    geo.dispose()
    const material = createPS2Material({ color: 0xd9d5c9 })
    return { geometry: flat, material, rotation: rand() * Math.PI * 2 }
  }, [seed, size])

  useGrabbable(group, { collide: false, grabbable: true })

  return (
    <group ref={group} position={position} rotation-y={rotation}>
      <mesh geometry={geometry} material={material} position={[0, size * 0.8, 0]} />
    </group>
  )
}
