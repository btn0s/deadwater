import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const url = process.argv[2] ?? 'http://127.0.0.1:5173/'
const artifactDir = 'artifacts/interaction-playtest'
await mkdir(artifactDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 960 } })
const errors = { console: [], page: [], requests: [] }
const steps = []

function captureErrors(targetPage) {
  targetPage.on('console', (message) => {
    if (message.type() === 'error') errors.console.push(message.text())
  })
  targetPage.on('pageerror', (error) => errors.page.push(error.message))
  targetPage.on('requestfailed', (request) => {
    errors.requests.push(`${request.method()} ${request.url()}`)
  })
}
captureErrors(page)

async function state() {
  return page.evaluate(() => window.__interactionState())
}

async function canvasCenter() {
  const box = await page.locator('canvas').boundingBox()
  assert.ok(box, 'game canvas must be visible')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function click(button) {
  const point = await canvasCenter()
  await page.mouse.click(point.x, point.y, { button })
}

async function pressE() {
  await page.keyboard.press('KeyE')
}

async function teleport(pose, prompt) {
  // Keep Playwright's absolute cursor parked at the reticle before setting
  // pitch; otherwise its travel from a UI button is interpreted as mouse-look.
  const point = await canvasCenter()
  await page.mouse.move(point.x, point.y)
  await page.evaluate(([x, z, yaw, pitch]) => window.__teleport(x, z, yaw, pitch), pose)
  await page.waitForTimeout(150)
  if (prompt) {
    await page.waitForFunction(
      (label) => document.querySelector('.use-prompt')?.textContent?.includes(label),
      prompt,
      { timeout: 10_000 },
    )
  }
}

async function assertPrompt(label, crosshairClass) {
  const prompt = page.locator('.use-prompt')
  assert.match(await prompt.innerText(), new RegExp(`^E\\s+${label}`))
  if (crosshairClass) {
    await expectClass(page.locator('.crosshair'), crosshairClass)
  }
}

async function expectClass(locator, className) {
  await page.waitForFunction(
    ([selector, expected]) => document.querySelector(selector)?.classList.contains(expected),
    [await locator.evaluate((element) => `.${[...element.classList].join('.')}`), className],
  )
}

function controlSlice(snapshot) {
  return {
    inventory: snapshot.inventory,
    flashlight: snapshot.flashlight,
    actions: snapshot.actions,
    heldNode: snapshot.carry.held?.nodeId ?? null,
  }
}

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'CLOCK IN' }).click()
  await page.waitForFunction(
    () => typeof window.__interactionState === 'function' && typeof window.__teleport === 'function',
    undefined,
    { timeout: 20_000 },
  )
  await page.evaluate(() => document.exitPointerLock?.())
  await page.waitForFunction(() => document.pointerLockElement === null)
  await page.evaluate(() => window.__devLock(true))
  await page.waitForFunction(() => window.__lightSlots().filter((slot) => slot.used).length >= 10, undefined, {
    timeout: 20_000,
  })

  const initial = await state()
  assert.equal(initial.inventory.slots.length, 4)
  assert.equal(initial.inventory.carryLock, false)
  assert.equal(await page.locator('.hotbar-slot').count(), 4)
  assert.doesNotMatch(await page.locator('.hotbar').innerText(), /HANDS/)
  const authoredLights = await page.evaluate(() => window.__lightSlots().filter((slot) => slot.used).length)
  steps.push({ name: 'four usable inventory slots', authoredLights })

  // E takes a world item. LMB owns the selected item's action; RMB and F do nothing.
  await teleport([-18.3, 1.6, -1.35, -0.37], 'TAKE TORCH')
  await assertPrompt('TAKE TORCH', 'on-grabbable')
  await pressE()
  await page.waitForFunction(() => window.__interactionState().inventory.slots[0]?.id === 'flashlight')
  let current = await state()
  assert.equal(current.inventory.active, 0)
  assert.equal(current.inventory.stowed, false)
  assert.equal(current.flashlight.powered, false)
  assert.match(await page.locator('.hotbar-slot').first().innerText(), /1[\s\S]*TORCH/)

  await click('left')
  await page.waitForFunction(() => window.__interactionState().flashlight.powered === true)
  assert.equal(
    await page.evaluate(() => window.__lightSlots().filter((slot) => slot.used).length),
    authoredLights + 1,
  )
  const beforeReservedInputs = controlSlice(await state())
  await click('right')
  await page.keyboard.press('KeyF')
  await page.waitForTimeout(150)
  assert.deepEqual(controlSlice(await state()), beforeReservedInputs)

  // H toggles holster/draw without changing the selected slot. Holstering
  // powers the torch down; drawing it again never turns it on implicitly.
  await page.keyboard.press('KeyH')
  await page.waitForFunction(() => {
    const snapshot = window.__interactionState()
    return snapshot.inventory.stowed && !snapshot.flashlight.powered
  })
  assert.equal((await state()).inventory.active, 0)
  assert.ok(await page.locator('.hotbar-slot').first().evaluate((element) => element.classList.contains('stowed')))
  await page.keyboard.press('KeyH')
  await page.waitForFunction(() => !window.__interactionState().inventory.stowed)
  assert.equal((await state()).flashlight.powered, false)
  await click('left')
  await page.waitForFunction(() => window.__interactionState().flashlight.powered)
  steps.push({ name: 'E pickup, LMB torch action, H holster, reserved inputs inert' })

  // E world actions remain available while a tool is equipped and do not
  // accidentally dispatch that tool's LMB action.
  await teleport([-17.2, -0.81, -Math.PI / 2, -0.3], 'MAIN LIGHTS')
  await assertPrompt('MAIN LIGHTS', 'on-interactable')
  const groupsBeforeTorchSwitch = (await state()).disabledLightGroups
  await pressE()
  await page.waitForFunction(
    (before) => JSON.stringify(window.__interactionState().disabledLightGroups) !== JSON.stringify(before),
    groupsBeforeTorchSwitch,
  )
  current = await state()
  assert.equal(current.inventory.active, 0)
  assert.equal(current.inventory.stowed, false)
  assert.equal(current.flashlight.powered, true)
  await pressE()
  await page.waitForFunction(
    (before) => JSON.stringify(window.__interactionState().disabledLightGroups) === JSON.stringify(before),
    groupsBeforeTorchSwitch,
  )
  steps.push({ name: 'E world action with equipped torch' })

  // E on a two-hand box suppresses the selected tool without changing its
  // slot/holster choice. The authored pose stays centered and follows yaw.
  await teleport([8, 2.1, -Math.PI / 2, -0.75], 'PICK UP')
  await assertPrompt('PICK UP', 'on-grabbable')
  await pressE()
  await page.waitForFunction(() => window.__interactionState().carry.held?.carryStyle === 'twoHand')
  await page.waitForFunction(() => !window.__interactionState().flashlight.powered)
  current = await state()
  assert.equal(current.inventory.active, 0)
  assert.equal(current.inventory.stowed, false)
  assert.equal(current.inventory.carryLock, true)
  assert.equal(current.flashlight.powered, false)
  assert.equal(current.carry.held.bodyType, 'kinematicPosition')
  const heldBoxNode = current.carry.held.nodeId
  const firstBoxQuaternion = current.carry.held.quaternion

  await teleport([8, 2.1, 0, -0.2])
  await page.waitForFunction(
    (quaternion) => {
      const next = window.__interactionState().carry.held?.quaternion
      return next && Math.hypot(...next.map((value, index) => value - quaternion[index])) > 0.25
    },
    firstBoxQuaternion,
  )
  current = await state()
  const [boxX, , boxZ] = current.carry.held.position
  const player = await page.evaluate(() => window.__playerPos())
  const dx = boxX - player.x
  const dz = boxZ - player.z
  const lateral = dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw)
  const forward = -dx * Math.sin(player.yaw) - dz * Math.cos(player.yaw)
  assert.ok(Math.abs(lateral) < 0.12, `two-hand carry drifted laterally by ${lateral}`)
  assert.ok(forward > 0.35, `two-hand carry was not in front (${forward})`)
  await page.screenshot({ path: `${artifactDir}/two-hand-box.png` })

  // An aimed world action wins over put-down while carrying. E operates the
  // switch and the box remains held; away from an action E puts it down.
  await teleport([-17.2, -0.81, -Math.PI / 2, -0.3], 'MAIN LIGHTS')
  await assertPrompt('MAIN LIGHTS', 'on-interactable')
  await page.screenshot({ path: `${artifactDir}/box-switch-priority.png` })
  const groupsBeforeCarrySwitch = (await state()).disabledLightGroups
  await pressE()
  await page.waitForFunction(
    (before) => JSON.stringify(window.__interactionState().disabledLightGroups) !== JSON.stringify(before),
    groupsBeforeCarrySwitch,
  )
  assert.equal((await state()).carry.held?.nodeId, heldBoxNode)
  await pressE()
  await page.waitForFunction(
    (before) => JSON.stringify(window.__interactionState().disabledLightGroups) === JSON.stringify(before),
    groupsBeforeCarrySwitch,
  )
  assert.equal((await state()).carry.held?.nodeId, heldBoxNode)

  await teleport([8, 2.1, 0, -0.7], 'PUT DOWN')
  await assertPrompt('PUT DOWN', 'holding')
  await pressE()
  await page.waitForFunction(() => window.__interactionState().carry.held === null)
  current = await state()
  assert.equal(current.inventory.active, 0)
  assert.equal(current.inventory.stowed, false)
  assert.equal(current.inventory.carryLock, false)
  assert.equal(current.flashlight.powered, false)
  assert.equal(current.carry.lastReleased.bodyType, 'dynamic')
  assert.ok(current.carry.lastReleased.placement, 'put-down did not resolve the crosshair surface')
  const placement = current.carry.lastReleased.placement
  const placementOffset = current.carry.lastReleased.position.map(
    (value, index) => value - placement.point[index],
  )
  assert.ok(
    placementOffset.reduce((sum, value, index) => sum + value * placement.normal[index], 0) > 0.1,
    'put-down did not leave surface clearance toward the player',
  )
  const [vx, , vz] = current.carry.lastReleased.linearVelocity
  assert.ok(Math.hypot(vx, vz) < 0.35, 'put-down injected horizontal throw velocity')
  assert.ok(Math.hypot(...current.carry.lastReleased.angularVelocity) < 0.35, 'put-down injected spin')
  steps.push({
    name: 'two-hand carry, switch priority, and surface placement',
    nodeId: current.carry.lastReleased.nodeId,
    lateral,
    forward,
    placement,
  })

  // One-hand metadata puts the prop at the right grip and still follows the
  // view rotation. With no reachable surface, E drops it at the hand pose.
  await teleport([-16.5, -7.5, -1.8, -0.65], 'PICK UP')
  await page.waitForFunction(() => window.__interactionState().aim.grabbableStyle === 'oneHand')
  await assertPrompt('PICK UP', 'on-grabbable')
  await pressE()
  await page.waitForFunction(() => window.__interactionState().carry.held?.carryStyle === 'oneHand')
  current = await state()
  const oneHandQuaternion = current.carry.held.quaternion
  const [oneX, , oneZ] = current.carry.held.position
  const onePlayer = await page.evaluate(() => window.__playerPos())
  const oneLateral =
    (oneX - onePlayer.x) * Math.cos(onePlayer.yaw) -
    (oneZ - onePlayer.z) * Math.sin(onePlayer.yaw)
  assert.ok(oneLateral > 0.2, `one-hand pickup was not in the right hand (${oneLateral})`)
  await page.screenshot({ path: `${artifactDir}/one-hand-right.png` })
  await teleport([-16.5, -7.5, -0.35, -0.2], 'PUT DOWN')
  await page.waitForFunction(
    (quaternion) => {
      const next = window.__interactionState().carry.held?.quaternion
      return next && Math.hypot(...next.map((value, index) => value - quaternion[index])) > 0.2
    },
    oneHandQuaternion,
  )
  await assertPrompt('PUT DOWN', 'holding')
  const oneHandNode = (await state()).carry.held.nodeId
  await pressE()
  await page.waitForFunction(() => window.__interactionState().carry.held === null)
  current = await state()
  assert.equal(current.carry.lastReleased.placement, null, 'distant crosshair surface should fall back to a drop')
  assert.equal(current.inventory.active, 0)
  assert.equal(current.inventory.stowed, false)
  assert.equal(current.flashlight.powered, false)
  steps.push({ name: 'one-hand right-side rotation and distant-surface drop', nodeId: oneHandNode })

  // E acquires the crowbar into the next usable slot; LMB swings it.
  await teleport([7.4, 10, Math.PI, -0.38], 'TAKE CROWBAR')
  await assertPrompt('TAKE CROWBAR', 'on-grabbable')
  await pressE()
  await page.waitForFunction(() => window.__interactionState().inventory.slots[1]?.id === 'crowbar')
  current = await state()
  assert.equal(current.inventory.active, 1)
  assert.equal(current.inventory.stowed, false)
  const swingsBefore = current.actions.crowbar ?? 0
  await click('left')
  await page.waitForFunction((count) => (window.__interactionState().actions.crowbar ?? 0) > count, swingsBefore)
  steps.push({ name: 'E crowbar pickup and LMB swing' })

  // Quit while carrying must restore the body and clear transient carry and
  // draw state without erasing acquired inventory.
  await teleport([16.2, -2.6, -Math.PI / 2, -0.72], 'PICK UP')
  await page.waitForFunction(() => window.__interactionState().aim.grabbableStyle === 'twoHand')
  await pressE()
  await page.waitForFunction(() => window.__interactionState().carry.held !== null)
  await page.evaluate(() => window.__devLock(false))
  const pauseCopy = (await page.locator('.overlay.pause .keys').allInnerTexts()).join(' ')
  assert.match(pauseCopy, /E INTERACT \/ PICK UP \/ PUT DOWN/)
  assert.match(pauseCopy, /LMB ITEM ACTION/)
  assert.match(pauseCopy, /H HOLSTER \/ DRAW/)
  assert.match(pauseCopy, /RMB RESERVED/)
  assert.match(pauseCopy, /F UNBOUND/)
  await page.getByRole('button', { name: 'QUIT TO TITLE' }).click()
  await page.waitForSelector('.overlay.menu')
  current = await state()
  assert.equal(current.carry.held, null)
  assert.equal(current.inventory.carryLock, false)
  assert.equal(current.inventory.stowed, true)
  assert.equal(current.inventory.slots[0]?.id, 'flashlight')
  assert.equal(current.inventory.slots[1]?.id, 'crowbar')
  assert.equal(current.carry.lastReleased.bodyType, 'dynamic')
  steps.push({ name: 'quit carry cleanup and classic control copy' })

  // The authored carry style remains visible and editable in the real editor.
  const editor = await browser.newPage({ viewport: { width: 1280, height: 960 } })
  captureErrors(editor)
  await editor.goto(new URL('/editor.html', url).href, { waitUntil: 'domcontentloaded' })
  await editor.waitForFunction(() => typeof window.__sceneStore === 'object')
  await editor.evaluate(() => window.__sceneStore.select('stage-can'))
  await editor.waitForFunction(() => document.querySelector('.ed-id')?.textContent?.includes('stage-can'))
  const carryStyleSelect = editor.locator('label.ed-field.wide', { hasText: 'carry style' }).locator('select')
  assert.equal(await carryStyleSelect.inputValue(), 'twoHand')
  assert.deepEqual(await carryStyleSelect.locator('option').allTextContents(), ['—', 'oneHand', 'twoHand'])
  await editor.screenshot({ path: `${artifactDir}/editor-carry-style.png` })
  await editor.close()
  steps.push({ name: 'editor carry-style schema' })

  assert.deepEqual(errors, { console: [], page: [], requests: [] })
  const result = { pass: true, url, authoredLights, steps, errors }
  await writeFile(`${artifactDir}/result.json`, `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  await page.screenshot({ path: `${artifactDir}/failure.png`, fullPage: true }).catch(() => {})
  const result = { pass: false, url, steps, errors, error: error.stack ?? String(error) }
  await writeFile(`${artifactDir}/result.json`, `${JSON.stringify(result, null, 2)}\n`)
  console.error(JSON.stringify(result, null, 2))
  process.exitCode = 1
} finally {
  await browser.close()
}
