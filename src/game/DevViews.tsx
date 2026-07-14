import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ambientColor, fogSettings } from '../ps2/PS2Material'

/**
 * Dev-only contact sheets: renders placed cameras into an offscreen target
 * (the visible canvas is untouched), composites labeled grids, and POSTs
 * PNGs to the dev server, which overwrites them in the project root.
 *
 *   window.__sheet()          -> writes ALL sheets
 *   window.__sheet('office')  -> writes contact-sheet-office.png only
 *
 * Sets: '' (overall), 'office', 'dock', 'sewer'
 */

const TILE_W = 512
const TILE_H = 384
const COLS = 3

interface View {
  label: string
  camera: THREE.Camera
}

function look(cam: THREE.Camera, pos: [number, number, number], at: [number, number, number]) {
  cam.position.set(...pos)
  cam.lookAt(...at)
  cam.updateMatrixWorld()
  return cam
}

const persp = (fov: number) => new THREE.PerspectiveCamera(fov, TILE_W / TILE_H, 0.1, 200)
const ortho = (hw: number) => {
  const hh = hw * (TILE_H / TILE_W)
  return new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.1, 200)
}

function makeViewSets(): Record<string, View[]> {
  return {
    '': [
      { label: 'map top-down', camera: look(ortho(26), [-1, 60, -11], [-1, 0, -11.01]) },
      { label: 'sewer top-down', camera: look(ortho(13.5), [-10, 60, -27], [-10, 0, -27.01]) },
      { label: 'warehouse iso', camera: look(persp(55), [17, 9, 10], [-5, 0, -5]) },
      { label: 'channel from east', camera: look(persp(60), [0.5, 1.2, -27], [-20, -0.8, -27]) },
      { label: 'dock bays', camera: look(persp(62), [11, 2.4, -5.5], [20, 1.4, 0.5]) },
      { label: 'office', camera: look(persp(62), [-11, 2.4, 4], [-18.6, 1.2, 0.2]) },
    ],
    office: [
      { label: 'office plan (under roof)', camera: look(ortho(4.5), [-17.9, 2.85, 0], [-17.9, 0, -0.01]) },
      { label: 'exterior from floor', camera: look(persp(60), [-10, 1.8, 3.5], [-18, 1.4, 0]) },
      { label: 'through window', camera: look(persp(55), [-14.2, 1.7, 0.7], [-18, 0.9, 1.4]) },
      { label: 'interior from door', camera: look(persp(70), [-16.3, 1.7, -1.7], [-18.5, 0.8, 2]) },
      { label: 'desk corner', camera: look(persp(65), [-18.6, 1.6, -0.5], [-16.3, 0.7, 2.2]) },
      { label: 'from desk chair', camera: look(persp(65), [-17, 1.4, 1], [-13, 1.2, -3]) },
    ],
    dock: [
      { label: 'dock top-down', camera: look(ortho(9), [15, 30, 0], [15, 0, -0.01]) },
      { label: 'all bays', camera: look(persp(62), [11, 2.4, -5.5], [20, 1.4, 0.5]) },
      { label: 'bay close-up', camera: look(persp(58), [16.5, 1.6, 3.5], [20, 1.6, 7]) },
      { label: 'from spawn', camera: look(persp(60), [15, 1.65, 8.5], [0, 1, -5]) },
      { label: 'down the wall', camera: look(persp(60), [18.8, 1.7, -10.5], [18.8, 1, 10]) },
      { label: 'racking row', camera: look(persp(60), [7, 2.2, 6], [7, 0.9, 11.5]) },
    ],
    sewer: [
      { label: 'sewer top-down', camera: look(ortho(13.5), [-10, 60, -27], [-10, 0, -27.01]) },
      { label: 'from hallway', camera: look(persp(60), [-10, 2, -19], [-10, -0.5, -29]) },
      { label: 'channel from east', camera: look(persp(60), [0.5, 1.2, -27], [-20, -0.8, -27]) },
      { label: 'pump station', camera: look(persp(60), [-11, 1.8, -25], [-16.5, 1, -32.5]) },
      { label: 'bridge', camera: look(persp(62), [-4, 1.8, -22.5], [0, -0.2, -28]) },
      { label: 'west grate', camera: look(persp(58), [-16, 0.6, -27], [-22, -0.6, -27]) },
    ],
  }
}

async function renderSheet(gl: THREE.WebGLRenderer, scene: THREE.Scene, name: string, views: View[]): Promise<string> {
  const rows = Math.ceil(views.length / COLS)
  const target = new THREE.WebGLRenderTarget(TILE_W, TILE_H, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
  })

  const sheet = document.createElement('canvas')
  sheet.width = TILE_W * COLS
  sheet.height = TILE_H * rows
  const ctx = sheet.getContext('2d')!

  // lift fog + ambient so review views stay readable, restore after
  const savedNear = fogSettings.near.value
  const savedFar = fogSettings.far.value
  const savedAmbient = ambientColor.clone()
  fogSettings.near.value = 500
  fogSettings.far.value = 1000
  ambientColor.multiplyScalar(4)

  const prevTarget = gl.getRenderTarget()
  const pixels = new Uint8Array(TILE_W * TILE_H * 4)
  const image = ctx.createImageData(TILE_W, TILE_H)

  views.forEach((v, i) => {
    gl.setRenderTarget(target)
    gl.clear()
    gl.render(scene, v.camera)
    gl.readRenderTargetPixels(target, 0, 0, TILE_W, TILE_H, pixels)
    // flip rows (GL origin is bottom-left)
    for (let row = 0; row < TILE_H; row++) {
      const src = (TILE_H - 1 - row) * TILE_W * 4
      image.data.set(pixels.subarray(src, src + TILE_W * 4), row * TILE_W * 4)
    }
    const x = (i % COLS) * TILE_W
    const y = Math.floor(i / COLS) * TILE_H
    ctx.putImageData(image, x, y)
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(x, y, 190, 24)
    ctx.fillStyle = '#9fe0a0'
    ctx.font = '14px monospace'
    ctx.fillText(v.label, x + 8, y + 17)
  })

  gl.setRenderTarget(prevTarget)
  target.dispose()
  fogSettings.near.value = savedNear
  fogSettings.far.value = savedFar
  ambientColor.copy(savedAmbient)

  const res = await fetch(`/__sheet?name=${name}`, { method: 'POST', body: sheet.toDataURL('image/png') })
  const file = name ? `contact-sheet-${name}.png` : 'contact-sheet.png'
  return res.ok ? `${file} written` : `${file} save failed: ${res.status}`
}

export function DevViews() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    ;(window as unknown as Record<string, unknown>).__sheet = async (which?: string) => {
      const sets = makeViewSets()
      const names = which !== undefined ? [which] : Object.keys(sets)
      const results = []
      for (const n of names) {
        if (!sets[n]) return `unknown sheet '${n}' (have: ${Object.keys(sets).join(', ')})`
        results.push(await renderSheet(gl, scene, n, sets[n]))
      }
      return results.join('; ')
    }
    return () => {
      delete (window as unknown as Record<string, unknown>).__sheet
    }
  }, [gl, scene])

  return null
}
