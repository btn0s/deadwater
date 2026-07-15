import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { player } from './playerState'

/**
 * Synthesized sound kit — every cue is generated in WebAudio at load, no
 * sample files, no licenses. PS2-era foley reads fine at this fidelity:
 * filtered noise bursts, FM chirps, slow noise beds.
 *
 * play(name) for one-shots; the AudioSystem component runs footsteps and
 * the zone ambience (warehouse hum inside, harbor wash outside).
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
const buffers = new Map<string, AudioBuffer>()

function ac(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
    bake()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function makeBuffer(name: string, dur: number, fill: (t: number, i: number, n: number) => number) {
  const c = ctx!
  const n = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, n, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < n; i++) data[i] = fill(i / c.sampleRate, i, n)
  buffers.set(name, buf)
}

/** one-pole lowpass over white noise, resonance faked with a sine blend */
function bake() {
  let lp = 0
  const noiseLP = (cut: number) => {
    lp += (Math.random() * 2 - 1 - lp) * cut
    return lp
  }

  // switch / UI click: 15ms snap
  makeBuffer('click', 0.03, (_t, i, n) => (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.12)) * 0.8)
  // heavier relay clunk for the light switches
  makeBuffer('clunk', 0.09, (_t, i, n) => noiseLP(0.12) * Math.exp(-i / (n * 0.2)) * 2.2)
  // door transition: airy whoosh into a latch
  makeBuffer('door', 0.5, (t, i, n) => {
    const whoosh = noiseLP(0.05 + 0.2 * (t / 0.5)) * Math.sin((Math.PI * i) / n) * 1.6
    const latch = t > 0.4 ? (Math.random() * 2 - 1) * Math.exp(-(t - 0.4) * 60) * 0.9 : 0
    return whoosh + latch
  })
  // pickup rustle
  makeBuffer('pickup', 0.12, (_t, i, n) => noiseLP(0.35) * Math.exp(-i / (n * 0.3)) * 1.4)
  // crowbar whoosh
  makeBuffer('swing', 0.22, (_t, i, n) => noiseLP(0.08 + 0.25 * Math.sin((Math.PI * i) / n)) * Math.sin((Math.PI * i) / n) * 2.0)
  // impact thunk
  makeBuffer('thunk', 0.14, (t) => (noiseLP(0.06) * 2.4 + Math.sin(2 * Math.PI * 70 * t) * 0.5) * Math.exp(-t * 26))
  // torch click on/off
  makeBuffer('torch', 0.04, (t, i, n) => (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.08)) * 0.5 + Math.sin(2 * Math.PI * 2100 * t) * Math.exp(-t * 90) * 0.4)
  // footstep: dull concrete tap, two weights
  makeBuffer('step1', 0.09, (t) => noiseLP(0.09) * Math.exp(-t * 42) * 1.9)
  makeBuffer('step2', 0.09, (t) => noiseLP(0.11) * Math.exp(-t * 38) * 1.7)
  // rat chirp
  makeBuffer('squeak', 0.09, (t) => Math.sin(2 * Math.PI * (2800 + Math.sin(t * 260) * 700) * t) * Math.exp(-t * 40) * 0.25)
  // ambience beds (looped): low interior hum / exterior water wash
  makeBuffer('hum', 2.0, (t) => Math.sin(2 * Math.PI * 58 * t) * 0.05 + Math.sin(2 * Math.PI * 117 * t) * 0.02 + noiseLP(0.01) * 0.35)
  makeBuffer('wash', 4.0, (t) => noiseLP(0.015) * (2.2 + Math.sin(2 * Math.PI * t * 0.23) * 1.4))
}

export function play(name: string, volume = 1, rate = 1) {
  const c = ac()
  const buf = buffers.get(name)
  if (!buf || !master) return
  const src = c.createBufferSource()
  src.buffer = buf
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
    const buf = buffers.get(name)
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

/** footsteps from travel distance + zone ambience; mount once in the Canvas */
export function AudioSystem() {
  const last = useRef({ x: player.x, z: player.z })
  const travelled = useRef(0)
  const parity = useRef(false)
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
    const d = Math.hypot(dx, dz)
    if (d < 1) travelled.current += d // teleports don't clomp
    if (travelled.current > 0.78) {
      travelled.current = 0
      parity.current = !parity.current
      play(parity.current ? 'step1' : 'step2', 0.5)
    }

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
