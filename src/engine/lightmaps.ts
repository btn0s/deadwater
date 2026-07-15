import * as THREE from 'three'

/**
 * Baked lightmap lookup. public/lightmaps/manifest.json lists the node ids
 * that have maps (written by the in-browser baker, git-tracked like any
 * asset). Surfaces check membership at mount and sample their map instead
 * of the runtime baked lights.
 */

export const lightmapName = (id: string) => id.replace(/[^a-zA-Z0-9-]/g, '_')

let manifestFetch: Promise<Set<string>> | null = null
export function getLightmapManifest(): Promise<Set<string>> {
  manifestFetch ??= fetch('/lightmaps/manifest.json')
    .then((r) => (r.ok ? r.json() : { surfaces: [] }))
    .then((j: { surfaces: string[] }) => new Set(j.surfaces))
    .catch(() => new Set<string>())
  return manifestFetch
}

const loader = new THREE.TextureLoader()
export function loadLightmap(id: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      `/lightmaps/${lightmapName(id)}.png`,
      (tex) => {
        tex.colorSpace = THREE.NoColorSpace
        tex.magFilter = THREE.LinearFilter
        tex.minFilter = THREE.LinearFilter
        tex.generateMipmaps = false
        tex.wrapS = THREE.ClampToEdgeWrapping
        tex.wrapT = THREE.ClampToEdgeWrapping
        resolve(tex)
      },
      undefined,
      reject,
    )
  })
}
