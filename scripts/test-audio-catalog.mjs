import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { CUE_CATALOG, validateCueCatalog } from '../src/game/audioCatalog.ts'

assert.deepEqual(validateCueCatalog(CUE_CATALOG), [])

for (const [name, cue] of Object.entries(CUE_CATALOG)) {
  for (const url of cue.urls) {
    assert.ok(url.startsWith('/sounds/'), `${name} uses a non-sound URL: ${url}`)
    assert.ok(existsSync(resolve('public', url.slice(1))), `${name} is missing ${url}`)
  }
}

for (const [name, minimum] of Object.entries({
  step_concrete: 6,
  step_wet: 3,
  step_metal: 4,
  cloth_move: 4,
  land: 4,
  impact_metal: 4,
  rat_scurry: 4,
  rat_squeak: 3,
})) {
  assert.ok(CUE_CATALOG[name].urls.length >= minimum, `${name} needs at least ${minimum} variants`)
}

const invalid = structuredClone(CUE_CATALOG)
invalid.step_concrete.rate = [1.1, 0.9]
assert.match(validateCueCatalog(invalid).join('\n'), /step_concrete.*rate/i)

console.log('audio cue catalog tests passed')
