import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { createPS2Material } from '../ps2/PS2Material'

export interface SurfaceProps {
  size: [number, number]
  segments: [number, number]
  position: [number, number, number]
  rotation?: [number, number, number]
  map: THREE.Texture
  repeat: [number, number]
  color?: number | string
  bombing?: number
}

/** A tessellated textured plane using the PS2 vertex-lit material. */
export function Surface({ size, segments, position, rotation = [0, 0, 0], map, repeat, color, bombing = 0 }: SurfaceProps) {
  const material = useMemo(
    () => createPS2Material({ map, repeat, color, bombing }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, repeat[0], repeat[1], color, bombing],
  )
  useEffect(() => () => material.dispose(), [material])
  return (
    <mesh position={position} rotation={rotation} material={material}>
      <planeGeometry args={[size[0], size[1], segments[0], segments[1]]} />
    </mesh>
  )
}
