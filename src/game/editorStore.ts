import { useSyncExternalStore } from 'react'
import layoutData from './layout.json'

export interface LayoutItem {
  id: string
  kind: 'prop' | 'fbx' | 'split' | 'paperWad' | 'trashPile' | 'loadedPallet' | 'rack'
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
  /** bumped on every edit so physics bodies remount at the new spawn */
  rev?: number
}

interface EditorState {
  active: boolean
  items: LayoutItem[]
  selectedId: string | null
  saving: string | null
  gizmoMode: 'translate' | 'rotate'
  camMode: 'orbit' | 'fly'
}

let state: EditorState = {
  // survive HMR / page reloads while editing
  active: typeof sessionStorage !== 'undefined' && sessionStorage.getItem('dw-editor') === '1',
  items: (layoutData.items as LayoutItem[]).map((i) => ({ ...i })),
  selectedId: null,
  saving: null,
  gizmoMode: 'translate',
  camMode: 'orbit',
}

const subs = new Set<() => void>()
function emit(next: Partial<EditorState>) {
  state = { ...state, ...next }
  subs.forEach((fn) => fn())
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
    emit({
      items: state.items.map((i) => (i.id === id ? { ...i, ...patch, rev: (i.rev ?? 0) + 1 } : i)),
    })
  },
  add(item: LayoutItem) {
    emit({ items: [...state.items, item], selectedId: item.id })
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
    emit({
      items: state.items.filter((i) => i.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    })
  },
  async save() {
    emit({ saving: 'saving…' })
    // strip editor-only fields before writing
    const items = state.items.map(({ rev: _rev, ...rest }) => rest)
    try {
      const res = await fetch('/__layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }, null, 2) + '\n',
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
