import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh'
import {
  lightPositions,
  lightColors,
  lightRadii,
  lightSpots,
  lightDirs,
  lightCones,
  lightBaked,
  ambientColor,
  MAX_LIGHTS,
} from '../ps2/PS2Material'
import { waterMeshes } from '../ps2/sceneDepth'

/**
 * In-browser lightmap baker (dev only). window.__bake() walks every surface
 * mesh, rasterizes a luxel grid across it, and for each luxel accumulates
 * the scene's baked-flagged lights with BVH shadow rays — walls finally
 * block light. Results are written to public/lightmaps/ through the
 * /__lightmap middleware (plus a manifest the renderer checks at load).
 *
 * Stored at half intensity; the shader multiplies by 2 (Quake overbright).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(THREE.Mesh.prototype as any).raycast = acceleratedRaycast

const safeName = (id: string) => id.replace(/[^a-zA-Z0-9-]/g, '_')

function isExcluded(o: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = o
  while (cur) {
    if (cur.userData.grabbable || cur.userData.noBake) return true
    if (waterMeshes.has(cur)) return true
    cur = cur.parent
  }
  return false
}

export function LightmapBaker() {
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    if (!import.meta.env.DEV) return

    const bake = async (luxelsPerMeter = 3) => {
      // ---- collect bake targets + occluders from the live scene ----
      const surfaces: { mesh: THREE.Mesh; id: string; w: number; h: number }[] = []
      const occluders: THREE.Mesh[] = []
      scene.updateMatrixWorld(true)
      scene.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || isExcluded(o)) return
        occluders.push(o)
        if (o.userData.bakeSurface) {
          // nearest named ancestor group is the scene node
          let p: THREE.Object3D | null = o.parent
          while (p && !p.name) p = p.parent
          const geo = o.geometry as THREE.PlaneGeometry
          const { width, height } = geo.parameters
          if (p?.name) surfaces.push({ mesh: o, id: p.name, w: width, h: height })
        }
      })
      for (const m of occluders) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = m.geometry as any
        if (!g.boundsTree) g.computeBoundsTree()
      }
      const lights: number[] = []
      for (let i = 0; i < MAX_LIGHTS; i++) if (lightBaked[i] === 1) lights.push(i)
      console.log(`[bake] ${surfaces.length} surfaces, ${occluders.length} occluders, ${lights.length} baked lights`)

      const raycaster = new THREE.Raycaster()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(raycaster as any).firstHitOnly = true

      const local = new THREE.Vector3()
      const world = new THREE.Vector3()
      const normal = new THREE.Vector3()
      const toLight = new THREE.Vector3()
      const origin = new THREE.Vector3()
      const nmat = new THREE.Matrix3()
      const acc = new THREE.Color()
      const manifest: string[] = []

      for (const s of surfaces) {
        const W = Math.min(192, Math.max(2, Math.round(s.w * luxelsPerMeter)))
        const H = Math.min(192, Math.max(2, Math.round(s.h * luxelsPerMeter)))
        const canvas = document.createElement('canvas')
        canvas.width = W
        canvas.height = H
        const ctx = canvas.getContext('2d')!
        const img = ctx.createImageData(W, H)

        nmat.getNormalMatrix(s.mesh.matrixWorld)
        normal.set(0, 0, 1).applyMatrix3(nmat).normalize()

        for (let py = 0; py < H; py++) {
          const v = 1 - (py + 0.5) / H // canvas rows top-down, uv v bottom-up
          for (let px = 0; px < W; px++) {
            const u = (px + 0.5) / W
            local.set((u - 0.5) * s.w, (v - 0.5) * s.h, 0)
            world.copy(local).applyMatrix4(s.mesh.matrixWorld)

            // ambient with the shader's hemisphere tilt
            acc.copy(ambientColor).multiplyScalar(0.95 + 0.3 * normal.y)

            for (const i of lights) {
              toLight.copy(lightPositions[i]).sub(world)
              const dist = toLight.length()
              if (dist >= lightRadii[i]) continue
              const atten = 1 - dist / lightRadii[i]
              toLight.divideScalar(Math.max(dist, 1e-4))
              const ndl = Math.max(normal.dot(toLight), 0)
              if (ndl <= 0) continue
              const cosDown = toLight.y
              const down = 0.06 + 0.94 * THREE.MathUtils.smoothstep(cosDown, -0.12, 0.45)
              let spot = 1 + (down - 1) * lightSpots[i]
              if (lightCones[i] > 0) {
                const along = -toLight.dot(lightDirs[i])
                spot *= THREE.MathUtils.smoothstep(along, lightCones[i], lightCones[i] + 0.12)
              }
              if (spot <= 0.001) continue

              // shadow ray — the whole point of baking
              origin.copy(world).addScaledVector(normal, 0.03)
              raycaster.set(origin, toLight)
              raycaster.far = dist - 0.08
              if (raycaster.intersectObjects(occluders, false).length > 0) continue

              acc.r += lightColors[i].r * ndl * atten * spot
              acc.g += lightColors[i].g * ndl * atten * spot
              acc.b += lightColors[i].b * ndl * atten * spot
            }

            const o = (py * W + px) * 4
            img.data[o] = Math.min(255, acc.r * 127.5)
            img.data[o + 1] = Math.min(255, acc.g * 127.5)
            img.data[o + 2] = Math.min(255, acc.b * 127.5)
            img.data[o + 3] = 255
          }
        }
        ctx.putImageData(img, 0, 0)
        await fetch(`/__lightmap?name=${safeName(s.id)}.png`, { method: 'POST', body: canvas.toDataURL('image/png') })
        manifest.push(s.id)
        console.log(`[bake] ${s.id} ${W}x${H}`)
        await new Promise((r) => setTimeout(r)) // let the page breathe
      }

      await fetch('/__lightmap?name=manifest.json', {
        method: 'POST',
        body: JSON.stringify({ surfaces: manifest }, null, 1),
      })
      console.log(`[bake] done — ${manifest.length} lightmaps written; reload to see them`)
      return manifest.length
    }

    ;(window as unknown as Record<string, unknown>).__bake = bake
  }, [scene])

  return null
}
