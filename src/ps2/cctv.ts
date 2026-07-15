import * as THREE from 'three'

/**
 * Security camera feed: a low-res target the pipeline re-renders every
 * quarter second from the camera above the yard door — era CCTV chop for
 * the price of four extra renders a second.
 */

export const CCTV_W = 128
export const CCTV_H = 96
export const CCTV_INTERVAL = 0.25

export const cctvTarget = new THREE.WebGLRenderTarget(CCTV_W, CCTV_H, {
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  depthBuffer: true,
})

export const cctvCamera = new THREE.PerspectiveCamera(64, CCTV_W / CCTV_H, 0.1, 60)
// mounted above the yard-side door, sweeping the apron toward the water
cctvCamera.position.set(20.6, 3.1, 10)
cctvCamera.lookAt(30, 0.4, 4)
cctvCamera.updateMatrixWorld(true)
