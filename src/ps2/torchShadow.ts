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

/** aimed down the beam by the Flashlight component every frame */
export const torchCamera = new THREE.PerspectiveCamera(56, 1, 0.15, 30)

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
}

/** call after posing torchCamera (pipeline does, pre-render) */
export function updateTorchShadowMatrix() {
  torchCamera.updateMatrixWorld(true)
  torchShadowUniforms.uShadowMatrix.value
    .copy(biasMatrix)
    .multiply(torchCamera.projectionMatrix)
    .multiply(torchCamera.matrixWorldInverse)
}
