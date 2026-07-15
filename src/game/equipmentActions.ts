import type { ItemId } from './inventory'

/**
 * One central click dispatcher owns pointer input. Equipped viewmodels
 * register their primary action here instead of competing for DOM events.
 */
const primaryActions = new Map<ItemId, () => void>()
const executionCounts = new Map<ItemId, number>()

export function registerPrimaryAction(item: ItemId, action: () => void): () => void {
  primaryActions.set(item, action)
  return () => {
    if (primaryActions.get(item) === action) primaryActions.delete(item)
  }
}

export function runPrimaryAction(item: ItemId | undefined): boolean {
  if (!item) return false
  const action = primaryActions.get(item)
  if (!action) return false
  action()
  executionCounts.set(item, (executionCounts.get(item) ?? 0) + 1)
  return true
}

export function equipmentActionSnapshot(): Partial<Record<ItemId, number>> {
  return Object.fromEntries(executionCounts)
}
