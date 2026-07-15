# DEADWATER visual scorecard

Score active gameplay in the visible 4:3 viewport. Use contact sheets for scene coverage and a live canvas capture for the final 512x448 pipeline, CRT blit, HUD, and presentation.

## Evidence set

Gather the complete relevant set before scoring:

- baseline and current live `.viewport canvas` captures from the same player pose;
- `contact-sheet.png` plus the affected area sheets from the project root;
- flashlight-off and flashlight-on captures when the flashlight is available;
- close views of water intersections, glass, CCTV, or imported assets when changed;
- per-pass renderer counts or a clearly named unavailable metric;
- frame-time capture with browser, hardware, build mode, view, and state;
- `window.__lightSlots()` output when lighting changed;
- `npm run build` and `npm run lint` results.

Contact sheets come from direct scene renders in `src/game/DevViews.tsx`. They bypass the final target and CRT presentation. Never score final-pipeline integrity from contact sheets alone.

## Scoring scale

- 0: Missing, broken, contradicted, or no evidence.
- 1: Present but weak, inconsistent, generic, or unmeasured.
- 2: Intentional, renderer-conformant, readable, and supported by evidence.
- 3: Distinctive, cohesive across views and states, technically controlled, and proven with before/after and measured evidence.

## Categories

### 1. Renderer-contract fidelity

- 0: Stock PBR, linear/sRGB workflow, wrong target/aspect, or ordinary per-fragment lighting replaces the core.
- 1: Core mostly survives but custom paths omit raw color, filtering, fog, dither, or import conversion.
- 2: Gamma/display-space, diffuse/emissive, Gouraud, 512x448, 4:3, dither, filtering, and runtime PBR stripping all hold.
- 3: The contract is tested at every affected boundary, and comments/reports separate hardware facts, DEADWATER policies, and modern cheats.

### 2. Art direction and atmosphere

- 0: No coherent warehouse, dock, sewer, or horror identity.
- 1: Mood comes mainly from darkness, fog, or a green tint.
- 2: Structure, stock layout, grime, lights, props, water, sound-facing cues, and UI support the same industrial setting.
- 3: Each area is recognizable at a glance while sharing one restrained DEADWATER visual language.

### 3. World composition and geometry

- 0: Empty planes, stretched boxes, accidental intersections, or blocked routes dominate.
- 1: Props exist but placement is scattered, repetitive, incorrectly scaled, or weak in the first-person frame.
- 2: Warehouse operational zones, negative space, foreground, midground, focal objects, and traversal sightlines are intentional.
- 3: Composition remains strong across gameplay and every relevant contact-sheet camera, with purposeful occlusion and no filler density.

### 4. Model and set-piece quality

- 0: Broken imports, placeholder primitives, PBR-only source read, missing collision, or wrong scale.
- 1: Models load but collapse after material stripping, lack silhouette, or read only in editor thumbnails.
- 2: Imported and procedural assets keep useful silhouettes, normals, diffuse/emissive treatment, scale, bounds, and separate collision at gameplay distance.
- 3: Reusable prop families and focal set pieces feel authored for this renderer, with diagnostic and licensing evidence.

### 5. Texture and material language

- 0: Missing textures, sRGB/PBR mismatch, unreadable noise, or accidental fullbright surfaces.
- 1: Diffuse maps work but repeat, scale, mip changes, or value separation remain obvious.
- 2: Raw diffuse and emissive maps, 256px working scale, UV repeat, tint, hard mip transitions, and limited bombing support form and material identity.
- 3: Texture choices remain clear in motion, darkness, flashlight, fog, and dither without relying on runtime PBR.

### 6. Vertex lighting, darkness, and fog

- 0: Essential paths are black, lights leak or fail, or the flashlight is the only readable illumination.
- 1: Fixtures illuminate the scene but pools facet, flatten, clip, or fight ambient/fog.
- 2: Per-vertex pools, normals, surface segments, fixture emissive/fullbright faces, ambient, and fog produce readable depth.
- 3: Lighting composes each area, survives movement and circuit states, and stays within the slot and frame budgets.

### 7. Modern-cheat discipline

- 0: A cheat is described as authentic hardware behavior, replaces the core renderer, or has an unknown owner and cost.
- 1: Flashlight, foam, bombing, glass, CCTV, or CRT works but is overused, visually noisy, or unmeasured.
- 2: Each active cheat has a label, owner, player-facing purpose, bounded coverage, cost, fallback, and comparison evidence.
- 3: Cheats solve specific reads with minimal scope and fail cleanly when disabled or unavailable.

### 8. 4:3 and CRT presentation

- 0: Wrong aspect, missing final blit, broken scaling, or clipped HUD.
- 1: The frame is 4:3 but composition, line treatment, corner falloff, or scaling hurts readability.
- 2: Fixed internal target, bilinear upscale, mild CRT cues, CSS frame, HUD, and overlays remain readable at tested desktop sizes.
- 3: The final presentation strengthens the mood without hiding dither, crushing dark areas, or looking like a generic CRT filter.

### 9. Gameplay-state readability

- 0: Crosshair, prompts, pickups, doors, hazards, or interaction targets disappear into the scene.
- 1: Readability works only when still, close, or with the flashlight on.
- 2: Navigation, interaction, carry state, fixture state, water boundaries, and surveillance cues read during normal movement.
- 3: Visual hierarchy anticipates player decisions across dark, lit, flashlight, office, dock, and sewer states.

### 10. Performance and verification evidence

- 0: No build/lint result, no live capture, or a performance claim without metrics.
- 1: Commands pass and screenshots exist, but per-pass counts, frame time, or light slots are missing.
- 2: Same-view before/after captures, build, lint, contact sheets, live final frame, per-pass counts, frame time, and relevant diagnostics are reported.
- 3: The report explains every cost delta, identifies bottlenecks, validates periodic and optional passes, and records a tested fallback.

## Gates

### Renderer-conformant graphics pass

- Renderer-contract fidelity scores 3.
- Every other category scores at least 2.
- Average score is at least 2.3.
- No automatic failure remains.

### Release-ready graphics pass

- Renderer-contract fidelity and performance evidence score 3.
- At least six other categories score 3.
- No category scores below 2.
- Average score is at least 2.7.
- The full relevant evidence set covers ordinary lights, flashlight state, and every changed modern cheat.

These are DEADWATER quality gates. They are not claims of high-end photoreal fidelity or universal PS2 authenticity.

## Automatic failures

Any item below blocks both gates:

- A shipped world path uses stock PBR, an environment map, tone mapping, or runtime roughness/metalness/normal/AO as its material language.
- A global PSX effect such as affine wobble, vertex snapping, or nearest-only magnification is added and called PS2-style.
- A report calls 512x448 or 20 light slots a universal PS2 hardware limit.
- Ordinary scene lighting moves from the vertex shader to per-fragment lighting.
- Imported glTF/FBX PBR materials bypass `applyPS2Materials` without an explicit renderer redesign.
- A new modern cheat lacks a label, owner, purpose, bounded cost, fallback, or enabled/disabled evidence.
- The visible game is not 4:3 or the main target is not fixed at 512x448.
- Only contact sheets or editor thumbnails are supplied; no live final-pipeline capture exists.
- Contact sheets are presented as evidence of the CRT blit.
- Lighting changed without checking slot allocation and the flashlight reserve.
- A new full-scene pass has no per-pass cost evidence.
- The flashlight shadow, water foam, glass, or CCTV changed but its affected state was not exercised.
- Navigation or interaction becomes unreadable in ordinary darkness or under the flashlight.
- `npm run build` or `npm run lint` fails because of the graphics work.

## Measured evidence rules

- Name the pass attached to draw calls and triangles. The final blit's counters do not describe the main scene.
- Include render targets and generated textures in memory counts.
- State the exact light-slot occupancy, not only the number of light nodes in `src/engine/scene.json`.
- State `not measured` instead of guessing.
- Name hardware and browser for frame time.
- Compare identical player pose, camera, window size, light circuits, and flashlight state.
- Do not use image entropy or edge density as a substitute for visual judgment. If automated image metrics are available, treat them as secondary evidence and state the capture path they measured.

## Independent review

The implementer should not be the only scorer for a release-ready claim.

Give a fresh reviewer only:

- the complete relevant before and after capture set;
- this scorecard;
- the filled technical-art metrics;
- the renderer-change diff when contract fidelity must be checked.

Do not provide the intended score or a defense of the work. Take the lower score per category unless concrete repository evidence resolves the disagreement.

If an independent reviewer is unavailable, write one adversarial sentence per category that argues for the next lower score before assigning the final value.

## Report format

```text
DEADWATER visual scorecard
Evidence set:
Hardware facts stated:
DEADWATER policies changed:
Modern cheats changed:

1. Renderer-contract fidelity: before / after / evidence
2. Art direction and atmosphere: before / after / evidence
3. World composition and geometry: before / after / evidence
4. Model and set-piece quality: before / after / evidence
5. Texture and material language: before / after / evidence
6. Vertex lighting, darkness, and fog: before / after / evidence
7. Modern-cheat discipline: before / after / evidence
8. 4:3 and CRT presentation: before / after / evidence
9. Gameplay-state readability: before / after / evidence
10. Performance and verification evidence: before / after / evidence

Average:
Automatic failures remaining:
Renderer-conformant gate: pass/fail
Release-ready gate: pass/fail
Lowest category and next concrete pass:
```
