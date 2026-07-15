import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RigidBodyType } from '@dimforge/rapier3d-compat'
import type { Grabbable } from './grabbables'
import { clampHeldTarget } from './worldBounds'
import { inventory } from './inventory'
import { play } from './audio'
import { handlingCueFor } from './acoustics'

/**
 * E picks up or puts down world props. Every carried prop owns both hands,
 * keeps tools holstered, and is welded to a camera-relative pose. Authored
 * two-hand props sit centered and upright; smaller props ride in the right hand.
 */

const ANCHOR_ONE_HAND = new THREE.Vector3(0.32, -0.34, -0.82)
const ANCHOR_TWO_HAND = new THREE.Vector3(0, -0.3, -0.92)
const MIN_HEIGHT = 0.22
const MAX_HEIGHT = 4.6
/** Beyond arm's reach, E lets go at the hand pose and gravity does the rest. */
const PLACE_RANGE = 2.8

interface HeldState {
  grab: Grabbable
  /** original object orientation relative to the camera for one-hand props */
  cameraRotationOffset: THREE.Quaternion
  lastPosition: THREE.Vector3
  lastRotation: THREE.Quaternion
}

interface ReleasedState {
  grab: Grabbable
  position: THREE.Vector3
  rotation: THREE.Quaternion
  placement: { point: THREE.Vector3; normal: THREE.Vector3 } | null
}

let held: HeldState | null = null
let lastReleased: ReleasedState | null = null

function bodyQuaternion(grab: Grabbable): THREE.Quaternion {
  const r = grab.body.rotation()
  return new THREE.Quaternion(r.x, r.y, r.z, r.w)
}

function nodeIdOf(grab: Grabbable): string | null {
  let object: THREE.Object3D | null = grab.root
  while (object) {
    if (typeof object.userData.nodeId === 'string') return object.userData.nodeId
    object = object.parent
  }
  return null
}

function bodyTypeName(type: RigidBodyType): string {
  if (type === RigidBodyType.Dynamic) return 'dynamic'
  if (type === RigidBodyType.Fixed) return 'fixed'
  if (type === RigidBodyType.KinematicPositionBased) return 'kinematicPosition'
  return 'kinematicVelocity'
}

function release(
  playCue: boolean,
  placement: { position: THREE.Vector3; point: THREE.Vector3; normal: THREE.Vector3 } | null = null,
) {
  const current = held
  if (!current) {
    inventory.endCarry()
    return
  }

  const { body } = current.grab
  if (placement) current.lastPosition.copy(placement.position)
  // Commit the last authored pose before returning to simulation. This also
  // makes a rapid pick-up / put-down pair deterministic between physics ticks.
  body.setTranslation(current.lastPosition, false)
  body.setRotation(current.lastRotation, false)
  body.setLinvel({ x: 0, y: 0, z: 0 }, false)
  body.setAngvel({ x: 0, y: 0, z: 0 }, false)
  body.setBodyType(RigidBodyType.Dynamic, true)
  body.wakeUp()

  lastReleased = {
    grab: current.grab,
    position: current.lastPosition.clone(),
    rotation: current.lastRotation.clone(),
    placement: placement
      ? { point: placement.point.clone(), normal: placement.normal.clone() }
      : null,
  }
  held = null
  inventory.endCarry()
  if (playCue) play(handlingCueFor(current.grab.material), 0.75)
}

export const carry = {
  pickUp(grab: Grabbable, camera: THREE.Camera): boolean {
    if (held || !inventory.beginCarry()) return false

    const position = grab.body.translation()
    const rotation = bodyQuaternion(grab)
    const cameraRotationOffset = camera.quaternion.clone().invert().multiply(rotation)
    grab.body.setLinvel({ x: 0, y: 0, z: 0 }, false)
    grab.body.setAngvel({ x: 0, y: 0, z: 0 }, false)
    grab.body.setBodyType(RigidBodyType.KinematicPositionBased, true)
    held = {
      grab,
      cameraRotationOffset,
      lastPosition: new THREE.Vector3(position.x, position.y, position.z),
      lastRotation: rotation,
    }
    lastReleased = null
    play(handlingCueFor(grab.material))
    return true
  },
  putDown(camera: THREE.Camera, scene: THREE.Scene) {
    release(true, held ? findCrosshairPlacement(held.grab, camera, scene) : null)
  },
  /** Safe lifecycle reset used on quit, remount, and HMR. */
  reset() {
    release(false)
  },
  isHolding: (grab?: Grabbable) => (grab ? held?.grab === grab : held !== null),
  snapshot: () => carrySnapshot(),
}

const TARGET = new THREE.Vector3()
const TARGET_DIRECTION = new THREE.Vector3()
const POSITION = new THREE.Vector3()
const YAW_EULER = new THREE.Euler(0, 0, 0, 'YXZ')
const ROTATION = new THREE.Quaternion()
const PLACE_CENTER = new THREE.Vector2(0, 0)
const PLACE_NORMAL_MATRIX = new THREE.Matrix3()
const PLACE_TOWARD_CAMERA = new THREE.Vector3()
const PLACE_RAY = new THREE.Raycaster()

function belongsToGrab(object: THREE.Object3D, grab: Grabbable): boolean {
  let current: THREE.Object3D | null = object
  while (current) {
    if (current === grab.root) return true
    current = current.parent
  }
  return false
}

function findCrosshairPlacement(
  grab: Grabbable,
  camera: THREE.Camera,
  scene: THREE.Scene,
): { position: THREE.Vector3; point: THREE.Vector3; normal: THREE.Vector3 } | null {
  const level = scene.getObjectByName('level')
  if (!level) return null

  PLACE_RAY.setFromCamera(PLACE_CENTER, camera)
  PLACE_RAY.far = PLACE_RANGE
  const hit = PLACE_RAY.intersectObject(level, true).find((candidate) => !belongsToGrab(candidate.object, grab))
  if (!hit) return null

  let normal = hit.face?.normal.clone()
  if (normal) {
    PLACE_NORMAL_MATRIX.getNormalMatrix(hit.object.matrixWorld)
    normal.applyMatrix3(PLACE_NORMAL_MATRIX).normalize()
  } else {
    normal = PLACE_TOWARD_CAMERA.copy(camera.position).sub(hit.point).normalize().clone()
  }
  // Put the body on the camera side even if a model's face winding is odd.
  PLACE_TOWARD_CAMERA.copy(camera.position).sub(hit.point)
  if (normal.dot(PLACE_TOWARD_CAMERA) < 0) normal.negate()

  const clearance = THREE.MathUtils.clamp(grab.size * 0.52, 0.12, 0.75)
  const position = hit.point.clone().addScaledVector(normal, clearance + 0.025)
  clampHeldTarget(position, grab.radius)
  position.y = THREE.MathUtils.clamp(position.y, MIN_HEIGHT, MAX_HEIGHT)
  return { position, point: hit.point.clone(), normal }
}

function carrySnapshot() {
  const current = held
  const released = lastReleased
  const describe = (grab: Grabbable, position?: THREE.Vector3, rotation?: THREE.Quaternion) => {
    const p = position ?? (() => {
      const value = grab.body.translation()
      return new THREE.Vector3(value.x, value.y, value.z)
    })()
    const q = rotation ?? bodyQuaternion(grab)
    const linear = grab.body.linvel()
    const angular = grab.body.angvel()
    return {
      nodeId: nodeIdOf(grab),
      carryStyle: grab.carryStyle,
      bodyType: bodyTypeName(grab.body.bodyType()),
      position: p.toArray(),
      quaternion: q.toArray(),
      linearVelocity: [linear.x, linear.y, linear.z],
      angularVelocity: [angular.x, angular.y, angular.z],
    }
  }
  return {
    held: current ? describe(current.grab, current.lastPosition, current.lastRotation) : null,
    lastReleased: released
      ? {
          ...describe(released.grab, released.position, released.rotation),
          placement: released.placement
            ? {
                point: released.placement.point.toArray(),
                normal: released.placement.normal.toArray(),
              }
            : null,
        }
      : null,
  }
}

export function CarrySystem() {
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  const occlusionRay = useRef(new THREE.Raycaster())

  useEffect(() => () => carry.reset(), [])

  useFrame(() => {
    const current = held
    if (!current) return

    const { grab } = current
    const twoHand = grab.carryStyle === 'twoHand'
    TARGET.copy(twoHand ? ANCHOR_TWO_HAND : ANCHOR_ONE_HAND)
    TARGET.z -= Math.max(0, grab.size - (twoHand ? 0.55 : 0.35)) * (twoHand ? 0.48 : 0.3)
    TARGET.applyQuaternion(camera.quaternion).add(camera.position)
    clampHeldTarget(TARGET, grab.radius)
    TARGET.y = THREE.MathUtils.clamp(TARGET.y, MIN_HEIGHT, MAX_HEIGHT)

    // Keep the carry anchor on the camera side of the first visible surface.
    // The shared interaction ray remains authoritative for acquisition; this
    // short ray only prevents a held prop from being welded through a wall.
    TARGET_DIRECTION.copy(TARGET).sub(camera.position)
    const targetDistance = TARGET_DIRECTION.length()
    if (targetDistance > 0.001) {
      TARGET_DIRECTION.divideScalar(targetDistance)
      const ray = occlusionRay.current
      ray.set(camera.position, TARGET_DIRECTION)
      ray.far = targetDistance
      const level = scene.getObjectByName('level')
      if (level) {
        const hits = ray.intersectObject(level, true)
        const obstruction = hits.find((hit) => {
          let object: THREE.Object3D | null = hit.object
          while (object) {
            if (object === grab.root) return false
            object = object.parent
          }
          return true
        })
        if (obstruction) {
          const clearance = Math.max(0.16, grab.radius * 0.75)
          const safeDistance = Math.max(0.18, obstruction.distance - clearance)
          TARGET.copy(camera.position).addScaledVector(TARGET_DIRECTION, safeDistance)
        }
      }
    }

    POSITION.copy(TARGET)
    if (twoHand) {
      YAW_EULER.setFromQuaternion(camera.quaternion, 'YXZ')
      ROTATION.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, YAW_EULER.y)
    } else {
      ROTATION.copy(camera.quaternion).multiply(current.cameraRotationOffset)
    }

    current.lastPosition.copy(POSITION)
    current.lastRotation.copy(ROTATION)
    grab.body.setNextKinematicTranslation(POSITION)
    grab.body.setNextKinematicRotation(ROTATION)
  })

  return null
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__carryState = carry.snapshot
}
