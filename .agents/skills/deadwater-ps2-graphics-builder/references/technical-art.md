# DEADWATER technical-art contract

Use this reference before changing visual cost, pass count, light count, shader structure, geometry density, texture use, imported assets, or release-quality graphics claims.

## Contract template

Write this before implementation:

```text
Visible problem:
Affected live views and contact-sheet tiles:
Renderer claims:
- Hardware fact:
- DEADWATER policy:
- Modern cheat:
Core path or cheat path:
Owner files:
Geometry and vertex-density impact:
Texture and material impact:
Light-slot impact:
Pass and fill-rate impact:
Target desktop and frame-time target:
Before evidence:
Acceptance evidence:
Fallback if the budget fails:
```

Do not put a hardware fact in the contract unless the distinction affects the work. Most implementation decisions are DEADWATER policies.

## Fixed renderer policies

| Policy | Repository evidence | Technical consequence |
| --- | --- | --- |
| Gamma/display-space shading | `rawColor`, `prepTexture`, and raw shader math in `src/ps2/PS2Material.ts` | Do not add sRGB decode, linear-light math, tone mapping, or PBR assumptions |
| Diffuse plus emissive | `createPS2Material` options and `applyPS2Materials` | Bake material character into diffuse color, geometry, vertex response, or emissive masks |
| Gouraud scene lighting | Vertex shader in `src/ps2/PS2Material.ts` | Light quality depends on mesh vertex density and normals |
| Fixed internal target | `INTERNAL_WIDTH` and `INTERNAL_HEIGHT` in `src/ps2/PS2Pipeline.tsx` | Main fill cost is stable across window sizes; geometry, vertices, draws, and extra passes still matter |
| 4:3 presentation | `.viewport` in `src/index.css` | Judge composition in the framed canvas, not a free-aspect editor camera |
| 5-bit ordered core output | Fragment shader in `src/ps2/PS2Material.ts` | Gradients and low-light ramps must survive quantization and Bayer patterning |
| Bilinear mag, hard mip transitions, no anisotropy | `prepTexture` in `src/ps2/PS2Material.ts` | Texture scale and UV repetition must be judged in motion and at oblique angles |
| Twenty compiled light slots | `MAX_LIGHTS` in `src/ps2/PS2Material.ts` | Each ordinary vertex loops over all slots; 20 is a code budget, not hardware history |
| Runtime PBR stripping | `applyPS2Materials` in `src/engine/render.tsx` | Source roughness, metalness, normal, and AO maps do not define the shipped look |

`src/game/SewerWater.tsx` has a local R5G6B5-style quantization path. Treat that as a water-specific implementation detail. The shared opaque material contract remains the 5-bit-per-channel path in `src/ps2/PS2Material.ts`.

## Pass graph and modern-cheat cost

The gameplay pipeline runs these renders:

1. `[Modern cheat]` CCTV scene render at 128x96 every 0.25 seconds.
2. `[Modern cheat]` Full opaque depth pre-pass at 512x448 every frame for water foam.
3. `[Modern cheat]` Full flashlight depth render at 512x512 while the flashlight owns a slot.
4. `[DEADWATER policy]` Main scene render at 512x448.
5. `[Modern cheat]` Fullscreen CRT presentation blit to the visible canvas.

One visible mesh can therefore be submitted more than once per frame. Do not quote the last `renderer.info.render.calls` value without identifying which pass produced it. Three.js may reset renderer counters between renders. For reliable diagnostics, sample each named pass or temporarily set up deliberate per-pass accounting, then restore normal counter behavior.

A new full-scene pass is a release-blocking design decision until the report shows its purpose, measured cost, and a cheaper rejected alternative.

## Starting budgets

These are `[DEADWATER policy]` starting targets for the current desktop-only game. They are not PS2 hardware limits. Measure the worst interactive view on the named test machine.

| Metric | Starting target | Notes |
| --- | --- | --- |
| Visible internal target | Exactly 512x448 | Verify `PS2Pipeline`, not only CSS size |
| Presentation | Exactly 4:3 | Verify live `.viewport`, HUD, and letterboxing |
| Main-view draw calls | At most 250 | Record main pass separately from depth, shadow, CCTV, and blit |
| Main-view triangles | At most 400k | Spend on silhouettes and Gouraud sampling that survives the game camera |
| Live geometries | At most 300 | Reuse geometry for repeated primitives and props |
| Live textures | At most 64 | Count render targets and generated textures as well as asset maps |
| Texture working size | 256px on the long side by default | Larger assets need a camera-distance reason and memory note |
| Compiled shader programs | At most 32 | Shared `ShaderMaterial` variants need stable reuse |
| Ordinary active light slots | At most 19 | Keep one slot available for the flashlight; inspect `window.__lightSlots()` |
| Added full-scene passes | Zero by default | Existing cheat passes are already part of the cost |
| Frame time | Median at or below 16.7 ms, p95 at or below 22 ms | Name hardware, browser, scene, flashlight state, and capture method |

If the current baseline exceeds a target, do not pretend the target passed. Report the baseline, prevent regression, and name the work required to return under budget.

## Geometry and Gouraud lighting

Vertex count is both an art control and a shader cost. Ordinary lights run per vertex, so topology determines the shape of light pools.

- Add segments to large receiving surfaces when a light visibly jumps across triangles.
- Spend vertices on silhouette, bends, and lighting gradients visible from the player's camera.
- Remove hidden segments and tiny bevels that disappear after the 512x448 render and dither.
- Keep collision proxies independent from visual tessellation.
- Share or instance repeated geometry where the component architecture permits it.
- Inspect vertex normals after import. More vertices do not repair bad normals.

Do not increase global tessellation to repair one fixture. Fix the affected surface or light.

## Texture and material budget

The shipped material language is base color plus optional emissive.

- Downscale imported diffuse and emissive maps to the smallest size that survives the active camera. The current asset workflow uses 256px sources.
- Use `prepTexture` for world color maps. It enforces raw sampling, bilinear magnification, hard mip transitions, and anisotropy 1.
- Use UV repeat and scene scale to preserve texel density. Hard mip transitions expose bad scale choices.
- Use texture bombing only on broad surfaces where repeated tiles are a visible problem. Three samples per fragment make it a real fill cost.
- Bake roughness, metal, dirt, and AO cues into the diffuse art only when they remain plausible under vertex lights.
- Use emissive maps for bulbs, signs, and screens. Do not make whole props fullbright to hide weak lighting.
- Count render targets for the main image, depth, flashlight shadow, and CCTV in the texture budget.

## Light budget

`MAX_LIGHTS = 20` compiles a fixed loop. Inactive slots still execute the loop with zero contribution.

- Use the runtime allocator in `src/engine/lights.ts`; do not hand-assign indices.
- Reserve one slot for the flashlight.
- Inspect allocation and leaks through `window.__lightSlots()` in development.
- Prefer a larger radius or better placement over several overlapping fixtures.
- Pair a fixture light with visible fullbright or emissive geometry so the source reads.
- Verify lights off, circuit switching, flicker, fog, and flashlight interaction.
- Treat any proposal to raise `MAX_LIGHTS` as a vertex-cost change across the whole ordinary scene.

## Imported asset contract

For each glTF or FBX asset, report:

- source path and registry key in `src/engine/models.ts`;
- license and `public/models/CREDITS.md` entry;
- source and shipped file size;
- texture dimensions and channels actually used;
- mesh count, material count before conversion, and material count after conversion;
- approximate triangles, bounds, pivot, scale, and forward/up orientation;
- collision component or reason none is needed;
- whether the first-material collapse in `applyPS2Materials` preserves the intended diffuse surface;
- glass-name and emissive-map behavior when present;
- a gameplay-camera capture, not only an editor thumbnail.

Never treat a clean PBR model-viewer screenshot as evidence. The shipped proof is the model after `applyPS2Materials` under DEADWATER lights, fog, dither, and presentation.

## Cheat review

For every changed modern cheat, record:

| Question | Required answer |
| --- | --- |
| What player-facing read does it create? | A concrete state, material, depth, or surveillance cue |
| Which file owns it? | One canonical owner and its consumers |
| What is the cost? | Passes, samples, vertices, transparency, memory, or refresh rate |
| Where is it bounded? | A state, material family, scene region, camera, or update rate |
| What is the fallback? | Disable, reduce resolution/rate, or use the core material |
| What evidence proves it? | Same view with the cheat enabled and disabled |

Approved cheats do not receive a permanent exemption. Re-measure them when their scene coverage or target size changes.

## Measurement procedure

1. Name the browser, hardware, build mode, view, and gameplay state.
2. Capture a live 4:3 frame with the flashlight off.
3. Capture the same view with the flashlight on when available.
4. Exercise water, glass, and CCTV when the pass affects them.
5. Refresh contact sheets through `await window.__sheet()` for spatial coverage.
6. Record per-pass draw calls and triangles, live geometry/texture/program counts, active light slots, and a frame-time sample.
7. Run `npm run build` and `npm run lint`.
8. Compare identical before and after views. Explain any budget increase in terms of visible value.

Contact sheets are 512x384 review renders made by `src/game/DevViews.tsx`. They bypass the final 512x448 target and CRT blit. Use them for coverage and scene quality, never as the only renderer evidence.

## Technical-art report

Report the completed contract, actual metrics, target deltas, imported asset checks, cheat review, light-slot state, test commands, visual evidence, and failed gates. Say `not measured` when a metric was not captured. Do not substitute `seems smooth`, `looks PS2`, or a screenshot for numeric evidence.
