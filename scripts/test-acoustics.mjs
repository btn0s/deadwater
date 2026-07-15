import assert from 'node:assert/strict'
import { audioZoneAt, footstepSurfaceAt, registerAcousticFloor } from '../src/game/acoustics.ts'

const removeConcrete = registerAcousticFloor({
  minX: -4,
  maxX: 4,
  minZ: -4,
  maxZ: 4,
  y: 0,
  surface: 'concrete',
})
const removeMetal = registerAcousticFloor({
  minX: -1,
  maxX: 1,
  minZ: -1,
  maxZ: 1,
  y: 0.1,
  surface: 'metal',
})

assert.equal(footstepSurfaceAt(0, 0), 'metal')
assert.equal(footstepSurfaceAt(3, 3), 'concrete')
assert.equal(footstepSurfaceAt(40, 0), 'concrete')
assert.equal(footstepSurfaceAt(-10, -27), 'wetConcrete')
assert.equal(audioZoneAt(0, 0), 'warehouse')
assert.equal(audioZoneAt(-10, -27), 'sewer')
assert.equal(audioZoneAt(30, 0), 'harbor')

removeMetal()
assert.equal(footstepSurfaceAt(0, 0), 'concrete')
removeConcrete()

console.log('acoustic surface and zone tests passed')
