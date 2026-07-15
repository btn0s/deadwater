# Visual test harness checklist

- Decision is explicit: added, updated, run, or skipped.
- Baselines protect a stable, valuable DEADWATER state rather than a generic title screen.
- Fixed viewport, DPR 1, game URL, and player pose are recorded.
- Setup uses `__devLock`, `__teleport`, and `__playerPos`; no nonexistent generic scaffold hooks are assumed.
- Dynamic flicker, water, CCTV refresh, flashlight beam, physics debris, and random rat motion are stabilized, masked narrowly, or excluded with a reason.
- Baselines cover the changed player-height view and relevant HUD state.
- Contact sheets may supplement baselines but do not replace the shipping camera.
- The editor receives separate baselines when editor UI or placement behavior changed.
- Fonts, GLTF/FBX models, textures, and first rendered frames are awaited.
- Screenshot thresholds are low enough to detect framing, asset, lighting, and UI regressions.
- Canvas nonblank smoke and interaction tests remain in the suite.
- Update command, compare command, snapshot paths, masks, thresholds, and flake risks are reported.
