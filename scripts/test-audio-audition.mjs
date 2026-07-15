import assert from 'node:assert/strict'
import { validateManifest } from './build-audio-audition.mjs'

const valid = {
  version: 1,
  candidates: [
    {
      family: 'footstep_concrete',
      label: 'Boots A',
      author: 'Field Recordist',
      sourcePage: 'https://example.com/sound',
      license: 'CC0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      retrieved: '2026-07-14',
      originalFile: 'boots.wav',
      previewFile: 'boots.ogg',
      sha256: 'a'.repeat(64),
    },
  ],
}

assert.deepEqual(validateManifest(valid), valid)

assert.throws(
  () => validateManifest({ ...valid, candidates: [{ ...valid.candidates[0], license: 'CC BY-NC 4.0' }] }),
  /unsupported license/i,
)

assert.throws(
  () => validateManifest({ ...valid, candidates: [{ ...valid.candidates[0], sha256: 'not-a-hash' }] }),
  /sha256/i,
)

assert.throws(
  () => validateManifest({ ...valid, candidates: [{ ...valid.candidates[0], previewFile: '../escape.ogg' }] }),
  /previewFile/i,
)

console.log('audio audition manifest tests passed')
