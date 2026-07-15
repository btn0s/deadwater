---
name: deadwater-game-ui-designer
description: Use when designing or changing DEADWATER's 4:3 game HUD, CLOCK IN menu, pointer-lock overlays, prompts, hotbar, non-playable mobile preview, or the Unity-style in-browser scene and prefab editor.
---

# DEADWATER game and editor UI

## Core contract

Design two related but distinct interfaces:

- The game UI is sparse, PS2-era, and composed around a fixed 4:3 play image.
- The editor UI is a modern desktop authoring workspace optimized for hierarchy, inspection, placement, and safe data editing.

Do not make the game look like a web dashboard. Do not make the editor deliberately clumsy or low resolution to match the game.

## Required references

Track loaded files in a reference ledger with `yes/no`, path, and any load failure.

- Load `references/ui-patterns.md` for every game or editor interface task.
- Load `references/checklists/game-ui-quality.md` for game HUD, overlay, prompt, menu, or mobile-preview work.
- Load `references/checklists/hud-readability.md` for reticle, prompt, hotbar, status, or equipment work.
- Load `references/checklists/editor-usability.md` for toolbar, hierarchy, viewport, details, palette, assets tab, shortcuts, or save-state work.
- Load `references/checklists/responsive-ui-fit.md` for viewport, narrow-window, scaling, overflow, or layout work.
- Load `references/checklists/mobile-input.md` when coarse pointers, the mobile preview, touch, or responsive mobile behavior is in scope.
- Load `references/prompt-templates.md` only for reusable prompt requests.

## Ownership map

| Interface | Owners |
| --- | --- |
| Game shell, CLOCK IN menu, HUD, overlays, mobile preview | `src/App.tsx`, `src/index.css` |
| Prompt and fade subscriptions | `src/game/interactions.ts` |
| Hotbar state | `src/game/inventory.ts` |
| Crosshair held and aimed states | `src/game/Carry.tsx`, DOM classes in `index.css` |
| Game Canvas composition | `src/App.tsx`, `src/ps2/PS2Pipeline.tsx` |
| Editor workspace | `src/editor/EditorApp.tsx`, `src/editor/editor.css` |
| Editor state and mutations | `src/engine/sceneStore.ts` |
| Inspector definitions | `src/engine/inspector.ts` |
| Placement, fly controls, thumbnails, prefab stage | `src/editor/ScenePlacer.tsx`, `EditorFlyControls.tsx`, `Thumbnails.tsx`, `AssetsView.tsx` |

## Game UI rules

- Keep DOM HUD and overlays outside the Canvas and positioned inside `.viewport` so they align with the fixed 4:3 image.
- Preserve the centered crosshair, nearby use prompt, bottom hotbar, full-frame fade, initial CLOCK IN menu, and pointer-lock resume overlay unless the task changes their function deliberately.
- Use monospace type, compact uppercase labels, limited desaturated green and neutral values, hard edges, slight text shadow, and stepped or brief motion. Keep it readable, not ornamental.
- Use fixed slot, counter, and prompt dimensions. Dynamic labels must not move the center of the HUD.
- Let world state do most of the communication. Use a prompt when the player can act, hotbar state when equipment changes, and a modal overlay when pointer lock is absent.
- Treat pointer lock as a UI state. Entry, Escape release, share-button clicks, focus, and re-entry must not fight each other.
- The current mobile product decision is a non-playable atmospheric 4:3 preview followed by a compact description/share card. Do not show CLOCK IN, add virtual sticks, or imply playability unless the task explicitly changes that scope.
- The final composition must be judged through the real 4:3 letterbox and fixed 512x448 pipeline, not only in a responsive DOM mockup.

## Editor UI rules

- Preserve the Unity-style layout: toolbar, hierarchy, central viewport, details inspector, bottom palette, and separate assets workspace.
- Favor modern editor usability: dense but readable spacing, clear selection, high-contrast focus, stable panel sizes, searchable lists, keyboard access, explicit save status, and visible destructive actions.
- Keep hierarchy and selection driven by `sceneStore`. UI must call store operations rather than mutate node arrays directly.
- Keep component fields generated from `COMPONENT_FIELDS` and `COMPONENT_DEFAULTS`; do not hand-build a second inspector for the same schema.
- Preserve shortcut arbitration. Fly mode owns WASD/QE only while right-mouse look is active; W/E select gizmos otherwise. Inputs and selects must not trigger global hotkeys.
- Make long ids, deep hierarchy, many components, large palettes, failed save messages, and empty selections usable without hiding core actions.
- Keep editor visuals and controls crisp. The editor Canvas may use device DPR and normal anti-aliasing; it does not need the game's final blit.
- Do not import editor chrome into the game entry.

## Workflow

1. Identify the surface as game UI, editor UI, or a shared visual token. Do not merge their interaction models.
2. Inspect the UI component, its state owner, CSS, relevant Canvas framing, and current empty, loading, error, disabled, active, and focus states.
3. Capture the current state at representative dimensions before changing layout.
4. State the information hierarchy and the one action or value each region must make fastest to find.
5. Implement through semantic React DOM and CSS. Keep simulation and scene mutation in their existing owners.
6. Test the longest labels, deepest hierarchy, high component counts, all hotbar slots, locked and stowed state, pointer-lock overlay, save success, and save failure as relevant.
7. Verify build, console, keyboard and pointer interactions, focus visibility, text fit, overlap, and screenshots.
8. For game HUD work, play through the affected state in the final 4:3 view. For editor work, complete a real select-edit-undo-save path.

## Common mistakes

- Styling both surfaces with the same chrome and density.
- Putting game HUD inside the WebGL scene when DOM already owns it.
- Resizing the R3F camera aspect to match the browser instead of preserving 4:3.
- Replacing the sparse game overlay with nested cards, gradients, or a marketing layout.
- Treating the editor like an era-authentic game menu and sacrificing legibility.
- Duplicating inventory or scene state inside local UI state.
- Letting global shortcuts fire while typing in an input.
- Showing a save action without pending, success, and failure status.
- Adding touch controls when the product still intentionally gates mobile play.

## Completion report

Lead with the user-visible result. Include the reference ledger, whether the game or editor surface changed, state ownership, states covered, keyboard and pointer behavior, text-fit and overflow evidence, 4:3 or editor screenshots, save or interaction checks, and remaining risks.
