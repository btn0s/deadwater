import * as THREE from 'three'

/**
 * Opaque-scene depth, rendered by PS2Pipeline each frame before the main
 * pass. Water samples it to find where geometry pierces the surface
 * (pilings, seawall, banks, junk) and draws foam there.
 *
 * uFoamOn is raised only around the pipeline's own scene render — other
 * renders (editor, contact sheets, thumbnails) use different cameras, so
 * the depth would be stale for them and foam must stay off.
 */
export const sceneDepthUniforms = {
  uSceneDepth: { value: null as THREE.Texture | null },
  uCamNear: { value: 0.1 },
  uCamFar: { value: 120 },
  uResolution: { value: new THREE.Vector2(512, 448) },
  uFoamOn: { value: 0 },
}

/** water meshes register here so the depth pre-pass can skip them */
export const waterMeshes = new Set<THREE.Object3D>()
