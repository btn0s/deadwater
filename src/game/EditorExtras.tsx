import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Grid, GizmoHelper, GizmoViewport } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader, FBXLoader } from 'three-stdlib'
import { MODELS, FBX_MODELS } from './Prop'
import { editorStore } from './editorStore'

/** Editor viewport chrome: ground grid + corner view-cube. */
export function EditorChrome() {
  return (
    <>
      <Grid
        position={[0, 0.02, 0]}
        args={[90, 70]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#3a4046"
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor="#4f6b52"
        fadeDistance={120}
        fadeStrength={1}
      />
      <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
        <GizmoViewport axisColors={['#c2554f', '#7da353', '#4f7ac2']} labelColor="#e8e8e8" />
      </GizmoHelper>
    </>
  )
}

/** Invisible ground plane that receives click-to-place while an asset is armed. */
export function FloorPlacer() {
  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position={[0, 0, -6]}
      onPointerDown={(e) => {
        if (!editorStore.get().placing) return
        e.stopPropagation()
        editorStore.placeAt(e.point.x, 0, e.point.z)
        // hold shift to stamp repeatedly
        if (!e.shiftKey) editorStore.setPlacing(null)
      }}
    >
      <planeGeometry args={[90, 70]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  )
}

/**
 * Renders 96px unlit thumbnails for every registered model into dataURLs,
 * once, the first time the editor opens. Uses its own tiny staging scene so
 * the live scene is untouched.
 */
export function ThumbnailFactory() {
  const gl = useThree((s) => s.gl)
  const started = useRef(false)

  useEffect(() => {
    if (started.current || Object.keys(editorStore.get().thumbs).length > 0) return
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
        editorStore.setThumb(key, canvas.toDataURL('image/png'))
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

      for (const [key, url] of Object.entries(MODELS)) {
        if (cancelled) return
        try {
          const gltf = await gltfLoader.loadAsync(url)
          const obj = gltf.scene.clone(true)
          unlit(obj)
          snapshot(obj, `prop:${key}`)
        } catch { /* skip broken entries */ }
      }
      for (const [key, spec] of Object.entries(FBX_MODELS)) {
        if (cancelled) return
        try {
          const fbx = await fbxLoader.loadAsync(spec.url)
          const obj = fbx.clone(true)
          const box = new THREE.Box3().setFromObject(obj)
          const size = box.getSize(new THREE.Vector3())
          if (Math.max(size.x, size.y, size.z) > 8) obj.scale.setScalar(0.01)
          const map = await texLoader.loadAsync(spec.tex)
          unlit(obj, map)
          snapshot(obj, `fbx:${key}`)
        } catch { /* skip broken entries */ }
      }
      target.dispose()
    }

    run()
    return () => {
      cancelled = true
    }
  }, [gl])

  return null
}
