import { useSyncExternalStore } from 'react'
import { useEffect } from 'react'
import { player } from './playerState'

/**
 * Player inventory: a 4-slot hotbar, Minecraft-style. Digit keys 1-4 pick
 * the active slot (drawing whatever is in it); F stows the item in hand.
 * Starts empty — items come from world pickups.
 */

export type ItemId = 'flashlight' | 'crowbar'

export interface InvItem {
  id: ItemId
  label: string
}

export const ITEM_DEFS: Record<ItemId, InvItem> = {
  flashlight: { id: 'flashlight', label: 'TORCH' },
  crowbar: { id: 'crowbar', label: 'CROWBAR' },
}

export const SLOT_COUNT = 4

interface InventoryState {
  slots: (InvItem | null)[]
  active: number
  /** active item put away with F — slot stays selected, hands are empty */
  stowed: boolean
}

let state: InventoryState = {
  slots: [null, null, null, null],
  active: 0,
  stowed: false,
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
  /** selecting a slot always draws it */
  setActive(i: number) {
    if (i < 0 || i >= SLOT_COUNT) return
    if (i !== state.active || state.stowed) emit({ active: i, stowed: false })
  },
  /** F: put the item in hand away / take it back out */
  toggleStowed() {
    if (state.slots[state.active]) emit({ stowed: !state.stowed })
  },
  /** world pickups land in the first empty slot and are drawn immediately */
  add(item: InvItem): boolean {
    const i = state.slots.findIndex((s) => s === null)
    if (i === -1) return false
    const slots = [...state.slots]
    slots[i] = item
    emit({ slots, active: i, stowed: false })
    return true
  },
  /** the item currently in hand (null while stowed) */
  equipped(): InvItem | null {
    return state.stowed ? null : state.slots[state.active]
  },
}

export function useInventory(): InventoryState {
  return useSyncExternalStore(inventory.subscribe, inventory.get)
}

/** mount once: digit keys switch slots, F stows, while playing */
export function InventoryKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!player.locked) return
      if (e.code === 'KeyF') {
        inventory.toggleStowed()
        return
      }
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
