---
name: deadwater-game-director
description: "Direct broad development of the DEADWATER Three.js game and its PS2-style engine. Use for complete features, major upgrades, gameplay-plus-art work, visual polish, release preparation, or requests spanning multiple game systems. Route work through the repo-local gameplay, PS2 graphics, UI, debug, QA, 3D asset, image, and audio specialists."
---

# DEADWATER game director

## Purpose

Own the end-to-end player-facing result. Preserve DEADWATER's data-driven scene graph, React Three Fiber and Rapier architecture, PS2-style renderer, editor workflow, asset provenance, and agent-verifiable runtime hooks.

Use this skill as the main entrypoint for broad work. For a narrow task, load the directly relevant specialist and `deadwater-qa-release`.

## Repository contract

Treat the current repository as the product and reference implementation:

- `src/ps2/`: PS2-style materials, fixed framebuffer pipeline, depth resources, CCTV, and flashlight shadow.
- `src/engine/`: scene schema, `scene.json`, component renderers, registries, editor store, lighting, textures, and inspection metadata.
- `src/game/`: controls, player state, physics, interactions, inventory, AI, audio, culling, and authored game effects.
- `src/editor/`: the in-browser scene and asset editor.
- `public/`: runtime textures and models, with provenance in `docs/ASSETS.md` and `public/models/CREDITS.md`.

Do not introduce a parallel vanilla Three.js engine, second scene source of truth, second render loop, or PBR runtime beside the PS2 renderer.

## Load sibling skills

For broad features or release work, load all five phase specialists before implementation:

1. `deadwater-gameplay-systems`
2. `deadwater-ps2-graphics-builder`
3. `deadwater-game-ui-designer`
4. `deadwater-debug-profiler`
5. `deadwater-qa-release`

Load production specialists when their outputs are in scope:

- `deadwater-3d-asset-pipeline`: models, props, textures tied to models, licensing, conversion, registration, collision, or placement.
- `deadwater-image-generator`: concepts, diffuse or emissive textures, signs, decals, icons, interface art, or image edits.
- `deadwater-audio-generator`: procedural cues, imported samples, ambience, interface feedback, or audio-system changes.

Read sibling files from `.agents/skills/<skill-name>/SKILL.md`. Record `loaded`, not `invoked`, when a file was read rather than activated by the runner.

## Rendering doctrine

Classify DEADWATER as a **Three.js PS2-style renderer with targeted modern cheats**. It is neither PSX nor retro-PBR.

Keep these distinctions explicit:

- **PS2 hardware fact:** a capability or behavior supported by primary hardware documentation.
- **DEADWATER policy:** an art or engineering choice such as 512x448 internal resolution, 4:3 framing, 256px runtime textures, or the current light-slot budget.
- **Modern cheat:** a modern technique kept because it serves the intended image or play, such as the flashlight shadow map, depth-aware foam, texture bombing, or editor preview.

Do not present a DEADWATER policy as a universal hardware limit. Do not introduce PS1 affine warping or vertex snapping. Do not preserve glTF metallic, roughness, normal, or AO channels in gameplay unless the renderer contract is deliberately redesigned.

## Phase routing

### 1. Discovery and contract

- Inspect the affected scene nodes, components, systems, assets, hooks, and existing verification.
- State the player-facing outcome, affected gameplay path, render policy, and non-goals.
- For a large feature, define the playable slice and the level or encounter change before building art around it.

### 2. Gameplay systems

Use `deadwater-gameplay-systems` for mechanics, controls, interactions, physics, state, AI, level flow, camera, feedback, and scene-schema changes. Keep `scene.json` authoritative for world layout.

### 3. Asset and media production

Use the 3D, image, and audio specialists as needed. Prefer the existing vetted CC0 and CC-BY acquisition path. Record source URL, license, processing, runtime path, registry entry, and credit update for every external asset.

Generated media is optional. Never force an external provider when a vetted asset, procedural construction, or existing library better fits the game.

### 4. PS2 graphics and technical art

Use `deadwater-ps2-graphics-builder` for models, materials, lighting, fog, water, shaders, render targets, world density, composition, and renderer budgets. Require the specialist's PS2 visual scorecard for claims that the graphics pass is complete.

### 5. Interface

Use `deadwater-game-ui-designer` for the game HUD and overlays or the editor interface. Keep game presentation and editor usability as separate modes sharing state, not styling rules.

### 6. Debug and profile

Use `deadwater-debug-profiler` for failures and measured performance work. Reproduce before changing code, identify the owning layer, and compare the same camera, build mode, and scene before and after optimization.

### 7. QA and release

Use `deadwater-qa-release` after every meaningful phase. Exercise the real browser path, the game and editor where relevant, production build output, contact sheets, console/page errors, and recent risky interactions.

## Required ledgers

Maintain the four compact ledgers defined in `references/phase-playbook.md`:

1. Skill loading
2. Required references
3. Asset provenance and processing
4. Phase execution

Record only rows that apply, but never omit a row carrying a source, failure, decision, or verification result.

## Completion rules

Do not call broad work complete until the applicable evidence exists:

- `npm run build` and `npm run lint` pass.
- The game opens without console or page errors.
- The main changed input or editor path works in the browser.
- Relevant contact-sheet areas or screenshots were captured.
- `scene.json` remains loadable and editor/game state agree.
- Renderer, physics, asset, UI, or audio evidence is reported when that area changed.
- Production preview was checked for release claims.
- Remaining risks name an owner and a concrete unverified path.

Graphics claims also require the current PS2 visual scorecard. Asset claims require provenance and runtime integration evidence. A successful download or build alone is never proof that the result works in game.

## Report audit

For broad work, draft the evidence report and run:

```bash
python3 .agents/skills/deadwater-game-director/scripts/audit_reference_report.py /path/to/report.md
```

Add `--graphics`, `--physics`, `--assets`, `--audio`, or `--release` when those areas are in scope. Fix missing evidence or report the exact blocker.

## Final report

Lead with the player-facing outcome. Include changed files, controls or editor path, commands and URLs used, artifacts, applicable ledgers, measured tradeoffs, and remaining risks. Keep the report proportional to the work; the ledgers exist to preserve decisions, not to bury the result.
