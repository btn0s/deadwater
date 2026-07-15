# DEADWATER QA and release checklists

Use this reference before calling DEADWATER fixed, visually verified, or release-ready.

## Evidence tiers

Use the smallest tier that proves the claim.

| Tier | Required evidence |
| --- | --- |
| Smoke | build or dev load, console/page/network capture, visible canvas, nonblank pixels |
| Change QA | smoke plus the changed player/editor path, targeted hook outputs, screenshots |
| Visual regression | change QA plus stable Playwright baselines and comparison artifacts |
| Release | production build and preview, game and editor policy, assets/licenses, main interaction, residual risks |

Passing one tier does not imply the next.

## Browser matrix

### Game development build

- Open `http://127.0.0.1:5173/`.
- Confirm `.frame`, `.viewport`, and one visible canvas.
- Confirm the viewport aspect is 4:3 within a small rounding tolerance.
- Record canvas CSS size and drawing-buffer size. The drawing buffer follows the displayed canvas at DPR 1; the renderer's internal 512x448 target is offscreen.
- Confirm `__sheet`, `__teleport`, `__playerPos`, `__devLock`, `__testCollision`, and `__lightSlots` exist.
- Capture console errors, page errors, request failures, and HTTP failures.
- Capture a screenshot and objective nonblank pixel data.

### Editor development build

- Open `http://127.0.0.1:5173/editor.html`.
- Confirm hierarchy, viewport, inspector, toolbar, and palette render.
- Confirm `__sceneStore` and `__lightSlots` exist.
- Select a node, switch camera or gizmo mode, and verify the UI state changes.
- When save is in scope, make a reversible edit, save, validate the JSON response, and restore the original scene data before finishing.
- Test asset thumbnails and the asset stage when model integration changed.

### Production preview

- Run `npm run build` before preview.
- Open built `/` and `/editor.html` according to the release policy.
- Repeat nonblank canvas, console, page, network, and main-interaction checks.
- Expect development hooks to be absent. Their absence is a pass, not missing coverage.
- Verify models, textures, sounds, and entry chunks resolve with the deployment base path.

## Scene-data checks

Validate `src/engine/scene.json` as part of scene, asset, light, collision, or editor work:

- JSON parses and contains a `nodes` array.
- Node IDs are unique.
- Every non-null parent ID exists.
- Library definitions stay out of root rendering.
- Model components use `gltf` or `fbx` and reference existing public files.
- FBX components include a base-color texture where required.
- Surface texture names exist in `TEXTURE_URLS`.
- Physics values match the component schema.
- One environment component supplies ambient and fog values.
- Authored lights plus temporary runtime lights fit the current `MAX_LIGHTS` allocation.

Do not hard-code a remembered light limit in QA. Read `MAX_LIGHTS` from `src/ps2/PS2Material.ts`; the README may lag code.

## Gameplay checks

Use `__devLock(true)` for headless automation. Pointer lock is still the manual path.

1. Read `__playerPos()`.
2. Hold a movement key and read it again.
3. Assert finite coordinates and meaningful displacement.
4. Teleport to the changed zone when traversal time adds no test value.
5. Exercise the real interaction input after teleporting.
6. Release keys and call `__devLock(false)` during cleanup.

For doors and area transitions, record position before interaction and the expected target position. For carry/throw, verify both the visual and Rapier state. For inventory, verify active slot, stow state, and the equipped viewmodel.

## Collision checks

`__testCollision(x, z, dx, dz, radius)` returns the adjusted position and collider count without moving the player. Use it for deterministic geometry checks:

- approach changed geometry from both sides;
- move parallel to confirm sliding;
- use a player-like radius, currently 0.35 unless the source changes;
- assert finite output and expected blocking or passage;
- compare collider count before and after scene reload when collider lifecycle changed.

Follow with an in-game movement check. The hook tests the custom player AABB path, not Rapier dynamics.

## Lighting checks

`__lightSlots()` returns every shared shader slot. Record:

- total slots and used slots;
- finite positions, colors, radii, and spot values for used slots;
- authored-light count after scene load;
- circuit toggle changes;
- flicker behavior without treating its exact cadence as deterministic;
- flashlight slot acquisition and release;
- no `out of light slots` warning.

The renderer uses custom shader uniforms. Looking for Three.js `PointLight` objects is the wrong diagnostic.

## Visual checks

DEADWATER deliberately uses a dark gamma-space, diffuse-only PS2-style renderer. Reject only observable defects:

- blank or near-uniform canvas;
- wrong 4:3 framing or stretched HUD;
- missing model or texture;
- broken scale, pivot, culling, or collision alignment;
- light-slot exhaustion, NaNs, or visibly unlit required paths;
- clipped text or overlay obstruction;
- obvious shader failure, depth artifact, missing fog, water break, or flashlight shadow regression;
- scene seams, z-fighting, or transparent sorting failures introduced by the change.

Color entropy, edge density, mean luminance, contrast, and dominant-color share are descriptive. A dark foggy room may have low values and still be correct. Do not use generic saturation, complexity, or fidelity thresholds.

### Contact sheets

Call:

```js
await window.__sheet();
await window.__sheet('office');
await window.__sheet('dock');
await window.__sheet('sewer');
```

The files are `contact-sheet.png` and `contact-sheet-<area>.png` in the repo root. Contact sheets intentionally lift ambient and move fog far away. Use them for layout, coverage, missing assets, and broad composition. Use player screenshots for final lighting and fog.

## Objective render data

Record a short, stable sample rather than enforcing imported budgets:

- animation frames observed;
- draw calls per frame;
- estimated submitted triangles per frame;
- WebGL buffer and texture creations during the sample;
- canvas CSS and drawing-buffer dimensions;
- resource counts and transferred bytes grouped by model, texture, audio, script, and style;
- pixel nonblank result and raw distribution values.

Compare against a prior report or baseline when performance is the claim. Without a baseline, report the numbers and the unmeasured risk. Headless Chromium is functional evidence only; do not report its frame timing as real-GPU performance.

## Audio checks

When audio changes:

- trigger the first pointer gesture and confirm `AudioContext` resumes;
- listen for the changed event and at least one variant path;
- verify missing or late sample loads do not throw;
- cross zone boundaries and confirm ambience changes without duplicate loops;
- blur, refocus, reload, and remount affected systems;
- inspect console/network for decode and 404 errors;
- check volume and pitch variance by ear and code where automated audio capture is impractical.

## Release checks

- `npm run build` passes.
- Intended entry points exist in `dist`.
- Preview URLs load with no runtime or asset errors.
- Debug-only hooks and views are gated by `import.meta.env.DEV`.
- Bundle and public asset growth is explained.
- `public/models/CREDITS.md` covers CC BY sources.
- No NC/ND, unapproved paid, or unattributed assets ship.
- No credentials or temporary provider URLs appear in source or output.
- Deployment base path and static-host assumptions are recorded.

## Evidence format

```text
QA result: pass | fail | partial
Scope and diff:
Commands and URLs:
Game result:
Editor result:
Production preview result:
Controls and interactions:
Player/collision/light hook output:
Canvas and render sample:
Contact sheets/screenshots/baselines:
Console/page/network errors:
Scene and asset checks:
Audio checks:
Visual harness decision:
Bot playtest decision:
Issues found or fixed:
Untested scope and residual risks:
```

## Common failures

- Testing only the dev server, then calling the production build ready.
- Treating a visible title overlay as proof the 3D scene rendered.
- Using contact-sheet lighting as proof of shipping lighting.
- Assuming the editor matches the fixed 512x448 game pipeline.
- Expecting dev hooks in production.
- Judging the PS2 image with generic brightness or PBR metrics.
- Updating `scene.json` without validating parents, assets, collision, and lights.
- Proving movement but not releasing held keys or dev lock during test cleanup.
- Running parallel headless WebGL workers and trusting their timing.
