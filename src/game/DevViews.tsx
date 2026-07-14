import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ambientColor, fogSettings } from '../ps2/PS2Material'

/**
 * Dev-only contact sheet: renders the level from six placed cameras into an
 * offscreen target (the visible canvas is untouched), composites a labeled
 * 3x2 grid, and POSTs the PNG to the dev server, which overwrites
 * contact-sheet.png in the project root. Trigger with window.__sheet().
 */

const TILE_W = 512
const TILE_H = 384

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

function makeViews(): View[] {
  const persp = (fov: number) => {
    const c = new THREE.PerspectiveCamera(fov, TILE_W / TILE_H, 0.1, 200)
    return c
  }
  const ortho = (hw: number) => {
    const hh = hw * (TILE_H / TILE_W)
    return new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.1, 200)
  }
  return [
    { label: 'map top-down', camera: look(ortho(26), [-1, 60, -11], [-1, 0, -11.01]) },
    { label: 'sewer top-down', camera: look(ortho(13.5), [-10, 60, -27], [-10, 0, -27.01]) },
    { label: 'warehouse iso', camera: look(persp(55), [17, 9, 10], [-5, 0, -5]) },
    { label: 'channel from east', camera: look(persp(60), [0.5, 1.2, -27], [-20, -0.8, -27]) },
    { label: 'dock bays', camera: look(persp(62), [11, 2.4, -5.5], [20, 1.4, 0.5]) },
    { label: 'office', camera: look(persp(62), [-11.5, 2.4, 5], [-18.5, 1, 9.8]) },
  ]
}

async function renderSheet(gl: THREE.WebGLRenderer, scene: THREE.Scene): Promise<string> {
  const views = makeViews()
  const target = new THREE.WebGLRenderTarget(TILE_W, TILE_H, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
  })

  const sheet = document.createElement('canvas')
  sheet.width = TILE_W * 3
  sheet.height = TILE_H * 2
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
    const x = (i % 3) * TILE_W
    const y = Math.floor(i / 3) * TILE_H
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

  const res = await fetch('/__sheet', { method: 'POST', body: sheet.toDataURL('image/png') })
  return res.ok ? 'contact-sheet.png written' : 'save failed: ' + res.status
}

export function DevViews() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    ;(window as unknown as Record<string, unknown>).__sheet = () => renderSheet(gl, scene)
    return () => {
      delete (window as unknown as Record<string, unknown>).__sheet
    }
  }, [gl, scene])

  return null
}
