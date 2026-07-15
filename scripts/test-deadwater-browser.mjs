#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import os from 'node:os'
import path from 'node:path'

const root = process.cwd()
const inspector = path.join(root, '.agents/skills/deadwater-qa-release/scripts/inspect-deadwater-canvas.mjs')
const artifacts = mkdtempSync(path.join(os.tmpdir(), 'deadwater-browser-test-'))

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

function inspect(label, args) {
  const result = spawnSync(process.execPath, [inspector, ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  if (result.status === 0) return
  process.stderr.write(`${label} failed. Artifacts retained at ${artifacts}\n`)
  process.stderr.write(result.stdout)
  process.stderr.write(result.stderr)
  throw new Error(`${label} exited with ${result.status}`)
}

function stop(processHandle) {
  if (processHandle.exitCode === null) processHandle.kill('SIGTERM')
}

const port = await freePort()
const url = `http://127.0.0.1:${port}`
const vite = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: root, stdio: 'ignore' },
)

let passed = false
try {
  await waitForServer(url, vite)
  inspect('game canvas inspection', [
    '--url', `${url}/`, '--mode', 'game', '--lock', '--teleport=-18.3,1.6,-1.35',
    '--wait', '100', '--sample', '100', '--out', artifacts,
  ])
  inspect('editor canvas inspection', [
    '--url', `${url}/editor.html`, '--mode', 'editor',
    '--wait', '100', '--sample', '100', '--out', artifacts,
  ])

  const reports = readdirSync(artifacts).filter((name) => name.endsWith('.json'))
  if (reports.length !== 2) throw new Error(`Expected two inspector reports, found ${reports.length}`)
  for (const report of reports) {
    const result = JSON.parse(readFileSync(path.join(artifacts, report), 'utf8'))
    if (result.pass !== true) throw new Error(`${report} did not report pass=true`)
  }
  passed = true
  console.log('DEADWATER browser skill tests passed for game and editor canvases.')
} finally {
  stop(vite)
  if (passed) rmSync(artifacts, { recursive: true, force: true })
}
