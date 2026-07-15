import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const SCENE = resolve(ROOT, 'src/engine/scene.json')
const scene = JSON.parse(await readFile(SCENE, 'utf8'))
const byId = new Map(scene.nodes.map((node) => [node.id, node]))

function upsert(node, patch) {
  node.components ??= []
  const existing = node.components.find((component) => component.type === 'acoustics')
  if (existing) Object.assign(existing, patch)
  else node.components.push({ type: 'acoustics', ...patch })
}

const floors = {
  floor: 'concrete',
  'sewer-structure/hall-floor': 'wetConcrete',
  'sewer-structure/platform-s': 'wetConcrete',
  'sewer-structure/platform-n': 'wetConcrete',
  'sewer-structure/bridge': 'metal',
  'yard/ground': 'concrete',
  'yard/alley-floor-s': 'concrete',
  'yard/alley-floor-n': 'concrete',
}
for (const [id, footstepSurface] of Object.entries(floors)) upsert(byId.get(id), { footstepSurface })

const emitters = {
  'sewer-generator': { cue: 'world_machinery', minInterval: 12, maxInterval: 28, gain: 0.8 },
  'sewer-compressor': { cue: 'world_machinery', minInterval: 17, maxInterval: 36, gain: 0.72 },
  'sewer-structure/pipe-bank-1': { cue: 'world_drip', minInterval: 8, maxInterval: 24, gain: 0.65 },
  'sewer-structure/water': { cue: 'world_water', minInterval: 14, maxInterval: 30, gain: 0.65 },
  'yard/harbor': { cue: 'world_water', minInterval: 20, maxInterval: 42, gain: 0.75 },
  'chained-door/chain': { cue: 'world_chain', minInterval: 22, maxInterval: 48, gain: 0.7 },
  'hall-ebox-1': { cue: 'roomtone_fridge', minInterval: 28, maxInterval: 55, gain: 0.42 },
}
for (const [id, emitter] of Object.entries(emitters)) upsert(byId.get(id), { emitter })

const woodTerms = ['cardboard', 'wooden', 'military_crate', 'pallet', 'table', 'chair', 'drawer_cabinet', 'binder']
const plasticTerms = ['plastic_crate', 'trashbag', 'caution', 'motor_oil']

function inferredMaterial(node) {
  const model = node.components?.find((component) => component.type === 'model')
  const generator = node.components?.find((component) => component.type === 'generator')
  const source = `${model?.url ?? ''} ${model?.texture ?? ''}`.toLowerCase()
  if (woodTerms.some((term) => source.includes(term))) return 'wood'
  if (plasticTerms.some((term) => source.includes(term))) return 'plastic'
  if (generator?.generator === 'paperWad' || generator?.generator === 'trashPile') return 'cloth'
  return 'metal'
}

let materialTags = 0
for (const node of scene.nodes) {
  const physics = node.components?.find((component) => component.type === 'physics')
  if (physics?.body !== 'dynamic' || !physics.grabbable) continue
  const material = inferredMaterial(node)
  if (material !== 'metal') {
    upsert(node, { material })
    materialTags++
  }
}

await writeFile(SCENE, `${JSON.stringify(scene, null, 1)}\n`)
console.log(`tagged ${Object.keys(floors).length} floors, ${materialTags} non-metal props, and ${Object.keys(emitters).length} emitters`)
