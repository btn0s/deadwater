import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RigidBodyType } from '@dimforge/rapier3d-compat'
import { allGrabbables, findGrabbable, type Grabbable } from './grabbables'
import { player } from './playerState'
import { clampHeldTarget } from './worldBounds'

/**
 * Two ways to hold a prop:
 * - E (routed through the reticle interaction system) carries it IN HANDS,
 *   FPS-style: small items tuck into the lower-right, big ones sit centered
 *   and low. LMB throws.
 * - HOLD right-click aims telekinesis: the object floats out at arm's
 *   length while the button is down and drops gently on release.
 */

const GRAB_RANGE = 4.2
const HOLD_STIFFNESS = 12
const TOSS_CAP = 8
const FLOAT_DIST = 1.9
const SPIN_RATE = 0.6

const ANCHOR_SMALL = new THREE.Vector3(0.42, -0.36, -0.62)
const ANCHOR_BIG = new THREE.Vector3(0, -0.22, -0.95)
const BIG_RADIUS = 0.42

interface HeldState {
  grab: Grabbable
  mode: 'hands' | 'float'
}

let held: HeldState | null = null

function take(grab: Grabbable, mode: HeldState['mode']) {
  grab.body.setBodyType(RigidBodyType.KinematicPositionBased, true)
  held = { grab, mode }
}

function release(toss: THREE.Vector3 | null) {
  if (!held) return
  const body = held.grab.body
  body.setBodyType(RigidBodyType.Dynamic, true)
  if (toss) {
    body.setLinvel({ x: toss.x, y: toss.y, z: toss.z }, true)
    body.setAngvel({ x: 0, y: SPIN_RATE, z: 0 }, true)
  }
  held = null
}

export const carry = {
  /** E on a grabbable: into the hands */
  pickUp(grab: Grabbable) {
    if (!held) take(grab, 'hands')
  },
  isHolding: () => held !== null,
}

/** what the reticle ray's first grabbable would be (for prompts + RMB) */
export function aimGrabbable(camera: THREE.Camera, raycaster: THREE.Raycaster): Grabbable | null {
  raycaster.setFromCamera(CENTER, camera)
  raycaster.far = GRAB_RANGE
  const roots = allGrabbables()
    .filter((g) => g !== held?.grab)
    .map((g) => g.root)
  const hits = raycaster.intersectObjects(roots, true)
  return hits.length ? findGrabbable(hits[0].object) : null
}

const CENTER = new THREE.Vector2(0, 0)
const FWD = new THREE.Vector3()
const TARGET = new THREE.Vector3()
const POS = new THREE.Vector3()

export function CarrySystem() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const heldVel = useRef(new THREE.Vector3())
  const prevPos = useRef(new THREE.Vector3())
  const raycaster = useRef(new THREE.Raycaster())
  const crosshairTimer = useRef(0)

  useEffect(() => {
    const canvas = gl.domElement
    const onContext = (e: Event) => e.preventDefault()

    const onPointerDown = (e: PointerEvent) => {
      if (!player.locked) return
      if (e.button === 0 && held) {
        // throw with carried momentum plus a shove
        camera.getWorldDirection(FWD)
        const toss = heldVel.current.clone().multiplyScalar(0.8).addScaledVector(FWD, held.mode === 'hands' ? 5 : 1.6)
        if (toss.length() > TOSS_CAP) toss.setLength(TOSS_CAP)
        release(toss)
      } else if (e.button === 2 && !held) {
        // telekinesis: float while the button is down
        const target = aimGrabbable(camera, raycaster.current)
        if (target) {
          take(target, 'float')
          const t = target.body.translation()
          prevPos.current.set(t.x, t.y, t.z)
          heldVel.current.set(0, 0, 0)
        }
      }
    }
    const onPointerUp = (e: PointerEvent) => {
      if (e.button === 2 && held?.mode === 'float') release(heldVel.current.clone().multiplyScalar(0.4))
    }

    canvas.addEventListener('contextmenu', onContext)
    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      canvas.removeEventListener('contextmenu', onContext)
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera])

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)

    if (held) {
      const body = held.grab.body
      if (held.mode === 'hands') {
        // welded to the view like a viewmodel, big things centered
        const anchor = held.grab.radius > BIG_RADIUS ? ANCHOR_BIG : ANCHOR_SMALL
        TARGET.copy(anchor)
        if (held.grab.radius > BIG_RADIUS) TARGET.z -= held.grab.radius * 0.6
        TARGET.applyQuaternion(camera.quaternion).add(camera.position)
      } else {
        camera.getWorldDirection(FWD)
        TARGET.copy(camera.position).addScaledVector(FWD, FLOAT_DIST)
        TARGET.y += Math.sin(clock.elapsedTime * 2.5) * 0.05
        clampHeldTarget(TARGET, held.grab.radius)
        TARGET.y = THREE.MathUtils.clamp(TARGET.y, 0.25, 4.6)
      }

      const t = body.translation()
      POS.set(t.x, t.y, t.z)
      const blend = 1 - Math.exp(-HOLD_STIFFNESS * dt)
      POS.lerp(TARGET, blend)
      body.setNextKinematicTranslation({ x: POS.x, y: POS.y, z: POS.z })

      if (held.mode === 'float') {
        const rot = body.rotation()
        const q = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w)
        q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), SPIN_RATE * dt))
        body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      }

      heldVel.current.copy(POS).sub(prevPos.current).divideScalar(Math.max(dt, 1e-4))
      prevPos.current.copy(POS)
    }

    crosshairTimer.current -= dt
    if (crosshairTimer.current <= 0) {
      crosshairTimer.current = 0.12
      const el = document.querySelector('.crosshair')
      if (el) {
        el.classList.toggle('holding', !!held)
        el.classList.toggle(
          'on-grabbable',
          !held && player.locked && !!aimGrabbable(camera, raycaster.current),
        )
      }
    }
  })

  return null
}
