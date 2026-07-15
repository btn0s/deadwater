import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const CACHE = resolve(ROOT, '.cache/deadwater-audio')
const SOURCES = resolve(CACHE, 'sources')
const PREVIEWS = resolve(CACHE, 'previews')
const RETRIEVED = '2026-07-14'
const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/'
const CCBY3 = 'https://creativecommons.org/licenses/by/3.0/'

const pages = {
  owlish: 'https://opengameart.org/content/sound-effects-pack',
  rubberduck: 'https://opengameart.org/content/100-cc0-sfx-2',
  metalSteps: 'https://opengameart.org/content/metal-footsteps-on-concrete',
  surfaceSteps: 'https://opengameart.org/content/footsteps-on-different-surfaces',
  shop: 'https://opengameart.org/content/the-shop',
  rat: 'https://opengameart.org/content/squeaky-rat',
}

const source = (family, label, author, sourcePage, path, license = 'CC0', licenseUrl = CC0, maxSeconds) => ({
  family,
  label,
  author,
  sourcePage,
  path,
  license,
  licenseUrl,
  maxSeconds,
})

const numbered = (count, make) => Array.from({ length: count }, (_, index) => make(index + 1))

const recipes = [
  ...numbered(4, (n) => source('footstep_concrete', `Thimras metal sole ${n}`, 'Thimras', pages.metalSteps, `metal-steps/metal_steps_${String([1, 5, 10, 15][n - 1]).padStart(2, '0')}.wav`)),
  ...numbered(4, (n) => source('footstep_concrete', `Owlish hard step ${n}`, 'OwlishMedia', pages.owlish, `owlish/Footsteps/hard-footstep${n}.wav`)),
  ...numbered(3, (n) => source('footstep_wet', `Rubberduck wet step ${n}`, 'rubberduck', pages.rubberduck, `sfx-100-v2/sfx100v2_footstep_wet_0${n}.ogg`)),
  ...numbered(4, (n) => source('footstep_metal', `C-Dogs metal step ${n}`, 'congusbongus', pages.surfaceSteps, `footsteps-surfaces/footsteps/step_metal${n === 1 ? '' : ` (${n})`}.ogg`, 'CC BY 3.0', CCBY3)),
  ...numbered(4, (n) => source('cloth_movement', `Owlish cloth movement ${n}`, 'OwlishMedia', pages.owlish, `owlish/Cloth, Rustle/${[320137, 320138, 320141, 320142][n - 1]}__owlstorm__blanket-movement-${n}.wav`, 'CC0', CC0, 4)),
  source('jump', 'Owlish stumble', 'OwlishMedia', pages.owlish, 'owlish/Footsteps/stumble.wav'),
  source('landing', 'Owlish dull impact', 'OwlishMedia', pages.owlish, 'owlish/Impacts/djembe1.wav'),
  ...numbered(3, (n) => source('crowbar_swing', `Rubberduck air cut ${n}`, 'rubberduck', pages.rubberduck, `sfx-100-v2/sfx100v2_air_0${n}.ogg`)),
  ...numbered(4, (n) => source('impact_metal', `Rubberduck metal contact ${n}`, 'rubberduck', pages.rubberduck, n <= 2 ? `sfx-100-v2/sfx100v2_metal_hit_0${n}.ogg` : `sfx-100-v2/sfx100v2_metal_0${n - 2}.ogg`)),
  ...numbered(3, (n) => source('impact_wood', `Rubberduck wood contact ${n}`, 'rubberduck', pages.rubberduck, `sfx-100-v2/sfx100v2_wood_hit_0${n}.ogg`)),
  ...numbered(3, (n) => source('impact_concrete', `Rubberduck hard impact ${n}`, 'rubberduck', pages.rubberduck, `sfx-100-v2/sfx100v2_hit_0${n}.ogg`)),
  source('handling_plastic', 'Owlish pill bottle', 'OwlishMedia', pages.owlish, 'owlish/Misc Foley/pill-bottle.wav'),
  source('handling_cloth', 'Owlish bag zipper', 'OwlishMedia', pages.owlish, 'owlish/Cloth, Rustle/212180__owlstorm__bag-zipper.wav'),
  ...numbered(2, (n) => source('handling_metal', `Rubberduck item ${n}`, 'rubberduck', pages.rubberduck, `sfx-100-v2/sfx100v2_items_0${n}.ogg`)),
  ...numbered(2, (n) => source('switch', `Rubberduck switch ${n}`, 'rubberduck', pages.rubberduck, `sfx-100-v2/sfx100v2_switch_0${n}.ogg`)),
  ...numbered(5, (n) => source('door', `Rubberduck door ${n}`, 'rubberduck', pages.rubberduck, `sfx-100-v2/sfx100v2_door_0${n}.ogg`)),
  ...['Attack', 'Pain', 'Death'].map((name) => source('rat', `Qubodup rat ${name.toLowerCase()}`, 'Iwan Gabovitch (qubodup)', pages.rat, `squeaky-rat/qubodupSqueakyRat/qubodupSqueakyRat${name}.flac`)),
  ...numbered(2, (n) => source('warehouse_tone', `LEGIT fridge room tone ${n}`, 'LEGIT Audio', pages.shop, `the-shop/TheShopCollection_convenience_store_drinks_fridge_drone${n === 1 ? '' : '_2'}.wav`, 'CC0', CC0, 12)),
  ...numbered(4, (n) => source('sewer_tone', `Rubberduck dark ambience ${n}`, 'rubberduck', pages.rubberduck, `sfx-100-v2/sfx100v2_loop_ambient_0${n}.ogg`, 'CC0', CC0, 12)),
  ...numbered(3, (n) => source('harbor_water', `Rubberduck water loop ${n}`, 'rubberduck', pages.rubberduck, `sfx-100-v2/sfx100v2_loop_water_0${n}.ogg`, 'CC0', CC0, 12)),
  ...numbered(4, (n) => source('machinery', `Rubberduck machinery ${n}`, 'rubberduck', pages.rubberduck, `sfx-100-v2/sfx100v2_loop_machine_0${n}.ogg`, 'CC0', CC0, 12)),
]

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} exited ${code}`)))
  })
}

await mkdir(PREVIEWS, { recursive: true })
const candidates = []
for (const [index, recipe] of recipes.entries()) {
  const input = resolve(SOURCES, recipe.path)
  const bytes = await readFile(input)
  const previewFile = `${recipe.family}-${String(index + 1).padStart(2, '0')}.wav`
  const output = resolve(PREVIEWS, previewFile)
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', input]
  if (recipe.maxSeconds) args.push('-t', String(recipe.maxSeconds))
  args.push('-af', 'loudnorm=I=-23:TP=-3:LRA=11', '-ar', '44100', '-c:a', 'pcm_s16le', output)
  await run('ffmpeg', args)
  candidates.push({
    family: recipe.family,
    label: recipe.label,
    author: recipe.author,
    sourcePage: recipe.sourcePage,
    license: recipe.license,
    licenseUrl: recipe.licenseUrl,
    retrieved: RETRIEVED,
    originalFile: basename(recipe.path),
    previewFile,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  })
}

await writeFile(resolve(CACHE, 'candidates.json'), `${JSON.stringify({ version: 1, candidates }, null, 2)}\n`)
console.log(`staged ${candidates.length} level-matched candidates`)
