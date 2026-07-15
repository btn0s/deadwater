# DEADWATER debug and profile prompt templates

## Runtime or editor bug

```text
Use $deadwater-debug-profiler to diagnose this DEADWATER issue.

Entry and URL:
Build mode:
Exact reproduction and state:
Expected:
Actual:
First console, network, shader, or audio error:
Recent change:

Identify the R3F, PS2Pipeline, raw-color shader, scene schema/store, asset loader, collision, pointer-lock, audio, or UI owner before editing. Retest the exact path plus the neighboring game/editor and production-preview paths.
```

## Multipass or shader bug

```text
Use $deadwater-debug-profiler to isolate this render problem.

Visible symptom:
Affected pass: CCTV, depth, torch shadow, main target, final blit, or unknown:
Torch and water state:
Shader compile/link log:
Target and uniform observations:

Preserve R3F frame ownership, the positive-priority PS2Pipeline callback, raw color, and 512x448 output. Check pass order and restoration before changing global lighting or color settings.
```

## Production performance pass

```text
Use $deadwater-debug-profiler to profile DEADWATER.

Target device/browser:
Entry, viewport, DPR, camera, and scene area:
Frame-time goal:
Torch, CCTV, water, physics, and editor state:
Known metrics:

Build and use production preview. Record frame-time distribution, multipass-aware renderer metrics, targets, bodies, colliders, textures, memory, and asset sizes. Change one measured bottleneck and rerun the identical scenario.
```

## Scene or editor data bug

```text
Use $deadwater-debug-profiler to diagnose this scene.json or editor issue.

Node ids and parents involved:
Components involved:
Editor operation and save response:
Game behavior:
Expected undo, prefab, or instance behavior:

Validate the flat node graph, schema/renderer/inspector alignment, sceneStore history, dev-only /__scene save path, and game/editor mode separation. Verify reload in both entries.
```
