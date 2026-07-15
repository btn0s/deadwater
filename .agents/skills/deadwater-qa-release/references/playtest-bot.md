# DEADWATER scripted playtest

A scripted playtest proves browser input changes the player and reaches the changed interaction. It complements manual play, collision probes, screenshots, and canvas smoke.

## Test contract

Use Playwright with one worker. Open `/`, enable dev lock, read `__playerPos()`, send real keyboard and pointer input, and read the position again. Treat headless time as unreliable. Base assertions on state changes and generous polling windows.

The current dev contract is:

```ts
type PlayerPos = { x: number; z: number; yaw: number }
window.__devLock(value: boolean): void
window.__teleport(x: number, z: number, yaw?: number): void
window.__playerPos(): PlayerPos
window.__testCollision(x: number, z: number, dx: number, dz: number, radius: number):
  PlayerPos & { colliders: number }
window.__lightSlots(): Array<{
  used: boolean
  pos: number[]
  color: number[]
  radius: number
  spot: number
}>
```

Do not require score, fail, wave, or generic game-state diagnostics. DEADWATER currently has exploration and interaction paths rather than a score loop.

## Core movement test

1. Wait for the canvas and hooks.
2. Call `__devLock(true)` and teleport to an open, recorded pose.
3. Hold `KeyW` for a bounded interval.
4. Release the key in `finally` cleanup.
5. Assert finite position and displacement above a declared threshold.
6. Hold a strafe key against known geometry and confirm the player slides rather than enters it.
7. Call `__devLock(false)` during cleanup.

## Path and interaction scripts

Write one short script per changed behavior:

- door: start near the door, press `KeyE`, assert the target coordinates;
- switch: capture `__lightSlots()`, press `KeyE`, assert the circuit colors change as expected;
- pickup: press `KeyE`, select a hotbar slot, assert the item or viewmodel state through visible UI or a narrowly added hook;
- carry/throw: aim, click to grab, move, click to throw, assert the body leaves its starting bounds;
- flashlight: equip, assert one extra light slot becomes used, stow, assert it releases;
- crowbar: equip and click, assert the intended dynamic body receives motion or verify the impact path manually if no stable hook exists.

Use teleports to remove uninteresting traversal. Record every coordinate and why it is safe.

## Softlock signal

Sample `__playerPos()` while a movement key is held. Count a softlock window only when:

- dev lock remains true;
- the game has focus;
- the script is not intentionally pressing into a blocking wall;
- position remains unchanged across several samples;
- no door fade or other expected transition is active.

Report the samples. Do not infer softlocks from low headless frame rate.

## Collision and light diagnostics

Use `__testCollision()` for deterministic boundary assertions before the live movement test. Use `__lightSlots()` to catch leaks and exhaustion. Read `MAX_LIGHTS` from source rather than copying a number into the test.

## Failure capture

On failure retain the Playwright trace, screenshot, start pose, input log, hook samples, console/page errors, failed requests, and collision/light output. A bot report without reproduction data is not useful.

## Reporting

Report added, updated, run, or skipped; command; browser mode; start poses; input steps; player samples; collision/light results; interactions reached; errors; trace/screenshot paths; and nondeterministic gaps.
