import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const CACHE = resolve(ROOT, '.cache/deadwater-audio')
const SOURCES = resolve(CACHE, 'sources')
const OUTPUT = resolve(ROOT, 'public/sounds')

const profiles = {
  footstep: 'highpass=f=55,lowpass=f=13500,acompressor=threshold=0.12:ratio=2.4:attack=4:release=85:makeup=1.35,loudnorm=I=-21:TP=-3:LRA=7,areverse,afade=t=in:d=0.018,areverse',
  cloth: 'highpass=f=150,lowpass=f=8500,acompressor=threshold=0.08:ratio=2:attack=8:release=110:makeup=1.2,loudnorm=I=-28:TP=-8:LRA=8,areverse,afade=t=in:d=0.025,areverse',
  impact: 'highpass=f=45,lowpass=f=13000,acompressor=threshold=0.1:ratio=3:attack=3:release=120:makeup=1.45,loudnorm=I=-19:TP=-2.5:LRA=6,areverse,afade=t=in:d=0.025,areverse',
  interaction: 'highpass=f=70,lowpass=f=12000,acompressor=threshold=0.1:ratio=2.5:attack=4:release=100:makeup=1.3,loudnorm=I=-22:TP=-4:LRA=7,areverse,afade=t=in:d=0.025,areverse',
  creature: 'highpass=f=180,lowpass=f=11000,acompressor=threshold=0.08:ratio=2.2:attack=4:release=90:makeup=1.2,loudnorm=I=-25:TP=-6:LRA=7,areverse,afade=t=in:d=0.02,areverse',
  world: 'highpass=f=45,lowpass=f=11500,acompressor=threshold=0.08:ratio=2:attack=12:release=180:makeup=1.15,loudnorm=I=-29:TP=-8:LRA=10,areverse,afade=t=in:d=0.08,areverse',
  ambience: 'highpass=f=28,lowpass=f=12500,loudnorm=I=-34:TP=-9:LRA=12',
  stinger: 'highpass=f=32,lowpass=f=10500,acompressor=threshold=0.08:ratio=2.8:attack=8:release=180:makeup=1.25,loudnorm=I=-23:TP=-5:LRA=8,areverse,afade=t=in:d=0.12,areverse',
}

const cue = (output, source, profile, options = {}) => ({ output, source, profile, ...options })
const selected = [
  ...[1, 5, 10, 15, 2, 7, 12, 20].map((n, i) => cue(`step_concrete_${String(i + 1).padStart(2, '0')}.ogg`, `metal-steps/metal_steps_${String(n).padStart(2, '0')}.wav`, 'footstep')),
  ...[1, 2, 3].map((n) => cue(`step_wet_${String(n).padStart(2, '0')}.ogg`, `sfx-100-v2/sfx100v2_footstep_wet_0${n}.ogg`, 'footstep')),
  ...[8, 9, 21, 23].map((n, i) => cue(`step_metal_${String(i + 1).padStart(2, '0')}.ogg`, `metal-steps/metal_steps_${String(n).padStart(2, '0')}.wav`, 'footstep')),
  ...[1, 2, 3, 4].map((n) => cue(`cloth_move_${String(n).padStart(2, '0')}.ogg`, `owlish/Cloth, Rustle/${[320137, 320138, 320141, 320142][n - 1]}__owlstorm__blanket-movement-${n}.wav`, 'cloth', { duration: 0.45 })),
  cue('jump_01.ogg', 'owlish/Footsteps/stumble.wav', 'footstep', { duration: 0.3 }),
  cue('jump_02.ogg', 'owlish/Footsteps/hard-footstep1.wav', 'footstep'),
  cue('jump_03.ogg', 'owlish/Footsteps/hard-footstep3.wav', 'footstep'),
  ...[1, 2, 3].map((n) => cue(`land_0${n}.ogg`, `owlish/Impacts/djembe${n}.wav`, 'impact')),
  cue('land_04.ogg', 'sfx-100-v2/sfx100v2_hit_01.ogg', 'impact'),
  ...[1, 2, 3].map((n) => cue(`swing_0${n}.ogg`, `sfx-100-v2/sfx100v2_air_0${n}.ogg`, 'interaction')),
  ...[1, 2].map((n) => cue(`impact_metal_0${n}.ogg`, `sfx-100-v2/sfx100v2_metal_hit_0${n}.ogg`, 'impact')),
  ...[1, 2].map((n) => cue(`impact_metal_0${n + 2}.ogg`, `sfx-100-v2/sfx100v2_metal_0${n}.ogg`, 'impact')),
  ...[1, 2, 3].map((n) => cue(`impact_wood_0${n}.ogg`, `sfx-100-v2/sfx100v2_wood_hit_0${n}.ogg`, 'impact')),
  ...[1, 2, 3].map((n) => cue(`impact_concrete_0${n}.ogg`, `sfx-100-v2/sfx100v2_hit_0${n}.ogg`, 'impact')),
  cue('impact_plastic_01.ogg', 'owlish/Misc Foley/pill-bottle.wav', 'impact', { duration: 0.5 }),
  cue('impact_plastic_02.ogg', 'sfx-100-v2/sfx100v2_items_01.ogg', 'impact'),
  ...[1, 2, 3].map((n) => cue(`handling_metal_0${n}.ogg`, n <= 2 ? `sfx-100-v2/sfx100v2_items_0${n}.ogg` : 'owlish/Impacts/flip.wav', 'interaction')),
  ...[1, 2, 3].map((n) => cue(`handling_wood_0${n}.ogg`, `sfx-100-v2/sfx100v2_wood_0${n}.ogg`, 'interaction')),
  cue('handling_plastic_01.ogg', 'owlish/Misc Foley/pill-bottle.wav', 'interaction', { duration: 0.45 }),
  cue('handling_plastic_02.ogg', 'sfx-100-v2/sfx100v2_misc_04.ogg', 'interaction'),
  cue('handling_cloth_01.ogg', 'owlish/Cloth, Rustle/212180__owlstorm__bag-zipper.wav', 'cloth', { duration: 0.55 }),
  cue('handling_cloth_02.ogg', 'owlish/Cloth, Rustle/320143__owlstorm__blanket-movement-5.wav', 'cloth', { duration: 0.45 }),
  ...[1, 2].map((n) => cue(`switch_0${n}.ogg`, `sfx-100-v2/sfx100v2_switch_0${n}.ogg`, 'interaction')),
  ...[1, 2, 3, 4, 5].map((n) => cue(`door_0${n}.ogg`, `sfx-100-v2/sfx100v2_door_0${n}.ogg`, 'interaction')),
  ...['Attack', 'Pain', 'Death'].map((name, i) => cue(`rat_squeak_0${i + 1}.ogg`, `squeaky-rat/qubodupSqueakyRat/qubodupSqueakyRat${name}.flac`, 'creature', { duration: 0.9 })),
  ...[1, 2, 3].map((n) => cue(`rat_scurry_0${n}.ogg`, `owlish/Impacts/toasterstep${n}.wav`, 'creature')),
  cue('rat_scurry_04.ogg', 'owlish/Impacts/alt-toasterstep1.wav', 'creature'),
  cue('ambience_warehouse.ogg', 'sfx-100-v2/sfx100v2_loop_ambient_02.ogg', 'ambience'),
  cue('ambience_sewer.ogg', 'sfx-100-v2/sfx100v2_loop_ambient_04.ogg', 'ambience'),
  cue('ambience_harbor.ogg', 'sfx-100-v2/sfx100v2_loop_water_02.ogg', 'ambience'),
  ...[1, 2, 3, 4].map((n) => cue(`world_machinery_0${n}.ogg`, `sfx-100-v2/sfx100v2_loop_machine_0${n}.ogg`, 'world', { duration: 4 })),
  ...[1, 2, 3].map((n) => cue(`world_chain_0${n}.ogg`, `sfx-100-v2/sfx100v2_metal_0${n}.ogg`, 'world')),
  ...[1, 2, 3].map((n) => cue(`world_drip_0${n}.ogg`, `sfx-100-v2/sfx100v2_footstep_wet_0${n}.ogg`, 'world')),
  ...[1, 2, 3].map((n) => cue(`world_water_0${n}.ogg`, `sfx-100-v2/sfx100v2_loop_water_0${n}.ogg`, 'world', { duration: 3.5 })),
  cue('stinger_clock_in.ogg', 'owlish/Ambience/earthquake.wav', 'stinger', { start: 0.4, duration: 1.7 }),
  cue('stinger_sewer.ogg', 'sfx-100-v2/sfx100v2_thunder_01.ogg', 'stinger', { duration: 1.8 }),
  cue('stinger_power.ogg', 'owlish/Scifi/blackhole2.wav', 'stinger', { duration: 1.5 }),
  cue('roomtone_fridge_01.ogg', 'the-shop/TheShopCollection_convenience_store_drinks_fridge_drone.wav', 'world', { start: 3, duration: 4 }),
  cue('roomtone_fridge_02.ogg', 'the-shop/TheShopCollection_convenience_store_drinks_fridge_drone_2.wav', 'world', { start: 3, duration: 4 }),
]

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} exited ${code}`)))
  })
}

await mkdir(OUTPUT, { recursive: true })
const records = []
for (const recipe of selected) {
  const input = resolve(SOURCES, recipe.source)
  const output = resolve(OUTPUT, recipe.output)
  const bytes = await readFile(input)
  const args = ['-y', '-hide_banner', '-loglevel', 'error']
  if (recipe.start) args.push('-ss', String(recipe.start))
  args.push('-i', input)
  args.push('-vn')
  if (recipe.duration) args.push('-t', String(recipe.duration))
  args.push('-af', profiles[recipe.profile], '-ac', '2', '-ar', '44100', '-c:a', 'vorbis', '-strict', 'experimental', '-q:a', '5', output)
  await run('ffmpeg', args)
  records.push({
    shipped: recipe.output,
    source: recipe.source,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    profile: recipe.profile,
    start: recipe.start ?? 0,
    duration: recipe.duration ?? null,
    command: ['ffmpeg', ...args],
  })
}

await writeFile(resolve(CACHE, 'production-record.json'), `${JSON.stringify({ version: 1, records }, null, 2)}\n`)
console.log(`built ${records.length} DEADWATER audio assets`)
