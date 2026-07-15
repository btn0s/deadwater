import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const CACHE = resolve(ROOT, '.cache/deadwater-audio')
const MANIFEST = resolve(CACHE, 'candidates.json')
const PREVIEWS = resolve(CACHE, 'previews')
const OUTPUT = resolve(ROOT, 'public/__audio-audition')
const ALLOWED_LICENSES = new Set(['CC0', 'CC BY 3.0', 'CC BY 4.0'])
const REQUIRED = [
  'family',
  'label',
  'author',
  'sourcePage',
  'license',
  'licenseUrl',
  'retrieved',
  'originalFile',
  'previewFile',
  'sha256',
]

function isHttps(value) {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export function validateManifest(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.candidates)) {
    throw new Error('candidate manifest must have version 1 and a candidates array')
  }

  for (const [index, candidate] of value.candidates.entries()) {
    for (const key of REQUIRED) {
      if (typeof candidate[key] !== 'string' || !candidate[key].trim()) {
        throw new Error(`candidate ${index} has no ${key}`)
      }
    }
    if (!/^[a-z0-9_]+$/.test(candidate.family)) {
      throw new Error(`candidate ${index} has an invalid family`)
    }
    if (!ALLOWED_LICENSES.has(candidate.license)) {
      throw new Error(`candidate ${index} uses unsupported license ${candidate.license}`)
    }
    if (!isHttps(candidate.sourcePage) || !isHttps(candidate.licenseUrl)) {
      throw new Error(`candidate ${index} sourcePage and licenseUrl must use HTTPS`)
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate.retrieved)) {
      throw new Error(`candidate ${index} retrieved must be YYYY-MM-DD`)
    }
    if (!/^[a-f0-9]{64}$/i.test(candidate.sha256)) {
      throw new Error(`candidate ${index} has an invalid SHA256`)
    }
    if (candidate.previewFile !== basename(candidate.previewFile) || !/^[-a-zA-Z0-9_.]+$/.test(candidate.previewFile)) {
      throw new Error(`candidate ${index} has an unsafe previewFile`)
    }
    if (!['.wav', '.flac', '.ogg', '.mp3', '.m4a'].includes(extname(candidate.previewFile).toLowerCase())) {
      throw new Error(`candidate ${index} previewFile is not supported audio`)
    }
  }

  return value
}

async function initManifest() {
  await mkdir(PREVIEWS, { recursive: true })
  try {
    await readFile(MANIFEST)
    console.log(`candidate manifest already exists: ${MANIFEST}`)
    return
  } catch {
    // Create the local production manifest on first use.
  }
  await writeFile(MANIFEST, `${JSON.stringify({ version: 1, candidates: [] }, null, 2)}\n`)
  console.log(`created ${MANIFEST}`)
  console.log(`put level-matched preview files in ${PREVIEWS}`)
}

async function build() {
  const manifest = validateManifest(JSON.parse(await readFile(MANIFEST, 'utf8')))
  await mkdir(OUTPUT, { recursive: true })

  const candidates = []
  for (const [index, candidate] of manifest.candidates.entries()) {
    const extension = extname(candidate.previewFile).toLowerCase()
    const shippedName = `${candidate.family}-${String(index + 1).padStart(2, '0')}${extension}`
    await copyFile(resolve(PREVIEWS, candidate.previewFile), resolve(OUTPUT, shippedName))
    candidates.push({ ...candidate, audioUrl: `/__audio-audition/${shippedName}` })
  }

  await writeFile(resolve(OUTPUT, 'manifest.json'), `${JSON.stringify({ version: 1, candidates }, null, 2)}\n`)
  console.log(`built ${candidates.length} candidates for http://localhost:5173/audio-audition.html`)
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--init')) await initManifest()
  else await build()
}
