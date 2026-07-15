/**
 * Named light groups with an on/off state — what wall switches toggle.
 * Lights opt in via their component's `group`; LightEffect folds the group
 * state into its level every frame (bulb glass follows automatically).
 */

const off = new Set<string>()

export function isGroupOn(group: string | undefined): boolean {
  return group === undefined || !off.has(group)
}

export function toggleGroup(group: string) {
  if (off.has(group)) off.delete(group)
  else off.add(group)
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__toggleLights = toggleGroup
}
