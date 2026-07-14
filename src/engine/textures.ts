import { useTexture } from '@react-three/drei'
import { prepTexture } from '../ps2/PS2Material'

/** Every tileable texture available to surfaces/primitives, by name. */
export const TEXTURE_URLS: Record<string, string> = {
  Concrete016: '/textures/Concrete016.jpg',
  Concrete030: '/textures/Concrete030.jpg',
  Concrete031: '/textures/Concrete031.jpg',
  Concrete034: '/textures/Concrete034.jpg',
  Concrete036: '/textures/Concrete036.jpg',
  Plaster001: '/textures/Plaster001.jpg',
  PaintedPlaster005: '/textures/PaintedPlaster005.jpg',
  Bricks084: '/textures/Bricks084.jpg',
  CorrugatedSteel005: '/textures/CorrugatedSteel005.jpg',
  MetalPlates006: '/textures/MetalPlates006.jpg',
  DangerSign: '/textures/PaintedMetal017.jpg',
  TrashPile: '/textures/TrashPile.jpg',
}

export const TEXTURE_OPTIONS = Object.keys(TEXTURE_URLS)

/** Suspense-cached, PS2-prepped texture lookup by registry name. */
export function useWorldTexture(name: string) {
  const url = TEXTURE_URLS[name] ?? TEXTURE_URLS.Concrete031
  return useTexture(url, prepTexture)
}
