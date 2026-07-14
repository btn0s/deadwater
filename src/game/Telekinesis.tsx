import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { allGrabbables, findGrabbable, type Grabbable } from './grabbables'
import { player } from './playerState'

const GRAB_RANGE = 4.2
const HOLD_DIST = 1.9
const HOLD_STIFFNESS = 10 // spring rate toward the hold point
const SPIN_RATE = 0.6
const BOB_AMPLITUDE = 0.05
const GRAVITY = -12
const TOSS_CAP = 7
// keep held/falling objects inside the room shell
const BOUND_X = 19.6
const BOUND_Z = 11.6

export function Telekinesis() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)

  const held = useRef<Grabbable | null>(null)
  const heldVel = useRef(new THREE.Vector3())
  const prevHeldPos = useRef(new THREE.Vector3())
  const falling = useRef(new Map<Grabbable, THREE.Vector3>())

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
        const fwd = new THREE.Vector3()
        camera.getWorldDirection(fwd)
        const toss = heldVel.current.clone().multiplyScalar(0.9).addScaledVector(fwd, 1.4)
        if (toss.length() > TOSS_CAP) toss.setLength(TOSS_CAP)
        falling.current.set(held.current, toss)
        held.current = null
        return
      }
      const target = aimAtGrabbable()
      if (target) {
        held.current = target
        target.releaseCollider()
        falling.current.delete(target)
        prevHeldPos.current.copy(target.root.position)
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
      const root = held.current.root
      const fwd = new THREE.Vector3()
      camera.getWorldDirection(fwd)
      const target = camera.position.clone().addScaledVector(fwd, HOLD_DIST)
      target.y += Math.sin(clock.elapsedTime * 2.5) * BOB_AMPLITUDE
      const r = held.current.radius
      target.x = THREE.MathUtils.clamp(target.x, -BOUND_X + r, BOUND_X - r)
      target.z = THREE.MathUtils.clamp(target.z, -BOUND_Z + r, BOUND_Z - r)
      target.y = THREE.MathUtils.clamp(target.y, held.current.restY + 0.15, 4.6)

      const blend = 1 - Math.exp(-HOLD_STIFFNESS * dt)
      root.position.lerp(target, blend)
      root.rotation.y += SPIN_RATE * dt

      heldVel.current.copy(root.position).sub(prevHeldPos.current).divideScalar(Math.max(dt, 1e-4))
      prevHeldPos.current.copy(root.position)
    }

    // settle dropped objects
    for (const [entry, vel] of falling.current) {
      const p = entry.root.position
      vel.y += GRAVITY * dt
      const drag = Math.exp(-1.2 * dt)
      vel.x *= drag
      vel.z *= drag
      p.addScaledVector(vel, dt)
      const r = entry.radius
      p.x = THREE.MathUtils.clamp(p.x, -BOUND_X + r, BOUND_X - r)
      p.z = THREE.MathUtils.clamp(p.z, -BOUND_Z + r, BOUND_Z - r)
      if (p.y <= entry.restY) {
        p.y = entry.restY
        falling.current.delete(entry)
        entry.refreshCollider()
      }
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
