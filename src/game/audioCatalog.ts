export type AudioBus = 'foley' | 'interaction' | 'world' | 'ambience' | 'stinger'

export interface SpatialCue {
  refDistance: number
  maxDistance: number
  rolloff: number
}

export interface CueDefinition {
  urls: string[]
  bus: AudioBus
  gain: [number, number]
  rate: [number, number]
  maxVoices: number
  cooldown: number
  priority: 0 | 1 | 2 | 3
  spatial?: SpatialCue
  loop?: boolean
}

const variants = (stem: string, count: number) =>
  Array.from({ length: count }, (_, index) => `/sounds/${stem}_${String(index + 1).padStart(2, '0')}.ogg`)

const centered = (
  urls: string[],
  bus: AudioBus,
  gain: [number, number],
  rate: [number, number],
  maxVoices: number,
  cooldown: number,
  priority: CueDefinition['priority'],
): CueDefinition => ({ urls, bus, gain, rate, maxVoices, cooldown, priority })

const spatial = (
  urls: string[],
  bus: AudioBus,
  gain: [number, number],
  rate: [number, number],
  maxVoices: number,
  cooldown: number,
  priority: CueDefinition['priority'],
  maxDistance = 12,
): CueDefinition => ({
  urls,
  bus,
  gain,
  rate,
  maxVoices,
  cooldown,
  priority,
  spatial: { refDistance: 1.5, maxDistance, rolloff: 1.2 },
})

export const CUE_CATALOG: Record<string, CueDefinition> = {
  step_concrete: centered(variants('step_concrete', 8), 'foley', [0.42, 0.52], [0.97, 1.03], 2, 0.08, 3),
  step_wet: centered(variants('step_wet', 3), 'foley', [0.38, 0.48], [0.97, 1.03], 2, 0.08, 3),
  step_metal: centered(variants('step_metal', 4), 'foley', [0.35, 0.44], [0.97, 1.03], 2, 0.08, 3),
  cloth_move: centered(variants('cloth_move', 4), 'foley', [0.12, 0.18], [0.98, 1.02], 1, 0.32, 1),
  jump: centered(variants('jump', 3), 'foley', [0.34, 0.44], [0.98, 1.02], 1, 0.15, 2),
  land: centered(variants('land', 4), 'foley', [0.52, 0.66], [0.97, 1.02], 2, 0.12, 3),
  swing: centered(variants('swing', 3), 'interaction', [0.46, 0.58], [0.98, 1.02], 2, 0.12, 2),
  impact_metal: spatial(variants('impact_metal', 4), 'interaction', [0.58, 0.72], [0.97, 1.03], 4, 0.06, 3),
  impact_wood: spatial(variants('impact_wood', 3), 'interaction', [0.5, 0.64], [0.97, 1.03], 4, 0.06, 3),
  impact_concrete: spatial(variants('impact_concrete', 3), 'interaction', [0.48, 0.62], [0.97, 1.03], 4, 0.06, 3),
  impact_plastic: spatial(variants('impact_plastic', 2), 'interaction', [0.38, 0.5], [0.98, 1.03], 3, 0.08, 2),
  handling_metal: centered(variants('handling_metal', 3), 'interaction', [0.32, 0.42], [0.98, 1.02], 2, 0.12, 2),
  handling_wood: centered(variants('handling_wood', 3), 'interaction', [0.3, 0.4], [0.98, 1.02], 2, 0.12, 2),
  handling_plastic: centered(variants('handling_plastic', 2), 'interaction', [0.26, 0.36], [0.98, 1.02], 2, 0.12, 2),
  handling_cloth: centered(variants('handling_cloth', 2), 'interaction', [0.22, 0.3], [0.99, 1.01], 1, 0.18, 1),
  switch: spatial(variants('switch', 2), 'interaction', [0.48, 0.58], [0.99, 1.01], 2, 0.12, 3, 9),
  door: spatial(variants('door', 5), 'interaction', [0.52, 0.66], [0.98, 1.02], 2, 0.25, 3, 14),
  rat_squeak: spatial(variants('rat_squeak', 3), 'world', [0.2, 0.3], [0.98, 1.03], 2, 1.2, 1, 8),
  rat_scurry: spatial(variants('rat_scurry', 4), 'world', [0.12, 0.2], [0.98, 1.03], 2, 0.28, 1, 7),
  world_machinery: spatial(variants('world_machinery', 4), 'world', [0.18, 0.28], [0.99, 1.01], 2, 2, 1, 18),
  world_chain: spatial(variants('world_chain', 3), 'world', [0.16, 0.25], [0.98, 1.02], 2, 1.2, 1, 13),
  world_drip: spatial(variants('world_drip', 3), 'world', [0.11, 0.18], [0.98, 1.03], 2, 0.5, 0, 8),
  world_water: spatial(variants('world_water', 3), 'world', [0.13, 0.22], [0.99, 1.01], 2, 1.8, 0, 14),
  roomtone_fridge: spatial(variants('roomtone_fridge', 2), 'world', [0.12, 0.2], [0.99, 1.01], 1, 3, 0, 12),
  ambience_warehouse: { ...centered(['/sounds/ambience_warehouse.ogg'], 'ambience', [0.34, 0.34], [1, 1], 1, 0, 0), loop: true },
  ambience_sewer: { ...centered(['/sounds/ambience_sewer.ogg'], 'ambience', [0.3, 0.3], [1, 1], 1, 0, 0), loop: true },
  ambience_harbor: { ...centered(['/sounds/ambience_harbor.ogg'], 'ambience', [0.38, 0.38], [1, 1], 1, 0, 0), loop: true },
  stinger_clock_in: centered(['/sounds/stinger_clock_in.ogg'], 'stinger', [0.38, 0.38], [1, 1], 1, 1, 2),
  stinger_sewer: centered(['/sounds/stinger_sewer.ogg'], 'stinger', [0.34, 0.34], [1, 1], 1, 1, 2),
  stinger_power: centered(['/sounds/stinger_power.ogg'], 'stinger', [0.32, 0.32], [1, 1], 1, 1, 2),
}

const BUSES = new Set<AudioBus>(['foley', 'interaction', 'world', 'ambience', 'stinger'])

export function validateCueCatalog(catalog: Record<string, CueDefinition>): string[] {
  const errors: string[] = []
  for (const [name, cue] of Object.entries(catalog)) {
    if (!cue.urls.length) errors.push(`${name}: urls must not be empty`)
    if (new Set(cue.urls).size !== cue.urls.length) errors.push(`${name}: urls contain duplicates`)
    if (!BUSES.has(cue.bus)) errors.push(`${name}: invalid bus ${cue.bus}`)
    for (const [field, range] of [['gain', cue.gain], ['rate', cue.rate]] as const) {
      if (range.length !== 2 || range.some((value) => !Number.isFinite(value)) || range[0] > range[1]) {
        errors.push(`${name}: invalid ${field} range`)
      }
    }
    if (cue.gain[0] < 0) errors.push(`${name}: gain must be non-negative`)
    if (cue.rate[0] <= 0) errors.push(`${name}: rate must be positive`)
    if (!Number.isInteger(cue.maxVoices) || cue.maxVoices < 1) errors.push(`${name}: maxVoices must be positive`)
    if (!Number.isFinite(cue.cooldown) || cue.cooldown < 0) errors.push(`${name}: cooldown must be non-negative`)
    if (![0, 1, 2, 3].includes(cue.priority)) errors.push(`${name}: priority must be 0-3`)
    if (cue.spatial) {
      if (cue.spatial.refDistance <= 0 || cue.spatial.maxDistance <= cue.spatial.refDistance || cue.spatial.rolloff < 0) {
        errors.push(`${name}: invalid spatial settings`)
      }
    }
  }
  return errors
}

export type CueName = keyof typeof CUE_CATALOG
