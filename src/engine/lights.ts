import { MAX_LIGHTS, lightPositions, lightColors, lightRadii, lightSpots, lightDirs, lightCones, lightBaked } from '../ps2/PS2Material'

/**
 * Runtime allocator for the shared PS2 light slots. Light components acquire
 * a slot on mount and release it on unmount — no hand-assigned indices.
 */
const used = new Array<boolean>(MAX_LIGHTS).fill(false)

// dev hook: inspect live slot state from the console / agent tooling
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__lightSlots = () =>
    used.map((u, i) => ({
      used: u,
      pos: lightPositions[i].toArray(),
      color: lightColors[i].toArray(),
      radius: lightRadii[i],
      spot: lightSpots[i],
    }))
}

export function acquireLightSlot(): number {
  const i = used.indexOf(false)
  if (i === -1) {
    console.warn(`out of light slots (${MAX_LIGHTS})`)
    return -1
  }
  used[i] = true
  return i
}

export function releaseLightSlot(i: number) {
  if (i < 0) return
  used[i] = false
  lightPositions[i].set(0, -1000, 0)
  lightColors[i].setRGB(0, 0, 0)
  lightRadii[i] = 1
  lightSpots[i] = 0
  lightDirs[i].set(0, -1, 0)
  lightCones[i] = 0
  lightBaked[i] = 0
}
