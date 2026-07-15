---
name: deadwater-ps2-graphics-builder
description: Use when designing, reviewing, or implementing DEADWATER's repo-local PS2-style Three.js graphics, including vertex-lit materials, scene art, imported model adaptation, renderer changes, water, glass, CCTV, flashlight shadows, CRT presentation, or visual-performance verification.
---

# DEADWATER PS2 graphics builder

## Purpose

Own graphics and technical art for this repository. Protect the renderer contract while improving silhouettes, spatial composition, texture use, lighting, atmosphere, and measured runtime cost.

This renderer is PS2-style, not a claim that every choice matches every PlayStation 2 title. It is not PSX rendering and it is not retro PBR.

## Claim labels

Label renderer claims in plans, code comments, reviews, and reports:

- `[Hardware fact]` for a documented PlayStation 2 capability or behavior. Keep the statement narrow. PS2 titles used many resolutions, framebuffer formats, material strategies, and light counts.
- `[DEADWATER policy]` for a project choice enforced by this repository. The fixed 512x448 target and 20-slot shader array belong here.
- `[Modern cheat]` for a newer technique used to serve DEADWATER's look or gameplay. Name its visual purpose and cost.

Never convert a project constant into a hardware limit. Never describe a modern cheat as hardware-authentic.

## Core renderer contract

- `[DEADWATER policy]` Run the main material path in gamma/display space. Sample color textures raw with `THREE.NoColorSpace`; use `rawColor` or `rawColorFromString`; do not add an sRGB decode, a linear-light workflow, tone mapping, or an environment map.
- `[DEADWATER policy]` Use diffuse plus additive emissive only. Do not use runtime metalness, roughness, normal, AO, clearcoat, transmission, IBL, `MeshStandardMaterial`, or `MeshPhysicalMaterial` as the shipped scene language.
- `[DEADWATER policy]` Calculate ordinary scene lighting per vertex in `src/ps2/PS2Material.ts`. Add vertices where light interpolation needs resolution. Do not replace Gouraud lighting with per-fragment scene lighting.
- `[DEADWATER policy]` Render the game to the fixed 512x448 target in `src/ps2/PS2Pipeline.tsx`, then present it inside the 4:3 viewport in `src/index.css`.
- `[DEADWATER policy]` Quantize the core material output to 5 bits per color channel with the 4x4 ordered dither in `src/ps2/PS2Material.ts`.
- `[DEADWATER policy]` Prepare ordinary textures through `prepTexture`: bilinear magnification, hard mip transitions, anisotropy 1, raw color sampling.
- `[DEADWATER policy]` Treat `MAX_LIGHTS = 20` as this shader's compile-time slot budget. Reserve capacity for the equipped flashlight and measure the live allocator with `window.__lightSlots()`.
- `[DEADWATER policy]` Strip imported glTF/FBX materials at runtime through `applyPS2Materials` in `src/engine/render.tsx`. Preserve diffuse and emissive maps only. Do not repair an import by reintroducing PBR.
- `[Hardware fact]` Do not add PS1/PSX affine texture wobble or vertex snapping. Those are not part of DEADWATER's PS2 target.

## Approved modern cheats

Keep these cheats bounded and explicit:

- Per-fragment, hard-shadowed flashlight: `src/ps2/torchShadow.ts`, `src/game/Flashlight.tsx`, and the fragment path in `src/ps2/PS2Material.ts`.
- Depth-aware water intersection foam: `src/ps2/sceneDepth.ts`, the depth pre-pass in `src/ps2/PS2Pipeline.tsx`, and `src/game/SewerWater.tsx`.
- Stochastic texture bombing on selected large surfaces: `uBomb` in `src/ps2/PS2Material.ts` and `bombing` in `src/engine/types.ts` and `src/engine/scene.json`.
- Grimy per-fragment glass sheen: `createGlassMaterial` in `src/engine/render.tsx`.
- Low-resolution chopped CCTV feed: `src/ps2/cctv.ts`, `src/game/Cctv.tsx`, and the scheduled render in `src/ps2/PS2Pipeline.tsx`.
- CRT presentation cues: line darkening and corner falloff in `src/ps2/PS2Pipeline.tsx`, plus the 4:3 frame in `src/index.css`.

Do not use a cheat as a general replacement for the core renderer. A new cheat needs a named owner, a player-facing reason, a cost estimate, and visual evidence with the cheat enabled and disabled.

## Required references

Load only the references needed for the task, but do not skip a gate that matches the work:

- Read `references/implementation-blueprint.md` before renderer architecture, scene ownership, material conversion, or broad graphics work.
- Read `references/technical-art.md` before setting budgets, changing passes, adding lights, importing assets, or making performance claims.
- Read `references/render-recipes.md` before changing the pipeline, presentation, lighting, fog, flashlight, water, glass, or CCTV.
- Read `references/shader-cookbook.md` before writing or reviewing shader code.
- Read `references/model-recipes.md` before adding or adapting models, procedural set pieces, collision proxies, or scene density.
- Read `references/visual-scorecard.md` before scoring screenshots or claiming a graphics pass is complete.
- Read the matching file under `references/checklists/` before final verification. Use `references/checklists/ps2-renderer-quality-gate.md` and `references/checklists/ps2-visual-scorecard.md` for broad completion claims.
- Read `references/prompt-templates.md` only when preparing reusable task prompts.

For a broad graphics pass, load the blueprint, technical-art contract, render recipes, model recipes, shader cookbook, scorecard, `references/checklists/ps2-renderer-quality-gate.md`, and `references/checklists/ps2-visual-scorecard.md`.

## Workflow

1. Inspect `src/ps2/`, the relevant components in `src/engine/render.tsx`, the affected nodes in `src/engine/scene.json`, and current live frames.
2. Classify each planned change as hardware fact, DEADWATER policy, or modern cheat.
3. Capture a baseline live 4:3 frame and the relevant contact sheet. Record renderer counts, frame time, active light slots, pass state, and visible defects that the available tooling can measure.
4. Write a short technical-art contract using `references/technical-art.md`.
5. Improve the weakest visible surfaces with the smallest renderer-compatible change. Favor scene composition, mesh silhouette, vertex density, diffuse texture treatment, emissive masks, and light placement before a new shader or pass.
6. Route imported assets through `src/engine/models.ts` and `applyPS2Materials`. Verify scale, pivot, bounds, texture size, emissive behavior, material collapse, and collision separately.
7. Rebuild and inspect the same views. Test ordinary lighting, flashlight on and off, water intersections, glass, CCTV, darkness, and motion when affected.
8. Complete `references/visual-scorecard.md` and the relevant checklists. Report exact failures rather than lowering the contract.

## Verification boundary

Run `npm run build` and `npm run lint` from the repository root.

In a development game session, call `await window.__sheet()` to refresh `contact-sheet.png`, `contact-sheet-office.png`, `contact-sheet-dock.png`, and `contact-sheet-sewer.png`. These sheets use direct scene renders from `src/game/DevViews.tsx`; they validate geometry, materials, lighting, and coverage but bypass the final `PS2Pipeline` CRT blit. Capture the visible `.viewport canvas` separately to verify the fixed internal target, upscale, CRT treatment, HUD, and 4:3 presentation.

## Final report

Report:

- contract changes grouped as hardware fact, DEADWATER policy, and modern cheat;
- exact repository files changed;
- before and after live-frame and contact-sheet evidence;
- renderer counts, frame-time evidence, active light slots, and pass costs that were measured;
- imported asset conversion checks when relevant;
- filled visual scorecard and failed quality gates;
- remaining risks and the next concrete visual pass.
