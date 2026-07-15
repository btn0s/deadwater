# Performance-safe visual detail checklist

Gate geometry density, texture use, repeated detail, transparent surfaces, shaders, and pass changes.

- [ ] The technical-art contract names the target desktop, browser, build mode, worst view, and flashlight state.
- [ ] Main-pass calls and triangles are measured separately from depth, flashlight shadow, CCTV, and blit.
- [ ] The report does not quote the final blit counters as if they describe the whole frame.
- [ ] Main-view calls are at or below the 250 starting target, or baseline overage and non-regression are documented.
- [ ] Main-view triangles are at or below the 400k starting target, or baseline overage and non-regression are documented.
- [ ] Live geometries, textures, render targets, and shader programs are counted against `references/technical-art.md`.
- [ ] Median and p95 frame time meet the named target or the exact failure is reported.
- [ ] Vertex density is spent on silhouette and Gouraud interpolation visible at 512x448.
- [ ] Hidden and subpixel geometry was removed or justified.
- [ ] Collision geometry remains separate from visual detail.
- [ ] Repeated props reuse registry assets, scene instances, geometry, and materials where the engine permits it.
- [ ] Texture sources are the smallest size that survives the gameplay camera.
- [ ] Texture bombing's three-sample cost is restricted to surfaces where it materially improves repetition.
- [ ] Transparent glass layers and overdraw are bounded.
- [ ] Flashlight shadow cost is measured equipped versus stowed.
- [ ] CCTV periodic spikes are inspected, not hidden inside an average.
- [ ] Water depth-prepass cost is included in frame accounting.
- [ ] No new full-scene pass was added without purpose, cost, fallback, and comparison evidence.
- [ ] Generated textures, geometries, materials, and render targets have clear ownership and disposal.
- [ ] The worst interactive scene remains playable and visually readable after the detail pass.
