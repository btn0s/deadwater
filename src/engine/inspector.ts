import type { Component, ComponentType } from './types'
import { TEXTURE_OPTIONS } from './textures'

/**
 * Inspector schema: how the editor renders each component's fields.
 * One generic inspector walks these instead of hand-built per-kind panels.
 */

export type FieldDef =
  | { key: string; label?: string; kind: 'number'; step?: number }
  | { key: string; label?: string; kind: 'color' }
  | { key: string; label?: string; kind: 'check' }
  | { key: string; label?: string; kind: 'select'; options: readonly string[]; allowEmpty?: boolean }
  | { key: string; label?: string; kind: 'text' }
  | { key: string; label?: string; kind: 'vec'; dims: number; step?: number }
  /** variable-length number list (primitive dims, generator params) */
  | { key: string; label?: string; kind: 'numbers'; step?: number }

export const COMPONENT_FIELDS: Record<ComponentType, FieldDef[]> = {
  model: [
    { key: 'source', kind: 'select', options: ['gltf', 'fbx'] },
    { key: 'url', kind: 'text' },
    { key: 'texture', kind: 'text' },
    { key: 'split', kind: 'select', options: ['mesh', 'suffix-ab'], allowEmpty: true },
  ],
  light: [
    { key: 'color', kind: 'color' },
    { key: 'intensity', kind: 'number', step: 0.05 },
    { key: 'radius', kind: 'number', step: 0.5 },
    { key: 'spot', kind: 'number', step: 0.25 },
    { key: 'flicker', kind: 'check' },
  ],
  physics: [
    { key: 'body', kind: 'select', options: ['fixed', 'dynamic'] },
    { key: 'collider', kind: 'select', options: ['hull', 'trimesh', 'cuboid', 'none'] },
    { key: 'size', label: 'size (half)', kind: 'vec', dims: 3, step: 0.05 },
    { key: 'grabbable', kind: 'check' },
    { key: 'blockPlayer', label: 'block player', kind: 'check' },
  ],
  surface: [
    { key: 'width', kind: 'number', step: 0.5 },
    { key: 'height', kind: 'number', step: 0.5 },
    { key: 'texture', kind: 'select', options: TEXTURE_OPTIONS },
    { key: 'repeat', kind: 'vec', dims: 2, step: 0.5 },
    { key: 'tint', kind: 'color' },
    { key: 'bombing', kind: 'number', step: 0.25 },
  ],
  primitive: [
    { key: 'shape', kind: 'select', options: ['box', 'cylinder', 'torus', 'plane'] },
    { key: 'dims', kind: 'numbers', step: 0.05 },
    { key: 'texture', kind: 'select', options: TEXTURE_OPTIONS, allowEmpty: true },
    { key: 'repeat', kind: 'vec', dims: 2, step: 0.5 },
    { key: 'tint', kind: 'color' },
    { key: 'fullbright', kind: 'check' },
  ],
  generator: [
    { key: 'generator', kind: 'select', options: ['paperWad', 'trashPile', 'rack', 'railing'] },
    { key: 'seed', kind: 'number', step: 1 },
    { key: 'params', kind: 'numbers', step: 0.05 },
  ],
  water: [
    { key: 'width', kind: 'number', step: 0.5 },
    { key: 'height', kind: 'number', step: 0.5 },
  ],
  behavior: [
    { key: 'behavior', kind: 'select', options: ['rat'] },
    { key: 'seed', kind: 'number', step: 1 },
  ],
  instance: [{ key: 'of', kind: 'text' }],
  environment: [
    { key: 'ambient', kind: 'color' },
    { key: 'fog.color', label: 'fog', kind: 'color' },
    { key: 'fog.near', label: 'fog near', kind: 'number', step: 0.5 },
    { key: 'fog.far', label: 'fog far', kind: 'number', step: 1 },
  ],
  door: [
    { key: 'target', kind: 'vec', dims: 2, step: 0.5 },
    { key: 'targetYaw', label: 'yaw', kind: 'number', step: 0.1 },
    { key: 'label', kind: 'text' },
    { key: 'radius', kind: 'number', step: 0.1 },
  ],
}

/** defaults used by the inspector's "add component" menu */
export const COMPONENT_DEFAULTS: Record<Exclude<ComponentType, 'environment'>, Component> = {
  model: { type: 'model', source: 'gltf', url: '' },
  light: { type: 'light', color: '#d8e6c8', intensity: 1.2, radius: 18, spot: 1 },
  physics: { type: 'physics', body: 'fixed', collider: 'cuboid', blockPlayer: true },
  surface: { type: 'surface', width: 2, height: 2, texture: 'Concrete031', repeat: [1, 1] },
  primitive: { type: 'primitive', shape: 'box', dims: [1, 1, 1], texture: 'Concrete031' },
  generator: { type: 'generator', generator: 'paperWad', seed: 1 },
  behavior: { type: 'behavior', behavior: 'rat', seed: 1 },
  instance: { type: 'instance', of: '' },
  water: { type: 'water', width: 4, height: 2 },
  door: { type: 'door', target: [0, 0], label: 'USE' },
}

// dot-path helpers for nested fields (environment.fog.near)
export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj)
}

export function withPath<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split('.')
  const clone = structuredClone(obj) as Record<string, unknown>
  let cur = clone
  for (const k of keys.slice(0, -1)) {
    cur[k] = { ...(cur[k] as Record<string, unknown> | undefined) }
    cur = cur[k] as Record<string, unknown>
  }
  cur[keys[keys.length - 1]] = value
  return clone as T
}
