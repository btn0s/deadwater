import { useSyncExternalStore } from 'react'
import { useEffect } from 'react'
import { player } from './playerState'
import { play } from './audio'
import { handlingCueFor, type AcousticMaterial } from './acoustics'

/**
 * Player inventory: four ordinary tool slots. Digits 1-4 select and draw a
 * slot; H holsters or redraws the selected tool. A carried world prop hides
 * equipment without changing the slot or holster state that will return.
 */

export type ItemId = 'flashlight' | 'crowbar'

export interface InvItem {
  id: ItemId
  label: string
  material: AcousticMaterial
}

export const ITEM_DEFS: Record<ItemId, InvItem> = {
  flashlight: { id: 'flashlight', label: 'TORCH', material: 'plastic' },
  crowbar: { id: 'crowbar', label: 'CROWBAR', material: 'metal' },
}

export const SLOT_COUNT = 4

export interface InventoryState {
  slots: (InvItem | null)[]
  active: number
  /** selected tool is hidden while the slot remains active */
  stowed: boolean
  /** a carried world prop owns the hands, so equipment input is disabled */
  carryLock: boolean
}

let state: InventoryState = {
  slots: [null, null, null, null],
  active: 0,
  stowed: false,
  carryLock: false,
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
  /** Digit selection always draws the chosen slot, including an empty slot. */
  setActive(i: number): boolean {
    if (state.carryLock || i < 0 || i >= SLOT_COUNT) return false
    if (i === state.active && !state.stowed) return true

    const item = state.slots[i]
    if (item) play(handlingCueFor(item.material), 0.7)
    emit({ active: i, stowed: false })
    return true
  },
  /** H holsters or redraws the selected tool. */
  toggleStowed(): boolean {
    if (state.carryLock) return false
    const item = state.slots[state.active]
    if (!item) return false
    play(handlingCueFor(item.material), 0.8)
    emit({ stowed: !state.stowed })
    return true
  },
  /** Carry suppresses equipment while preserving active slot and stow state. */
  beginCarry(): boolean {
    if (state.carryLock) return false
    emit({ carryLock: true })
    return true
  },
  /** Releasing restores the exact drawn/holstered state hidden by carry. */
  endCarry() {
    if (!state.carryLock) return
    emit({ carryLock: false })
  },
  /** World pickups fill the first empty slot and draw it immediately. */
  add(item: InvItem): boolean {
    if (state.carryLock) return false
    const i = state.slots.findIndex((slot) => slot === null)
    if (i === -1) return false
    const slots = [...state.slots]
    slots[i] = item
    emit({ slots, active: i, stowed: false })
    return true
  },
  /** The selected tool only when it is both drawn and available. */
  equipped(): InvItem | null {
    return state.stowed || state.carryLock ? null : state.slots[state.active]
  },
  /** Hide equipment safely for the title without clearing inventory choice. */
  resetForMenu() {
    emit({ stowed: true, carryLock: false })
  },
}

export function useInventory(): InventoryState {
  return useSyncExternalStore(inventory.subscribe, inventory.get)
}

/** Mount once: digits select/draw slots and H toggles the selected tool. */
export function InventoryKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!player.locked) return
      if (e.code === 'KeyH') {
        if (!e.repeat) inventory.toggleStowed()
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
