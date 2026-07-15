interface InteractionActions {
  commit: () => void
  cancel: () => void
}

let activeActions: InteractionActions | null = null

/** Lets toolbar actions honor the same active move transaction as shortcuts. */
export const buildInteractionActions = {
  commit: () => activeActions?.commit(),
  cancel: () => activeActions?.cancel(),
}

export function setBuildInteractionActions(actions: InteractionActions | null) {
  activeActions = actions
}
