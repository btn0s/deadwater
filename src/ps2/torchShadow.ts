import * as THREE from 'three'

/**
 * Real-time shadow map for the torch. The flashlight aims a camera down its
 * own beam; PS2Pipeline renders scene depth from it each frame, and the
 * material shaders compare against it — one hard tap, no PCF, so the edges
 * stay era-gritty. Only the torch's contribution is shadowed; the static
 * world keeps its baked lightmaps and everything else stays per-vertex.
 */

export const SHADOW_SIZE = 512

const depthTexture = new THREE.DepthTexture(SHADOW_SIZE, SHADOW_SIZE)
depthTexture.type = THREE.UnsignedIntType
export const torchShadowTarget = new THREE.WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE, {
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  depthTexture,
  depthBuffer: true,
})

/** aimed down the beam by the Flashlight component every frame; fov covers
 * the hot cone + halo (~19° half-angle) with margin */
export const torchCamera = new THREE.PerspectiveCamera(44, 1, 0.15, 30)

// world → light NDC → [0,1] uv/depth
const biasMatrix = new THREE.Matrix4().set(
  0.5, 0, 0, 0.5,
  0, 0.5, 0, 0.5,
  0, 0, 0.5, 0.5,
  0, 0, 0, 1,
)

export const torchShadowUniforms = {
  uShadowMap: { value: depthTexture as THREE.Texture },
  uShadowMatrix: { value: new THREE.Matrix4() },
  /** light-slot index the torch occupies; -1 = none */
  uShadowSlot: { value: -1 },
  /** raised by the pipeline only around its own scene render */
  uShadowOn: { value: 0 },
  // the torch itself, evaluated PER-FRAGMENT in PS2Material (the one light
  // that must pool round instead of Gouraud-blobby); the vertex loop skips
  // its slot, water keeps the per-vertex version
  uTorchPos: { value: new THREE.Vector3() },
  uTorchDir: { value: new THREE.Vector3(0, 0, -1) },
  uTorchColor: { value: new THREE.Color(0, 0, 0) },
  uTorchRadius: { value: 1 },
  uTorchCone: { value: 0.97 },
}

/** call after posing torchCamera (pipeline does, pre-render) */
export function updateTorchShadowMatrix() {
  torchCamera.updateMatrixWorld(true)
  torchShadowUniforms.uShadowMatrix.value
    .copy(biasMatrix)
    .multiply(torchCamera.projectionMatrix)
    .multiply(torchCamera.matrixWorldInverse)
}
