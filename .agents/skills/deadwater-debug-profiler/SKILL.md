---
name: deadwater-debug-profiler
description: Use when diagnosing or profiling DEADWATER's R3F frames, PS2Pipeline passes, shaders, raw-color output, scene.json and editor state, GLTF or FBX models, Rapier bodies, pointer lock, audio unlock, hooks, or production performance.
---

# DEADWATER debug profiler

## Core contract

Reproduce first, identify the owning system, and fix the root cause without replacing DEADWATER's React Three Fiber architecture, fixed PS2-era renderer, scene-data model, or game/editor split. Measure performance in the real multipass pipeline and in production preview when user-facing cost matters.

## Required references

Track loaded files in a reference ledger with `yes/no`, path, and any load failure.

- Load `references/debug-profile-checklists.md` for every debug or profiling task.
- Load `references/checklists/scene-debugging.md` for render, shader, asset, `scene.json`, editor, physics, input, audio, hook, or runtime bugs.
- Load `references/checklists/performance-profile.md` for frame time, renderer metrics, shader cost, render targets, memory, asset cost, or production profiling.
- Load `references/checklists/mobile-input.md` for coarse-pointer detection, the mobile gate, pointer-lock capability, or mobile behavior.
- Load `references/prompt-templates.md` only for reusable prompt requests.

## Triage order

1. Reproduce with the same URL, entry point, interaction, scene location, and build mode.
2. Read the first console, page, network, shader, and Web Audio error before editing.
3. Decide the owner: React/R3F lifecycle, `useFrame`, `PS2Pipeline`, shader/raw color, scene schema or store, asset loader, Rapier/custom collision, pointer lock, audio, DOM/CSS, Vite middleware, or performance.
4. Form one falsifiable hypothesis and gather the narrowest evidence that can reject it.
5. Fix the root cause in the owner. Avoid compensating changes in unrelated CSS, camera, global lighting, or physics.
6. Retest the exact broken path, then nearby game/editor and production paths.

## Architecture facts

- `App.tsx` owns the `@react-three/fiber` game Canvas. `EditorApp.tsx` owns a separate editor Canvas and Vite entry.
- Ordinary gameplay and editor `useFrame` callbacks update state at default priority.
- `PS2Pipeline` uses positive render priority `1`, which takes over R3F automatic rendering. It renders CCTV when due, an opaque depth prepass, an optional torch shadow pass, the main 512x448 target, and the final screen blit.
- `scene.json` is a flat node table with parent ids. `SceneRoot` indexes it and `NodeView` renders typed components.
- Editor mutations live in `sceneStore`; SAVE posts the node table to the dev-only `/__scene` middleware.
- The game uses custom AABB player navigation plus Rapier bodies and a kinematic player capsule.
- `SettleSim` in `App.tsx` is a boot-only exception that pins Rapier to 1/60 and advances 90 steps when rigid-body count changes during its first five seconds; the boot fade hides that work.
- Textures and colors intentionally use a raw gamma-space path through `prepTexture`, `rawColor`, and custom `ShaderMaterial` uniforms.
- GLTF uses Drei `useGLTF`; FBX uses `useFBX` plus an explicit texture and scale normalization.
- Pointer-lock entry also supplies the user gesture that unlocks Web Audio.
- Development verification includes `window.__sheet`, teleport, collision, inventory, light, and editor-store hooks.

## Debug rules

- Never add another frame loop or ordinary positive-priority `useFrame` callback as a quick fix.
- Do not remove `PS2Pipeline` to make the image appear unless the test is a temporary isolation step and the real fix restores it.
- Do not apply generic sRGB, tone mapping, physically based material, shadow-map, or composer fixes to the raw-color pipeline.
- Do not patch generated runtime nodes when the source problem is invalid `scene.json`, schema drift, or editor save behavior.
- Do not replace GLTF or FBX materials without preserving the PS2 material swap and texture preparation.
- Do not make Rapier own player navigation while the custom AABB controller remains active.
- Do not call R3F hooks outside Canvas or conditionally change hook order.
- Keep diagnostics development-only and avoid high-frequency console logging during profiles.

## Performance rules

- Establish a repeatable camera, player position, scene area, pointer-lock state, viewport, DPR, browser, and warmup period.
- Start steady-state profiles after the boot fade and `SettleSim` window. Profile the settle burst separately when load behavior is the subject.
- Profile `npm run build` followed by `npm run preview` for user-facing conclusions.
- Record CPU frame time and GPU or render evidence separately.
- Interpret `renderer.info.render.calls` in the context of multiple scene renders per frame. A main frame can include depth, torch, CCTV, final color, and blit work.
- Measure render-target memory: main color, scene depth, torch shadow, CCTV, thumbnail, and contact-sheet targets as applicable.
- Compare the same pipeline and camera before and after each optimization.
- Verify final image, water foam, torch shadow, CCTV, editor thumbnails, contact sheets, pointer lock, physics, and audio after changes that touch shared rendering or lifecycle code.

## Completion report

Lead with the root cause or measured bottleneck. Include reproduction, owner, evidence, reference ledger, changed files, baseline and post-change metrics, commands, exact game and editor paths retested, production-preview evidence, screenshots or contact sheets, and residual risk.
