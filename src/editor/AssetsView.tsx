import { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { ambientColor, rawColorFromString } from '../ps2/PS2Material'
import { EngineContext, NodeView, indexScene } from '../engine/render'
import type { SceneNode } from '../engine/types'
import { MODEL_REGISTRY, MODEL_NAMES } from '../engine/models'
import { sceneStore, useSceneEditor, subtreeIds } from '../engine/sceneStore'

/**
 * Assets tab: inspect any model on a clean stage, compose several into a
 * prefab with gizmos, and save it — prefabs become library subtrees in
 * scene.json, placeable from the palette as instances.
 */

function StageBoost() {
  // the stage has no lamps — lift ambient so models are readable
  const prev = useRef<THREE.Color | null>(null)
  if (!prev.current) {
    prev.current = ambientColor.clone()
    ambientColor.copy(rawColorFromString('#8a8f96'))
  }
  return null
}

function StageNodeView({ node, index, selected, onSelect, onCommit }: {
  node: SceneNode
  index: ReturnType<typeof indexScene>
  selected: boolean
  onSelect: () => void
  onCommit: (pos: [number, number, number], rot: number) => void
}) {
  const group = useRef<THREE.Group>(null)
  return (
    <>
      <group
        ref={group}
        position={node.transform.pos}
        rotation={[0, (node.transform.rot as number) ?? 0, 0]}
        onPointerDown={(e) => {
          e.stopPropagation()
          onSelect()
        }}
      >
        <NodeView node={{ ...node, transform: { pos: [0, 0, 0] } }} index={index} />
      </group>
      {selected && (
        <TransformControls
          object={group as React.RefObject<THREE.Group>}
          mode={sceneStore.get().gizmoMode}
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
  const { thumbs, nodes } = useSceneEditor()
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState<SceneNode[]>([])
  const [stageSel, setStageSel] = useState<string | null>(null)
  const [prefabName, setPrefabName] = useState('')
  const nextId = useRef(1)

  const prefabs = nodes.filter((n) => n.parent === 'library')
  const filtered = useMemo(
    () => MODEL_NAMES.filter((m) => m.toLowerCase().includes(search.toLowerCase())),
    [search],
  )
  const stageIndex = useMemo(() => indexScene(stage), [stage])

  const addToStage = (model: string) => {
    const id = `stage-${nextId.current++}`
    setStage((s) => [
      ...s,
      {
        id,
        parent: null,
        transform: { pos: [s.length * 1.2 - 1, 0, 0], rot: 0 },
        components: [
          { type: 'model', ...MODEL_REGISTRY[model] },
          { type: 'physics', body: 'dynamic', collider: 'hull', grabbable: true },
        ],
      },
    ])
    setStageSel(id)
  }

  const savePrefab = () => {
    const name = prefabName.trim().replace(/[^a-zA-Z0-9-_]/g, '-')
    if (!name || stage.length === 0) return
    // replace an existing prefab of the same name wholesale
    const old = nodes.find((n) => n.parent === 'library' && n.id === name)
    if (old) for (const id of subtreeIds(nodes, old.id)) sceneStore.remove(id)
    const root: SceneNode = { id: name, parent: 'library', library: true, transform: { pos: [0, 0, 0] } }
    const children = stage.map((s, i) => ({
      ...structuredClone(s),
      id: `${name}/${i + 1}`,
      parent: name,
    }))
    sceneStore.add(root, children)
    setPrefabName('')
  }

  const loadPrefab = (id: string) => {
    const children = nodes.filter((n) => n.parent === id)
    setStage(children.map((c) => ({ ...structuredClone(c), id: `stage-${nextId.current++}`, parent: null })))
    setPrefabName(id)
    setStageSel(null)
  }

  return (
    <div className="ed-main">
      <div className="ed-left">
        <input className="ed-filter" placeholder="search models…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="ed-list">
          {filtered.map((m) => (
            <div key={m} className="ed-item" onClick={() => addToStage(m)} title="click to add to stage">
              {thumbs[m] && <img className="ed-mini" src={thumbs[m]} alt="" />}
              {m} <span>{MODEL_REGISTRY[m].source}</span>
            </div>
          ))}
          {prefabs.length > 0 && <div className="ed-subhead ed-listhead">prefabs</div>}
          {prefabs.map((p) => (
            <div key={p.id} className="ed-item" onClick={() => loadPrefab(p.id)} title="click to load onto stage">
              {p.id} <span>prefab · {nodes.filter((n) => n.parent === p.id).length}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ed-viewport">
        <Canvas gl={{ antialias: true }} dpr={window.devicePixelRatio} camera={{ position: [3, 2.5, 3.5], fov: 45 }}>
          <Suspense fallback={null}>
            <EngineContext.Provider value="editor">
              <StageBoost />
              <group>
                {stage.map((n) => (
                  <StageNodeView
                    key={n.id}
                    node={n}
                    index={stageIndex}
                    selected={n.id === stageSel}
                    onSelect={() => setStageSel(n.id)}
                    onCommit={(pos, rot) =>
                      setStage((s) => s.map((x) => (x.id === n.id ? { ...x, transform: { pos, rot } } : x)))
                    }
                  />
                ))}
              </group>
            </EngineContext.Provider>
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
              {stage.map((n) => (
                <div key={n.id} className={`ed-item${n.id === stageSel ? ' sel' : ''}`} onClick={() => setStageSel(n.id)}>
                  {n.components?.find((c) => c.type === 'model')?.url.split('/').pop() ?? n.id}
                  <button
                    className="danger ed-x"
                    onClick={(e) => {
                      e.stopPropagation()
                      setStage((s) => s.filter((x) => x.id !== n.id))
                      if (stageSel === n.id) setStageSel(null)
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="ed-hint">prefabs live in scene.json's library — SAVE writes them with the scene</div>
        </div>
      </div>
    </div>
  )
}
