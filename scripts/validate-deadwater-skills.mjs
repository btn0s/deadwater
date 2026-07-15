#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const skillsRoot = path.join(root, '.agents', 'skills')
const expected = [
  'deadwater-3d-asset-pipeline',
  'deadwater-audio-generator',
  'deadwater-debug-profiler',
  'deadwater-game-director',
  'deadwater-game-ui-designer',
  'deadwater-gameplay-systems',
  'deadwater-image-generator',
  'deadwater-ps2-graphics-builder',
  'deadwater-qa-release',
]

const forbidden = [
  ['threejs-game-director', 'upstream director name'],
  ['threejs-aaa-graphics-builder', 'upstream graphics name'],
  ['AAA', 'upstream generic quality label'],
  ['premium', 'upstream generic quality label'],
  ['endless runner', 'upstream example genre'],
  ['create_threejs_game.py', 'upstream scaffold creator'],
  ['inspect-threejs-canvas.mjs', 'upstream generic inspector name'],
  ['threejs_3d_asset.py', 'upstream generic 3D helper name'],
  ['threejs_audio_asset.py', 'upstream generic audio helper name'],
  ['probe_asset_credentials', 'upstream credential gate'],
  ['TRIPO_API_KEY', 'mandatory Tripo credential contract'],
  ['GEMINI_API_KEY', 'mandatory Gemini credential contract'],
  ['ELEVENLABS_API_KEY', 'mandatory ElevenLabs credential contract'],
]

const errors = []

const actual = readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('deadwater-'))
  .map((entry) => entry.name)
  .sort()
for (const name of actual.filter((name) => !expected.includes(name))) errors.push(`unexpected DEADWATER skill: ${name}`)

function filesBelow(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...filesBelow(full))
    else if (entry.isFile()) files.push(full)
  }
  return files
}

function parseFrontmatter(markdown, file) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) {
    errors.push(`${file}: missing YAML frontmatter`)
    return {}
  }
  const result = {}
  for (const line of match[1].split('\n')) {
    const field = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/)
    if (field) result[field[1]] = field[2].replace(/^['"]|['"]$/g, '')
  }
  return result
}

function validateReferencedSkillPaths(text, file, skillDir) {
  const pattern = /`(deadwater-[a-z0-9-]+)\/(SKILL\.md|(?:references|scripts)\/[a-zA-Z0-9_./-]+)`/g
  for (const match of text.matchAll(pattern)) {
    const target = path.join(skillsRoot, match[1], match[2])
    if (!existsSync(target)) errors.push(`${file}: missing referenced file ${match[1]}/${match[2]}`)
  }

  const repoPattern = /\.agents\/skills\/(deadwater-[a-z0-9-]+)\/(SKILL\.md|(?:references|scripts)\/[a-zA-Z0-9_./-]+)/g
  for (const match of text.matchAll(repoPattern)) {
    const target = path.join(skillsRoot, match[1], match[2])
    if (!existsSync(target)) errors.push(`${file}: missing referenced file ${match[1]}/${match[2]}`)
  }

  const localPattern = /`((?:references|scripts)\/[a-zA-Z0-9_./-]+)`/g
  for (const match of text.matchAll(localPattern)) {
    const target = path.join(skillDir, match[1])
    if (!existsSync(target)) errors.push(`${file}: missing referenced file ${match[1]}`)
  }
}

for (const name of expected) {
  const dir = path.join(skillsRoot, name)
  const skillFile = path.join(dir, 'SKILL.md')
  const agentFile = path.join(dir, 'agents', 'openai.yaml')
  if (!existsSync(skillFile)) {
    errors.push(`${name}: missing SKILL.md`)
    continue
  }
  if (!existsSync(agentFile)) errors.push(`${name}: missing agents/openai.yaml`)
  else {
    const agentText = readFileSync(agentFile, 'utf8')
    if (!/^interface:\s*$/m.test(agentText)) errors.push(`${agentFile}: missing interface mapping`)
    for (const field of ['display_name', 'short_description', 'default_prompt']) {
      if (!new RegExp(`^\\s{2}${field}:\\s+.+$`, 'm').test(agentText)) {
        errors.push(`${agentFile}: missing interface.${field}`)
      }
    }
  }

  const skillText = readFileSync(skillFile, 'utf8')
  const frontmatter = parseFrontmatter(skillText, skillFile)
  if (frontmatter.name !== name) errors.push(`${skillFile}: frontmatter name is ${frontmatter.name ?? 'missing'}`)
  if (!frontmatter.description) errors.push(`${skillFile}: missing description`)
  if (statSync(skillFile).size < 300) errors.push(`${skillFile}: unexpectedly small`)

  for (const file of filesBelow(dir)) {
    if (!/\.(md|yaml|py|sh|mjs|ts|tsx|js)$/.test(file)) continue
    const text = readFileSync(file, 'utf8')
    validateReferencedSkillPaths(text, file, dir)
    for (const [needle, label] of forbidden) {
      if (text.toLowerCase().includes(needle.toLowerCase())) errors.push(`${file}: contains ${label} (${needle})`)
    }
  }
}

const assetSearchDir = path.join(skillsRoot, 'asset-search')
const assetSearchSkill = path.join(assetSearchDir, 'SKILL.md')
if (!existsSync(assetSearchSkill)) errors.push('asset-search: missing companion SKILL.md')
else {
  const text = readFileSync(assetSearchSkill, 'utf8')
  validateReferencedSkillPaths(text, assetSearchSkill, assetSearchDir)
  for (const [needle, label] of forbidden) {
    if (text.toLowerCase().includes(needle.toLowerCase())) errors.push(`${assetSearchSkill}: contains ${label} (${needle})`)
  }
}

const director = readFileSync(path.join(skillsRoot, 'deadwater-game-director', 'SKILL.md'), 'utf8')
for (const sibling of expected.filter((name) => name !== 'deadwater-game-director')) {
  if (!director.includes(`\`${sibling}\``)) errors.push(`director: does not route to ${sibling}`)
}

for (const file of expected.flatMap((name) => filesBelow(path.join(skillsRoot, name)))) {
  try {
    if (file.endsWith('.py')) {
      execFileSync(
        'python3',
        ['-c', 'import pathlib,sys; compile(pathlib.Path(sys.argv[1]).read_text(), sys.argv[1], "exec")', file],
        { stdio: 'pipe' },
      )
    }
    if (file.endsWith('.sh')) execFileSync('bash', ['-n', file], { stdio: 'pipe' })
    if (file.endsWith('.mjs') || file.endsWith('.js')) execFileSync('node', ['--check', file], { stdio: 'pipe' })
  } catch (error) {
    errors.push(`${file}: syntax check failed: ${error.stderr?.toString().trim() || error.message}`)
  }
}

if (errors.length) {
  console.error(`DEADWATER skill validation failed with ${errors.length} issue(s):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`DEADWATER skill validation passed for ${expected.length} skills.`)
