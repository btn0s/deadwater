# Render, lighting, and presentation recipes

Use this reference after identifying the visual owner in `references/implementation-blueprint.md`. Keep every recommendation inside DEADWATER's custom pipeline.

## Renderer baseline

- `[DEADWATER policy]` `src/App.tsx` creates the game canvas with antialiasing off and DPR 1.
- `[DEADWATER policy]` `src/ps2/PS2Pipeline.tsx` renders the main view to 512x448 and blits it to the visible canvas.
- `[DEADWATER policy]` `.viewport` in `src/index.css` locks the presentation to 4:3.
- `[DEADWATER policy]` `src/ps2/PS2Material.ts` performs display-space diffuse and emissive shading, linear fog, ordered dither, and quantization.

Do not add `ACESFilmicToneMapping`, exposure controls, an output color transform, PMREM, environment lighting, bloom, SSAO, TAA, or a stock post stack. Those belong to a different renderer.

## Camera and 4:3 composition

Judge the visible `.viewport`, not an editor camera or uncropped screenshot.

- Keep the immediate route, interaction target, and crosshair readable at 4:3.
- Use foreground occlusion sparingly in the first-person view.
- Check that tall warehouse stock breaks long sightlines without blocking the drive and cross aisles defined in `docs/WAREHOUSE-LAYOUT.md`.
- Use light pools, door frames, rack rows, railing, and sewer banks to lead the eye.
- Keep the HUD inside the 4:3 frame and verify pointer-lock overlays separately.
- Capture the same player pose before and after a composition change.

`src/game/DevViews.tsx` uses review cameras at 4:3, but those renders bypass `PS2Pipeline`. They prove spatial composition, not final CRT presentation.

## Per-vertex lighting recipe

Ordinary lights are Gouraud-style contributions computed in the vertex shader.

1. Place or tune the `light` component in `src/engine/scene.json`.
2. Give the fixture visible fullbright or emissive geometry so the source reads.
3. Inspect the receiving surface topology. For `surface` components, tune `segments` if the pool crosses too few vertices.
4. Tune radius before intensity. Small, very hot lights clip into harsh color steps after quantization.
5. Tune ambient and fog through the `environment` component only after local fixtures read.
6. Inspect from the gameplay camera while moving. Static editor thumbnails hide Gouraud interpolation and mip transitions.

`spot: 1` is a DEADWATER shaded-fixture approximation that attenuates light above the lamp and favors the downward region. It is not a Three.js `SpotLight` and it is not a hardware fact.

## Darkness and fog

Fog lives in `sharedLightUniforms` and is applied as a linear blend in the material fragment shader.

- Use fog to terminate visibility and join the warehouse, sewer, and void colors.
- Keep the interaction range inside a readable value range without relying on the flashlight.
- Check dark geometry against the fog color. Dither does not rescue a silhouette that has no value separation.
- Avoid a near/far interval so narrow that several 5-bit steps collapse into a visible wall.
- Verify the environment component updates `ambientColor` and `fogSettings` through `EnvironmentVisual` in `src/engine/render.tsx`.

## Texture filtering and scale

`prepTexture` in `src/ps2/PS2Material.ts` is the ordinary texture boundary:

- `[DEADWATER policy]` `LinearFilter` for magnification;
- `[DEADWATER policy]` `LinearMipmapNearestFilter` for hard mip transitions;
- `[DEADWATER policy]` anisotropy 1;
- `[DEADWATER policy]` `NoColorSpace` raw sampling;
- `[DEADWATER policy]` repeat wrapping on both axes.

Fix texture problems in this order:

1. Verify world scale and UV repeat.
2. Verify the source is diffuse color at the intended 256px working size.
3. Inspect hard mip changes during player motion.
4. Enable texture bombing only when broad repetition remains the defect.
5. Replace the diffuse source if it still reads as high-frequency noise.

Do not switch to nearest magnification to make the renderer look more PSX. Do not add trilinear filtering or anisotropy globally to hide poor UV scale.

## Ordered dither and quantization

The core material adds a 4x4 Bayer threshold, then quantizes each RGB channel to 31 intervals. This is a DEADWATER display simulation inside an RGBA render target.

- Judge dither in a live 512x448 frame. Browser image scaling and screenshots can alter its apparent grain.
- Keep low-light gradients broad enough to survive 5-bit quantization.
- Avoid temporal noise or film grain that fights the stable ordered matrix.
- Any custom opaque world shader must implement the same display-space fog and dither contract or document why it is an approved cheat.
- Transparent glass and special screens are cheat paths. Do not cite them as proof that the core path can omit dither.

## Diffuse and emissive materials

Use `createPS2Material` for ordinary world meshes.

- Diffuse map and raw tint define the surface.
- Vertex normals and scene lights define form.
- An emissive map adds raw texture color after diffuse lighting.
- `fullbright` mixes the vertex light to white. Reserve it for lit faces, void cards, and authored signals.
- Distinguish metal, paint, plastic, concrete, and wet grime through diffuse art, silhouette, seams, and light response. Do not add runtime roughness or metalness.

If a material needs a new PBR property to read, revise its diffuse map, geometry, normals, or light placement first.

## Flashlight recipe

The flashlight is an approved modern cheat.

Owner paths:

- `src/game/Flashlight.tsx` poses the viewmodel, beam, light slot, and shadow camera.
- `src/ps2/torchShadow.ts` owns the 512x512 depth target and shadow matrix.
- `src/ps2/PS2Pipeline.tsx` schedules the flashlight depth render when equipped.
- `src/ps2/PS2Material.ts` evaluates its cone, Lambert term, attenuation, and one hard depth comparison per fragment.

Verify:

- the beam converges on the crosshair;
- the light pool stays circular on broad surfaces;
- the one-tap shadow remains hard and stable;
- the viewmodel and water do not enter the shadow/depth pre-passes;
- stowing the flashlight releases its light slot and disables the pass;
- unlit gameplay remains navigable enough to find and equip it.

Do not give ordinary fixtures the flashlight path. That would replace the core renderer and multiply shadow cost.

## Water recipe

`src/game/SewerWater.tsx` uses dual scrolling noise layers, small vertex displacement, per-vertex lights, display-space fog, local quantization, alpha, and depth-aware foam.

- `[Modern cheat]` The foam compares water fragment depth with the opaque depth target from `src/ps2/sceneDepth.ts`.
- Keep foam narrow, noisy, and restricted to true intersections.
- Tune flow and repeat to the sewer channel scale. Avoid a coherent plane-wide interference pattern.
- Keep waves small enough that collision and banks still read as solid.
- Inspect mip transitions in motion. Water intentionally uses trilinear minification because hard bands sweep visibly across its large moving plane.
- Verify water with `uFoamOn` disabled in editor/contact-sheet renders and enabled in the gameplay pipeline.

Do not add SSR, planar reflection, cube reflection, PBR transmission, or refraction. The surface should read through motion, diffuse color, lights, transparency, silhouette, and bounded foam.

## Glass recipe

`createGlassMaterial` in `src/engine/render.tsx` is a dirty transparent shader.

- `[Modern cheat]` It computes a per-fragment facing-ratio sheen and alpha variation from the grime texture.
- Keep `transparent: true`, `depthWrite: false`, and deliberate render order.
- Use dirty diffuse contrast so the pane remains visible when the sheen disappears.
- Check objects through the pane for sorting, fog, and gameplay readability.
- Limit pane layers. Transparent overdraw and sorting failures grow quickly.

Do not replace it with `MeshPhysicalMaterial`, transmission, IOR, or environment reflections.

## CCTV recipe

`src/ps2/cctv.ts` defines a 128x96 nearest-filtered target and a 0.25-second refresh interval. `src/game/Cctv.tsx` converts it to a lifted green monochrome screen with scanlines.

- `[Modern cheat]` The pipeline renders the yard from `cctvCamera` four times per second.
- Keep the feed low-rate and low-resolution. Smooth high-resolution CCTV loses the intended read and costs more.
- Verify the yard visibility override restores the player's zone-culling state.
- Keep the monitor large and bright enough to read inside the office at 512x448.
- Profile the periodic update for spikes, not only average frame time.

## CRT presentation recipe

The final blit in `src/ps2/PS2Pipeline.tsx` samples the fixed target with bilinear filtering, darkens alternating internal lines slightly, and applies mild corner falloff. The CSS frame then displays it at 4:3.

- `[DEADWATER policy]` The 512x448 target and 4:3 frame are this project's presentation choices, not universal PS2 limits.
- `[Modern cheat]` The line and corner treatment approximates CRT presentation in a browser.
- Keep the effect mild enough that the HUD and dark sewer remain readable.
- Verify at multiple desktop window sizes. The internal target must remain fixed while CSS presentation scales.
- Capture a visible canvas frame. Contact sheets cannot validate this pass.

## New shader or pass gate

Before adding shader code, answer:

1. Can scene composition, geometry, normals, diffuse art, emissive art, UV scale, or vertex density solve it?
2. Is the proposal part of the core path or a modern cheat?
3. Which exact file owns it?
4. Does it preserve gamma/display-space math and the core dither contract?
5. What samples, passes, transparency, vertices, programs, and render targets does it add?
6. What identical before and after view proves its value?
7. How is it disabled or reduced if the budget fails?

If any answer is missing, do not implement the shader or pass.
