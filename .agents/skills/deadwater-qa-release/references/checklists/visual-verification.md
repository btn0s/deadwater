# Visual verification checklist

- Open the correct game or editor URL and identify it in the report.
- Capture console errors, page errors, failed requests, and HTTP failures.
- Confirm the canvas has nonzero CSS and drawing-buffer dimensions.
- In game mode, confirm the `.viewport` is 4:3. Treat the 512x448 internal target as a code/config invariant because it is offscreen.
- Capture a full-page screenshot and sample canvas pixels for nonblank output.
- Record pixel range and distribution as diagnostics, not artistic grades.
- In dev game mode, confirm `__sheet`, `__teleport`, `__playerPos`, `__devLock`, `__testCollision`, and `__lightSlots` exist.
- In dev editor mode, confirm `__sceneStore` and `__lightSlots` exist.
- Capture contact sheets for the changed area: overall, office, dock, or sewer.
- Also capture player-height views. Contact sheets raise ambient and fog distance, so they do not represent the final game image.
- Check dark detail, fog, 5-bit dither, texture sampling, fixture glow, water, CCTV, and flashlight only where the change touches them.
- Check HUD overlap, 4:3 placement, overlay state, and text fit.
- Use screenshots at the fixed test viewport used by existing baselines.
- Test narrow/mobile framing only when that target is explicitly in scope.
- Keep canvas smoke, interaction checks, and visual baselines as separate evidence.
