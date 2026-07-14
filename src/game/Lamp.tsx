import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { rawColor, lightColors } from '../ps2/PS2Material'
import { applyPS2Materials, MODELS } from './Prop'

// nominal bulb-glass tint at full brightness (matches applyPS2Materials' glass)
const GLASS_WARM = rawColor(0xf3f0da)
// a dead bulb still reads as dark glass, not a black hole
const GLASS_FLOOR = 0.12

function luminance(c: THREE.Color): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
}

/**
 * Hanging lamp fixture whose glowing glass tracks its point light: the glass
 * gets per-instance fullbright materials (via applyPS2Materials — each clone's
 * meshes own their ShaderMaterials), and every frame the light's current
 * luminance — normalized by the brightest value seen so far — is written into
 * the glass uColor. When the flicker drops lightColors[lightIndex] out, the
 * bulb goes dark with it.
 *
 * Purely visual: no physics, no player collider (fixtures hang overhead).
 */
export function Lamp({ position, lightIndex }: {
  position: [number, number, number]
  lightIndex: number
}) {
  const { scene } = useGLTF(MODELS.hangingLamp)
  const maxLum = useRef(0)
  const lastLevel = useRef(-1)

  const { cloned, glassColors } = useMemo(() => {
    const c = scene.clone(true)
    applyPS2Materials(c)
    // glass is the only part applyPS2Materials marks fullbright; grab its
    // per-instance uColor values so we can mutate them each frame
    const glassColors: THREE.Color[] = []
    c.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.ShaderMaterial) {
        if (obj.material.uniforms.uFullbright?.value === 1) {
          glassColors.push(obj.material.uniforms.uColor.value as THREE.Color)
        }
      }
    })
    return { cloned: c, glassColors }
  }, [scene])

  useFrame(() => {
    const lum = luminance(lightColors[lightIndex])
    if (lum > maxLum.current) maxLum.current = lum
    const level = maxLum.current > 0
      ? THREE.MathUtils.clamp(lum / maxLum.current, GLASS_FLOOR, 1)
      : 1
    if (level === lastLevel.current) return
    lastLevel.current = level
    for (const color of glassColors) color.copy(GLASS_WARM).multiplyScalar(level)
  })

  return (
    <group position={position}>
      <primitive object={cloned} />
    </group>
  )
}
