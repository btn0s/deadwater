import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { player } from './playerState'

/**
 * Sound kit: real CC0 samples (Kenney impact + interface packs, see
 * public/models/CREDITS.md) decoded into WebAudio buffers on first
 * pointer-down. A name can map to several variant files — play() picks one
 * at random. The two looped ambience beds (interior hum, harbor wash) and
 * the rat squeak stay synthesized: beds need seamless loops, and the wash
 * is tuned to the water shader's swell so what you hear matches what the
 * shore is doing.
 *
 * play(name) for one-shots; AudioSystem runs grounded-only footsteps,
 * jump/land cues and the zone ambience.
 */

const SAMPLES: Record<string, string[]> = {
  step: [0, 1, 2, 3, 4].map((i) => `/sounds/footstep_concrete_00${i}.ogg`),
  land: ['/sounds/land.ogg'],
  click: ['/sounds/click.ogg'],
  clunk: ['/sounds/clunk.ogg'],
  door: ['/sounds/door.ogg'],
  pickup: ['/sounds/pickup.ogg'],
  thunk: ['/sounds/thunk.ogg'],
  torch: ['/sounds/torch.ogg'],
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
const buffers = new Map<string, AudioBuffer[]>()

function ac(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
    bakeSynth()
    void loadSamples()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

async function loadSamples() {
  const c = ctx!
  await Promise.all(
    Object.entries(SAMPLES).map(async ([name, urls]) => {
      const decoded = await Promise.all(
        urls.map(async (u) => c.decodeAudioData(await (await fetch(u)).arrayBuffer())),
      )
      buffers.set(name, decoded)
    }),
  )
}

function makeBuffer(name: string, dur: number, fill: (t: number, i: number, n: number) => number) {
  const c = ctx!
  const n = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, n, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < n; i++) data[i] = fill(i / c.sampleRate, i, n)
  buffers.set(name, [buf])
}

/** the synthesized stragglers: whoosh, rat, and the two ambience beds */
function bakeSynth() {
  let lp = 0
  const noiseLP = (cut: number) => {
    lp += (Math.random() * 2 - 1 - lp) * cut
    return lp
  }
  // crowbar whoosh — filtered noise sweep
  makeBuffer('swing', 0.22, (_t, i, n) => noiseLP(0.08 + 0.25 * Math.sin((Math.PI * i) / n)) * Math.sin((Math.PI * i) / n) * 2.0)
  // rat chirp
  makeBuffer('squeak', 0.09, (t) => Math.sin(2 * Math.PI * (2800 + Math.sin(t * 260) * 700) * t) * Math.exp(-t * 40) * 0.25)
  // interior hum bed (looped)
  makeBuffer('hum', 2.0, (t) => Math.sin(2 * Math.PI * 58 * t) * 0.05 + Math.sin(2 * Math.PI * 117 * t) * 0.02 + noiseLP(0.01) * 0.35)
  // harbor wash bed (looped): one full surge per loop, period matched to the
  // water shader's slow swell term (uTime * 0.6 rad/s → 2π/0.6 s)
  const SWELL = 2 * Math.PI / 0.6
  makeBuffer('wash', SWELL, (t) => noiseLP(0.015) * (2.2 + Math.sin((2 * Math.PI * t) / SWELL) * 1.4))
}

export function play(name: string, volume = 1, rate = 1) {
  const c = ac()
  const variants = buffers.get(name)
  if (!variants?.length || !master) return
  const src = c.createBufferSource()
  src.buffer = variants[Math.floor(Math.random() * variants.length)]
  src.playbackRate.value = rate * (0.94 + Math.random() * 0.12)
  const g = c.createGain()
  g.gain.value = volume
  src.connect(g).connect(master)
  src.start()
}

let ambient: { src: AudioBufferSourceNode; gain: GainNode; name: string } | null = null
function setAmbience(name: string | null, volume: number) {
  if (ambient?.name === name) return
  if (ambient) {
    ambient.gain.gain.linearRampToValueAtTime(0, ac().currentTime + 0.8)
    const old = ambient.src
    setTimeout(() => old.stop(), 900)
    ambient = null
  }
  if (name) {
    const c = ac()
    const buf = buffers.get(name)?.[0]
    if (!buf || !master) return
    const src = c.createBufferSource()
    src.buffer = buf
    src.loop = true
    const g = c.createGain()
    g.gain.value = 0
    g.gain.linearRampToValueAtTime(volume, c.currentTime + 1.2)
    src.connect(g).connect(master)
    src.start()
    ambient = { src, gain: g, name }
  }
}

/** footsteps from travel distance (grounded only), landing thumps,
 * zone ambience; mount once in the Canvas */
export function AudioSystem() {
  const last = useRef({ x: player.x, z: player.z })
  const travelled = useRef(0)
  const wasGrounded = useRef(true)
  const squeakTimer = useRef(20)

  useEffect(() => {
    // the first pointer-lock click unlocks audio
    const unlock = () => ac()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  useFrame((_, rawDt) => {
    if (!ctx || !player.locked) return
    const dt = Math.min(rawDt, 0.05)

    const dx = player.x - last.current.x
    const dz = player.z - last.current.z
    last.current.x = player.x
    last.current.z = player.z

    if (player.grounded) {
      if (!wasGrounded.current) play('land', 0.7) // touchdown
      const d = Math.hypot(dx, dz)
      if (d < 1) travelled.current += d // teleports don't clomp
      if (travelled.current > 0.78) {
        travelled.current = 0
        play('step', 0.5)
      }
    } else {
      travelled.current = 0 // no footsteps in the air
    }
    wasGrounded.current = player.grounded

    setAmbience(player.x < 20 ? 'hum' : 'wash', player.x < 20 ? 0.5 : 0.7)

    // a rat somewhere, now and then
    squeakTimer.current -= dt
    if (squeakTimer.current <= 0) {
      squeakTimer.current = 14 + Math.random() * 25
      if (player.x < 20) play('squeak', 0.3, 0.9 + Math.random() * 0.3)
    }
  })

  return null
}
