#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = process.cwd()
const audit = path.join(root, '.agents/skills/deadwater-game-director/scripts/audit_reference_report.py')
const valid = path.join(root, 'scripts/fixtures/deadwater-report-valid.md')

function run(command, args) {
  return spawnSync(command, args, { cwd: root, encoding: 'utf8' })
}

function requirePass(label, result) {
  if (result.status === 0) return
  process.stderr.write(`${label} failed.\n`)
  process.stderr.write(result.stdout)
  process.stderr.write(result.stderr)
  process.exit(result.status ?? 1)
}

const validation = run('node', ['scripts/validate-deadwater-skills.mjs'])
if (validation.status !== 0) {
  process.stderr.write(validation.stdout)
  process.stderr.write(validation.stderr)
  process.exit(validation.status ?? 1)
}

const positive = run('python3', [audit, valid, '--graphics', '--physics', '--assets', '--audio', '--release'])
if (positive.status !== 0) {
  process.stderr.write(positive.stdout)
  process.stderr.write(positive.stderr)
  process.exit(positive.status ?? 1)
}

const negative = run('python3', [audit, 'README.md', '--graphics', '--assets', '--release'])
if (negative.status === 0) {
  console.error('Expected the audit to reject a document without completion evidence.')
  process.exit(1)
}

const qaInspector = path.join(root, '.agents/skills/deadwater-qa-release/scripts/inspect-deadwater-canvas.mjs')
const modelHelper = path.join(root, '.agents/skills/deadwater-3d-asset-pipeline/scripts/deadwater_3d_asset.py')
const imageHelper = path.join(root, '.agents/skills/deadwater-image-generator/scripts/generate_image.py')
const audioHelper = path.join(root, '.agents/skills/deadwater-audio-generator/scripts/deadwater_audio_asset.py')
requirePass('QA inspector help', run('node', [qaInspector, '--help']))
requirePass('3D helper inspect', run('python3', [modelHelper, 'inspect', 'public/models/Barrel_01/Barrel_01_1k.gltf']))
requirePass('image helper inspect', run('python3', [imageHelper, 'inspect', 'public/textures/Concrete016.jpg']))
requirePass('audio project audit', run('python3', [audioHelper, 'audit-project', '.']))

const temporary = mkdtempSync(path.join(os.tmpdir(), 'deadwater-skill-test-'))
try {
  const wave = path.join(temporary, 'hum.wav')
  requirePass('audio synthesis', run('python3', [audioHelper, 'synth', wave, '--kind', 'hum', '--duration', '2', '--seed', '7']))
  requirePass('audio loop check', run('python3', [audioHelper, 'loop-check', wave]))
} finally {
  rmSync(temporary, { recursive: true, force: true })
}

process.stdout.write(validation.stdout)
process.stdout.write(positive.stdout)
console.log('DEADWATER skill tests passed, including media helper smoke tests and the negative report-audit case.')
