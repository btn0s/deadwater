---
name: deadwater-gameplay-systems
description: Use when building or changing DEADWATER gameplay, scene components, first-person controls, interactions, inventory, carrying, Rapier bodies, deterministic actors, audio hooks, level flow, or the game/editor runtime boundary.
---

# DEADWATER gameplay systems

## Core contract

Extend the existing React 19 and `@react-three/fiber` game. Keep `src/engine/scene.json` as the authored-world source of truth, keep gameplay inside the game entry, and use the existing component renderers and stores. Do not introduce a standalone Three.js loop, a second renderer, a second scene graph, or a new starter project.

## Required references

Load only the references needed by the request, then report a ledger with `yes/no`, path, and any load failure.

- Load `references/gameplay-workflows.md` for every implementation task.
- Load `references/game-design-level-design.md` for new mechanics, level flow, encounter pacing, objectives, progression, or broad game changes.
- Load `references/physics-engine-selection.md` for Rapier bodies, colliders, custom player blocking, carrying, high-speed motion, or collision bugs.
- Load `references/game-feel.md` for controls, camera, prompts, feedback, audio timing, interaction weight, or polish.
- Load `references/checklists/new-game-definition-of-done.md` before calling a first playable or major slice complete.
- Load `references/checklists/game-design-level-design.md` before calling a mechanic or level-flow pass complete.
- Load `references/checklists/game-feel.md` before calling feel or feedback work complete.
- Load `references/checklists/first-person-exploration-quality.md` before calling first-person exploration, interaction, inventory, or carry work complete.
- Load `references/prompt-templates.md` only for reusable prompt requests.

## Architecture map

| Concern | Owner |
| --- | --- |
| React and R3F composition | `src/App.tsx`, `src/main.tsx` |
| Authored scene schema | `src/engine/types.ts` |
| Authored world data | `src/engine/scene.json` through `src/engine/scene.ts` |
| Scene indexing and component renderers | `src/engine/render.tsx`, `indexScene`, `NodeView`, `SceneRoot` |
| Editor state and authoring operations | `src/engine/sceneStore.ts` |
| Inspector field definitions and defaults | `src/engine/inspector.ts` |
| First-person camera and movement | `src/game/PlayerController.tsx`, `src/game/playerState.ts` |
| Player blocking and debris contact | `src/game/collision.ts`, `src/game/PlayerBody.tsx`, `@react-three/rapier` |
| Boot-only rigid-body settling | `SettleSim` in `src/App.tsx` |
| Reticle use, prompts, and transitions | `src/game/interactions.ts` |
| Inventory and equipment | `src/game/inventory.ts`, `Flashlight.tsx`, `Crowbar.tsx` |
| Hands and floating carry | `src/game/Carry.tsx`, `src/game/grabbables.ts` |
| Runtime audio | `src/game/audio.ts` |
| Fixed PS2-era output | `src/ps2/PS2Pipeline.tsx`, `src/ps2/PS2Material.ts` |
| Agent-visible verification | `src/game/DevViews.tsx` and development `window.__*` hooks |

## Non-negotiable boundaries

- Mount gameplay systems as React components below the existing `<Canvas>`. R3F hooks such as `useFrame` and `useThree` must stay inside Canvas ownership.
- Let R3F own frame scheduling. `PS2Pipeline` already takes render ownership with positive `useFrame` priority and performs the render-target passes.
- Preserve the camera contract in `PlayerController`: 60 degree vertical FOV, 4:3 aspect, `manual = true`, near `0.1`, far `120`.
- Represent authored world additions as flat `SceneNode[]` entries with unique ids, parent references, transforms, and typed components. Do not hide level geometry in a parallel JSX-only map.
- When adding a component type, update the discriminated union, renderer, inspector fields, inspector default, game/editor mode behavior, and representative `scene.json` data together.
- Keep `sceneStore` for editor CRUD, selection, history, prefab operations, placement, and save. Runtime state belongs in focused game stores or mounted systems.
- Keep gameplay side effects behind `EngineMode === 'game'`. Editor mode renders visuals and lights with physics paused and must not collect pickups, move actors, trigger doors, or mutate inventory.
- Keep Rapier under the existing `<Physics>` tree. Reuse `RigidBody` and collider components from `@react-three/rapier`; do not create a separate imperative physics world.
- Preserve `SettleSim` as a bounded boot-only exception: it temporarily pins Rapier to 1/60 and advances 90 steps when the body count changes during the first five seconds. Do not call `world.step()` from ordinary gameplay systems or include the boot burst in steady-state profiles.
- Keep player navigation's custom XZ AABB collision and the kinematic Rapier capsule in their existing roles. The AABB path controls movement; the capsule pushes debris.
- Route interaction through the center reticle and first solid hit. Preserve occlusion, reach limits, pointer-lock gating, and cleanup returned by registration functions.
- Route equipment through `inventory`, grabbables through `registerGrabbable`, and carried state through `carry`. Preserve carry lock for two-handed objects.
- Call `play()` on the state transition that owns the sound. Keep `AudioContext` creation and resume tied to a user gesture.
- Use `mulberry32(seed)` for authored procedural geometry and seeded actor behavior. Store stable seeds in `scene.json`. Preserve the development contact-sheet and teleport hooks.
- Keep the editor as the separate `editor.html` Vite entry. Game code must not import the editor app or ship editor chrome.

## Workflow

1. Inspect the relevant schema, renderer, game system, editor field definitions, scene nodes, and current dev hooks.
2. State the player-facing behavior and identify the owning module before editing.
3. For broad changes, write the compact player promise, core loop, level-flow beats, failure or setback, and non-goals.
4. Add or change the smallest coherent vertical path: data, runtime behavior, visual response, HUD prompt or inventory state, audio event, editor authoring support, and diagnostic hook.
5. Clamp variable render delta where the current systems do. Keep per-frame state in refs or stable objects and avoid React state writes on every frame.
6. Test cleanup for event listeners, registrations, Rapier bodies, material resources, and external-store subscriptions.
7. Run `npm run build`, then verify the real game URL with the affected input path. Inspect console errors and capture a relevant contact sheet when the change affects the world.
8. Open `/editor.html` when schema, components, models, prefabs, or scene data changed. Confirm selection, inspector editing, undo/redo, save, and game/editor behavior separation.

## Common mistakes

- Adding a standalone `Game` class, manual animation loop, or second app beside the R3F runtime.
- Editing `scene.json` without keeping `types.ts`, `render.tsx`, and `inspector.ts` aligned.
- Mounting gameplay effects in editor mode.
- Calling `gl.render` from an ordinary gameplay `useFrame` callback and bypassing `PS2Pipeline`.
- Changing camera aspect or renderer DPR to fix CSS layout, which breaks the fixed output contract.
- Using detailed visual meshes as dynamic colliders or making the player capsule the navigation controller.
- Raycasting through occluders, registering without cleanup, or handling the same key in competing listeners.
- Mutating inventory directly from UI or duplicating carry/equipment state.
- Using unseeded randomness for authored geometry that appears in contact-sheet comparisons.

## Completion report

Lead with the player-visible outcome. Include the reference ledger, changed ownership paths, schema or scene-data changes, controls and state transitions, physics/collider notes, deterministic seeds or hooks, editor impact, build and active-play evidence, contact-sheet artifacts, and unresolved edge cases.
