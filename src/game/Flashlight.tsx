import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  rawColorFromString,
  lightPositions,
  lightColors,
  lightRadii,
  lightSpots,
  lightDirs,
  lightCones,
} from '../ps2/PS2Material'
import { acquireLightSlot, releaseLightSlot } from '../engine/lights'
import { torchCamera, torchShadowUniforms } from '../ps2/torchShadow'
import { waterMeshes } from '../ps2/sceneDepth'
import { useInventory } from './inventory'

const COLOR = '#e8e2c8'
const INTENSITY = 2.6
const RADIUS = 30
const CONE = Math.cos(0.26) // ~15° hot cone (+0.06 soft halo in the shader)

// visible beam shaft: long and tight — reaches without filling the screen
const BEAM_LEN = 11
const BEAM_RADIUS = Math.tan(0.23) * BEAM_LEN

/** soft warm gradient along the shaft: bright at the hand, gone at the tip */
function makeBeamTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = 1
  c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 64, 0, 0) // v=0 (base/far) → v=1 (apex)
  g.addColorStop(0, 'rgba(120, 116, 92, 0)')
  g.addColorStop(0.3, 'rgba(140, 136, 108, 0.06)')
  g.addColorStop(0.8, 'rgba(190, 184, 150, 0.16)')
  g.addColorStop(1, 'rgba(220, 214, 176, 0.3)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 1, 64)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.NoColorSpace
  return tex
}

/**
 * Equippable flashlight: while the TORCH slot is active, an aimed per-vertex
 * spotlight (SH2 school) follows the camera. Held slightly right of the eye
 * so nearby geometry gets a hint of parallax.
 */
export function Flashlight() {
  const camera = useThree((s) => s.camera)
  const { slots, active } = useInventory()
  const equipped = slots[active]?.id === 'flashlight'
  const slot = useRef(-1)
  const beam = useRef<THREE.Mesh>(null)

  const { beamGeometry, beamMaterial } = useMemo(() => {
    // apex at the origin, opening down -y; oriented per-frame to the aim
    const geo = new THREE.ConeGeometry(BEAM_RADIUS, BEAM_LEN, 18, 1, true)
    geo.translate(0, -BEAM_LEN / 2, 0)
    // soft shaft: gradient along the length x facing-ratio fade so the
    // silhouette edges melt instead of drawing a hard wedge
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vUv = uv;
          vN = normalMatrix * normal;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        varying vec2 vUv;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vec4 g = texture2D(map, vUv);
          float facing = abs(dot(normalize(vN), normalize(vV)));
          gl_FragColor = vec4(g.rgb, g.a * pow(facing, 1.7));
        }
      `,
      uniforms: { map: { value: makeBeamTexture() } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    return { beamGeometry: geo, beamMaterial: mat }
  }, [])

  // keep the shaft out of the depth pre-passes (foam + shadow map) — it is
  // glow, not geometry
  useEffect(() => {
    const b = beam.current
    if (!equipped || !b) return
    waterMeshes.add(b)
    return () => {
      waterMeshes.delete(b)
    }
  }, [equipped])

  useEffect(() => {
    if (!equipped) return
    slot.current = acquireLightSlot()
    const i = slot.current
    if (i >= 0) {
      lightColors[i].copy(rawColorFromString(COLOR)).multiplyScalar(INTENSITY)
      lightRadii[i] = RADIUS
      lightSpots[i] = 0
      lightCones[i] = CONE
      torchShadowUniforms.uShadowSlot.value = i
      torchCamera.far = RADIUS
      torchCamera.updateProjectionMatrix()
    }
    return () => {
      releaseLightSlot(slot.current)
      slot.current = -1
      torchShadowUniforms.uShadowSlot.value = -1
    }
  }, [equipped])

  useFrame(() => {
    const i = slot.current
    if (i < 0) return
    const dir = camera.getWorldDirection(lightDirs[i])
    // beam origin: at the hand — a touch right of and below the eye
    const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize()
    lightPositions[i]
      .copy(camera.position)
      .addScaledVector(right, 0.3)
      .addScaledVector(dir, 0.2)
    lightPositions[i].y -= 0.32
    // the shadow camera looks down the beam
    torchCamera.position.copy(lightPositions[i])
    torchCamera.lookAt(
      lightPositions[i].x + dir.x,
      lightPositions[i].y + dir.y,
      lightPositions[i].z + dir.z,
    )
    // the visible shaft follows too
    const b = beam.current
    if (b) {
      b.position.copy(lightPositions[i])
      b.quaternion.setFromUnitVectors(DOWN, dir)
    }
  })

  if (!equipped) return null
  return <mesh ref={beam} geometry={beamGeometry} material={beamMaterial} renderOrder={3} frustumCulled={false} />
}

const DOWN = new THREE.Vector3(0, -1, 0)
