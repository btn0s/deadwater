---
name: deadwater-qa-release
description: Use when verifying DEADWATER gameplay, editor behavior, rendering, scene data, browser regressions, production builds, release readiness, screenshots, Playwright baselines, or scripted playtests.
---

# DEADWATER QA and release

## Purpose

Prove the game and editor work through their real browser entry points. Treat DEADWATER's dark PS2 image as intentional. Objective smoke checks can prove that the canvas rendered, assets loaded, controls moved the player, collision responded, and budgets did not drift. They cannot grade art direction.

## Required references

Before broad QA, load `references/qa-release-checklists.md` and the checklists relevant to the change:

- `references/checklists/visual-verification.md` for screenshots and canvas inspection.
- `references/checklists/playtest-qa.md` for gameplay and interaction changes.
- `references/checklists/release.md` for production output.
- `references/visual-test-harness.md` plus its checklist for visual baselines.
- `references/playtest-bot.md` plus its checklist for scripted playtests.
- `references/prompt-templates.md` only when reusable task prompts are requested.

Record each loaded reference and any deliberate skip. Do not claim release readiness without the main checklist.

## Project truth

- Dev game: `http://127.0.0.1:5173/`
- Dev editor: `http://127.0.0.1:5173/editor.html`
- Scene source: `src/engine/scene.json`
- Production command: `npm run build`
- Production preview: `npm run preview -- --host 127.0.0.1`
- Game presentation: fixed 512x448 internal render target, bilinear upscale, fixed 4:3 projection and 4:3 viewport.
- Contact sheets: `window.__sheet()`, or `__sheet('office' | 'dock' | 'sewer')` in dev.
- Player hooks: `__devLock(true)`, `__teleport(x, z, yaw)`, `__playerPos()` in dev.
- Diagnostics: `__testCollision(x, z, dx, dz, radius)`, `__lightSlots()` in dev.
- Editor diagnostics: `__sceneStore` and `__lightSlots()` in dev.

Do not invent `__THREE_GAME_TEST_HOOKS__` or generic score/state diagnostics. Add a new hook only when a test needs a stable fact the existing hooks cannot expose.

## QA workflow

1. Inspect the diff, `package.json`, `vite.config.ts`, affected scene nodes, and asset paths.
2. Run `npm run build`. Run `npm run lint` when source code changed.
3. Start the dev server. Verify `/` and `/editor.html` separately.
4. Capture console errors, page errors, failed requests, canvas dimensions, nonblank pixels, hook availability, and an objective render sample.
5. Wait for the boot fade and bounded Rapier settle window before visual or steady-state performance conclusions; test that window separately when load settling changed.
6. Use `__devLock(true)` before scripted keyboard input. Compare `__playerPos()` before and after movement.
7. Use targeted teleports for the warehouse, office, dock, and sewer. Capture views at player height as well as contact sheets.
8. Call `__testCollision()` for changed walls, doors, props, or boundaries. Inspect `__lightSlots()` after light or scene changes.
9. Exercise interactions affected by the change: pickup, carry, throw, flashlight, crowbar, doors, switches, audio, and editor save/undo/placement as applicable.
10. Decide whether to add or update Playwright visual baselines and a scripted playtest. Report each decision as added, updated, run, or skipped with a concrete reason.
11. Run the production build through the preview server. Expect dev-only hooks to be absent there. Repeat canvas, console, network, and main-interaction smoke checks.
12. Report pass/fail, evidence, changed risks, and untested scope.

Mobile is not a default target. Test narrow or touch layouts only when the current task adds that target. A mobile screenshot alone does not establish support.

## Canvas inspector

Use the bundled inspector after the server is ready:

```bash
node .agents/skills/deadwater-qa-release/scripts/inspect-deadwater-canvas.mjs \
  --url http://127.0.0.1:5173/ --mode game --lock \
  --teleport=-18.3,1.6,-1.35

node .agents/skills/deadwater-qa-release/scripts/inspect-deadwater-canvas.mjs \
  --url http://127.0.0.1:5173/editor.html --mode editor
```

The inspector writes a screenshot and JSON report. It fails on a blank or tiny canvas, console/page errors, failed asset requests, wrong game framing, missing expected dev hooks, or an invalid collision/light diagnostic. Pixel distribution and WebGL counters are descriptive evidence. Never convert entropy, edge density, brightness, or triangle count into a generic visual-quality score.

Game inspection enters through the real CLOCK IN button before reading gameplay hooks. Add `--menu` to keep and capture the initial harbor menu instead.

Useful options:

```bash
--sheet office
--menu
--collision=-18,1,1,0,0.35
--keys=KeyW:800,KeyD:400
--production
--viewport=1280x960
```

Read `--help` for the complete interface.

## Release evidence

Lead with pass or fail. Include:

- commands, URLs, browser mode, and commit/diff scope;
- game and editor results;
- controls and paths exercised;
- hook outputs, canvas report, contact sheets, screenshots, and baseline artifacts;
- build output and production-preview result;
- console, page, network, asset, scene-data, light-slot, collision, and audio findings;
- visual-harness and bot-playtest decisions;
- residual risks and anything not tested.
