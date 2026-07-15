import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  createPS2Material,
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
import { registerPrimaryAction } from './equipmentActions'
import { play } from './audio'

const COLOR = '#e8e2c8'
const INTENSITY = 4.5 // super bright — the hot center saturates to white
const RADIUS = 30
const CONE = Math.cos(0.26) // ~15° hot cone (+0.06 soft halo in the shader)

// where the torch sits in CAMERA space: right of and below the eye, a
// touch forward. Applied through the camera's quaternion every frame, so
// the rig is rigidly welded to the view — no drift, no look-down swing.
const ANCHOR = new THREE.Vector3(0.3, -0.32, -0.22)

// visible beam shaft: long and tight — reaches without filling the screen
const BEAM_LEN = 11
const BEAM_RADIUS = Math.tan(0.23) * BEAM_LEN

const FORWARD = new THREE.Vector3()
const WORLD_ANCHOR = new THREE.Vector3()
const AIM_POINT = new THREE.Vector3()
const AIM_DIR = new THREE.Vector3()
const DOWN = new THREE.Vector3(0, -1, 0)
const CENTER = new THREE.Vector2(0, 0)
const RIG_INV = new THREE.Quaternion()
const BEAM_WORLD = new THREE.Quaternion()
let flashlightPowered = false

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
 * Equippable torch: a camera-welded viewmodel (body + lens + visible beam
 * shaft) driving a per-fragment shadow-mapped spotlight.
 */
export function Flashlight() {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const { slots, active, stowed, carryLock } = useInventory()
  const equipped = !stowed && !carryLock && slots[active]?.id === 'flashlight'
  const [powered, setPowered] = useState(false)
  const equippedRef = useRef(equipped)
  const slot = useRef(-1)
  const rig = useRef<THREE.Group>(null)
  const beam = useRef<THREE.Mesh>(null)
  const aimCaster = useRef(new THREE.Raycaster())

  equippedRef.current = equipped
  flashlightPowered = powered

  const { beamGeometry, beamMaterial, bodyMaterial, lensOnMaterial, lensOffMaterial } = useMemo(() => {
    // apex at the origin, opening down -y; the rig JSX rotates it to -z
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
    return {
      beamGeometry: geo,
      beamMaterial: mat,
      bodyMaterial: createPS2Material({ color: 0x2a2d30 }),
      lensOnMaterial: createPS2Material({ fullbright: true, color: 0xfff3d0 }),
      lensOffMaterial: createPS2Material({ color: 0x34362f }),
    }
  }, [])

  useEffect(() => {
    const unregister = registerPrimaryAction('flashlight', () => {
      if (!equippedRef.current) return
      setPowered((current) => {
        const next = !current
        flashlightPowered = next
        play('switch', 0.65, next ? 1.08 : 0.92)
        return next
      })
    })
    return () => {
      unregister()
      flashlightPowered = false
    }
  }, [])

  // Holstering, switching away, or carrying a prop always kills the lamp.
  // Drawing the torch again leaves it off until the player deliberately clicks.
  useEffect(() => {
    if (equipped) return
    flashlightPowered = false
    setPowered(false)
  }, [equipped])

  // keep the whole rig out of the depth pre-passes (foam + shadow map) —
  // it hugs the camera and must not cast or write depth
  useEffect(() => {
    const r = rig.current
    if (!equipped || !r) return
    waterMeshes.add(r)
    return () => {
      waterMeshes.delete(r)
    }
  }, [equipped])

  useEffect(() => {
    if (!equipped || !powered) return
    slot.current = acquireLightSlot()
    const i = slot.current
    if (i >= 0) {
      lightColors[i].copy(rawColorFromString(COLOR)).multiplyScalar(INTENSITY)
      lightRadii[i] = RADIUS
      lightSpots[i] = 0
      lightCones[i] = CONE
      torchShadowUniforms.uShadowSlot.value = i
      torchShadowUniforms.uTorchColor.value.copy(lightColors[i])
      torchShadowUniforms.uTorchRadius.value = RADIUS
      torchShadowUniforms.uTorchCone.value = CONE
      torchCamera.far = RADIUS
      torchCamera.updateProjectionMatrix()
    }
    return () => {
      releaseLightSlot(slot.current)
      slot.current = -1
      torchShadowUniforms.uShadowSlot.value = -1
    }
  }, [equipped, powered])

  useFrame(() => {
    const i = slot.current
    const r = rig.current
    if (!equipped || !r) return
    // rigid attachment: fixed camera-space anchor through the camera's pose
    r.quaternion.copy(camera.quaternion)
    WORLD_ANCHOR.copy(ANCHOR).applyQuaternion(camera.quaternion).add(camera.position)
    r.position.copy(WORLD_ANCHOR)

    if (i < 0) return

    // converge on the crosshair: aim at whatever the camera ray hits, so
    // the offset hand-light lands exactly on the reticle
    const dir = camera.getWorldDirection(FORWARD)
    AIM_POINT.copy(camera.position).addScaledVector(dir, 20)
    const rc = aimCaster.current
    rc.setFromCamera(CENTER, camera)
    rc.far = 24
    const level = scene.getObjectByName('level')
    if (level) {
      const hits = rc.intersectObject(level, true)
      if (hits.length > 0) AIM_POINT.copy(hits[0].point)
    }
    AIM_DIR.copy(AIM_POINT).sub(WORLD_ANCHOR).normalize()

    lightPositions[i].copy(WORLD_ANCHOR)
    lightDirs[i].copy(AIM_DIR)
    torchShadowUniforms.uTorchPos.value.copy(WORLD_ANCHOR)
    torchShadowUniforms.uTorchDir.value.copy(AIM_DIR)
    torchCamera.position.copy(WORLD_ANCHOR)
    torchCamera.lookAt(AIM_POINT)
    // the visible shaft re-aims in rig-local space
    const b = beam.current
    if (b) {
      BEAM_WORLD.setFromUnitVectors(DOWN, AIM_DIR)
      RIG_INV.copy(r.quaternion).invert()
      b.quaternion.copy(RIG_INV).multiply(BEAM_WORLD)
    }
  })

  if (!equipped) return null
  return (
    <group ref={rig}>
      {/* handheld body: barrel + head ring + lit lens, pointing down -z */}
      <mesh material={bodyMaterial} position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.028, 0.032, 0.17, 10]} />
      </mesh>
      <mesh material={bodyMaterial} position={[0, 0, 0.008]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.042, 0.036, 0.05, 10]} />
      </mesh>
      <mesh material={powered ? lensOnMaterial : lensOffMaterial} position={[0, 0, -0.018]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.038, 0.038, 0.004, 10]} />
      </mesh>
      {/* beam shaft: authored down -y, re-aimed at the crosshair each frame */}
      <mesh
        ref={beam}
        geometry={beamGeometry}
        material={beamMaterial}
        visible={powered}
        renderOrder={3}
        frustumCulled={false}
      />
    </group>
  )
}

export function flashlightSnapshot() {
  return { powered: flashlightPowered }
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__flashlightState = flashlightSnapshot
}
