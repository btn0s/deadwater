import * as THREE from 'three'

// Walkable interior regions (slightly inset from the walls). Held objects are
// clamped to the union of these boxes, so they can be carried through the
// hallway without being pushed through walls.
const REGIONS = [
  // main warehouse
  { minX: -19.9, maxX: 19.9, minZ: -11.9, maxZ: 11.9 },
  // hallway through the north wall
  { minX: -11.3, maxX: -8.7, minZ: -19.9, maxZ: -11.0 },
  // sewer room
  { minX: -21.8, maxX: 1.8, minZ: -33.8, maxZ: -20.1 },
  // exterior dock yard
  { minX: 20.5, maxX: 41.8, minZ: -15.8, maxZ: 15.8 },
]

/** Clamp a point (shrunk by radius r) into the nearest interior region. */
export function clampHeldTarget(target: THREE.Vector3, r: number) {
  let bestX = target.x
  let bestZ = target.z
  let bestDist = Infinity
  for (const b of REGIONS) {
    const minX = b.minX + r
    const maxX = b.maxX - r
    const minZ = b.minZ + r
    const maxZ = b.maxZ - r
    if (minX > maxX || minZ > maxZ) continue
    const cx = THREE.MathUtils.clamp(target.x, minX, maxX)
    const cz = THREE.MathUtils.clamp(target.z, minZ, maxZ)
    const d = (cx - target.x) ** 2 + (cz - target.z) ** 2
    if (d < bestDist) {
      bestDist = d
      bestX = cx
      bestZ = cz
    }
  }
  target.x = bestX
  target.z = bestZ
}
