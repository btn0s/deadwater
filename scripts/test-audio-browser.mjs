#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { chromium } from '@playwright/test'

const root = process.cwd()
const production = process.argv.includes('--production')

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      probe.close((error) => error ? reject(error) : resolve(address.port))
    })
  })
}

async function waitForServer(url, processHandle) {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`Vite exited with ${processHandle.exitCode}`)
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // The server has not bound its port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

function stop(processHandle) {
  if (processHandle.exitCode === null) processHandle.kill('SIGTERM')
}

const port = await freePort()
const url = `http://127.0.0.1:${port}`
const viteArgs = [
  'node_modules/vite/bin/vite.js',
  ...(production ? ['preview'] : []),
  '--host', '127.0.0.1',
  '--port', String(port),
  '--strictPort',
]
const vite = spawn(process.execPath, viteArgs, { cwd: root, stdio: 'ignore' })

let browser
try {
  await waitForServer(url, vite)
  browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } })
  const failures = []
  const soundResponses = new Set()

  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => failures.push(`page: ${error.message}`))
  page.on('requestfailed', (request) => failures.push(`request: ${request.url()} ${request.failure()?.errorText ?? ''}`))
  page.on('response', (response) => {
    const parsed = new URL(response.url())
    if (parsed.pathname.startsWith('/sounds/') && response.ok()) soundResponses.add(parsed.pathname)
    if (response.status() >= 400) failures.push(`http ${response.status()}: ${response.url()}`)
  })

  await page.goto(`${url}/`, { waitUntil: 'domcontentloaded' })
  await page.locator('.clock-in').click()
  await page.waitForFunction(() => document.querySelector('.clock-in') === null, null, { timeout: 10_000 })

  if (production) {
    await page.waitForFunction(() => performance.getEntriesByType('resource')
      .filter((entry) => new URL(entry.name).pathname.startsWith('/sounds/')).length >= 86, null, { timeout: 15_000 })
    const hookType = await page.evaluate(() => typeof window.__audioState)
    if (hookType !== 'undefined') failures.push('production build exposed the __audioState development hook')
  } else {
    await page.waitForFunction(() => {
      const state = window.__audioState?.()
      return state?.contextState === 'running' && state.loadedCues === 30 && state.loadedBuffers === 86
    }, null, { timeout: 15_000 })

    await page.evaluate(() => {
      window.__devLock?.(true)
      window.__teleport?.(-18.3, 1.6, -1.35)
    })
    await page.waitForFunction(() => window.__audioState?.().ambience === 'ambience_warehouse')

    // Advance in sub-teleport increments so this audio contract does not
    // depend on whichever cargo happens to be settling beside the spawn.
    // The general canvas playtest covers keyboard locomotion and collision.
    for (let step = 1; step <= 12; step += 1) {
      await page.evaluate((x) => window.__teleport?.(x, 1.6, -1.35), -18.3 + step * 0.5)
      await page.waitForTimeout(60)
    }
    // Keep the key down across several animation frames; an instantaneous
    // press can fall entirely between useFrame samples in headless Chromium.
    await page.keyboard.down('Space')
    await page.waitForTimeout(120)
    await page.keyboard.up('Space')
    await page.waitForTimeout(120)
    await page.waitForFunction(() => {
      const starts = window.__audioState?.().starts ?? {}
      return (starts.step_concrete ?? 0) > 0 && (starts.cloth_move ?? 0) > 0 && (starts.jump ?? 0) > 0
    }, null, { timeout: 5_000 })

    await page.evaluate(() => window.__teleport?.(-10, -22.5, 0))
    await page.waitForFunction(() => {
      const state = window.__audioState?.()
      return state?.ambience === 'ambience_sewer' && (state.starts.stinger_sewer ?? 0) === 1
    })

    await page.evaluate(() => window.__teleport?.(31, 0, 0))
    await page.waitForFunction(() => window.__audioState?.().ambience === 'ambience_harbor')

    let state = await page.evaluate(() => window.__audioState?.())
    if ((state?.failures?.length ?? 0) > 0) failures.push(`audio loader: ${state.failures.join(', ')}`)
    if ((state?.starts?.stinger_clock_in ?? 0) !== 1) failures.push('clock-in stinger did not start exactly once')

    await page.evaluate(() => window.__devLock?.(false))
    await page.locator('.menu-button.quit').click()
    await page.waitForSelector('.clock-in', { state: 'visible' })
    await page.waitForFunction(() => {
      const stopped = window.__audioState?.()
      return stopped?.ambience === null && stopped.activeVoices === 0
    })
    state = await page.evaluate(() => window.__audioState?.())
    console.log(JSON.stringify(state, null, 2))
  }

  if (soundResponses.size !== 86) failures.push(`expected 86 unique sound responses, received ${soundResponses.size}`)
  if (failures.length) throw new Error(failures.join('\n'))
  console.log(`DEADWATER ${production ? 'production ' : ''}audio browser test passed (${soundResponses.size} assets).`)
} finally {
  await browser?.close()
  stop(vite)
}
