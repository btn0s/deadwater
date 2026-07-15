import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { applyPS2Materials } from '../engine/render'
import { allGrabbables } from './grabbables'
import { useInventory } from './inventory'
import { play, playAt } from './audio'
import { impactCueFor } from './acoustics'
import { registerPrimaryAction } from './equipmentActions'

/**
 * Equipped crowbar: rides at the right shoulder; the central LMB dispatcher
 * swings it in an arc and shoves dynamic bodies in front.
 */

const ANCHOR = new THREE.Vector3(0.34, -0.3, -0.45)
const SWING_TIME = 0.38
const HIT_RANGE = 1.1
const HIT_AT = 0.4 // fraction of the swing where contact lands
const SHOVE = 6

const WORLD_ANCHOR = new THREE.Vector3()
const FWD = new THREE.Vector3()
const TO_TARGET = new THREE.Vector3()
const HIT_POINT = new THREE.Vector3()

export function Crowbar() {
  const camera = useThree((s) => s.camera)
  const { slots, active, stowed, carryLock } = useInventory()
  const equipped = !stowed && !carryLock && slots[active]?.id === 'crowbar'
  const equippedRef = useRef(equipped)
  const rig = useRef<THREE.Group>(null)
  const arm = useRef<THREE.Group>(null)
  const swing = useRef(-1) // -1 idle; else seconds into the swing
  const hitDone = useRef(false)

  equippedRef.current = equipped

  const { scene } = useGLTF('/models/crowbar_01/crowbar_01_1k.gltf')
  const model = useMemo(() => {
    const g = scene.clone(true)
    applyPS2Materials(g)
    return g
  }, [scene])

  useEffect(
    () =>
      registerPrimaryAction('crowbar', () => {
        if (equippedRef.current && swing.current < 0) {
          swing.current = 0
          hitDone.current = false
          play('swing', 0.8)
        }
      }),
    [],
  )

  useEffect(() => {
    if (!equipped) {
      swing.current = -1
      hitDone.current = false
    }
  }, [equipped])

  useFrame((_, rawDt) => {
    const r = rig.current
    if (!equipped || !r) return
    const dt = Math.min(rawDt, 0.05)
    r.quaternion.copy(camera.quaternion)
    WORLD_ANCHOR.copy(ANCHOR).applyQuaternion(camera.quaternion).add(camera.position)
    r.position.copy(WORLD_ANCHOR)

    // swing arc: wind back, whip down-forward, settle
    const a = arm.current
    if (a) {
      if (swing.current >= 0) {
        swing.current += dt
        const t = Math.min(swing.current / SWING_TIME, 1)
        const arc = t < 0.25 ? -t * 1.6 : Math.sin((t - 0.25) * Math.PI * 1.33) * 1.5 - 0.4 * (1 - t)
        a.rotation.x = -0.5 - arc
        if (!hitDone.current && t >= HIT_AT) {
          hitDone.current = true
          // shove every dynamic body in front of the face
          camera.getWorldDirection(FWD)
          HIT_POINT.copy(camera.position).addScaledVector(FWD, HIT_RANGE * 0.8)
          let sounded = false
          for (const g of allGrabbables()) {
            const p = g.body.translation()
            TO_TARGET.set(p.x, p.y, p.z).sub(HIT_POINT)
            if (TO_TARGET.length() < HIT_RANGE) {
              if (!sounded) {
                playAt(impactCueFor(g.material), { x: p.x, y: p.y, z: p.z })
                sounded = true
              }
              const v = g.body.linvel()
              g.body.setLinvel(
                { x: v.x + FWD.x * SHOVE, y: v.y + FWD.y * SHOVE + 1.2, z: v.z + FWD.z * SHOVE },
                true,
              )
            }
          }
        }
        if (t >= 1) swing.current = -1
      } else {
        a.rotation.x = -0.5 // ready pose
      }
    }
  })

  if (!equipped) return null
  return (
    <group ref={rig}>
      <group ref={arm} position={[0, -0.05, 0]}>
        {/* real crowbar, gripped low, length angled forward-up, hook out front */}
        <primitive object={model} position={[0, 0.02, -0.3]} rotation={[2.7, 0, -0.25]} />
      </group>
    </group>
  )
}
