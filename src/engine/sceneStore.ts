import { useSyncExternalStore } from 'react'
import type { Component, SceneNode, Transform } from './types'
import { sceneNodes } from './scene'
import { MODEL_REGISTRY } from './models'

/**
 * Editor store over the node tree. Nodes are the single source of truth
 * (scene.json); everything here is CRUD + selection + undo history on them.
 */

export interface PlacingSpec {
  /** a model from MODEL_REGISTRY */
  model?: string
  /** a composed entity ('lamp' = fixture + light child, generators, …) */
  kind?: 'lamp' | 'paperWad' | 'trashPile' | 'rack'
  /** a library prefab to instance */
  prefab?: string
}

export type BuildPanel = 'catalog' | 'inspector' | null
export type BuildMoveMode = 'walk' | 'fly'

export interface SceneEditorState {
  nodes: SceneNode[]
  selectedId: string | null
  saving: string | null
  /** authored nodes differ from the last successful save */
  dirty: boolean
  gizmoMode: 'translate' | 'rotate'
  camMode: 'orbit' | 'fly'
  placing: PlacingSpec | null
  /** model thumbnails keyed by registry name */
  thumbs: Record<string, string>
  canUndo: boolean
  canRedo: boolean
  /** hierarchy expand/collapse, keyed by node id */
  expanded: Record<string, boolean>
  viewMode: 'scene' | 'assets'
  /** RMB fly-look active — movement keys are captured, gizmo hotkeys off */
  flying: boolean
  /** first-person authoring state; kept out of scene.json */
  buildPanel: BuildPanel
  buildMoveMode: BuildMoveMode
  buildSnap: boolean
  buildAimedId: string | null
  buildHoldingId: string | null
  buildLocked: boolean
}

let state: SceneEditorState = {
  nodes: sceneNodes.map((n) => structuredClone(n)),
  selectedId: null,
  saving: null,
  dirty: false,
  gizmoMode: 'translate',
  camMode: 'fly',
  placing: null,
  thumbs: {},
  canUndo: false,
  canRedo: false,
  expanded: {},
  viewMode: 'scene',
  flying: false,
  buildPanel: null,
  buildMoveMode: 'walk',
  buildSnap: true,
  buildAimedId: null,
  buildHoldingId: null,
  buildLocked: false,
}

const subs = new Set<() => void>()
function emit(next: Partial<SceneEditorState>) {
  state = { ...state, ...next }
  subs.forEach((fn) => fn())
}

// ---- history ----
const MAX_HISTORY = 60
let past: SceneNode[][] = []
let future: SceneNode[][] = []

function record() {
  past.push(state.nodes)
  if (past.length > MAX_HISTORY) past.shift()
  future = []
}
function historyFlags() {
  return { canUndo: past.length > 0, canRedo: future.length > 0 }
}

// ---- tree helpers ----

function childrenOf(nodes: SceneNode[], id: string): SceneNode[] {
  return nodes.filter((n) => n.parent === id)
}

/** id + all descendant ids, tree order */
export function subtreeIds(nodes: SceneNode[], id: string): string[] {
  const out = [id]
  for (const c of childrenOf(nodes, id)) out.push(...subtreeIds(nodes, c.id))
  return out
}

function isDescendant(nodes: SceneNode[], id: string, ancestor: string): boolean {
  let cur = nodes.find((n) => n.id === id)?.parent
  while (cur) {
    if (cur === ancestor) return true
    cur = nodes.find((n) => n.id === cur)?.parent
  }
  return false
}

function uniqueId(nodes: SceneNode[], base: string): string {
  if (!nodes.some((n) => n.id === base)) return base
  let n = 2
  while (nodes.some((no) => no.id === `${base}-${n}`)) n++
  return `${base}-${n}`
}

export const sceneStore = {
  get: () => state,
  subscribe: (fn: () => void) => {
    subs.add(fn)
    return () => subs.delete(fn)
  },

  select(selectedId: string | null) {
    emit({ selectedId })
    // reveal the selection in the hierarchy
    if (selectedId) {
      const expanded = { ...state.expanded }
      let cur = state.nodes.find((n) => n.id === selectedId)?.parent
      while (cur) {
        expanded[cur] = true
        cur = state.nodes.find((n) => n.id === cur)?.parent
      }
      emit({ expanded })
    }
  },
  toggleExpanded(id: string) {
    emit({ expanded: { ...state.expanded, [id]: !state.expanded[id] } })
  },
  setGizmoMode(gizmoMode: 'translate' | 'rotate') {
    emit({ gizmoMode })
  },
  setCamMode(camMode: 'orbit' | 'fly') {
    emit({ camMode })
  },
  setFlying(flying: boolean) {
    if (flying !== state.flying) emit({ flying })
  },
  setPlacing(placing: PlacingSpec | null) {
    emit({ placing })
  },
  setThumb(key: string, dataUrl: string) {
    emit({ thumbs: { ...state.thumbs, [key]: dataUrl } })
  },
  setViewMode(viewMode: 'scene' | 'assets') {
    emit({ viewMode })
  },
  setBuildPanel(buildPanel: BuildPanel) {
    emit({ buildPanel })
  },
  setBuildMoveMode(buildMoveMode: BuildMoveMode) {
    emit({ buildMoveMode })
  },
  setBuildSnap(buildSnap: boolean) {
    emit({ buildSnap })
  },
  setBuildAimedId(buildAimedId: string | null) {
    if (buildAimedId !== state.buildAimedId) emit({ buildAimedId })
  },
  setBuildHoldingId(buildHoldingId: string | null) {
    if (buildHoldingId !== state.buildHoldingId) emit({ buildHoldingId })
  },
  setBuildLocked(buildLocked: boolean) {
    if (buildLocked !== state.buildLocked) emit({ buildLocked })
  },

  // ---- node CRUD ----

  updateTransform(id: string, transform: Transform) {
    record()
    emit({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, transform } : n)),
      dirty: true,
      ...historyFlags(),
    })
  },
  rename(id: string, name: string) {
    record()
    emit({ nodes: state.nodes.map((n) => (n.id === id ? { ...n, name } : n)), dirty: true, ...historyFlags() })
  },
  updateComponent(id: string, index: number, patch: Partial<Component>) {
    record()
    emit({
      nodes: state.nodes.map((n) => {
        if (n.id !== id || !n.components) return n
        const components = n.components.map((c, i) => (i === index ? ({ ...c, ...patch } as Component) : c))
        return { ...n, components }
      }),
      dirty: true,
      ...historyFlags(),
    })
  },
  addComponent(id: string, component: Component) {
    record()
    emit({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, components: [...(n.components ?? []), component] } : n)),
      dirty: true,
      ...historyFlags(),
    })
  },
  removeComponent(id: string, index: number) {
    record()
    emit({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, components: (n.components ?? []).filter((_, i) => i !== index) } : n,
      ),
      dirty: true,
      ...historyFlags(),
    })
  },

  /** add a node (and optional pre-built children) */
  add(node: SceneNode, children: SceneNode[] = []) {
    record()
    emit({ nodes: [...state.nodes, node, ...children], selectedId: node.id, dirty: true, ...historyFlags() })
    return node.id
  },

  /** remove a node and its whole subtree */
  remove(id: string) {
    record()
    const doomed = new Set(subtreeIds(state.nodes, id))
    emit({
      nodes: state.nodes.filter((n) => !doomed.has(n.id)),
      selectedId: state.selectedId && doomed.has(state.selectedId) ? null : state.selectedId,
      dirty: true,
      ...historyFlags(),
    })
  },

  /** deep-copy a subtree with fresh ids, offset slightly */
  duplicate(id: string): string | null {
    const src = state.nodes.find((n) => n.id === id)
    if (!src) return null
    record()
    const nodes = [...state.nodes]
    const idMap = new Map<string, string>()
    const copyTree = (nodeId: string, newParent: string | null) => {
      const orig = state.nodes.find((n) => n.id === nodeId)!
      const newId = uniqueId(nodes, nodeId)
      idMap.set(nodeId, newId)
      nodes.push({ ...structuredClone(orig), id: newId, parent: newParent })
      for (const c of childrenOf(state.nodes, nodeId)) copyTree(c.id, newId)
    }
    copyTree(id, src.parent)
    const rootCopy = nodes.find((n) => n.id === idMap.get(id))!
    rootCopy.transform = {
      ...rootCopy.transform,
      pos: [rootCopy.transform.pos[0] + 0.8, rootCopy.transform.pos[1], rootCopy.transform.pos[2] + 0.8],
    }
    emit({ nodes, selectedId: rootCopy.id, dirty: true, ...historyFlags() })
    return rootCopy.id
  },

  /** move a node under a new parent (null = scene root); cycle-safe */
  reparent(id: string, parentId: string | null) {
    if (id === parentId) return
    if (parentId && isDescendant(state.nodes, parentId, id)) return
    record()
    emit({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, parent: parentId } : n)),
      dirty: true,
      ...historyFlags(),
    })
  },

  /** turn a subtree into a library prefab, leaving an instance in its place */
  makePrefab(id: string) {
    const src = state.nodes.find((n) => n.id === id)
    if (!src || src.library || src.parent === 'library') return
    record()
    const prefabId = uniqueId(state.nodes, `${id}-prefab`)
    const nodes = state.nodes.map((n) =>
      n.id === id
        ? { ...n, id: prefabId, parent: 'library' as string | null, library: true, transform: { pos: [0, 0, 0] as [number, number, number] }, components: undefined }
        : n.parent === id
          ? { ...n, parent: prefabId }
          : n,
    )
    // the original node keeps living in the scene as an instance of the prefab
    const instance: SceneNode = {
      id,
      parent: src.parent,
      transform: src.transform,
      components: [{ type: 'instance', of: prefabId }],
    }
    // node's own components move onto a child inside the prefab so nothing is lost
    const own: SceneNode[] = src.components?.length
      ? [{ id: uniqueId(nodes, `${prefabId}/base`), parent: prefabId, transform: { pos: [0, 0, 0] }, components: src.components }]
      : []
    emit({ nodes: [...nodes, ...own, instance], selectedId: id, dirty: true, ...historyFlags() })
  },

  undo() {
    const prev = past.pop()
    if (!prev) return
    future.push(state.nodes)
    emit({ nodes: prev, selectedId: null, dirty: true, ...historyFlags() })
  },
  redo() {
    const next = future.pop()
    if (!next) return
    past.push(state.nodes)
    emit({ nodes: next, selectedId: null, dirty: true, ...historyFlags() })
  },

  /** click-to-place from the palette */
  placeAt(x: number, y: number, z: number): string | null {
    const p = state.placing
    if (!p) return null
    const pos: [number, number, number] = [+x.toFixed(2), +Math.max(0, y).toFixed(2), +z.toFixed(2)]
    if (p.model) {
      const def = MODEL_REGISTRY[p.model]
      if (!def) return null
      const id = uniqueId(state.nodes, p.model)
      return sceneStore.add({
        id,
        parent: null,
        transform: { pos, rot: 0 },
        components: [
          { type: 'model', ...def },
          { type: 'physics', body: 'dynamic', collider: 'hull', grabbable: true },
        ],
      })
    } else if (p.prefab) {
      const id = uniqueId(state.nodes, p.prefab.replace(/-prefab$/, ''))
      return sceneStore.add({
        id,
        parent: null,
        transform: { pos, rot: 0 },
        components: [{ type: 'instance', of: p.prefab }],
      })
    } else if (p.kind === 'lamp') {
      const id = uniqueId(state.nodes, 'lamp')
      return sceneStore.add(
        {
          id,
          parent: null,
          transform: { pos: [pos[0], Math.max(pos[1], 4.6), pos[2]] },
          components: [{ type: 'model', ...MODEL_REGISTRY.hangingLamp }],
        },
        [
          {
            id: `${id}/light`,
            parent: id,
            transform: { pos: [0, -1.4, 0] },
            components: [{ type: 'light', color: '#d8e6c8', intensity: 1.2, radius: 18, spot: 1 }],
          },
        ],
      )
    } else if (p.kind === 'paperWad') {
      const id = uniqueId(state.nodes, 'wad')
      return sceneStore.add({
        id,
        parent: null,
        transform: { pos },
        components: [
          { type: 'generator', generator: 'paperWad', seed: (state.nodes.length * 7919) % 997 + 1, params: [0.09] },
          { type: 'physics', body: 'dynamic', collider: 'hull', grabbable: true },
        ],
      })
    } else if (p.kind === 'trashPile') {
      const id = uniqueId(state.nodes, 'trash-mound')
      return sceneStore.add({
        id,
        parent: null,
        transform: { pos },
        components: [{ type: 'generator', generator: 'trashPile', seed: (state.nodes.length * 7919) % 997 + 1, params: [1.2, 0.35] }],
      })
    } else if (p.kind === 'rack') {
      const id = uniqueId(state.nodes, 'rack')
      return sceneStore.add(
        {
          id,
          parent: null,
          transform: { pos, rot: 0 },
          components: [
            { type: 'generator', generator: 'rack' },
            { type: 'physics', body: 'fixed', collider: 'cuboid', blockPlayer: true },
          ],
        },
        [0.12, 1.0, 1.85].map((sy, i) => ({
          id: `${id}/shelf-${i + 1}`,
          parent: id,
          transform: { pos: [0, sy, 0] as [number, number, number] },
          components: [{ type: 'physics' as const, body: 'fixed' as const, collider: 'cuboid' as const, size: [2, 0.035, 0.55] as [number, number, number] }],
        })),
      )
    }
    return null
  },

  async save() {
    if (state.saving === 'saving…') return
    const nodesAtSave = state.nodes
    emit({ saving: 'saving…' })
    try {
      const res = await fetch('/__scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: nodesAtSave }, null, 1) + '\n',
      })
      emit({
        saving: res.ok ? 'saved ✓' : `failed: ${res.status}`,
        ...(res.ok && state.nodes === nodesAtSave ? { dirty: false } : {}),
      })
    } catch (e) {
      emit({ saving: `failed: ${(e as Error).message}` })
    }
    setTimeout(() => emit({ saving: null }), 2000)
  },
}

export function useSceneEditor(): SceneEditorState {
  return useSyncExternalStore(sceneStore.subscribe, sceneStore.get)
}

// dev hook: drive the editor from the console / agent tooling
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__sceneStore = sceneStore
}
