import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RigidBodyType } from '@dimforge/rapier3d-compat'
import { allGrabbables, findGrabbable, type Grabbable } from './grabbables'
import { player } from './playerState'

const GRAB_RANGE = 4.2
const HOLD_DIST = 1.9
const HOLD_STIFFNESS = 10 // spring rate toward the hold point
const SPIN_RATE = 0.6
const BOB_AMPLITUDE = 0.05
const TOSS_CAP = 7
// keep held objects inside the room shell
const BOUND_X = 19.6
const BOUND_Z = 11.6

export function Telekinesis() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)

  const held = useRef<Grabbable | null>(null)
  const heldVel = useRef(new THREE.Vector3())
  const prevHeldPos = useRef(new THREE.Vector3())

  const raycaster = useMemo(() => {
    const r = new THREE.Raycaster()
    r.far = GRAB_RANGE
    return r
  }, [])

  const aimAtGrabbable = () => {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
    const roots = allGrabbables()
      .filter((g) => g !== held.current)
      .map((g) => g.root)
    const hits = raycaster.intersectObjects(roots, true)
    return hits.length ? findGrabbable(hits[0].object) : null
  }

  useEffect(() => {
    const canvas = gl.domElement
    const onClick = () => {
      if (!player.locked) return
      if (held.current) {
        // release with the momentum it was carried with, plus a nudge forward
        const body = held.current.body
        const fwd = new THREE.Vector3()
        camera.getWorldDirection(fwd)
        const toss = heldVel.current.clone().multiplyScalar(0.9).addScaledVector(fwd, 1.4)
        if (toss.length() > TOSS_CAP) toss.setLength(TOSS_CAP)
        body.setBodyType(RigidBodyType.Dynamic, true)
        body.setLinvel({ x: toss.x, y: toss.y, z: toss.z }, true)
        body.setAngvel({ x: 0, y: SPIN_RATE, z: 0 }, true)
        held.current = null
        return
      }
      const target = aimAtGrabbable()
      if (target) {
        held.current = target
        target.body.setBodyType(RigidBodyType.KinematicPositionBased, true)
        const t = target.body.translation()
        prevHeldPos.current.set(t.x, t.y, t.z)
        heldVel.current.set(0, 0, 0)
      }
    }
    canvas.addEventListener('click', onClick)
    return () => canvas.removeEventListener('click', onClick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera])

  const crosshairTimer = useRef(0)

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)

    if (held.current) {
      const body = held.current.body
      const fwd = new THREE.Vector3()
      camera.getWorldDirection(fwd)
      const target = camera.position.clone().addScaledVector(fwd, HOLD_DIST)
      target.y += Math.sin(clock.elapsedTime * 2.5) * BOB_AMPLITUDE
      const r = held.current.radius
      target.x = THREE.MathUtils.clamp(target.x, -BOUND_X + r, BOUND_X - r)
      target.z = THREE.MathUtils.clamp(target.z, -BOUND_Z + r, BOUND_Z - r)
      target.y = THREE.MathUtils.clamp(target.y, 0.25, 4.6)

      const t = body.translation()
      const pos = new THREE.Vector3(t.x, t.y, t.z)
      const blend = 1 - Math.exp(-HOLD_STIFFNESS * dt)
      pos.lerp(target, blend)
      body.setNextKinematicTranslation({ x: pos.x, y: pos.y, z: pos.z })

      // slow float spin around Y
      const rot = body.rotation()
      const q = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w)
      q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), SPIN_RATE * dt))
      body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w })

      heldVel.current.copy(pos).sub(prevHeldPos.current).divideScalar(Math.max(dt, 1e-4))
      prevHeldPos.current.copy(pos)
    }

    // crosshair hover feedback, throttled
    crosshairTimer.current -= dt
    if (crosshairTimer.current <= 0) {
      crosshairTimer.current = 0.12
      const el = document.querySelector('.crosshair')
      if (el) {
        el.classList.toggle('holding', !!held.current)
        el.classList.toggle('on-grabbable', !held.current && player.locked && !!aimAtGrabbable())
      }
    }
  })

  return null
}
