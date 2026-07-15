# DEADWATER game UI quality checklist

- The UI sits inside the fixed 4:3 viewport and remains aligned with the final play image.
- The crosshair stays at the same center used by the interaction ray.
- Pointer-locked play shows only the information needed for aim, use, equipment, carry, and transitions.
- The initial CLOCK IN menu and later pointer-lock resume overlay are distinct, focused, and free of accidental immediate re-lock.
- The hotbar has stable four-slot geometry and distinct active, stowed, empty, and carry-locked states.
- Prompt, item, and control labels fit without shifting the center composition.
- World state carries most feedback; the UI does not become a dashboard or stack of cards.
- Monospace type, limited color, hard edges, and brief motion support PS2-era style without harming legibility.
- DOM elements that should not intercept play use `pointer-events: none`; real buttons opt in.
- Fade, overlay, prompt, crosshair, and hotbar z-order is intentional.
- Focus-visible, hover, pressed, disabled, copied, and error states exist where the control needs them.
- The real 512x448-to-4:3 output has been reviewed during active play.
- The mobile preview omits CLOCK IN, tells the truth about mouse and keyboard requirements, and keeps its description/share card usable in narrow portrait view.
- Game UI does not import editor chrome or editor state.
- Build, console, pointer-lock, interaction, equipment, carry, and overlay checks pass.
