# DEADWATER UI prompt templates

Use one template and replace every placeholder. Keep game HUD and editor workflows separate unless the task explicitly spans both.

## 4:3 game HUD pass

```text
Use $deadwater-game-ui-designer to improve DEADWATER's game HUD or pointer-lock overlay.

Changed states:
State owners:
Information priority:
Input and pointer-lock behavior:
Longest prompt or item labels:
Smallest supported desktop viewport:
Mobile-gate impact:

Keep the HUD as DOM inside the fixed 4:3 viewport. Preserve the center reticle and interaction ray contract, stable hotbar geometry, sparse PS2-era visual language, and the fixed 512x448 render pipeline. Verify active play, pointer-lock entry and release, state transitions, text fit, overlap, focus, build, and console.
```

## Editor usability pass

```text
Use $deadwater-game-ui-designer to improve DEADWATER's browser editor.

Affected workspace region:
User task to make faster or safer:
Scene-store operations involved:
Keyboard, pointer, drag, and focus behavior:
Dense-state test data:
Save, empty, loading, disabled, or error states:

Keep the Unity-style toolbar, hierarchy, central viewport, details inspector, bottom palette, and assets workspace. Use modern editor legibility and shared inspector schemas. Verify a real select-edit-undo-save path and confirm gameplay effects stay disabled in editor mode.
```

## Game overlay or menu state

```text
Use $deadwater-game-ui-designer to add or revise this DEADWATER overlay.

Trigger and exit:
Pointer-lock behavior:
Primary and secondary actions:
Game state shown beneath it:
Keyboard and pointer focus order:
Reduced-motion needs:

Keep the overlay inside the 4:3 viewport and visually consistent with the sparse game UI. Do not build a landing page or generic card stack. Verify open, close, Escape, click, keyboard focus, re-entry to play, and the smallest supported viewport.
```

## Mobile-preview pass

```text
Use $deadwater-game-ui-designer to improve DEADWATER's non-playable mobile preview without implying touch gameplay.

Target devices and orientations:
Copy changes:
Share behavior:
Atmospheric scene behavior:
Reduced-motion behavior:

Keep the preview honest that mouse and keyboard are required. Preserve the atmospheric 4:3 Canvas, omit CLOCK IN, and verify coarse-pointer detection, missing pointer-lock support, ?mobile preview, native share or copy fallback, portrait and landscape fit, and console errors.
```
