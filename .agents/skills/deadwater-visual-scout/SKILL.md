---
name: deadwater-visual-scout
description: "Create and verify repeatable fixed-camera visual coverage for DEADWATER. Use when an agent needs named contact-sheet shots, visual reconnaissance of a scene area, before-and-after composition references, coverage of models or level layout, or changes to src/game/DevViews.tsx. This is visual scouting, not gameplay, input, interaction, or game-feel testing."
---

# DEADWATER visual scout

## Purpose

Turn a visual question into a small, named set of fixed cameras and a reviewable contact sheet. Use the existing development renderer in `src/game/DevViews.tsx`; do not add pathfinding, scripted player movement, a second camera controller, or another frame loop for this workflow.

Always read `references/shot-design.md` before choosing or changing shots.

## Evidence contract

Use fixed-camera sheets to answer questions about:

- scene layout and landmarks;
- missing, misplaced, clipped, or poorly scaled assets;
- composition, sightlines, broad occlusion, and coverage;
- before-and-after visual comparisons from repeatable coordinates.

Do not use a contact sheet as evidence that movement, collision, input, interaction, game feel, lighting transitions, or level flow works. Route those claims to `deadwater-qa-release/SKILL.md` and, for implementation, `deadwater-gameplay-systems/SKILL.md`.

The sheet renderer deliberately raises ambient light, pushes fog away, and renders the scene directly. It bypasses the final PS2 presentation and does not prove shipping darkness, fog, dithering, CRT treatment, flashlight behavior, or HUD composition. Capture the live `.viewport` at a controlled player pose when those properties matter.

## Repository ownership

- `src/game/DevViews.tsx` owns the named camera sets and sheet renderer.
- `vite.config.ts` owns the development-only `/__sheet` PNG writer.
- `contact-sheet.png` and `contact-sheet-<name>.png` are generated review artifacts in the repository root.
- `window.__sheet()` writes every set; `window.__sheet('office')` writes one named set.

Keep the current scene and renderer authoritative. A visual-scout request normally changes only `src/game/DevViews.tsx`, unless the user also requested a scene or rendering change.

## Workflow

### 1. Define the review question

Inspect the current scene nodes, relevant coordinates, existing view sets, and any prior sheet. State what the reviewer must be able to judge. Choose the smallest set of shots that answers that question.

Before editing, write a compact shot list with a label, projection, camera position, target, and acceptance condition for each shot.

### 2. Author a named set

Add or revise one key in `makeViewSets()` in `src/game/DevViews.tsx`. Use explicit stable world coordinates with `look(persp(fov), position, target)` or `look(ortho(halfWidth), position, target)`.

Follow these constraints:

- Use a lowercase or hyphenated set name no longer than 24 characters; the writer enforces `^[a-z0-9-]{0,24}$`.
- Give every shot a short, unique label that describes its review purpose.
- Use perspective for player-height, approach, subject, and detail views. A field of view from 55 to 70 degrees is the normal starting range.
- Use orthographic views only when a plan or spatial relationship answers the question better than perspective.
- Prefer static geometry and stable coordinates. If a dynamic subject matters, name the timing or nondeterminism in the report.
- Include orientation, approach, subject-in-context, and occlusion/detail coverage only when each adds evidence. Do not pad a set to a fixed shot count.

Do not move the player or mutate gameplay state merely to produce a sheet.

### 3. Generate and inspect the artifact

Run the development server, open the game route, wait for the scene to load, and evaluate:

```js
await window.__sheet('set-name')
```

Require the returned `contact-sheet-set-name.png written` result. Open the generated PNG and inspect every tile; successful file creation alone is not visual verification.

The writer overwrites an existing sheet with the same name. For before-and-after work, preserve the inspected baseline under a clearly labeled path such as `contact-sheet-set-name-before.png` before generating the after sheet. Report both paths, and do not commit generated PNGs unless the user explicitly asks for checked-in reference images.

For final-frame questions, also capture the active `.viewport` at the corresponding player-height pose. Keep the contact sheet and live capture labeled separately because they answer different questions.

### 4. Verify proportionately

Run the repository's normal lint and build checks after code changes. Use `deadwater-qa-release/references/visual-test-harness.md` when the request requires browser regression coverage, pixel baselines, or release evidence. Fixed-camera reconnaissance does not replace that harness.

### 5. Report what the shots prove

Report:

- review question and named set;
- shot labels with positions, targets, and projection settings;
- generated artifact path and the exact sheet command;
- visible findings and any shot that failed its acceptance condition;
- live-viewport artifact when final presentation mattered;
- untested gameplay or dynamic behavior, routed to the correct specialist.

## Routing boundaries

- Use `deadwater-qa-release` for automated play, input, collision, interaction, game/editor paths, visual baselines, and release claims.
- Use `deadwater-gameplay-systems` for player movement, pathfinding, interactions, camera behavior, and level-flow implementation.
- Use `deadwater-ps2-graphics-builder` for renderer, material, lighting, fog, shader, or final-frame graphics changes.
- Use this skill to make the fixed visual evidence legible and repeatable before or after those specialists work.

## Completion rule

The work is complete only when the named set is valid, the sheet was regenerated, the actual pixels were inspected, and the report distinguishes visual evidence from gameplay evidence.
