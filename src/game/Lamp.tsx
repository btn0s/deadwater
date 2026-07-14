import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import {
  rawColor,
  rawColorFromString,
  lightPositions,
  lightColors,
  lightRadii,
  lightSpots,
} from '../ps2/PS2Material'
import { applyPS2Materials, MODELS } from './Prop'

// nominal bulb-glass tint at full brightness (matches applyPS2Materials' glass)
const GLASS_WARM = rawColor(0xf3f0da)
// a dead bulb still reads as dark glass, not a black hole
const GLASS_FLOOR = 0.12

export interface LampSettings {
  position: [number, number, number]
  /** shared light slot (0-11) */
  lightIndex: number
  /** emitter height (world y); defaults to 1.4m below the mount */
  lightY?: number
  color?: string
  intensity?: number
  radius?: number
  flicker?: boolean
  /** editor: world position for the light when the visual is wrapper-relative */
  lightAt?: [number, number, number]
}

/**
 * Hanging lamp fixture — a self-contained light entity. Owns its light slot
 * (position/color/radius/spot), runs its own telegraph flicker when enabled,
 * and drives the bulb-glass glow from the light's live level so the visual
 * and the light never desync.
 *
 * Purely visual: no physics, no player collider (fixtures hang overhead).
 */
export function Lamp({ position, lightIndex, lightY, color = '#d8e6c8', intensity = 1.2, radius = 18, flicker = false, lightAt }: LampSettings) {
  const { scene } = useGLTF(MODELS.hangingLamp)
  const lastLevel = useRef(-1)
  const flickerState = useRef({ on: true, nextToggle: 0.5 + (lightIndex % 3) })
  const settings = useRef({ color, intensity, flicker })
  settings.current = { color, intensity, flicker }

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

  // claim + configure the light slot
  useEffect(() => {
    const p = lightAt ?? position
    lightPositions[lightIndex].set(p[0], lightY ?? p[1] - 1.4, p[2])
    lightColors[lightIndex].copy(rawColorFromString(color)).multiplyScalar(intensity)
    lightRadii[lightIndex] = radius
    lightSpots[lightIndex] = 1
    lastLevel.current = -1
    return () => {
      // release: park the light far away and dark
      lightPositions[lightIndex].set(0, -1000, 0)
      lightColors[lightIndex].setRGB(0, 0, 0)
    }
  }, [lightIndex, position, lightY, color, intensity, radius, lightAt])

  useFrame(({ clock }) => {
    const s = settings.current
    let level = 1
    const f = flickerState.current
    if (s.flicker) {
      const t = clock.elapsedTime
      if (t > f.nextToggle) {
        f.on = !f.on
        // long stretches lit, short violent dropouts — HL2 fluorescent cadence
        f.nextToggle = t + (f.on ? 0.4 + Math.random() * 2.5 : 0.04 + Math.random() * 0.18)
      }
      level = f.on ? 1 : 0.07
    }
    if (level !== lastLevel.current) {
      lastLevel.current = level
      lightColors[lightIndex].copy(rawColorFromString(s.color)).multiplyScalar(s.intensity * level)
      const glow = Math.max(level, GLASS_FLOOR)
      for (const c of glassColors) c.copy(GLASS_WARM).multiplyScalar(glow)
    }
  })

  return (
    <group position={position}>
      <primitive object={cloned} />
    </group>
  )
}
