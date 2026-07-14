import { useSyncExternalStore } from 'react'
import layoutData from './layout.json'

export interface LayoutItem {
  id: string
  kind: 'prop' | 'fbx' | 'split' | 'paperWad' | 'trashPile' | 'loadedPallet' | 'rack' | 'lamp'
  model?: string
  pos: [number, number, number]
  rot?: number
  grabbable?: boolean
  collide?: boolean
  physics?: 'hull' | 'trimesh' | 'none'
  scale?: number
  variant?: number
  seed?: number
  size?: number
  radius?: number
  height?: number
  items?: number
  /** lamp: shared light slot (0-11) */
  light?: number
  /** lamp: emitter height (world y) */
  lightY?: number
  color?: string
  intensity?: number
  flicker?: boolean
  /** bumped on every edit so physics bodies remount at the new spawn */
  rev?: number
}

export interface SurfaceSettings {
  texture: string
  repeatX: number
  repeatY: number
  tint: string
  bombing: number
}

export interface WorldSettings {
  walls: SurfaceSettings
  floor: SurfaceSettings
  ceiling: SurfaceSettings
  ambient: string
  fog: { color: string; near: number; far: number }
}

export interface PlacingSpec {
  kind: LayoutItem['kind']
  model?: string
}

interface EditorState {
  active: boolean
  items: LayoutItem[]
  selectedId: string | null
  saving: string | null
  gizmoMode: 'translate' | 'rotate'
  camMode: 'orbit' | 'fly'
  /** palette asset armed for click-to-place */
  placing: PlacingSpec | null
  /** model thumbnails keyed by `${kind}:${model}` */
  thumbs: Record<string, string>
  canUndo: boolean
  canRedo: boolean
  world: WorldSettings
  rightTab: 'details' | 'world'
}

let state: EditorState = {
  // survive HMR / page reloads while editing
  active: typeof sessionStorage !== 'undefined' && sessionStorage.getItem('dw-editor') === '1',
  items: (layoutData.items as LayoutItem[]).map((i) => ({ ...i })),
  selectedId: null,
  saving: null,
  gizmoMode: 'translate',
  camMode: 'orbit',
  placing: null,
  thumbs: {},
  canUndo: false,
  canRedo: false,
  world: structuredClone((layoutData as { world: WorldSettings }).world),
  rightTab: 'details',
}

const subs = new Set<() => void>()
function emit(next: Partial<EditorState>) {
  state = { ...state, ...next }
  subs.forEach((fn) => fn())
}

// ---- history ----
const MAX_HISTORY = 60
let past: LayoutItem[][] = []
let future: LayoutItem[][] = []

/** snapshot before a mutation */
function record() {
  past.push(state.items)
  if (past.length > MAX_HISTORY) past.shift()
  future = []
}
function historyFlags() {
  return { canUndo: past.length > 0, canRedo: future.length > 0 }
}

export const editorStore = {
  get: () => state,
  subscribe: (fn: () => void) => {
    subs.add(fn)
    return () => subs.delete(fn)
  },
  setActive(active: boolean) {
    sessionStorage.setItem('dw-editor', active ? '1' : '0')
    emit({ active, selectedId: null })
  },
  select(selectedId: string | null) {
    emit({ selectedId })
  },
  setGizmoMode(gizmoMode: 'translate' | 'rotate') {
    emit({ gizmoMode })
  },
  setCamMode(camMode: 'orbit' | 'fly') {
    emit({ camMode })
  },
  update(id: string, patch: Partial<LayoutItem>) {
    record()
    emit({
      items: state.items.map((i) => (i.id === id ? { ...i, ...patch, rev: (i.rev ?? 0) + 1 } : i)),
      ...historyFlags(),
    })
  },
  add(item: LayoutItem) {
    record()
    emit({ items: [...state.items, item], selectedId: item.id, ...historyFlags() })
  },
  duplicate(id: string) {
    const src = state.items.find((i) => i.id === id)
    if (!src) return
    let n = 2
    while (state.items.some((i) => i.id === `${id}-${n}`)) n++
    const copy: LayoutItem = { ...src, id: `${id}-${n}`, pos: [src.pos[0] + 0.8, src.pos[1], src.pos[2] + 0.8] }
    editorStore.add(copy)
  },
  remove(id: string) {
    record()
    emit({
      items: state.items.filter((i) => i.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
      ...historyFlags(),
    })
  },
  undo() {
    const prev = past.pop()
    if (!prev) return
    future.push(state.items)
    emit({ items: prev, selectedId: null, ...historyFlags() })
  },
  redo() {
    const next = future.pop()
    if (!next) return
    past.push(state.items)
    emit({ items: next, selectedId: null, ...historyFlags() })
  },
  setPlacing(placing: PlacingSpec | null) {
    emit({ placing })
  },
  /** click-to-place at a floor point */
  placeAt(x: number, y: number, z: number) {
    const p = state.placing
    if (!p) return
    const base = p.model ?? p.kind
    let n = 1
    while (state.items.some((i) => i.id === `${base}-${n}`)) n++
    const item: LayoutItem = {
      id: `${base}-${n}`,
      kind: p.kind,
      pos: [+x.toFixed(2), +Math.max(0, y).toFixed(2), +z.toFixed(2)],
      rot: 0,
    }
    if (p.model) item.model = p.model
    if (p.kind === 'prop' || p.kind === 'fbx') {
      item.grabbable = true
      item.collide = false
    }
    if (p.kind === 'paperWad' || p.kind === 'trashPile') item.seed = ((n * 7919) % 997) + 1
    if (p.kind === 'trashPile') {
      item.radius = 1.2
      item.height = 0.35
      item.items = 5
    }
    editorStore.add(item)
  },
  setThumb(key: string, dataUrl: string) {
    emit({ thumbs: { ...state.thumbs, [key]: dataUrl } })
  },
  setRightTab(rightTab: 'details' | 'world') {
    emit({ rightTab })
  },
  /** patch a world settings section, e.g. updateWorld('walls', { tint: '#fff' }) */
  updateWorld<K extends keyof WorldSettings>(section: K, patch: Partial<WorldSettings[K]> | WorldSettings[K]) {
    const cur = state.world[section]
    const next =
      typeof cur === 'object' && typeof patch === 'object'
        ? { ...(cur as object), ...(patch as object) }
        : patch
    emit({ world: { ...state.world, [section]: next } as WorldSettings })
  },
  async save() {
    emit({ saving: 'saving…' })
    // strip editor-only fields before writing
    const items = state.items.map(({ rev: _rev, ...rest }) => rest)
    try {
      const res = await fetch('/__layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ world: state.world, items }, null, 2) + '\n',
      })
      emit({ saving: res.ok ? 'saved ✓' : `failed: ${res.status}` })
    } catch (e) {
      emit({ saving: `failed: ${(e as Error).message}` })
    }
    setTimeout(() => emit({ saving: null }), 2000)
  },
}

export function useEditor(): EditorState {
  return useSyncExternalStore(editorStore.subscribe, editorStore.get)
}

if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__editor = (v: boolean) => editorStore.setActive(v)
}
