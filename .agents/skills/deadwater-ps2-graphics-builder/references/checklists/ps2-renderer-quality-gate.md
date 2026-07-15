# DEADWATER PS2 renderer quality gate

Use before declaring a broad graphics or renderer pass complete.

- [ ] Every renderer claim is labeled hardware fact, DEADWATER policy, or modern cheat.
- [ ] No project constant is presented as a universal PS2 hardware limit.
- [ ] Gamma/display-space color remains intact for the ordinary scene path.
- [ ] Ordinary world materials remain diffuse plus optional emissive.
- [ ] Runtime metalness, roughness, normal, AO, clearcoat, transmission, IBL, and stock PBR materials are absent from shipped world rendering.
- [ ] Ordinary scene lights remain per vertex in `src/ps2/PS2Material.ts`.
- [ ] The main target remains fixed at 512x448 in `src/ps2/PS2Pipeline.tsx`.
- [ ] The visible game remains 4:3 through `.viewport` in `src/index.css`.
- [ ] Core opaque output retains the 4x4 ordered dither and 5-bit-per-channel quantization.
- [ ] Ordinary textures pass through `prepTexture`: bilinear magnification, hard mip transitions, anisotropy 1, raw sampling.
- [ ] No global PSX affine wobble, vertex snapping, or nearest-only pixelation has been added.
- [ ] Imported glTF/FBX materials are converted by `applyPS2Materials` in `src/engine/render.tsx`.
- [ ] `MAX_LIGHTS = 20` is treated as a DEADWATER compile-time shader budget, with a slot reserved for the flashlight.
- [ ] `window.__lightSlots()` shows no leaks or unexpected exhaustion after mount, interaction, and teardown.
- [ ] Flashlight shadowing remains a bounded per-fragment modern cheat.
- [ ] Depth-aware water foam remains a bounded modern cheat and the depth pre-pass excludes registered water/viewmodel objects.
- [ ] Texture bombing is enabled only on broad surfaces where comparison evidence shows less repetition.
- [ ] Glass sheen remains a limited dirty-glass cheat, not PBR transmission.
- [ ] CCTV remains low-resolution and low-rate, and its temporary visibility override restores correctly.
- [ ] CRT line and corner treatment remains mild and is verified in a live final-pipeline frame.
- [ ] Every new shader or full-scene pass has an owner, purpose, cost, fallback, and enabled/disabled capture.
- [ ] Per-pass renderer counts, frame time, texture/program counts, and light-slot state are reported or explicitly marked not measured.
- [ ] Relevant live gameplay, flashlight, water, glass, CCTV, darkness, and interaction states pass.
- [ ] Refreshed contact sheets cover the affected areas, and no contact sheet is misreported as final CRT evidence.
- [ ] `npm run build` passes.
- [ ] `npm run lint` passes.
- [ ] `references/visual-scorecard.md` passes the renderer-conformant gate.
