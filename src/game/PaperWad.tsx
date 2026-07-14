import { useMemo } from 'react'
import * as THREE from 'three'
import { createPS2Material } from '../ps2/PS2Material'
import { GrabbablePiece } from './Prop'
import { mulberry32 } from './rand'

interface PaperWadProps {
  position: [number, number, number]
  seed?: number
  size?: number
}

/** Low-poly crumpled paper ball — a jittered icosahedron with flat facets. */
export function PaperWad({ position, seed = 1, size = 0.09 }: PaperWadProps) {
  const { object, rotation } = useMemo(() => {
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
    const object = new THREE.Group()
    const mesh = new THREE.Mesh(flat, material)
    mesh.position.y = size * 0.8
    object.add(mesh)
    return { object, rotation: rand() * Math.PI * 2 }
  }, [seed, size])

  return <GrabbablePiece object={object} position={position} rotationY={rotation} />
}
