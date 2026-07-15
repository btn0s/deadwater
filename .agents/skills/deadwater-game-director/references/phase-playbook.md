# Director phase playbook

Load this reference for broad work. A loaded sibling skill owns its detailed workflow; this playbook supplies routing, entry and exit evidence, and fallback guidance.

## Ledgers

```text
Skill-loading ledger:
- Director: active
- Gameplay systems: loaded/not-needed, path or reason
- PS2 graphics: loaded/not-needed, path or reason
- UI: loaded/not-needed, path or reason
- Debug/profile: loaded/not-needed, path or reason
- QA/release: loaded, path
- Visual scout: loaded/not-needed, path or reason
- 3D asset pipeline: loaded/not-needed, path or reason
- Image generator: loaded/not-needed, path or reason
- Audio generator: loaded/not-needed, path or reason

Reference ledger:
- <skill/reference>: loaded/not-needed/unavailable, path or reason

Asset provenance and processing ledger:
- Surface or cue:
- Source type: existing / procedural / CC0 / CC-BY / generated
- Source URL or generation record:
- License and author:
- Source files:
- Processing: conversion, resize, material reduction, loop edit, cleanup
- Runtime path and registry/schema entry:
- Credit update:
- In-game verification:

Phase ledger:
- Discovery and contract: pending/running/done/skipped, evidence
- Gameplay systems: pending/running/done/skipped, evidence
- Asset and media production: pending/running/done/skipped, evidence
- PS2 graphics and technical art: pending/running/done/skipped, evidence
- UI/editor interface: pending/running/done/skipped, evidence
- Debug/profile: pending/running/done/skipped, evidence
- QA/release: pending/running/done/skipped, evidence
```

Mark a phase done only after implementation and direct verification.

## Required references

Load only references that apply, at phase entry:

- Gameplay: `deadwater-gameplay-systems/references/gameplay-workflows.md`
- Level or encounter work: `deadwater-gameplay-systems/references/game-design-level-design.md`
- Feel and feedback: `deadwater-gameplay-systems/references/game-feel.md`
- Physics or collision: `deadwater-gameplay-systems/references/physics-engine-selection.md`
- Graphics: `deadwater-ps2-graphics-builder/references/implementation-blueprint.md`, `technical-art.md`, `render-recipes.md`, and `visual-scorecard.md`
- Models or imported assets: `deadwater-ps2-graphics-builder/references/model-recipes.md`
- Custom shaders or framebuffer work: `deadwater-ps2-graphics-builder/references/shader-cookbook.md`
- Game or editor UI: `deadwater-game-ui-designer/references/ui-patterns.md`
- Debug or profiling: `deadwater-debug-profiler/references/debug-profile-checklists.md`
- QA or release: `deadwater-qa-release/references/qa-release-checklists.md`
- Visual baselines: `deadwater-qa-release/references/visual-test-harness.md`
- Named fixed-camera coverage: `deadwater-visual-scout/references/shot-design.md`
- Automated play: `deadwater-qa-release/references/playtest-bot.md`
- Models, textures, licensing, or placement: `deadwater-3d-asset-pipeline/references/threejs-integration.md`
- Image-to-model or generated image inputs: `deadwater-3d-asset-pipeline/references/image-generator-workflows.md`
- Audio production or integration: `deadwater-audio-generator/references/audio-workflows.md`

Load checklist files before claiming the matching phase complete.

## Phase entry and exit

### Discovery and contract

Enter by reading the relevant code, `README.md`, scene nodes, assets, and recent changes. Exit with the intended player or editor outcome, affected owners, risks, non-goals, and verification path.

### Gameplay systems

Enter with a triggerable behavior and ownership plan. Exit after the behavior works through real input or editor action, state resets cleanly, and related UI/audio/VFX state follows it.

### Asset and media production

Enter with a named surface or cue and an in-game use. Exit after provenance, processing, registry/schema integration, credits, runtime load, and active-scene verification are complete.

### PS2 graphics and technical art

Enter with active-game screenshots or contact sheets and a classified weakness. Exit with the PS2 visual scorecard, renderer-budget evidence, before/after artifacts, and every modern cheat or policy change named.

### UI and editor interface

Enter with a named state and action. Exit after text fit, overlap, focus/input, state wiring, 4:3 game framing or editor layout, and browser interaction are checked.

### Debug and profile

Enter with a reproduction and observed evidence. Exit with root cause, owning module, direct retest, and baseline/post measurements for performance changes.

### QA and release

Enter after implementation is stable enough to exercise. Exit with build/lint results, dev or preview URL, browser errors, changed interaction path, screenshots/contact sheets, game/editor coverage, and residual risks.

## PS2 graphics gate

Keep three categories separate in all graphics decisions:

- Hardware fact
- DEADWATER policy
- Modern cheat

Reject PSX artifacts, accidental PBR preservation, and generic glow/fog used to hide missing authored form. Accept a modern cheat when it is documented, measured, consistent with the final frame, and improves play or the intended image.

## Asset gate

Prefer existing assets, procedural construction, and vetted CC0/CC-BY libraries. Use generated media only when it solves a named gap. Never claim an asset is integrated until it loads through the real registry and material path, has a collision and scale decision, appears in an active scene or editor view, and has provenance recorded.

## Release gate

For release-ready claims, verify production output rather than only the dev server. Check asset URLs, editor exclusion or intended inclusion, debug-hook gating, bundle and large files, browser errors, pointer-lock and audio-unlock paths, and a representative play path.
