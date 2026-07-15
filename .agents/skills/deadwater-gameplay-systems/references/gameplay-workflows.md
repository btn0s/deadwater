# DEADWATER gameplay workflows

Use this reference for every gameplay implementation task. DEADWATER is an existing React 19, React Three Fiber 9, Drei, and `@react-three/rapier` application. Follow its ownership boundaries instead of installing a starter or inventing a separate runtime.

## Read the owning path first

| Change | Read before editing |
| --- | --- |
| World-authored mechanic | `src/engine/types.ts`, `render.tsx`, `inspector.ts`, related `scene.json` nodes |
| Player movement or camera | `PlayerController.tsx`, `collision.ts`, `playerState.ts`, `PS2Pipeline.tsx` |
| Rapier debris or collider | `render.tsx`, `PlayerBody.tsx`, `Carry.tsx`, `grabbables.ts` |
| Door, switch, pickup, prompt | `interactions.ts`, the matching component renderer, `App.tsx` HUD |
| Inventory or equipment | `inventory.ts`, `Flashlight.tsx`, `Crowbar.tsx`, `Carry.tsx`, `App.tsx` |
| Runtime sound | `audio.ts` and the system that owns the state transition |
| Procedural prop or actor | `rand.ts`, generator or actor component, inspector seed field, scene seed |
| Editor-authored content | `sceneStore.ts`, `EditorApp.tsx`, `ScenePlacer.tsx`, `inspector.ts` |
| Agent verification | `DevViews.tsx`, `vite.config.ts`, existing `window.__*` hooks |

## Runtime shape

`App.tsx` owns the game Canvas. Its mounted systems cooperate through React, R3F hooks, focused external stores, refs, and registration sets:

```text
scene.json -> scene.ts -> SceneRoot(game) -> NodeView -> component renderers
                                           -> Rapier bodies and game-only effects

keyboard/pointer -> PlayerController -> player state -> collision and camera
reticle ray       -> InteractionSystem -> interactable or grabbable action
pickup/action     -> inventory/carry/light group/player teleport -> HUD and audio

useFrame updates at priority 0 -> PS2Pipeline render passes at priority 1
```

Do not add a `requestAnimationFrame` loop, imperative `Game` singleton, duplicate Three scene, duplicate player state, or second render pipeline.

## Add a scene component

Use a component when designers or agents must author repeated world behavior in `scene.json`.

1. Add a narrow interface to the `Component` discriminated union in `src/engine/types.ts`.
2. Add fields to `COMPONENT_FIELDS` and a valid value to `COMPONENT_DEFAULTS` in `src/engine/inspector.ts`.
3. Read it with `componentOf` inside `NodeView`.
4. Render visuals in both modes when they are safe and useful.
5. Mount physics, interaction registration, inventory mutations, actor updates, and other side effects only in `game` mode.
6. Keep cleanup in `useEffect` return functions. Registries must not retain an unmounted node.
7. Add a representative node to `scene.json` and verify the inspector can edit every field.
8. Verify game behavior and editor behavior separately.

Prefer one component for one authoring concept. Do not encode a one-off room name inside a general renderer.

## Add a world interaction

The reticle uses a center-screen ray against the `level` group. The first solid hit decides the result, so geometry blocks use through walls.

1. Attach behavior to a node-owned group through `NodeGroupContext` or an existing renderer effect.
2. Register with `registerInteractable` and return its unregister function from `useEffect`.
3. Choose a short uppercase prompt and a truthful reach distance.
4. Use `fadeThrough` only for area transitions. Immediate toggles and pickups should set `fade: false`.
5. Keep locked or inert interactions visible by omitting the action while retaining the prompt.
6. Fire audio and state changes inside the action, not in a polling frame callback.
7. Test while aimed, while occluded, just outside reach, with pointer lock released, and after remount.

If the target is a dynamic prop, use the existing grabbable path rather than adding a second pickup ray.

## Add inventory or equipment

`inventory.ts` is the single source for four slots, active slot, stowed state, and two-handed carry lock.

- Add item ids and labels to `ItemId` and `ITEM_DEFS`.
- Let the scene pickup component call `inventory.add` through its existing renderer effect.
- Mount equipment visuals as Canvas children that read `useInventory`.
- Keep digit switching and `F` stow in `InventoryKeys` unless the input design changes as one coordinated pass.
- Respect `carryLock`; equipment must not draw or switch while a large object fills both hands.
- Use stable HUD containers so labels do not shift the 4:3 composition.

Test full inventory, selection, stow, pickup while carrying, large-object lock, drop, and unlock.

## Add carryable physics

`GrabbableBody` owns the Rapier body and registers its visual root, body handle, radius, and size. `CarrySystem` temporarily changes that body to `KinematicPositionBased`.

- Use dynamic hulls for ordinary loose props. Use simple explicit colliders when the hull is unstable or expensive.
- Keep density, damping, and CCD intentional. Cargo should settle, and ordinary throws should not tunnel.
- Small hand-carried objects use the left-hand anchor so equipment can remain visible.
- Objects over `BIG_SIZE` use the centered two-handed anchor and lock inventory.
- Right mouse hold uses floating carry; left click releases or tosses with capped velocity.
- Restore dynamic body type and inventory state on every release path and unmount path.
- Clamp held targets through `worldBounds.ts`; do not let kinematic objects cross walls or leave the playable vertical range.

## Change player movement or camera

The player path is deliberately hybrid:

- `PlayerController` owns keyboard intent, pointer-lock look, acceleration, jump, head bob, XZ position, AABB sliding collision, and the fixed camera projection.
- `PlayerBody` follows that position with a kinematic Rapier capsule so the player pushes debris.
- `playerState.ts` is the small shared bridge used by interaction, audio, zone, and equipment systems.

Preserve this split. A movement change should update `player` every frame before dependent systems read it. Clamp `rawDt` as the existing code does. Clear pressed keys when pointer lock is lost. Test pointer-lock entry, Escape release, re-entry, blur, spawn, teleport, collision sliding, step height, jump, and debris contact.

Do not make the R3F default camera responsive to the browser aspect. The final image is fixed to 4:3 inside a letterboxed DOM viewport.

## Add deterministic procedural content or actors

Use `mulberry32(seed)` from `src/game/rand.ts` inside `useMemo` or stable actor state. Store the seed on a generator or behavior component in `scene.json` and expose it through the inspector.

- Same seed and parameters must create the same geometry, placement, or initial behavior.
- Do not consume the random stream during render in a way that depends on React remount count.
- Keep random results in memoized geometry or refs.
- Runtime-only ambience variation may remain non-deterministic if it does not change authored layout, collision, objective state, or a comparison artifact.
- If a changing light or actor makes a visual baseline noisy, add a narrow development control rather than replacing the whole random model.

## Add audio hooks

`audio.ts` lazily creates and resumes its `AudioContext` on user gesture. `play(name, volume, rate)` is the common one-shot hook; `AudioSystem` owns footsteps, landing, ambience, and occasional actor sounds.

- Register sample URLs in the existing sound map.
- Trigger one-shots on the owning state transition, never on every frame that a condition is true.
- Keep pitch and volume variation restrained.
- Avoid a second AudioContext or a component-local master gain graph.
- Make failed fetch/decode paths observable when adding new assets.
- Test first click unlock, pointer-lock entry, repeated actions, tab visibility, and remount cleanup.

## Keep editor and game behavior separate

`SceneRoot` receives `mode="game"` from `App.tsx` and `mode="editor"` from `EditorApp.tsx`. Editor physics is mounted paused. The editor should show the same authored visuals and light configuration without running gameplay.

For every new component, answer both questions:

1. What should a designer see and edit in `/editor.html`?
2. What behavior must only exist in the game?

Do not import `sceneStore` into gameplay merely to read the authored scene. The game reads `sceneNodes` from `scene.ts`.

## Verification loop

1. Run `npm run build`.
2. Start the game and inspect console and failed network requests.
3. Enter pointer lock through a real click and exercise the changed input path.
4. Use `window.__playerPos()` and `window.__teleport(...)` for repeatable positions when useful.
5. Use `window.__testCollision(...)`, `window.__colliders()`, `window.__inventory`, or other existing hooks when they cover the change.
6. Run `await window.__sheet()` or a named set such as `await window.__sheet('office')` for world-facing work.
7. Open `/editor.html` for schema or world changes. Edit the field, undo and redo, save, then reload the game.
8. Confirm the game bundle has no editor behavior and the editor does not run gameplay effects.

## Failure patterns

- A JSX-only prop appears in game but cannot be authored or inspected.
- A component exists in types but has no default or inspector field.
- A hook runs outside Canvas or a positive-priority `useFrame` steals render ownership.
- Interaction state lives in both the world renderer and HUD.
- Rapier and the custom player blocker both try to resolve navigation.
- A body stays kinematic or the hotbar stays locked after an interrupted carry.
- Audio creates before a user gesture or fires once per frame.
- `Math.random()` changes authored geometry between contact sheets.
- Editor mode collects, teleports, animates AI, or mutates inventory.
