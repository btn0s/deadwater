import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createPS2Material } from '../ps2/PS2Material'
import { allGrabbables } from './grabbables'
import { carry } from './Carry'
import { useInventory } from './inventory'
import { player } from './playerState'

/**
 * Equipped crowbar: rides at the right shoulder; LMB swings it in an arc
 * and shoves whatever dynamic bodies sit in front. (E stays interact;
 * click is always use-what's-in-hand.)
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
  const { slots, active, stowed } = useInventory()
  const equipped = !stowed && slots[active]?.id === 'crowbar'
  const rig = useRef<THREE.Group>(null)
  const arm = useRef<THREE.Group>(null)
  const swing = useRef(-1) // -1 idle; else seconds into the swing
  const hitDone = useRef(false)

  const { barMaterial, tipMaterial } = useMemo(
    () => ({
      barMaterial: createPS2Material({ color: 0x7a2a22 }),
      tipMaterial: createPS2Material({ color: 0x5a1f1a }),
    }),
    [],
  )

  useEffect(() => {
    if (!equipped) return
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || !player.locked || carry.isHolding()) return
      if (swing.current < 0) {
        swing.current = 0
        hitDone.current = false
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
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
          for (const g of allGrabbables()) {
            const p = g.body.translation()
            TO_TARGET.set(p.x, p.y, p.z).sub(HIT_POINT)
            if (TO_TARGET.length() < HIT_RANGE) {
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
        {/* shaft angled forward from the grip */}
        <mesh material={barMaterial} position={[0, 0.1, -0.18]} rotation={[Math.PI / 2 - 0.35, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.5, 6]} />
        </mesh>
        {/* hook at the business end */}
        <mesh material={tipMaterial} position={[0, 0.19, -0.42]} rotation={[0.4, 0, Math.PI / 2]}>
          <torusGeometry args={[0.04, 0.012, 6, 8, 3.4]} />
        </mesh>
      </group>
    </group>
  )
}
