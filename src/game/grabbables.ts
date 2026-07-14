import { useEffect, type RefObject } from 'react'
import * as THREE from 'three'
import { addCollider } from './collision'

export interface Grabbable {
  root: THREE.Object3D
  /** root.position.y when the object rests on the floor */
  restY: number
  /** rough horizontal half-extent, for wall clamping while held */
  radius: number
  releaseCollider: () => void
  refreshCollider: () => void
}

const items = new Set<Grabbable>()

export function allGrabbables(): Grabbable[] {
  return [...items]
}

export function findGrabbable(hit: THREE.Object3D): Grabbable | null {
  let o: THREE.Object3D | null = hit
  while (o) {
    if (o.userData.grabbable) return o.userData.grabbable as Grabbable
    o = o.parent
  }
  return null
}

/**
 * Registers a prop group as a player collider and/or telekinesis target.
 * Grabbable objects can release their collider while held and re-register it
 * wherever they land.
 */
export function useGrabbable(
  group: RefObject<THREE.Group | null>,
  opts: { collide: boolean; grabbable: boolean },
) {
  const { collide, grabbable } = opts
  useEffect(() => {
    const g = group.current
    if (!g) return

    const makeBox = () => {
      const box = new THREE.Box3().setFromObject(g)
      return { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z }
    }

    let remove: (() => void) | null = collide ? addCollider(makeBox()) : null
    if (!grabbable) return () => remove?.()

    const box0 = new THREE.Box3().setFromObject(g)
    const entry: Grabbable = {
      root: g,
      restY: g.position.y - box0.min.y,
      radius: Math.max(box0.max.x - box0.min.x, box0.max.z - box0.min.z) / 2,
      releaseCollider: () => {
        remove?.()
        remove = null
      },
      refreshCollider: () => {
        if (collide) {
          remove?.()
          remove = addCollider(makeBox())
        }
      },
    }
    g.userData.grabbable = entry
    items.add(entry)
    return () => {
      items.delete(entry)
      delete g.userData.grabbable
      remove?.()
    }
  }, [group, collide, grabbable])
}
