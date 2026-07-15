import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader, FBXLoader } from 'three-stdlib'
import { MODEL_REGISTRY } from '../engine/models'
import { sceneStore } from '../engine/sceneStore'

/**
 * Renders 96px unlit thumbnails for every registered model into dataURLs,
 * once, the first time the editor opens. Uses its own tiny staging scene so
 * the live scene is untouched.
 */
export function ThumbnailFactory({ enabled = true }: { enabled?: boolean }) {
  const gl = useThree((s) => s.gl)
  const started = useRef(false)

  useEffect(() => {
    const thumbs = sceneStore.get().thumbs
    const complete = Object.keys(MODEL_REGISTRY).every((key) => Boolean(thumbs[key]))
    if (!enabled || started.current || complete) return
    started.current = true
    let cancelled = false

    const run = async () => {
      const SIZE = 96
      const target = new THREE.WebGLRenderTarget(SIZE, SIZE)
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x1d2024)
      const cam = new THREE.PerspectiveCamera(32, 1, 0.01, 200)
      const pixels = new Uint8Array(SIZE * SIZE * 4)
      const canvas = document.createElement('canvas')
      canvas.width = SIZE
      canvas.height = SIZE
      const ctx = canvas.getContext('2d')!
      const image = ctx.createImageData(SIZE, SIZE)
      const gltfLoader = new GLTFLoader()
      const fbxLoader = new FBXLoader()
      const texLoader = new THREE.TextureLoader()

      const snapshot = (object: THREE.Object3D, key: string) => {
        scene.add(object)
        const box = new THREE.Box3().setFromObject(object)
        const sphere = box.getBoundingSphere(new THREE.Sphere())
        const d = sphere.radius / Math.tan((cam.fov * Math.PI) / 360) + sphere.radius * 0.3
        cam.position.set(sphere.center.x + d * 0.62, sphere.center.y + d * 0.5, sphere.center.z + d * 0.62)
        cam.lookAt(sphere.center)
        cam.updateMatrixWorld()
        const prev = gl.getRenderTarget()
        gl.setRenderTarget(target)
        gl.clear()
        gl.render(scene, cam)
        gl.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels)
        gl.setRenderTarget(prev)
        for (let row = 0; row < SIZE; row++) {
          const src = (SIZE - 1 - row) * SIZE * 4
          image.data.set(pixels.subarray(src, src + SIZE * 4), row * SIZE * 4)
        }
        ctx.putImageData(image, 0, 0)
        sceneStore.setThumb(key, canvas.toDataURL('image/png'))
        scene.remove(object)
      }

      const unlit = (root: THREE.Object3D, map?: THREE.Texture) => {
        root.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            const src = (Array.isArray(o.material) ? o.material[0] : o.material) as THREE.MeshStandardMaterial
            o.material = new THREE.MeshBasicMaterial({ map: map ?? src.map ?? null, color: map || src.map ? 0xffffff : 0x9aa0a6 })
          }
        })
      }

      for (const [key, def] of Object.entries(MODEL_REGISTRY)) {
        if (sceneStore.get().thumbs[key]) continue
        if (cancelled) {
          target.dispose()
          return
        }
        try {
          if (def.source === 'gltf') {
            const gltf = await gltfLoader.loadAsync(def.url)
            const obj = gltf.scene.clone(true)
            unlit(obj)
            snapshot(obj, key)
          } else {
            const fbx = await fbxLoader.loadAsync(def.url)
            const obj = fbx.clone(true)
            const box = new THREE.Box3().setFromObject(obj)
            const size = box.getSize(new THREE.Vector3())
            if (Math.max(size.x, size.y, size.z) > 8) obj.scale.setScalar(0.01)
            const map = def.texture ? await texLoader.loadAsync(def.texture) : undefined
            unlit(obj, map)
            snapshot(obj, key)
          }
        } catch { /* skip broken entries */ }
      }
      target.dispose()
    }

    run()
    return () => {
      cancelled = true
      started.current = false
    }
  }, [enabled, gl])

  return null
}
