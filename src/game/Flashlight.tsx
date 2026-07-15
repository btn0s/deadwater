import { useEffect, useRef } from 'react'
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
import { useInventory } from './inventory'

const COLOR = '#e8e2c8'
const INTENSITY = 2.3
const RADIUS = 24
const CONE = Math.cos(0.36) // ~21° hot cone (+0.12 soft halo in the shader)

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
      .addScaledVector(right, 0.22)
      .addScaledVector(dir, 0.2)
    lightPositions[i].y -= 0.25
    // the shadow camera looks down the beam
    torchCamera.position.copy(lightPositions[i])
    torchCamera.lookAt(
      lightPositions[i].x + dir.x,
      lightPositions[i].y + dir.y,
      lightPositions[i].z + dir.z,
    )
  })

  return null
}
