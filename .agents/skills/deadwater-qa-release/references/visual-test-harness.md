# DEADWATER visual test harness

Use Playwright screenshot baselines to protect stable scenes, editor layout, HUD placement, and imported assets. Keep nonblank canvas inspection and gameplay assertions alongside them.

## Add or update baselines when

- a player-facing camera composition, scene area, HUD, overlay, texture, model, material, light, fog, or shader changed;
- the editor hierarchy, inspector, asset stage, toolbar, or viewport changed;
- a prior visual regression would have been caught by a stable screenshot;
- a release claim needs repeatable evidence.

Skip a baseline when the state has no stable acceptance image or the change is better proven with a hook assertion. Report the reason.

## Stable states

Prefer named, player-height states tied to the scene:

| State | Setup |
| --- | --- |
| warehouse spawn | `__devLock(true)` then `__teleport(-18.3, 1.6, -1.35)` or current canonical spawn |
| office | teleport to a recorded office pose and wait for model loads |
| dock | teleport to a recorded dock pose and wait for water/CCTV as needed |
| sewer | teleport to a recorded sewer pose and wait for water |
| equipped flashlight | give/select the flashlight through the real interaction path or a narrowly scoped hook if one is added |
| editor scene | open `/editor.html`, select a stable node, and use a fixed camera pose |
| editor assets | open the asset tab after thumbnails finish |

Store canonical coordinates in the test, next to a label explaining what the camera must see. Do not hide them behind generic state names.

## Existing hooks

Use the repo's hooks directly:

```ts
await page.evaluate(() => {
  window.__devLock?.(true)
  window.__teleport?.(-18.3, 1.6, -1.35)
})
await expect.poll(() => page.evaluate(() => window.__playerPos?.())).toMatchObject({
  x: -18.3,
  z: 1.6,
})
```

There is no generic seed/freeze/state hook. If an unstable system prevents a valuable baseline, add the smallest dev-only control for that system and document it. Do not add a general test API preemptively.

## Dynamic systems

- Fluorescent flicker uses `Math.random()`. Baseline a non-flickering fixture or mask only the affected pool.
- Rats move and choose random timing. Exclude them from the acceptance area or add a narrow dev-only rat freeze if the rat itself is the subject.
- Water scrolls and deforms with elapsed time. Use a modest diff ratio or a targeted mask that leaves shoreline geometry visible.
- CCTV refreshes at 4 Hz. Wait for one update when the monitor is part of the screenshot.
- Physics debris settles differently across runs. Place it deterministically or baseline a static scene.
- The flashlight beam and shadow depend on view pose. Fix the camera and inventory state before capture.

Never mask a region that contains the asset, framing, collision alignment, or HUD behavior under test.

## Playwright pattern

Use one worker for WebGL:

```ts
import { expect, test } from '@playwright/test'

test('warehouse spawn remains framed at 4:3', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/')
  await page.locator('canvas').waitFor({ state: 'visible' })
  await page.evaluate(() => {
    window.__devLock?.(true)
    window.__teleport?.(-18.3, 1.6, -1.35)
  })
  await page.waitForTimeout(750)
  await expect(page.locator('.viewport')).toHaveScreenshot('warehouse-spawn.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  })
})
```

Choose the initial threshold from repeated local runs. Tighten it until real layout, asset, light, and HUD changes fail while known shader motion passes. Keep the exact threshold and masks in version control.

## Contact sheets

Contact sheets are broad layout artifacts, not direct visual baselines for the shipping view. `__sheet()` changes ambient and fog during capture and writes files through dev middleware. Use them for:

- missing or displaced scene nodes;
- zone coverage;
- large composition changes;
- review outside the browser.

Use normal player screenshots for fog, darkness, dither, flashlight, and HUD acceptance.

## Editor baselines

The editor renders at device pixel ratio with antialiasing and does not mount `PS2Pipeline`. Give it separate snapshots. Stabilize selected node, expanded hierarchy rows, inspector scroll, camera, and asset-thumbnail completion.

## Reporting

Report the decision, states, coordinates, viewport, update and compare commands, snapshot paths, thresholds, masks, repeat-run stability, and any dynamic systems left unprotected.
