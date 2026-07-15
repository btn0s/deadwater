import { useSyncExternalStore } from 'react'
import { useEffect } from 'react'
import { player } from './playerState'

/**
 * Player inventory: a 4-slot hotbar, Minecraft-style. Digit keys 1-4 pick
 * the active slot; whatever sits in it is "equipped" (game systems like the
 * flashlight subscribe and react).
 */

export type ItemId = 'flashlight'

export interface InvItem {
  id: ItemId
  label: string
}

export const SLOT_COUNT = 4

interface InventoryState {
  slots: (InvItem | null)[]
  active: number
}

let state: InventoryState = {
  slots: [{ id: 'flashlight', label: 'TORCH' }, null, null, null],
  active: 0,
}

const subs = new Set<() => void>()
function emit(next: Partial<InventoryState>) {
  state = { ...state, ...next }
  subs.forEach((fn) => fn())
}

export const inventory = {
  get: () => state,
  subscribe: (fn: () => void) => {
    subs.add(fn)
    return () => subs.delete(fn)
  },
  setActive(i: number) {
    if (i >= 0 && i < SLOT_COUNT && i !== state.active) emit({ active: i })
  },
  /** the currently equipped item, if any */
  equipped(): InvItem | null {
    return state.slots[state.active]
  },
}

export function useInventory(): InventoryState {
  return useSyncExternalStore(inventory.subscribe, inventory.get)
}

/** mount once: digit keys switch slots while playing */
export function InventoryKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!player.locked) return
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[e.code]
      if (n !== undefined) inventory.setActive(n)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return null
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__inventory = inventory
}
