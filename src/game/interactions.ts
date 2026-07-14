import { useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import { useEffect } from 'react'
import { player } from './playerState'

/**
 * Usable things in the world (doors, later switches/pickups). Each has a
 * spot, a radius, a HUD prompt, and an action. The InteractionSystem finds
 * the nearest one in range each frame and fires it on E.
 */

export interface Interactable {
  x: number
  z: number
  radius: number
  label: string
  /** absent = inert (a locked door): the prompt shows but E does nothing */
  action?: () => void
}

const items = new Set<Interactable>()

export function registerInteractable(entry: Interactable): () => void {
  items.add(entry)
  return () => {
    items.delete(entry)
  }
}

// ---- HUD prompt (subscribed by the App overlay) ----
let prompt: string | null = null
const subs = new Set<() => void>()
function setPrompt(next: string | null) {
  if (next === prompt) return
  prompt = next
  subs.forEach((fn) => fn())
}
export function usePrompt(): string | null {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    () => prompt,
  )
}

// ---- fade transition (subscribed by the App overlay) ----
let faded = false
const fadeSubs = new Set<() => void>()
export function useFade(): boolean {
  return useSyncExternalStore(
    (fn) => {
      fadeSubs.add(fn)
      return () => fadeSubs.delete(fn)
    },
    () => faded,
  )
}
let transitioning = false
/** fade to black, run fn at the darkest point, fade back */
export function fadeThrough(fn: () => void, holdMs = 280) {
  if (transitioning) return
  transitioning = true
  faded = true
  fadeSubs.forEach((s) => s())
  setTimeout(() => {
    fn()
    setTimeout(() => {
      faded = false
      fadeSubs.forEach((s) => s())
      transitioning = false
    }, holdMs)
  }, holdMs)
}

function nearest(): Interactable | null {
  let best: Interactable | null = null
  let bestD = Infinity
  for (const it of items) {
    const d = Math.hypot(player.x - it.x, player.z - it.z)
    if (d <= it.radius && d < bestD) {
      bestD = d
      best = it
    }
  }
  return best
}

/** Mount once inside the Canvas (game mode). */
export function InteractionSystem() {
  useFrame(() => {
    setPrompt(player.locked && !transitioning ? (nearest()?.label ?? null) : null)
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyE' || !player.locked || transitioning) return
      const it = nearest()
      if (it) {
        e.stopImmediatePropagation()
        if (it.action) fadeThrough(it.action)
      }
    }
    // capture phase so the door wins over the E-opens-editor shortcut
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return null
}
