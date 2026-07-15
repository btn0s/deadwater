# DEADWATER graphics prompt templates

Adapt only the template that matches the task. Keep repository paths exact and remove unused sections.

## Broad graphics pass

```text
Use $deadwater-ps2-graphics-builder for a renderer-conformant graphics pass on DEADWATER.

Visible problem:
Affected areas and gameplay states:
Target read:

Preserve these DEADWATER policies:
- Gamma/display-space color.
- Diffuse plus emissive only.
- Ordinary per-vertex lighting.
- Fixed 512x448 internal target and 4:3 presentation.
- Core 5-bit ordered dither.
- Bilinear magnification, hard mip transitions, anisotropy 1.
- Runtime PBR stripping for glTF/FBX.

Classify every renderer claim as hardware fact, DEADWATER policy, or modern cheat. Treat the flashlight shadow, water foam, texture bombing, glass sheen, CCTV, and CRT cues as modern cheats.

Inspect src/ps2/, src/engine/render.tsx, src/engine/scene.json, the affected live canvas, and contact sheets. Write the technical-art contract, improve the smallest correct owner, and complete the visual scorecard.

Verify with npm run build, npm run lint, refreshed contact sheets, a live 4:3 final-pipeline frame, relevant gameplay states, per-pass renderer counts, frame time, and window.__lightSlots() when lighting changes.
```

## Screenshot critique and implementation plan

```text
Use $deadwater-ps2-graphics-builder to critique DEADWATER's current live frame and relevant contact sheets, then produce a prioritized implementation plan.

Inputs:
- Live .viewport canvas capture:
- Relevant contact sheets:
- Player pose and gameplay state:
- Flashlight and light-circuit state:
- Available renderer metrics:

Score references/visual-scorecard.md. Separate visible art problems from renderer-contract problems. For each recommendation, name the exact owner under src/ps2/, src/engine/, src/game/, src/index.css, or src/engine/scene.json; classify it as hardware fact, DEADWATER policy, or modern cheat; estimate cost; and define identical before/after evidence.

Do not recommend stock PBR, tone mapping, environment maps, PSX wobble, nearest-only magnification, or generic post-processing.
```

## Lighting and darkness pass

```text
Use $deadwater-ps2-graphics-builder for a DEADWATER lighting pass.

Affected locations:
Current readability failure:
Desired player read:

Keep ordinary lighting in the vertex shader in src/ps2/PS2Material.ts. Work through light placement, radius, intensity, shaded-fixture cone, surface segments, normals, visible fixture emissive/fullbright faces, ambient, and fog. Reserve one of the 20 project light slots for the flashlight. Do not describe 20 as a PS2 hardware limit.

Inspect window.__lightSlots(), circuit-off and circuit-on states, flashlight stowed and equipped, player movement through the area, and the affected contact-sheet tiles. Record per-pass and frame-time changes.
```

## Texture and material pass

```text
Use $deadwater-ps2-graphics-builder to improve DEADWATER's diffuse/emissive material language.

Affected surfaces:
Current defect:
Target material read:

Use createPS2Material and prepTexture from src/ps2/PS2Material.ts. Preserve raw display-space sampling, diffuse plus emissive, bilinear magnification, hard mip transitions, anisotropy 1, linear fog, and ordered dither. Fix source image, 256px working scale, UV repeat, tint, normals, and lighting before enabling texture bombing. Treat bombing and glass sheen as modern cheats with measured cost.

Do not add runtime roughness, metalness, normal, AO, clearcoat, transmission, PMREM, or environment reflections.
```

## Imported asset adaptation

```text
Use $deadwater-ps2-graphics-builder to adapt this glTF or FBX asset to DEADWATER.

Asset path and license:
Registry role:
Gameplay camera distance:
Collision role:

Register it in src/engine/models.ts and place it through src/engine/scene.json. Route it through applyPS2Materials in src/engine/render.tsx. Keep diffuse and justified emissive maps; strip PBR channels. Verify source material arrays, glass naming, scale, pivot, bounds, normals, texture dimensions, material collapse, collision, attribution, darkness, flashlight response, live gameplay silhouette, and contact-sheet coverage.

Report source and shipped diagnostics. A PBR model-viewer render is not acceptance evidence.
```

## Procedural set-piece pass

```text
Use $deadwater-ps2-graphics-builder to build a reusable DEADWATER set piece.

Area and function:
Player route and negative space:
Focal object:
Supporting prop family:
Lighting role:
Collision needs:

Prefer scene nodes, existing MODEL_REGISTRY assets, primitive components, instances, and current generators. Add a generator in src/engine/render.tsx and schema support in src/engine/types.ts only when repeated parametrized construction warrants it. Keep visual and collision geometry separate. Spend vertices on silhouette and Gouraud light sampling visible at 512x448.

Follow docs/WAREHOUSE-LAYOUT.md. Verify all affected gameplay paths and contact-sheet cameras, renderer deltas, and build/lint.
```

## Modern-cheat review

```text
Use $deadwater-ps2-graphics-builder to review this proposed or changed modern cheat in DEADWATER.

Cheat:
Player-facing purpose:
Canonical owner:
Consumers:
Coverage or activation state:
Expected samples/passes/memory/transparency cost:

Confirm it does not replace gamma/display-space diffuse/emissive Gouraud rendering. Compare the same live frame with the cheat enabled and disabled. Measure per-pass cost and frame time. Define a fallback. Reject the change if scene composition, geometry, normals, diffuse art, emissive art, UV scale, or vertex density solves the problem more cheaply.
```

## Flashlight and shadow pass

```text
Use $deadwater-ps2-graphics-builder to tune DEADWATER's flashlight without generalizing its modern-cheat path.

Current defect:
Affected surfaces and occluders:

Keep ownership split across src/game/Flashlight.tsx, src/ps2/torchShadow.ts, the torch fragment branch in src/ps2/PS2Material.ts, and scheduling in src/ps2/PS2Pipeline.tsx. Preserve the single hard depth tap and 512x512 shadow target unless measurements justify a DEADWATER policy change.

Verify crosshair convergence, circular pool, hard edge, bias, stow/equip slot lifecycle, viewmodel exclusion, water exclusion, darkness without the torch, draw/triangle counts per pass, and frame-time delta.
```

## Water pass

```text
Use $deadwater-ps2-graphics-builder to tune DEADWATER's sewer water.

Current defect:
Affected channel and intersections:

Work in src/game/SewerWater.tsx and the existing depth contract in src/ps2/sceneDepth.ts and src/ps2/PS2Pipeline.tsx. Preserve per-vertex scene lighting, dual scrolling diffuse layers, small vertex motion, fog, local quantization, transparency, and bounded depth-aware foam. Treat foam as a modern cheat.

Do not add reflection, refraction, SSR, planar mirrors, transmission, or PBR water. Verify flow in motion, banks, pilings, grates, foam enabled in gameplay, foam disabled in direct review renders, light response, mip behavior, transparency, and pass cost.
```

## Fresh-eyes scorecard review

```text
Independently score this DEADWATER graphics pass using references/visual-scorecard.md.

Inputs:
- Complete before and after live 4:3 capture set:
- Complete relevant contact sheets:
- Technical-art metrics:
- Renderer diff for contract-fidelity review:

Do not assume the implementation intent is correct. Score all ten categories, list automatic failures, identify claims mislabeled as hardware fact, DEADWATER policy, or modern cheat, and name the three most important visible or technical fixes. Contact sheets do not prove final CRT presentation.
```
