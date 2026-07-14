import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { sceneDepthUniforms, waterMeshes } from './sceneDepth'

// NTSC PS2 framebuffer: 512x448, stretched to 4:3 on the CRT
export const INTERNAL_WIDTH = 512
export const INTERNAL_HEIGHT = 448

const blitFragment = /* glsl */ `
  uniform sampler2D tDiffuse;
  varying vec2 vUv;

  void main() {
    vec3 color = texture2D(tDiffuse, vUv).rgb;

    // faint interlace-style line darkening at internal resolution
    float line = mod(floor(vUv.y * ${INTERNAL_HEIGHT}.0), 2.0);
    color *= mix(0.93, 1.0, line);

    // mild CRT corner falloff
    vec2 q = vUv - 0.5;
    color *= 1.0 - 0.3 * dot(q, q);

    gl_FragColor = vec4(color, 1.0);
  }
`

const blitVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

/**
 * Renders the scene into a fixed 512x448 target (the PS2's common NTSC
 * framebuffer size), then upscales to the canvas with bilinear filtering —
 * standing in for the CRT's analog smoothing of the dithered image.
 */
export function PS2Pipeline() {
  const gl = useThree((s) => s.gl)

  const { target, depthTarget, depthOverride, postScene, postCamera } = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(INTERNAL_WIDTH, INTERNAL_HEIGHT, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
    })

    // opaque-depth pre-pass target: water reads this to find intersections
    const depthTexture = new THREE.DepthTexture(INTERNAL_WIDTH, INTERNAL_HEIGHT)
    depthTexture.type = THREE.UnsignedIntType
    const depthTarget = new THREE.WebGLRenderTarget(INTERNAL_WIDTH, INTERNAL_HEIGHT, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthTexture,
      depthBuffer: true,
    })
    // geometry-only: skip every real material during the pre-pass
    const depthOverride = new THREE.MeshBasicMaterial()

    // fullscreen triangle
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2))
    const mat = new THREE.ShaderMaterial({
      vertexShader: blitVertex,
      fragmentShader: blitFragment,
      uniforms: { tDiffuse: { value: target.texture } },
      depthTest: false,
      depthWrite: false,
    })
    const postScene = new THREE.Scene()
    postScene.add(new THREE.Mesh(geo, mat))
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    return { target, depthTarget, depthOverride, postScene, postCamera }
  }, [])

  useFrame(({ gl: renderer, scene, camera }) => {
    const cam = camera as THREE.PerspectiveCamera

    // 1) opaque depth pre-pass (water hidden, materials overridden)
    for (const w of waterMeshes) w.visible = false
    scene.overrideMaterial = depthOverride
    renderer.setRenderTarget(depthTarget)
    renderer.render(scene, camera)
    scene.overrideMaterial = null
    for (const w of waterMeshes) w.visible = true

    sceneDepthUniforms.uSceneDepth.value = depthTarget.depthTexture
    sceneDepthUniforms.uCamNear.value = cam.near
    sceneDepthUniforms.uCamFar.value = cam.far

    // 2) main pass — foam enabled only here, where the depth matches the camera
    sceneDepthUniforms.uFoamOn.value = 1
    renderer.setRenderTarget(target)
    renderer.render(scene, camera)
    sceneDepthUniforms.uFoamOn.value = 0

    renderer.setRenderTarget(null)
    renderer.render(postScene, postCamera)
  }, 1)

  void gl
  return null
}
