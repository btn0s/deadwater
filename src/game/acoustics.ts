import type { AudioPosition } from './audio'

export type AcousticMaterial = 'metal' | 'wood' | 'plastic' | 'concrete' | 'wetConcrete' | 'cloth'
export type FootstepSurface = 'concrete' | 'wetConcrete' | 'metal'
export type AudioZone = 'warehouse' | 'sewer' | 'harbor'
export type EmitterCue = 'world_machinery' | 'world_chain' | 'world_drip' | 'world_water' | 'roomtone_fridge'

export interface AcousticFloor {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  y: number
  surface: FootstepSurface
}

export interface AcousticEmitter {
  cue: EmitterCue
  position: AudioPosition
  minInterval: number
  maxInterval: number
  gain: number
}

const floors = new Set<AcousticFloor>()
const emitters = new Set<AcousticEmitter>()

export function audioZoneAt(x: number, z: number): AudioZone {
  if (x >= 20) return 'harbor'
  if (z <= -20) return 'sewer'
  return 'warehouse'
}

function defaultSurfaceAt(x: number, z: number): FootstepSurface {
  return audioZoneAt(x, z) === 'sewer' ? 'wetConcrete' : 'concrete'
}

export function registerAcousticFloor(floor: AcousticFloor): () => void {
  floors.add(floor)
  return () => floors.delete(floor)
}

export function footstepSurfaceAt(x: number, z: number): FootstepSurface {
  let best: AcousticFloor | null = null
  for (const floor of floors) {
    if (x < floor.minX || x > floor.maxX || z < floor.minZ || z > floor.maxZ) continue
    if (!best || floor.y > best.y) best = floor
  }
  return best?.surface ?? defaultSurfaceAt(x, z)
}

export function registerAcousticEmitter(emitter: AcousticEmitter): () => void {
  emitters.add(emitter)
  return () => emitters.delete(emitter)
}

export function activeAcousticEmitters(): AcousticEmitter[] {
  return [...emitters]
}

export function impactCueFor(material: AcousticMaterial) {
  if (material === 'wetConcrete') return 'impact_concrete' as const
  if (material === 'cloth') return 'impact_plastic' as const
  return `impact_${material}` as 'impact_metal' | 'impact_wood' | 'impact_plastic' | 'impact_concrete'
}

export function handlingCueFor(material: AcousticMaterial) {
  if (material === 'wetConcrete' || material === 'concrete') return 'handling_metal' as const
  return `handling_${material}` as 'handling_metal' | 'handling_wood' | 'handling_plastic' | 'handling_cloth'
}
