import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CUE_CATALOG, type AudioBus, type CueDefinition, type CueName } from './audioCatalog'
import { activeAcousticEmitters, audioZoneAt, footstepSurfaceAt, type AcousticEmitter } from './acoustics'
import { player } from './playerState'

export interface AudioPosition {
  x: number
  y: number
  z: number
}

interface Voice {
  name: CueName
  bus: AudioBus
  priority: number
  startedAt: number
  source: AudioBufferSourceNode
  gain: GainNode
  panner?: PannerNode
}

const BUS_LEVELS: Record<AudioBus, number> = {
  foley: 0.9,
  interaction: 0.88,
  world: 0.72,
  ambience: 0.7,
  stinger: 0.78,
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
const buses = new Map<AudioBus, GainNode>()
const buffers = new Map<CueName, AudioBuffer[]>()
const voices = new Set<Voice>()
const lastPlayed = new Map<CueName, number>()
const lastVariant = new Map<CueName, number>()
const cueStarts = new Map<CueName, number>()
const reportedFailures = new Set<string>()
const playedOnce = new Set<CueName>()
const emitterSchedule = new Map<AcousticEmitter, number>()
let loadPromise: Promise<void> | null = null

function reportFailure(name: CueName, url: string, cause: unknown) {
  const key = `${name}:${url}`
  if (!import.meta.env.DEV || reportedFailures.has(key)) return
  reportedFailures.add(key)
  console.error(`[audio] ${name} failed to load ${url}`, cause)
}

function audioContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = 0.55
    master.connect(ctx.destination)
    for (const [name, level] of Object.entries(BUS_LEVELS) as [AudioBus, number][]) {
      const gain = ctx.createGain()
      gain.gain.value = level
      gain.connect(master)
      buses.set(name, gain)
    }
    loadPromise = loadSamples(ctx)
  }
  return ctx
}

async function loadSamples(context: AudioContext) {
  await Promise.all(
    (Object.entries(CUE_CATALOG) as [CueName, CueDefinition][]).map(async ([name, cue]) => {
      const decoded = await Promise.all(
        cue.urls.map(async (url) => {
          try {
            const response = await fetch(url)
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            return await context.decodeAudioData(await response.arrayBuffer())
          } catch (cause) {
            reportFailure(name, url, cause)
            return null
          }
        }),
      )
      const available = decoded.filter((buffer): buffer is AudioBuffer => buffer !== null)
      if (available.length) buffers.set(name, available)
    }),
  )
}

export async function prepareAudio(timeoutMs = 1500): Promise<void> {
  const context = audioContext()
  if (context.state === 'suspended') await context.resume()
  const ready = loadPromise ?? Promise.resolve()
  await Promise.race([ready, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))])
}

function between([low, high]: [number, number]) {
  return low + Math.random() * (high - low)
}

function pickBuffer(name: CueName, available: AudioBuffer[]): AudioBuffer {
  if (available.length === 1) return available[0]
  const previous = lastVariant.get(name) ?? -1
  let index = Math.floor(Math.random() * available.length)
  if (index === previous) index = (index + 1 + Math.floor(Math.random() * (available.length - 1))) % available.length
  lastVariant.set(name, index)
  return available[index]
}

function releaseVoice(voice: Voice) {
  if (!voices.delete(voice)) return
  voice.source.disconnect()
  voice.gain.disconnect()
  voice.panner?.disconnect()
}

function stopVoice(voice: Voice) {
  voice.source.onended = null
  try {
    voice.source.stop()
  } catch {
    // The source already ended; cleanup is still required.
  }
  releaseVoice(voice)
}

function makeRoomFor(name: CueName, cue: CueDefinition): boolean {
  const sameCue = [...voices].filter((voice) => voice.name === name).sort((a, b) => a.startedAt - b.startedAt)
  if (sameCue.length >= cue.maxVoices) stopVoice(sameCue[0])

  if (cue.bus !== 'world') return true
  const world = [...voices].filter((voice) => voice.bus === 'world').sort((a, b) => a.priority - b.priority || a.startedAt - b.startedAt)
  if (world.length < 6) return true
  if (world[0].priority > cue.priority) return false
  stopVoice(world[0])
  return true
}

function setPannerPosition(panner: PannerNode, position: AudioPosition, at: number) {
  panner.positionX.setValueAtTime(position.x, at)
  panner.positionY.setValueAtTime(position.y, at)
  panner.positionZ.setValueAtTime(position.z, at)
}

function startCue(name: CueName, volume: number, rate: number, position?: AudioPosition): boolean {
  // Physics can generate impacts on the title screen. Do not create a suspended
  // context there and queue a burst of stale sounds for the first user gesture.
  if (!ctx) return false
  const context = ctx
  if (context.state === 'suspended') void context.resume()
  const cue = CUE_CATALOG[name]
  const available = buffers.get(name)
  const bus = buses.get(cue.bus)
  if (!available?.length || !bus) return false

  const now = context.currentTime
  if (now - (lastPlayed.get(name) ?? -Infinity) < cue.cooldown) return false
  if (!makeRoomFor(name, cue)) return false
  lastPlayed.set(name, now)

  const source = context.createBufferSource()
  source.buffer = pickBuffer(name, available)
  source.playbackRate.value = rate * between(cue.rate)

  const gain = context.createGain()
  gain.gain.value = Math.max(0, volume) * between(cue.gain)
  source.connect(gain)

  let panner: PannerNode | undefined
  if (position && cue.spatial) {
    panner = context.createPanner()
    panner.panningModel = 'HRTF'
    panner.distanceModel = 'inverse'
    panner.refDistance = cue.spatial.refDistance
    panner.maxDistance = cue.spatial.maxDistance
    panner.rolloffFactor = cue.spatial.rolloff
    setPannerPosition(panner, position, now)
    gain.connect(panner).connect(bus)
  } else {
    gain.connect(bus)
  }

  const voice: Voice = { name, bus: cue.bus, priority: cue.priority, startedAt: now, source, gain, panner }
  voices.add(voice)
  cueStarts.set(name, (cueStarts.get(name) ?? 0) + 1)
  source.onended = () => releaseVoice(voice)
  source.start()
  return true
}

export function play(name: CueName, volume = 1, rate = 1) {
  return startCue(name, volume, rate)
}

export function playAt(name: CueName, position: AudioPosition, volume = 1, rate = 1) {
  return startCue(name, volume, rate, position)
}

export function playOnce(name: CueName, volume = 1, rate = 1) {
  if (playedOnce.has(name)) return false
  const started = play(name, volume, rate)
  if (started) playedOnce.add(name)
  return started
}

let ambient: { name: CueName; source: AudioBufferSourceNode; gain: GainNode } | null = null

function stopAmbience(fadeSeconds = 0.8) {
  if (!ambient || !ctx) return
  const previous = ambient
  ambient = null
  previous.gain.gain.cancelScheduledValues(ctx.currentTime)
  previous.gain.gain.setValueAtTime(previous.gain.gain.value, ctx.currentTime)
  previous.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeSeconds)
  setTimeout(() => {
    try {
      previous.source.stop()
    } catch {
      // Already stopped during teardown.
    }
    previous.source.disconnect()
    previous.gain.disconnect()
  }, fadeSeconds * 1000 + 50)
}

function setAmbience(name: CueName | null) {
  if (ambient?.name === name) return
  if (!name) {
    stopAmbience()
    return
  }

  const cue = CUE_CATALOG[name]
  const context = audioContext()
  const buffer = buffers.get(name)?.[0]
  const bus = buses.get('ambience')
  if (!cue.loop || !buffer || !bus) return

  const previous = ambient
  const source = context.createBufferSource()
  source.buffer = buffer
  source.loop = true
  const gain = context.createGain()
  gain.gain.value = 0
  gain.gain.linearRampToValueAtTime(between(cue.gain), context.currentTime + 1.2)
  source.connect(gain).connect(bus)
  source.start()
  ambient = { name, source, gain }

  if (previous) {
    previous.gain.gain.cancelScheduledValues(context.currentTime)
    previous.gain.gain.setValueAtTime(previous.gain.gain.value, context.currentTime)
    previous.gain.gain.linearRampToValueAtTime(0, context.currentTime + 1.2)
    setTimeout(() => {
      try {
        previous.source.stop()
      } catch {
        // Already stopped during teardown.
      }
      previous.source.disconnect()
      previous.gain.disconnect()
    }, 1250)
  }
}

export function stopAudio() {
  stopAmbience(0.15)
  for (const voice of [...voices]) stopVoice(voice)
  lastPlayed.clear()
  playedOnce.clear()
  emitterSchedule.clear()
}

const listenerForward = new THREE.Vector3()
function updateListener(camera: THREE.Camera, context: AudioContext) {
  camera.getWorldDirection(listenerForward)
  const listener = context.listener
  const at = context.currentTime
  listener.positionX.setValueAtTime(camera.position.x, at)
  listener.positionY.setValueAtTime(camera.position.y, at)
  listener.positionZ.setValueAtTime(camera.position.z, at)
  listener.forwardX.setValueAtTime(listenerForward.x, at)
  listener.forwardY.setValueAtTime(listenerForward.y, at)
  listener.forwardZ.setValueAtTime(listenerForward.z, at)
  listener.upX.setValueAtTime(camera.up.x, at)
  listener.upY.setValueAtTime(camera.up.y, at)
  listener.upZ.setValueAtTime(camera.up.z, at)
}

function ambienceAt(x: number, z: number): CueName {
  return `ambience_${audioZoneAt(x, z)}`
}

const STEP_CUES = {
  concrete: 'step_concrete',
  wetConcrete: 'step_wet',
  metal: 'step_metal',
} as const

function updateEmitters(now: number) {
  const active = activeAcousticEmitters()
  const activeSet = new Set(active)
  for (const emitter of emitterSchedule.keys()) if (!activeSet.has(emitter)) emitterSchedule.delete(emitter)
  for (const emitter of active) {
    let next = emitterSchedule.get(emitter)
    if (next === undefined) {
      next = now + emitter.minInterval + Math.random() * (emitter.maxInterval - emitter.minInterval)
      emitterSchedule.set(emitter, next)
    }
    if (now < next) continue
    playAt(emitter.cue, emitter.position, emitter.gain)
    emitterSchedule.set(emitter, now + emitter.minInterval + Math.random() * (emitter.maxInterval - emitter.minInterval))
  }
}

export function AudioSystem({ active = true }: { active?: boolean }) {
  const last = useRef({ x: player.x, z: player.z })
  const travelled = useRef(0)
  const clothTravelled = useRef(0)
  const wasGrounded = useRef(true)
  const airTime = useRef(0)

  useEffect(() => {
    const unlock = () => void prepareAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  useEffect(() => {
    if (!active) {
      stopAudio()
      last.current = { x: player.x, z: player.z }
      travelled.current = 0
      clothTravelled.current = 0
      wasGrounded.current = player.grounded
      airTime.current = 0
    }
  }, [active])

  useFrame(({ camera }, rawDt) => {
    if (!ctx || !active) return
    updateListener(camera, ctx)
    if (!player.locked) return

    const dt = Math.min(rawDt, 0.05)
    const dx = player.x - last.current.x
    const dz = player.z - last.current.z
    last.current.x = player.x
    last.current.z = player.z

    if (player.grounded) {
      if (!wasGrounded.current) {
        play('land', 0.85 + Math.min(airTime.current * 0.18, 0.4))
        airTime.current = 0
      }
      const distance = Math.hypot(dx, dz)
      if (distance < 1) {
        travelled.current += distance
        clothTravelled.current += distance
      }
      if (travelled.current > 2) {
        travelled.current = 0
        play(STEP_CUES[footstepSurfaceAt(player.x, player.z)])
      }
      if (clothTravelled.current > 4.4) {
        clothTravelled.current = 0
        play('cloth_move')
      }
    } else {
      travelled.current = 0
      airTime.current += dt
    }
    wasGrounded.current = player.grounded
    const zone = audioZoneAt(player.x, player.z)
    setAmbience(ambienceAt(player.x, player.z))
    if (zone === 'sewer') playOnce('stinger_sewer')
    updateEmitters(ctx.currentTime)
  })

  return null
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__audioState = () => ({
    contextState: ctx?.state ?? 'uninitialized',
    loadedCues: buffers.size,
    loadedBuffers: [...buffers.values()].reduce((sum, entries) => sum + entries.length, 0),
    activeVoices: voices.size,
    ambience: ambient?.name ?? null,
    failures: [...reportedFailures],
    starts: Object.fromEntries(cueStarts),
  })
}
