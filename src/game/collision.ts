// Flat-floor 2D AABB collision world. The player is a circle of radius r;
// movement resolves per axis so you slide along surfaces.

export interface AABB {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

const colliders: AABB[] = []

export function addCollider(box: AABB): () => void {
  colliders.push(box)
  return () => {
    const i = colliders.indexOf(box)
    if (i !== -1) colliders.splice(i, 1)
  }
}

export function moveWithCollision(pos: { x: number; z: number }, dx: number, dz: number, r: number) {
  if (dx !== 0) {
    pos.x += dx
    for (const b of colliders) {
      if (pos.z > b.minZ - r && pos.z < b.maxZ + r && pos.x > b.minX - r && pos.x < b.maxX + r) {
        pos.x = dx > 0 ? b.minX - r : b.maxX + r
      }
    }
  }
  if (dz !== 0) {
    pos.z += dz
    for (const b of colliders) {
      if (pos.x > b.minX - r && pos.x < b.maxX + r && pos.z > b.minZ - r && pos.z < b.maxZ + r) {
        pos.z = dz > 0 ? b.minZ - r : b.maxZ + r
      }
    }
  }
}
