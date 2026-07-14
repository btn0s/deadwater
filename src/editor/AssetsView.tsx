import { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { Physics } from '@react-three/rapier'
import { MODELS, FBX_MODELS } from '../game/Prop'
import { ItemVisual } from '../game/PlacedItems'
import { ambientColor, rawColorFromString } from '../ps2/PS2Material'
import { useEditor, editorStore, type PrefabChild, type LayoutItem } from '../game/editorStore'

/**
 * Assets tab: inspect any model on a clean stage, compose several into a
 * prefab with gizmos, and save it — prefabs become placeable palette entries
 * stored in layout.json.
 */

interface StageItem extends PrefabChild {
  id: number
}

const ALL_MODELS: { kind: 'prop' | 'fbx'; model: string }[] = [
  ...Object.keys(MODELS).map((model) => ({ kind: 'prop' as const, model })),
  ...Object.keys(FBX_MODELS).map((model) => ({ kind: 'fbx' as const, model })),
]

function StageBoost() {
  // the stage has no lamps — lift ambient so models are readable
  const prev = useRef<THREE.Color | null>(null)
  if (!prev.current) {
    prev.current = ambientColor.clone()
    ambientColor.copy(rawColorFromString('#8a8f96'))
  }
  return null
}

function StageItemView({ item, selected, onSelect, onCommit }: {
  item: StageItem
  selected: boolean
  onSelect: () => void
  onCommit: (pos: [number, number, number], rot: number) => void
}) {
  const group = useRef<THREE.Group>(null)
  const layoutItem: LayoutItem = { ...item, id: `stage-${item.id}`, pos: [0, 0, 0], rot: 0 }
  return (
    <>
      <group
        ref={group}
        position={item.pos}
        rotation={[0, item.rot ?? 0, 0]}
        onPointerDown={(e) => {
          e.stopPropagation()
          onSelect()
        }}
      >
        <ItemVisual item={layoutItem} inert zeroed />
      </group>
      {selected && (
        <TransformControls
          object={group as React.RefObject<THREE.Group>}
          mode={editorStore.get().gizmoMode}
          translationSnap={0.05}
          rotationSnap={Math.PI / 36}
          onMouseUp={() => {
            const g = group.current
            if (g) onCommit([+g.position.x.toFixed(3), +g.position.y.toFixed(3), +g.position.z.toFixed(3)], +g.rotation.y.toFixed(3))
          }}
        />
      )}
    </>
  )
}

export function AssetsView() {
  const { thumbs, prefabs } = useEditor()
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState<StageItem[]>([])
  const [stageSel, setStageSel] = useState<number | null>(null)
  const [prefabName, setPrefabName] = useState('')
  const nextId = useRef(1)

  const filtered = useMemo(
    () => ALL_MODELS.filter((m) => m.model.toLowerCase().includes(search.toLowerCase())),
    [search],
  )

  const addToStage = (kind: 'prop' | 'fbx', model: string) => {
    const id = nextId.current++
    setStage((s) => [...s, { id, kind, model, pos: [s.length * 1.2 - 1, 0, 0], rot: 0 }])
    setStageSel(id)
  }

  const savePrefab = () => {
    const name = prefabName.trim().replace(/[^a-zA-Z0-9-_]/g, '-')
    if (!name || stage.length === 0) return
    editorStore.addPrefab({
      name,
      children: stage.map(({ id: _id, ...rest }) => rest),
    })
    setPrefabName('')
  }

  const loadPrefab = (name: string) => {
    const def = prefabs.find((p) => p.name === name)
    if (!def) return
    setStage(def.children.map((c) => ({ ...c, id: nextId.current++ })))
    setPrefabName(name)
    setStageSel(null)
  }

  return (
    <div className="ed-main">
      <div className="ed-left">
        <input className="ed-filter" placeholder="search models…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="ed-list">
          {filtered.map((m) => {
            const key = `${m.kind}:${m.model}`
            return (
              <div key={key} className="ed-item" onClick={() => addToStage(m.kind, m.model)} title="click to add to stage">
                {thumbs[key] && <img className="ed-mini" src={thumbs[key]} alt="" />}
                {m.model} <span>{m.kind}</span>
              </div>
            )
          })}
          {prefabs.length > 0 && <div className="ed-subhead ed-listhead">prefabs</div>}
          {prefabs.map((p) => (
            <div key={p.name} className="ed-item" onClick={() => loadPrefab(p.name)} title="click to load onto stage">
              {p.name} <span>prefab · {p.children.length}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ed-viewport">
        <Canvas gl={{ antialias: true }} dpr={window.devicePixelRatio} camera={{ position: [3, 2.5, 3.5], fov: 45 }}>
          <Suspense fallback={null}>
            <Physics gravity={[0, 0, 0]} paused>
              <StageBoost />
              <group>
                {stage.map((it) => (
                  <StageItemView
                    key={it.id}
                    item={it}
                    selected={it.id === stageSel}
                    onSelect={() => setStageSel(it.id)}
                    onCommit={(pos, rot) => setStage((s) => s.map((x) => (x.id === it.id ? { ...x, pos, rot } : x)))}
                  />
                ))}
              </group>
            </Physics>
          </Suspense>
          <Grid position={[0, 0, 0]} args={[20, 20]} cellSize={0.5} cellColor="#3a4046" sectionSize={2} sectionColor="#4f6b52" fadeDistance={30} />
          <OrbitControls makeDefault target={[0, 0.6, 0]} />
        </Canvas>
      </div>

      <div className="ed-right">
        <div className="ed-details">
          <div className="ed-subhead">prefab stage</div>
          <div className="ed-hint">click models on the left to add · gizmo them · name & save</div>
          <div className="ed-row">
            <input placeholder="prefab name…" value={prefabName} onChange={(e) => setPrefabName(e.target.value)} style={{ flex: 1 }} />
          </div>
          <div className="ed-row">
            <button onClick={savePrefab} disabled={!prefabName.trim() || stage.length === 0}>save prefab</button>
            <button onClick={() => { setStage([]); setStageSel(null); setPrefabName('') }}>clear stage</button>
          </div>
          {stage.length > 0 && (
            <div className="ed-section">
              <div className="ed-subhead">on stage</div>
              {stage.map((it) => (
                <div key={it.id} className={`ed-item${it.id === stageSel ? ' sel' : ''}`} onClick={() => setStageSel(it.id)}>
                  {it.model}
                  <button
                    className="danger ed-x"
                    onClick={(e) => {
                      e.stopPropagation()
                      setStage((s) => s.filter((x) => x.id !== it.id))
                      if (stageSel === it.id) setStageSel(null)
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="ed-hint">
            prefabs save into layout.json on SAVE and appear in the scene palette
          </div>
        </div>
      </div>
    </div>
  )
}
