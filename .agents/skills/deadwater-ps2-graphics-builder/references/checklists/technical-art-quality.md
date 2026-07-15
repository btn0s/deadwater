# DEADWATER technical-art checklist

Gate any graphics change that affects renderer structure, cost, imports, shaders, or completion claims.

- [ ] The technical-art contract in `references/technical-art.md` is filled before implementation.
- [ ] The visible problem and affected evidence views are concrete.
- [ ] Each renderer claim is classified as hardware fact, DEADWATER policy, or modern cheat.
- [ ] Hardware claims are narrow and do not turn project choices into console limits.
- [ ] Core path versus cheat path is explicit.
- [ ] Every change has a canonical repository owner and named consumers.
- [ ] Geometry and Gouraud vertex-cost impact is estimated and measured where practical.
- [ ] Texture, material, render-target, and program impact is estimated and measured.
- [ ] Light-slot impact accounts for the 20-slot compiled project array and flashlight reserve.
- [ ] Pass impact accounts for CCTV, opaque depth, optional flashlight depth, main scene, and blit.
- [ ] New full-scene passes default to rejected unless comparison evidence and measurement justify them.
- [ ] Imported assets report source and shipped diagnostics after PBR stripping.
- [ ] Modern cheats state purpose, owner, cost, bound, fallback, and enabled/disabled evidence.
- [ ] Per-pass counters are collected deliberately; last-render counters are not misread as total frame cost.
- [ ] Frame-time evidence names hardware, browser, build mode, view, and gameplay state.
- [ ] `window.__lightSlots()` is recorded when lighting changes.
- [ ] Contact sheets and a live final-pipeline frame are both used for broad visual work.
- [ ] Every unavailable metric is marked `not measured` rather than guessed.
- [ ] `npm run build` and `npm run lint` pass.
- [ ] The final report includes exact files, evidence, budget deltas, failed gates, and next pass.
