import assert from 'node:assert/strict'
import test from 'node:test'

const dims: [number, number, number] = [1.2, 0.8, 1]

test('crushed box deformation is deterministic and leaves an uncrushed box untouched', async () => {
  const geometry = await import('../src/engine/crushedBoxGeometry.ts')
  const point: [number, number, number] = [0.6, 0.1, -0.2]

  assert.deepEqual(geometry.deformBoxVertex(point, dims, 17, 0), point)
  assert.deepEqual(
    geometry.deformBoxVertex(point, dims, 17, 0.55),
    geometry.deformBoxVertex(point, dims, 17, 0.55),
  )
})

test('crushed box deformation preserves the base while changing silhouette and top profile', async () => {
  const { deformBoxVertex } = await import('../src/engine/crushedBoxGeometry.ts')
  const amount = 0.55

  const bottomCorner: [number, number, number] = [0.6, -0.4, 0.5]
  assert.deepEqual(deformBoxVertex(bottomCorner, dims, 23, amount), bottomCorner)

  const topCenter = deformBoxVertex([0, 0.4, 0], dims, 23, amount)
  assert.ok(topCenter[1] < 0.37, `expected visible top sag, got y=${topCenter[1]}`)

  const rightFace = [-0.3, -0.1, 0.1, 0.3].flatMap((y) =>
    [-0.35, -0.1, 0.15, 0.35].map((z) =>
      deformBoxVertex([0.6, y, z], dims, 23, amount),
    ),
  )
  assert.ok(
    rightFace.some(([x]) => x < 0.57),
    'expected at least one side vertex to dent inward by 3 cm',
  )

  for (const [x, y, z] of [...rightFace, topCenter]) {
    assert.ok(Math.abs(x) <= 0.7)
    assert.ok(y >= -0.4 && y <= 0.4)
    assert.ok(Math.abs(z) <= 0.6)
  }
})
