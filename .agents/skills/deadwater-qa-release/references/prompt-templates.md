# DEADWATER QA prompt templates

Use only the template that matches the request. Replace every placeholder with repo-specific facts before running it.

## Release pass

```text
Use $deadwater-qa-release to assess DEADWATER release readiness.

Target host and base path: [target]
Changed areas: [game/editor/scene/assets/audio/rendering]

Required evidence:
- Run npm run build and production preview.
- Verify / and the editor.html shipping policy.
- Capture console, page, network, canvas, and main-interaction evidence.
- Verify scene.json and changed asset paths.
- Exercise the changed zones with __teleport and player-height screenshots.
- Record __testCollision and __lightSlots output when relevant.
- Decide whether visual baselines and a scripted playtest need updates.
- Report pass, fail, or partial with artifacts and residual risks.
```

## Focused scene QA

```text
Use $deadwater-qa-release to verify this DEADWATER scene change.

Area: [warehouse/office/dock/sewer]
Scene nodes: [ids]
Expected visual and collision result: [result]

Run the dev game and editor. Validate scene.json, capture the area's contact sheet and a player-height screenshot, probe changed collision, inspect light slots, exercise the nearby interaction, and report objective canvas/browser evidence without applying generic brightness or fidelity scores.
```

## Visual baseline pass

```text
Use $deadwater-qa-release to add or update Playwright visual protection for DEADWATER.

State and camera pose: [label plus x,z,yaw]
Acceptance image: [what must remain visible/correct]
Dynamic systems: [water/flicker/rat/physics/CCTV/flashlight]

Use existing DEADWATER hooks, a fixed viewport, one WebGL worker, narrow masks, and repeated-run threshold calibration. Keep nonblank canvas and interaction assertions. Report update/compare commands, snapshots, masks, thresholds, and flake risks.
```

## Scripted playtest

```text
Use $deadwater-qa-release to create or run a DEADWATER Playwright playtest.

Start pose: [x,z,yaw]
Core path: [movement/door/switch/pickup/carry/flashlight/crowbar]
Expected state change: [result]

Drive real input after __devLock(true), sample __playerPos, use __testCollision and __lightSlots where relevant, release all keys and dev lock in cleanup, retain failure traces, and report state-based results rather than headless FPS.
```
