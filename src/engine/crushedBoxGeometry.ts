import * as THREE from 'three'

type Vec3 = readonly [number, number, number]

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function seeded(seed: number, offset: number): number {
  const value = Math.sin(seed * 91.733 + offset * 17.137) * 43758.5453
  return value - Math.floor(value)
}

/** Deforms one generated cuboid vertex while keeping the entire bottom plane
 * fixed. The function depends only on object-space position, so BoxGeometry's
 * duplicated edge vertices stay welded visually after deformation. */
export function deformBoxVertex(
  position: Vec3,
  dims: Vec3,
  seed: number,
  crushAmount: number,
): [number, number, number] {
  const amount = clamp01(crushAmount)
  if (amount === 0) return [...position]

  const [width, height, depth] = dims
  const halfWidth = width / 2
  const halfHeight = height / 2
  const halfDepth = depth / 2
  const [sourceX, sourceY, sourceZ] = position
  const vertical = clamp01((sourceY + halfHeight) / height)
  if (vertical === 0) return [...position]

  const nx = sourceX / halfWidth
  const nz = sourceZ / halfDepth
  const upperWeight = smoothstep(0.02, 1, vertical)
  const leanX = seeded(seed, 1) * 2 - 1
  const leanZ = seeded(seed, 2) * 2 - 1
  const taperX = 0.035 + seeded(seed, 3) * 0.035
  const taperZ = 0.03 + seeded(seed, 4) * 0.03
  const band = Math.sin(vertical * Math.PI * 2.1 + seeded(seed, 5) * Math.PI * 2)

  let x = sourceX * (1 - amount * taperX * upperWeight)
  let z = sourceZ * (1 - amount * taperZ * upperWeight)
  x *= 1 + band * amount * 0.018 * upperWeight
  z *= 1 - band * amount * 0.014 * upperWeight
  x += halfWidth * amount * 0.07 * leanX * upperWeight
  z += halfDepth * amount * 0.055 * leanZ * upperWeight

  const dentCenterY = 0.38 + seeded(seed, 6) * 0.28
  const dentCenterZ = (seeded(seed, 7) * 2 - 1) * 0.34
  const dentCenterX = (seeded(seed, 8) * 2 - 1) * 0.34
  const yDistance = (vertical - dentCenterY) / 0.25
  const xFaceDent = Math.exp(-(yDistance * yDistance + ((nz - dentCenterZ) / 0.42) ** 2))
    * smoothstep(0.72, 1, Math.abs(nx))
  const zFaceDent = Math.exp(-(yDistance * yDistance + ((nx - dentCenterX) / 0.42) ** 2))
    * smoothstep(0.72, 1, Math.abs(nz))
  x -= Math.sign(sourceX) * halfWidth * amount * 0.25 * xFaceDent * upperWeight
  z -= Math.sign(sourceZ) * halfDepth * amount * 0.23 * zFaceDent * upperWeight

  const topWeight = smoothstep(0.72, 1, vertical)
  const centerSag = Math.max(0, 1 - nx * nx) * Math.max(0, 1 - nz * nz)
  const cornerX = seeded(seed, 9) > 0.5 ? 0.72 : -0.72
  const cornerZ = seeded(seed, 10) > 0.5 ? 0.72 : -0.72
  const cornerDistance = ((nx - cornerX) / 0.52) ** 2 + ((nz - cornerZ) / 0.52) ** 2
  const cornerSag = Math.exp(-cornerDistance)
  const edgeWeight = smoothstep(0.62, 1, Math.max(Math.abs(nx), Math.abs(nz)))
  const edgeWave = 0.5 + 0.5 * Math.sin(nx * 4.3 + nz * 3.7 + seed * 0.73)
  const y = Math.max(
    -halfHeight,
    sourceY - height * amount
      * (0.085 * centerSag + 0.055 * cornerSag + 0.02 * edgeWeight * edgeWave)
      * topWeight,
  )

  return [x, y, z]
}

export function createCrushedBoxGeometry(
  dims: Vec3,
  seed: number,
  crushAmount: number,
): THREE.BoxGeometry {
  const [width, height, depth] = dims
  const geometry = new THREE.BoxGeometry(
    width,
    height,
    depth,
    4,
    Math.max(4, Math.round(height * 5)),
    4,
  )
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute

  for (let index = 0; index < positions.count; index += 1) {
    const deformed = deformBoxVertex(
      [positions.getX(index), positions.getY(index), positions.getZ(index)],
      dims,
      seed,
      crushAmount,
    )
    positions.setXYZ(index, deformed[0], deformed[1], deformed[2])
  }

  positions.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}
