import * as THREE from 'three'
import type { RapierRigidBody } from '@react-three/rapier'

export interface Grabbable {
  /** visual root, used for raycasting */
  root: THREE.Object3D
  /** physics body driving the object */
  body: RapierRigidBody
  /** rough horizontal half-extent, for wall clamping while held */
  radius: number
}

const items = new Set<Grabbable>()

export function registerGrabbable(entry: Grabbable): () => void {
  entry.root.userData.grabbable = entry
  items.add(entry)
  return () => {
    items.delete(entry)
    delete entry.root.userData.grabbable
  }
}

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
