import { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, TransformControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import * as THREE from 'three'
import { DevViews } from '../game/DevViews'
import { EditorChrome } from '../game/EditorExtras'
import { SceneRoot } from '../engine/render'
import type { Component, SceneNode } from '../engine/types'
import { sceneStore, useSceneEditor, type PlacingSpec } from '../engine/sceneStore'
import { COMPONENT_FIELDS, COMPONENT_DEFAULTS, getPath, withPath, type FieldDef } from '../engine/inspector'
import { MODEL_NAMES } from '../engine/models'
import { EditorFlyControls } from './EditorFlyControls'
import { ScenePlacer } from './ScenePlacer'
import { AssetsView } from './AssetsView'
import { ThumbnailFactory } from './Thumbnails'

const SPECIAL_KINDS = [
  { kind: 'lamp', label: '💡 lamp' },
  { kind: 'paperWad', label: '📄 wad' },
  { kind: 'trashPile', label: '🗑 pile' },
  { kind: 'rack', label: '🗄 rack' },
] as const

function EditorCamera() {
  const { camMode } = useSceneEditor()
  return (
    <>
      <PerspectiveCamera makeDefault fov={55} near={0.1} far={300} position={[14, 18, 20]} />
      {camMode === 'orbit' ? <OrbitControls makeDefault target={[0, 0, -2]} /> : <EditorFlyControls />}
    </>
  )
}

/** gizmo bound to the selected node's live group; commits on release */
function NodeGizmo() {
  const { selectedId, gizmoMode, nodes } = useSceneEditor()
  const scene = useThree((s) => s.scene)
  const node = nodes.find((n) => n.id === selectedId)
  const [obj, setObj] = useState<THREE.Object3D | null>(null)

  useEffect(() => {
    setObj(node ? (scene.getObjectByName(node.id) ?? null) : null)
  }, [node, nodes, scene])

  if (!obj || !node) return null
  return (
    <TransformControls
      object={obj}
      mode={gizmoMode}
      onMouseUp={() => {
        const prevRot = node.transform.rot
        const rot = Array.isArray(prevRot)
          ? ([+obj.rotation.x.toFixed(3), +obj.rotation.y.toFixed(3), +obj.rotation.z.toFixed(3)] as [number, number, number])
          : +obj.rotation.y.toFixed(3)
        sceneStore.updateTransform(node.id, {
          ...node.transform,
          pos: [+obj.position.x.toFixed(3), +obj.position.y.toFixed(3), +obj.position.z.toFixed(3)],
          rot,
        })
      }}
    />
  )
}

/** resolve a raycast hit to its owning scene node (nearest named ancestor) */
function useNodeIds() {
  const { nodes } = useSceneEditor()
  return useMemo(() => new Set(nodes.map((n) => n.id)), [nodes])
}

function Toolbar() {
  const { saving, gizmoMode, camMode, placing, canUndo, canRedo, viewMode } = useSceneEditor()
  return (
    <div className="ed-toolbar">
      <strong className="ed-logo">DEADWATER</strong>
      <span className="ed-sep" />
      <button className={viewMode === 'scene' ? 'on' : ''} onClick={() => sceneStore.setViewMode('scene')}>scene</button>
      <button className={viewMode === 'assets' ? 'on' : ''} onClick={() => sceneStore.setViewMode('assets')}>assets</button>
      <span className="ed-sep" />
      <button className={gizmoMode === 'translate' ? 'on' : ''} onClick={() => sceneStore.setGizmoMode('translate')} title="W">
        move
      </button>
      <button className={gizmoMode === 'rotate' ? 'on' : ''} onClick={() => sceneStore.setGizmoMode('rotate')} title="E">
        rotate
      </button>
      <span className="ed-sep" />
      <button disabled={!canUndo} onClick={() => sceneStore.undo()} title="⌘Z">↩</button>
      <button disabled={!canRedo} onClick={() => sceneStore.redo()} title="⇧⌘Z">↪</button>
      <span className="ed-sep" />
      <button className={camMode === 'fly' ? 'on' : ''} onClick={() => sceneStore.setCamMode('fly')}>fly</button>
      <button className={camMode === 'orbit' ? 'on' : ''} onClick={() => sceneStore.setCamMode('orbit')}>orbit</button>
      <span className="ed-hint">{camMode === 'fly' ? 'hold RMB: look + WASD/QE fly, shift turbo' : 'drag orbit · wheel zoom'}</span>
      {placing && (
        <span className="ed-placing">placing {placing.model ?? placing.prefab ?? placing.kind} — click/drop on any surface · shift multi · esc cancel</span>
      )}
      <span className="ed-spacer" />
      <button className="save" onClick={() => sceneStore.save()}>{saving ?? 'SAVE'}</button>
      <button onClick={() => window.open('/', '_blank')}>▶ play</button>
    </div>
  )
}

function componentBadge(n: SceneNode): string {
  return (n.components ?? []).map((c) => c.type).join(' ') || 'group'
}

function TreeRow({ node, depth, childrenOf, filter }: {
  node: SceneNode
  depth: number
  childrenOf: Map<string | null, SceneNode[]>
  filter: string
}) {
  const { selectedId, expanded } = useSceneEditor()
  const kids = childrenOf.get(node.id) ?? []
  const isOpen = expanded[node.id] ?? false
  // when filtering, show every match with its ancestry flattened
  const matches = (n: SceneNode): boolean =>
    n.id.toLowerCase().includes(filter) ||
    componentBadge(n).includes(filter) ||
    (childrenOf.get(n.id) ?? []).some(matches)
  if (filter && !matches(node)) return null

  return (
    <>
      <div
        className={`ed-item${node.id === selectedId ? ' sel' : ''}`}
        style={{ paddingLeft: 6 + depth * 12 }}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/node-id', node.id)
          e.dataTransfer.effectAllowed = 'move'
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('text/node-id')) e.preventDefault()
        }}
        onDrop={(e) => {
          const id = e.dataTransfer.getData('text/node-id')
          if (id && id !== node.id) {
            e.stopPropagation()
            sceneStore.reparent(id, node.id)
            sceneStore.toggleExpanded(node.id)
          }
        }}
        onClick={() => sceneStore.select(node.id)}
      >
        <span
          className="ed-caret"
          onClick={(e) => {
            e.stopPropagation()
            if (kids.length) sceneStore.toggleExpanded(node.id)
          }}
        >
          {kids.length ? (isOpen || filter ? '▾' : '▸') : '·'}
        </span>
        {node.name ?? node.id} <span>{componentBadge(node)}</span>
      </div>
      {(isOpen || filter) &&
        kids.map((k) => <TreeRow key={k.id} node={k} depth={depth + 1} childrenOf={childrenOf} filter={filter} />)}
    </>
  )
}

function Hierarchy() {
  const { nodes } = useSceneEditor()
  const [filter, setFilter] = useState('')
  const q = filter.toLowerCase()
  const byParent = useMemo(() => {
    const m = new Map<string | null, SceneNode[]>()
    for (const n of nodes) {
      const list = m.get(n.parent) ?? []
      list.push(n)
      m.set(n.parent, list)
    }
    return m
  }, [nodes])
  const roots = byParent.get(null) ?? []

  return (
    <div className="ed-left">
      <input className="ed-filter" placeholder="filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div
        className="ed-list"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('text/node-id')) e.preventDefault()
        }}
        onDrop={(e) => {
          // drop on empty list space = move to scene root
          const id = e.dataTransfer.getData('text/node-id')
          if (id) sceneStore.reparent(id, null)
        }}
      >
        {roots.map((n) => (
          <TreeRow key={n.id} node={n} depth={0} childrenOf={byParent} filter={q} />
        ))}
      </div>
    </div>
  )
}

function Num({ label, value, step = 0.1, onChange }: { label: string; value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="ed-field">
      {label}
      <input type="number" step={step} value={value} onChange={(e) => {
        const v = parseFloat(e.target.value)
        if (!Number.isNaN(v)) onChange(v)
      }} />
    </label>
  )
}

function Field({ def, component, onChange }: { def: FieldDef; component: Component; onChange: (patch: Partial<Component>) => void }) {
  const value = getPath(component, def.key)
  const label = def.label ?? def.key
  const set = (v: unknown) => onChange(withPath(component, def.key, v) as Partial<Component>)

  switch (def.kind) {
    case 'number':
      return <Num label={label} step={def.step} value={(value as number) ?? 0} onChange={set} />
    case 'color':
      return (
        <label className="ed-field">
          {label}
          <input type="color" value={(value as string) ?? '#ffffff'} onChange={(e) => set(e.target.value)} />
        </label>
      )
    case 'check':
      return (
        <label className="ed-check">
          <input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} />
          {label}
        </label>
      )
    case 'select':
      return (
        <label className="ed-field wide">
          {label}
          <select value={(value as string) ?? ''} onChange={(e) => set(e.target.value || undefined)}>
            {def.allowEmpty && <option value="">—</option>}
            {def.options.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
      )
    case 'text':
      return (
        <label className="ed-field wide">
          {label}
          <input type="text" value={(value as string) ?? ''} onChange={(e) => set(e.target.value || undefined)} />
        </label>
      )
    case 'vec': {
      const arr = (value as number[] | undefined) ?? new Array(def.dims).fill(0)
      return (
        <>
          {arr.slice(0, def.dims).map((v, i) => (
            <Num
              key={i}
              label={`${label}[${i}]`}
              step={def.step}
              value={v}
              onChange={(nv) => {
                const next = [...arr]
                next[i] = nv
                set(next)
              }}
            />
          ))}
        </>
      )
    }
    case 'numbers': {
      const arr = (value as number[] | undefined) ?? []
      return (
        <>
          {arr.map((v, i) => (
            <Num
              key={i}
              label={`${label}[${i}]`}
              step={def.step}
              value={v}
              onChange={(nv) => {
                const next = [...arr]
                next[i] = nv
                set(next)
              }}
            />
          ))}
        </>
      )
    }
  }
}

function ComponentSection({ nodeId, component, index }: { nodeId: string; component: Component; index: number }) {
  return (
    <div className="ed-section">
      <div className="ed-subhead">
        {component.type}
        <button className="danger ed-x" onClick={() => sceneStore.removeComponent(nodeId, index)} title="remove component">×</button>
      </div>
      <div className="ed-row" style={{ flexWrap: 'wrap' }}>
        {COMPONENT_FIELDS[component.type].map((def) => (
          <Field key={def.key} def={def} component={component} onChange={(patch) => sceneStore.updateComponent(nodeId, index, patch)} />
        ))}
      </div>
    </div>
  )
}

function Details({ node }: { node: SceneNode }) {
  const t = node.transform
  const setT = (patch: Partial<SceneNode['transform']>) => sceneStore.updateTransform(node.id, { ...t, ...patch })
  const setPos = (axis: 0 | 1 | 2, v: number) => {
    const pos = [...t.pos] as [number, number, number]
    pos[axis] = v
    setT({ pos })
  }
  const rotIsEuler = Array.isArray(t.rot)
  const [addType, setAddType] = useState('')

  return (
    <div className="ed-details">
      <div className="ed-id">{node.id} <span>({componentBadge(node)}{node.parent ? ` · in ${node.parent}` : ''})</span></div>
      <div className="ed-row">
        <Num label="x" value={t.pos[0]} onChange={(v) => setPos(0, v)} />
        <Num label="y" value={t.pos[1]} onChange={(v) => setPos(1, v)} />
        <Num label="z" value={t.pos[2]} onChange={(v) => setPos(2, v)} />
        {!rotIsEuler && (
          <Num label="rot°" step={5} value={Math.round((((t.rot as number) ?? 0) * 180) / Math.PI)} onChange={(v) => setT({ rot: (v * Math.PI) / 180 })} />
        )}
        <Num label="scale" step={0.05} value={t.scale ?? 1} onChange={(v) => setT({ scale: v })} />
      </div>
      {rotIsEuler && (
        <div className="ed-row">
          {(t.rot as [number, number, number]).map((r, i) => (
            <Num key={i} label={`r${'xyz'[i]}°`} step={5} value={Math.round((r * 180) / Math.PI)} onChange={(v) => {
              const rot = [...(t.rot as [number, number, number])] as [number, number, number]
              rot[i] = (v * Math.PI) / 180
              setT({ rot })
            }} />
          ))}
        </div>
      )}

      {(node.components ?? []).map((c, i) => (
        <ComponentSection key={`${c.type}-${i}`} nodeId={node.id} component={c} index={i} />
      ))}

      <div className="ed-row">
        <select value={addType} onChange={(e) => setAddType(e.target.value)}>
          <option value="">add component…</option>
          {Object.keys(COMPONENT_DEFAULTS).map((t) => <option key={t}>{t}</option>)}
        </select>
        <button
          disabled={!addType}
          onClick={() => {
            sceneStore.addComponent(node.id, structuredClone(COMPONENT_DEFAULTS[addType as keyof typeof COMPONENT_DEFAULTS]))
            setAddType('')
          }}
        >
          +
        </button>
      </div>

      <div className="ed-row">
        <button onClick={() => sceneStore.duplicate(node.id)}>duplicate</button>
        <button onClick={() => sceneStore.makePrefab(node.id)} title="move subtree to the library, leave an instance here">→ prefab</button>
        <button className="danger" onClick={() => sceneStore.remove(node.id)}>delete</button>
      </div>
    </div>
  )
}

function RightPanel() {
  const { nodes, selectedId } = useSceneEditor()
  const selected = nodes.find((n) => n.id === selectedId)
  return (
    <div className="ed-right">
      {selected ? <Details node={selected} /> : <div className="ed-empty">select something</div>}
    </div>
  )
}

function PaletteStrip() {
  const { placing, thumbs, nodes } = useSceneEditor()
  const [search, setSearch] = useState('')
  const q = search.toLowerCase()
  const prefabs = nodes.filter((n) => n.parent === 'library')
  const arm = (spec: PlacingSpec, armed: boolean) => sceneStore.setPlacing(armed ? null : spec)

  return (
    <div className="ed-bottom">
      <input className="ed-palette-search" placeholder="search…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {SPECIAL_KINDS.filter((s) => s.kind.toLowerCase().includes(q)).map((s) => {
        const armed = placing?.kind === s.kind
        return (
          <div
            key={s.kind}
            className={`editor-tile text${armed ? ' on' : ''}`}
            draggable
            onDragStart={() => sceneStore.setPlacing({ kind: s.kind })}
            onClick={() => arm({ kind: s.kind }, armed)}
            title={s.kind}
          >
            {s.label}
          </div>
        )
      })}
      {prefabs.filter((p) => p.id.toLowerCase().includes(q)).map((p) => {
        const armed = placing?.prefab === p.id
        return (
          <div
            key={`prefab:${p.id}`}
            className={`editor-tile text${armed ? ' on' : ''}`}
            draggable
            onDragStart={() => sceneStore.setPlacing({ prefab: p.id })}
            onClick={() => arm({ prefab: p.id }, armed)}
            title={`prefab: ${p.id}`}
          >
            ⧉ {p.id}
          </div>
        )
      })}
      {MODEL_NAMES.filter((m) => m.toLowerCase().includes(q)).map((m) => {
        const armed = placing?.model === m
        return (
          <div
            key={m}
            className={`editor-tile${armed ? ' on' : ''}`}
            draggable
            onDragStart={() => sceneStore.setPlacing({ model: m })}
            onClick={() => arm({ model: m }, armed)}
            title={m}
          >
            {thumbs[m] ? <img src={thumbs[m]} alt={m} /> : <span>{m}</span>}
          </div>
        )
      })}
    </div>
  )
}

function EditableScene() {
  const { nodes } = useSceneEditor()
  const nodeIds = useNodeIds()
  return (
    <group name="level">
      <group
        onClick={(e) => {
          e.stopPropagation()
          let o: THREE.Object3D | null = e.object
          while (o) {
            if (o.name && nodeIds.has(o.name)) {
              sceneStore.select(o.name)
              return
            }
            o = o.parent
          }
        }}
      >
        <SceneRoot nodes={nodes} mode="editor" />
      </group>
    </group>
  )
}

export function EditorApp() {
  // keyboard: W/E gizmo (fly cam owns WASD/QE while flying), undo/redo, delete, escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return
      const s = sceneStore.get()
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ') {
        e.preventDefault()
        if (e.shiftKey) sceneStore.redo()
        else sceneStore.undo()
      } else if (!s.flying && e.code === 'KeyW') {
        sceneStore.setGizmoMode('translate')
      } else if (!s.flying && e.code === 'KeyE') {
        sceneStore.setGizmoMode('rotate')
      } else if ((e.code === 'Delete' || e.code === 'Backspace') && s.selectedId) {
        sceneStore.remove(s.selectedId)
      } else if (e.code === 'Escape') {
        if (s.placing) sceneStore.setPlacing(null)
        else sceneStore.select(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const { viewMode } = useSceneEditor()

  return (
    <div className="ed-frame">
      <Toolbar />
      {viewMode === 'assets' ? (
        <AssetsView />
      ) : (
        <div className="ed-main">
          <Hierarchy />
          <div className="ed-viewport">
            <Canvas gl={{ antialias: true }} dpr={window.devicePixelRatio}>
              <Suspense fallback={null}>
                <Physics gravity={[0, -12, 0]} paused>
                  <EditableScene />
                </Physics>
              </Suspense>
              <EditorCamera />
              <EditorChrome />
              <NodeGizmo />
              <ScenePlacer />
              <ThumbnailFactory />
              {import.meta.env.DEV && <DevViews />}
            </Canvas>
          </div>
          <RightPanel />
        </div>
      )}
      <PaletteStrip />
    </div>
  )
}
