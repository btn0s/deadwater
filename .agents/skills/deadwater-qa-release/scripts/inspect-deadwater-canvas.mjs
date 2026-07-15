#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PNG } from 'pngjs'

async function loadChromium() {
  for (const packageName of ['@playwright/test', 'playwright']) {
    try {
      const module = await import(packageName)
      if (module.chromium) return module.chromium
    } catch (error) {
      if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error
    }
  }
  throw new Error('Playwright is required. Install @playwright/test in the project, then run this script again.')
}

function parseTuple(value, count, name) {
  const values = value.split(',').map(Number)
  if (values.length !== count || values.some((item) => !Number.isFinite(item))) {
    throw new Error(`${name} expects ${count} comma-separated numbers`)
  }
  return values
}

function parseArgs(argv) {
  const args = {
    url: 'http://127.0.0.1:5173/',
    mode: 'game',
    out: 'artifacts/deadwater-canvas',
    wait: 900,
    sample: 600,
    viewport: [1280, 960],
    production: false,
    menu: false,
    lock: false,
    teleport: null,
    collision: null,
    keys: [],
    sheet: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    const next = () => {
      const result = argv[++index]
      if (result === undefined) throw new Error(`${value} requires a value`)
      return result
    }
    if (value === '--url') args.url = next()
    else if (value === '--mode') args.mode = next()
    else if (value === '--out') args.out = next()
    else if (value === '--wait') args.wait = Number(next())
    else if (value === '--sample') args.sample = Number(next())
    else if (value === '--viewport') args.viewport = parseTuple(next().replace('x', ','), 2, '--viewport')
    else if (value === '--production') args.production = true
    else if (value === '--menu') args.menu = true
    else if (value === '--lock') args.lock = true
    else if (value === '--teleport') args.teleport = parseTuple(next(), 3, '--teleport')
    else if (value.startsWith('--teleport=')) args.teleport = parseTuple(value.slice(11), 3, '--teleport')
    else if (value === '--collision') args.collision = parseTuple(next(), 5, '--collision')
    else if (value.startsWith('--collision=')) args.collision = parseTuple(value.slice(12), 5, '--collision')
    else if (value === '--keys') args.keys = parseKeys(next())
    else if (value.startsWith('--keys=')) args.keys = parseKeys(value.slice(7))
    else if (value === '--sheet') args.sheet = next()
    else if (value === '-h' || value === '--help') {
      console.log(`Usage: inspect-deadwater-canvas.mjs [options]

  --url URL                 target URL, default http://127.0.0.1:5173/
  --mode game|editor        expected entry point and hook set
  --out DIR                 artifact directory
  --viewport WIDTHxHEIGHT   browser viewport, default 1280x960
  --wait MS                 settle time before actions
  --sample MS               render-counter sample duration
  --production              expect dev-only hooks to be absent
  --menu                    keep the initial CLOCK IN menu instead of entering play
  --lock                    call __devLock(true) before input
  --teleport=x,z,yaw        call __teleport before capture
  --collision=x,z,dx,dz,r   call __testCollision and validate its output
  --keys=Code:ms,...        press sequential keyboard inputs
  --sheet all|office|dock|sewer

The JSON report contains objective smoke data. Pixel distribution and render
counters describe the capture; they are not visual-quality scores.`)
      process.exit(0)
    } else throw new Error(`Unknown argument: ${value}`)
  }

  if (!['game', 'editor'].includes(args.mode)) throw new Error('--mode must be game or editor')
  if (args.viewport.some((item) => !Number.isFinite(item) || item < 128)) throw new Error('invalid --viewport')
  if (![args.wait, args.sample].every((item) => Number.isFinite(item) && item >= 0)) throw new Error('invalid wait/sample time')
  return args
}

function parseKeys(value) {
  if (!value) return []
  return value.split(',').map((entry) => {
    const [code, durationText] = entry.split(':')
    const duration = Number(durationText)
    if (!code || !Number.isFinite(duration) || duration < 0) throw new Error(`invalid key step: ${entry}`)
    return { code, duration }
  })
}

function slug(value) {
  return value.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
}

function round(value, digits = 2) {
  return Number(Number(value).toFixed(digits))
}

const renderProbe = () => {
  const state = {
    frames: 0,
    calls: 0,
    triangles: 0,
    texturesCreated: 0,
    texturesDeleted: 0,
    buffersCreated: 0,
    buffersDeleted: 0,
  }

  const triangleCount = (mode, count, instances = 1) => {
    if (mode === 4) return Math.floor(count / 3) * instances
    if (mode === 5 || mode === 6) return Math.max(0, count - 2) * instances
    return 0
  }

  const patch = (prototype, name, before) => {
    if (!prototype || typeof prototype[name] !== 'function') return
    const original = prototype[name]
    try {
      prototype[name] = function (...args) {
        before(args)
        return Reflect.apply(original, this, args)
      }
    } catch {
      // Some browsers lock native prototypes. Missing counters remain explicit.
    }
  }

  for (const prototype of [globalThis.WebGLRenderingContext?.prototype, globalThis.WebGL2RenderingContext?.prototype]) {
    patch(prototype, 'drawArrays', ([mode, , count]) => {
      state.calls += 1
      state.triangles += triangleCount(mode, count)
    })
    patch(prototype, 'drawElements', ([mode, count]) => {
      state.calls += 1
      state.triangles += triangleCount(mode, count)
    })
    patch(prototype, 'drawArraysInstanced', ([mode, , count, instances]) => {
      state.calls += 1
      state.triangles += triangleCount(mode, count, instances)
    })
    patch(prototype, 'drawElementsInstanced', ([mode, count, , , instances]) => {
      state.calls += 1
      state.triangles += triangleCount(mode, count, instances)
    })
    patch(prototype, 'createTexture', () => { state.texturesCreated += 1 })
    patch(prototype, 'deleteTexture', () => { state.texturesDeleted += 1 })
    patch(prototype, 'createBuffer', () => { state.buffersCreated += 1 })
    patch(prototype, 'deleteBuffer', () => { state.buffersDeleted += 1 })
  }

  const originalRaf = globalThis.requestAnimationFrame.bind(globalThis)
  globalThis.requestAnimationFrame = (callback) => originalRaf((time) => {
    state.frames += 1
    callback(time)
  })

  globalThis.__DEADWATER_RENDER_PROBE__ = {
    reset() {
      for (const key of Object.keys(state)) state[key] = 0
    },
    snapshot() {
      return { ...state }
    },
  }
}

async function canvasSnapshot(page) {
  const geometry = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const viewport = document.querySelector('.viewport')
    if (!canvas) return { ok: false, reason: 'missing-canvas' }

    const rect = canvas.getBoundingClientRect()
    const viewportRect = viewport?.getBoundingClientRect() ?? null
    if (rect.width < 32 || rect.height < 32) {
      return { ok: false, reason: 'canvas-too-small', rect: rect.toJSON() }
    }
    return {
      ok: true,
      canvas: {
        css: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        drawingBuffer: { width: canvas.width, height: canvas.height },
        cssAspect: rect.width / rect.height,
      },
      viewport: viewportRect ? {
        width: viewportRect.width,
        height: viewportRect.height,
        aspect: viewportRect.width / viewportRect.height,
      } : null,
      internalFramebufferExpected: { width: 512, height: 448, displayAspect: 4 / 3 },
    }
  })

  if (!geometry.ok) return geometry
  const screenshot = await page.locator('canvas').first().screenshot({ type: 'png' })
  const image = PNG.sync.read(screenshot)
  const buckets = new Map()
  const luminance = []
  let opaque = 0
  let min = 255
  let max = 0
  const strideX = Math.max(1, Math.floor(image.width / 160))
  const strideY = Math.max(1, Math.floor(image.height / 120))
  for (let y = 0; y < image.height; y += strideY) {
    for (let x = 0; x < image.width; x += strideX) {
      const index = (y * image.width + x) * 4
      const r = image.data[index]
      const g = image.data[index + 1]
      const b = image.data[index + 2]
      const a = image.data[index + 3]
      if (a > 0) opaque += 1
      min = Math.min(min, r, g, b)
      max = Math.max(max, r, g, b)
      luminance.push(0.2126 * r + 0.7152 * g + 0.0722 * b)
      const key = `${r >> 4},${g >> 4},${b >> 4},${a >> 6}`
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }
  }
  luminance.sort((a, b) => a - b)
  const p5 = luminance[Math.floor(luminance.length * 0.05)]
  const p95 = luminance[Math.floor(luminance.length * 0.95)]
  const dominant = Math.max(...buckets.values())
  const pixelCount = luminance.length
  const nonblank = opaque > pixelCount * 0.8 && (max - min > 5 || buckets.size > 3)
  return {
    ...geometry,
    ok: nonblank,
    reason: nonblank ? 'nonblank' : 'low-variance-or-transparent',
    pixels: {
      sample: { pixels: pixelCount, strideX, strideY },
      opaqueShare: opaque / pixelCount,
      channelRange: max - min,
      colorBuckets: buckets.size,
      dominantBucketShare: dominant / pixelCount,
      luminanceP5: p5,
      luminanceP95: p95,
      luminanceRange: p95 - p5,
      interpretation: 'descriptive smoke data from a Playwright canvas screenshot, not an art-quality score',
    },
  }
}

async function readHooks(page) {
  return page.evaluate(() => {
    const names = ['__sheet', '__teleport', '__playerPos', '__devLock', '__testCollision', '__lightSlots', '__sceneStore']
    return Object.fromEntries(names.map((name) => [name, typeof window[name] === 'function' || Boolean(window[name])]))
  })
}

async function resourceSummary(page) {
  return page.evaluate(() => {
    const groups = {
      model: /\.(gltf|glb|fbx)(\?|$)/i,
      texture: /\.(png|jpe?g|webp|ktx2)(\?|$)/i,
      audio: /\.(ogg|mp3|wav|m4a)(\?|$)/i,
      script: /\.(js|mjs)(\?|$)/i,
      style: /\.css(\?|$)/i,
    }
    const result = Object.fromEntries(Object.keys(groups).map((key) => [key, { requests: 0, transferBytes: 0 }]))
    for (const entry of performance.getEntriesByType('resource')) {
      for (const [name, pattern] of Object.entries(groups)) {
        if (pattern.test(entry.name)) {
          result[name].requests += 1
          result[name].transferBytes += entry.transferSize || 0
          break
        }
      }
    }
    return result
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const chromium = await loadChromium()
  await mkdir(args.out, { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: args.viewport[0], height: args.viewport[1] },
    deviceScaleFactor: 1,
  })
  await context.addInitScript(renderProbe)
  const page = await context.newPage()
  const consoleErrors = []
  const consoleWarnings = []
  const pageErrors = []
  const requestFailures = []
  const httpFailures = []

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
    if (message.type() === 'warning') consoleWarnings.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('requestfailed', (request) => requestFailures.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' }))
  page.on('response', (response) => {
    if (response.status() >= 400) httpFailures.push({ url: response.url(), status: response.status() })
  })

  await page.goto(args.url, { waitUntil: 'networkidle' })
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15_000 })
  await page.waitForTimeout(args.wait)

  if (args.mode === 'game' && !args.menu) {
    const clockIn = page.locator('button.clock-in')
    if (await clockIn.isVisible().catch(() => false)) {
      await page.evaluate(() => {
        HTMLCanvasElement.prototype.requestPointerLock = () => Promise.resolve()
      })
      await clockIn.click()
      // CLOCK IN deliberately cuts to gameplay after its cover reaches black.
      // Give the delayed phase transition enough time to mount PlayerController.
      await page.waitForTimeout(Math.max(args.wait, 600))
    }
  }

  const hooks = await readHooks(page)
  const allDevHooks = Object.keys(hooks)
  const requiredHooks = args.mode === 'game'
    ? (args.menu ? ['__lightSlots'] : ['__sheet', '__teleport', '__playerPos', '__devLock', '__testCollision', '__lightSlots'])
    : ['__sceneStore', '__lightSlots']
  const missingDevHooks = args.production ? [] : requiredHooks.filter((name) => !hooks[name])
  const leakedProductionHooks = args.production ? allDevHooks.filter((name) => hooks[name]) : []

  let beforePlayer = hooks.__playerPos ? await page.evaluate(() => window.__playerPos()) : null
  if (args.lock && hooks.__devLock) await page.evaluate(() => window.__devLock(true))
  if (args.teleport && hooks.__teleport) {
    await page.evaluate(([x, z, yaw]) => window.__teleport(x, z, yaw), args.teleport)
    beforePlayer = await page.evaluate(() => window.__playerPos?.() ?? null)
  }

  const inputLog = []
  try {
    for (const step of args.keys) {
      await page.keyboard.down(step.code)
      await page.waitForTimeout(step.duration)
      await page.keyboard.up(step.code)
      inputLog.push(step)
    }
  } finally {
    for (const step of args.keys) await page.keyboard.up(step.code).catch(() => {})
  }
  const afterPlayer = hooks.__playerPos ? await page.evaluate(() => window.__playerPos()) : null

  let collision = null
  if (args.collision) {
    collision = hooks.__testCollision
      ? await page.evaluate((values) => window.__testCollision(...values), args.collision)
      : { error: 'missing __testCollision' }
  }
  const lights = hooks.__lightSlots ? await page.evaluate(() => window.__lightSlots()) : null
  const invalidLights = Array.isArray(lights)
    ? lights.filter((slot) => slot.used && (![...slot.pos, ...slot.color, slot.radius, slot.spot].every(Number.isFinite)))
    : []

  let sheet = null
  if (args.sheet !== null) {
    const area = args.sheet === 'all' ? undefined : args.sheet
    sheet = hooks.__sheet
      ? await page.evaluate((value) => window.__sheet(value), area)
      : 'missing __sheet'
  }

  await page.evaluate(() => window.__DEADWATER_RENDER_PROBE__?.reset())
  await page.waitForTimeout(args.sample)
  const renderRaw = await page.evaluate(() => window.__DEADWATER_RENDER_PROBE__?.snapshot() ?? null)
  const renderSample = renderRaw ? {
    durationMs: args.sample,
    ...renderRaw,
    callsPerFrame: renderRaw.frames ? round(renderRaw.calls / renderRaw.frames) : null,
    submittedTrianglesPerFrame: renderRaw.frames ? round(renderRaw.triangles / renderRaw.frames) : null,
    interpretation: 'submitted WebGL work during this capture; compare with a baseline, do not treat as a universal budget',
  } : null

  const canvas = await canvasSnapshot(page)
  const resources = await resourceSummary(page)
  const stateName = args.mode === 'game' ? (args.menu ? 'menu' : 'play') : 'workspace'
  const name = `${args.mode}-${stateName}-${args.production ? 'production' : 'dev'}-${slug(args.url)}`
  const screenshotPath = path.join(args.out, `${name}.png`)
  const reportPath = path.join(args.out, `${name}.json`)
  await page.screenshot({ path: screenshotPath, fullPage: true })

  if (args.lock && hooks.__devLock) await page.evaluate(() => window.__devLock(false))
  await browser.close()

  const gameAspectOk = args.mode !== 'game' || Boolean(canvas.viewport && Math.abs(canvas.viewport.aspect - 4 / 3) < 0.02)
  const collisionOk = !args.collision || (
    collision && !collision.error && [collision.x, collision.z, collision.colliders].every(Number.isFinite)
  )
  const pass = canvas.ok && gameAspectOk && collisionOk && invalidLights.length === 0 &&
    missingDevHooks.length === 0 && leakedProductionHooks.length === 0 &&
    consoleErrors.length === 0 && pageErrors.length === 0 && requestFailures.length === 0 && httpFailures.length === 0

  const report = {
    pass,
    url: args.url,
    mode: args.mode,
    menu: args.menu,
    production: args.production,
    viewport: { width: args.viewport[0], height: args.viewport[1], deviceScaleFactor: 1 },
    screenshotPath,
    canvas,
    gameAspectOk,
    hooks,
    missingDevHooks,
    leakedProductionHooks,
    player: { before: beforePlayer, after: afterPlayer, inputLog },
    collision,
    lights: Array.isArray(lights) ? {
      total: lights.length,
      used: lights.filter((slot) => slot.used).length,
      invalidUsedSlots: invalidLights,
      slots: lights,
    } : null,
    sheet,
    renderSample,
    resources,
    consoleErrors,
    consoleWarnings,
    pageErrors,
    requestFailures,
    httpFailures,
  }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ ...report, reportPath }, null, 2))
  if (!pass) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
