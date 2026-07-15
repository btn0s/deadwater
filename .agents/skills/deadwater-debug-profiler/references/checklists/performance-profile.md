# DEADWATER performance profile checklist

- Record browser, device, viewport, Canvas CSS size, DPR, entry, camera, player position, torch state, and warmup.
- Run `npm run build` and profile `npm run preview` for player-facing conclusions.
- Record frame-time distribution plus renderer calls, triangles, lines, points, geometries, and textures.
- Interpret render calls against depth, optional torch, intermittent CCTV, main color, and final blit passes.
- Inventory render targets and dimensions, including main color, scene depth, torch, CCTV, thumbnails, and contact sheets when active.
- Count visible nodes, dynamic Rapier bodies, colliders, split model pieces, animated actors, and per-frame raycasts.
- Check per-frame allocations, React rerenders, listener duplication, and high-frequency DOM or console work.
- Inspect texture dimensions, model sizes, material clones, and disposal after unmount or HMR.
- Separate CPU update, physics, GPU draw, GPU vertex, GPU fragment, memory, and network bottlenecks.
- Do not recommend game DPR changes before accounting for the fixed 512x448 target; measure editor DPR separately.
- Optimize one measured cause and repeat the identical scenario.
- Verify final color, water foam, torch shadow, CCTV, pointer lock, audio, physics, editor viewport, and dev capture paths after shared changes.
