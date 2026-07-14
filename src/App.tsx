import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, FlyControls, PerspectiveCamera } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { Leva } from 'leva'
import { PS2Pipeline } from './ps2/PS2Pipeline'
import { PlayerController } from './game/PlayerController'
import { PlayerBody } from './game/PlayerBody'
import { Telekinesis } from './game/Telekinesis'
import { Room } from './game/Room'
import { DevViews } from './game/DevViews'
import { useEditor, editorStore, type LayoutItem } from './game/editorStore'
import { MODELS, FBX_MODELS } from './game/Prop'

const ADDABLE_KINDS: Record<string, string[]> = {
  prop: Object.keys(MODELS),
  fbx: Object.keys(FBX_MODELS),
  paperWad: ['-'],
  trashPile: ['-'],
  loadedPallet: ['-'],
  rack: ['-'],
}

function EditorCamera() {
  const { camMode } = useEditor()
  return (
    <>
      <PerspectiveCamera makeDefault fov={55} near={0.1} far={300} position={[14, 18, 20]} />
      {camMode === 'orbit' ? (
        <OrbitControls makeDefault target={[0, 0, -2]} />
      ) : (
        // WASD + RF to move, drag to look
        <FlyControls makeDefault movementSpeed={8} rollSpeed={0.6} dragToLook />
      )}
    </>
  )
}

function EditorPanel() {
  const { items, selectedId, saving, gizmoMode, camMode } = useEditor()
  const [filter, setFilter] = useState('')
  const [addKind, setAddKind] = useState('prop')
  const [addModel, setAddModel] = useState('cardboardBox')
  const selected = items.find((i) => i.id === selectedId)

  const setPos = (axis: 0 | 1 | 2, v: number) => {
    if (!selected || Number.isNaN(v)) return
    const pos = [...selected.pos] as [number, number, number]
    pos[axis] = v
    editorStore.update(selected.id, { pos })
  }

  const addItem = () => {
    const id = `new-${addKind}-${items.length + 1}`
    const item: LayoutItem = { id, kind: addKind as LayoutItem['kind'], pos: [0, 0, 0], rot: 0 }
    if (addKind === 'prop' || addKind === 'fbx') {
      item.model = addModel
      item.grabbable = true
      item.collide = false
    }
    if (addKind === 'paperWad') item.seed = Math.floor(Math.random() * 1000)
    if (addKind === 'trashPile') {
      item.seed = Math.floor(Math.random() * 1000)
      item.radius = 1.2
      item.height = 0.35
      item.items = 5
    }
    editorStore.add(item)
  }

  return (
    <div className="editor-panel">
      <div className="editor-head">
        <strong>DEADWATER EDITOR</strong>
        <button onClick={() => editorStore.setActive(false)}>exit</button>
      </div>

      <div className="editor-row">
        <button className={gizmoMode === 'translate' ? 'on' : ''} onClick={() => editorStore.setGizmoMode('translate')}>move</button>
        <button className={gizmoMode === 'rotate' ? 'on' : ''} onClick={() => editorStore.setGizmoMode('rotate')}>rotate</button>
        <button className="save" onClick={() => editorStore.save()}>{saving ?? 'SAVE'}</button>
      </div>
      <div className="editor-row">
        <button className={camMode === 'orbit' ? 'on' : ''} onClick={() => editorStore.setCamMode('orbit')}>orbit cam</button>
        <button className={camMode === 'fly' ? 'on' : ''} onClick={() => editorStore.setCamMode('fly')}>fly cam</button>
        <span className="editor-hint">{camMode === 'fly' ? 'WASD+RF move · drag look' : 'drag orbit · wheel zoom'}</span>
      </div>

      <div className="editor-row">
        <select value={addKind} onChange={(e) => { setAddKind(e.target.value); setAddModel(ADDABLE_KINDS[e.target.value][0]) }}>
          {Object.keys(ADDABLE_KINDS).map((k) => <option key={k}>{k}</option>)}
        </select>
        {(addKind === 'prop' || addKind === 'fbx') && (
          <select value={addModel} onChange={(e) => setAddModel(e.target.value)}>
            {ADDABLE_KINDS[addKind].map((m) => <option key={m}>{m}</option>)}
          </select>
        )}
        <button onClick={addItem}>add</button>
      </div>

      {selected && (
        <div className="editor-inspect">
          <div className="editor-id">{selected.id} <span>({selected.kind}{selected.model ? `:${selected.model}` : ''})</span></div>
          <div className="editor-row">
            {(['x', 'y', 'z'] as const).map((axis, i) => (
              <label key={axis}>
                {axis}
                <input
                  type="number"
                  step={0.1}
                  value={selected.pos[i]}
                  onChange={(e) => setPos(i as 0 | 1 | 2, parseFloat(e.target.value))}
                />
              </label>
            ))}
            <label>
              rot°
              <input
                type="number"
                step={5}
                value={Math.round(((selected.rot ?? 0) * 180) / Math.PI)}
                onChange={(e) => editorStore.update(selected.id, { rot: (parseFloat(e.target.value) * Math.PI) / 180 })}
              />
            </label>
          </div>
          <div className="editor-row">
            <button onClick={() => editorStore.duplicate(selected.id)}>duplicate</button>
            <button className="danger" onClick={() => editorStore.remove(selected.id)}>delete</button>
          </div>
        </div>
      )}

      <input className="editor-filter" placeholder="filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div className="editor-list">
        {items
          .filter((i) => i.id.includes(filter) || (i.model ?? '').includes(filter) || i.kind.includes(filter))
          .map((i) => (
            <div
              key={i.id}
              className={`editor-item${i.id === selectedId ? ' sel' : ''}`}
              onClick={() => editorStore.select(i.id)}
            >
              {i.id} <span>{i.kind}{i.model ? `:${i.model}` : ''}</span>
            </div>
          ))}
      </div>
    </div>
  )
}

export default function App() {
  const [locked, setLocked] = useState(false)
  const { active: editor } = useEditor()

  // E toggles the editor whenever the pointer isn't locked
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' && !document.pointerLockElement && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        editorStore.setActive(!editorStore.get().active)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className={`frame${editor ? ' editing' : ''}`}>
      <Leva hidden={locked || editor} collapsed titleBar={{ title: 'WORLD TUNING' }} />
      <div className="viewport">
        <Canvas gl={{ antialias: false, powerPreference: 'high-performance' }} dpr={editor ? window.devicePixelRatio : 1}>
          <Suspense fallback={null}>
            <Physics gravity={[0, -12, 0]} paused={editor}>
              <Room />
              {!editor && <PlayerBody />}
            </Physics>
          </Suspense>
          {!editor && <PlayerController onLockChange={setLocked} spawn={[15, 8.5]} initialYaw={Math.PI / 3} />}
          {!editor && <Telekinesis />}
          {!editor && <PS2Pipeline />}
          {editor && <EditorCamera />}
          {import.meta.env.DEV && <DevViews />}
        </Canvas>

        {!editor && (locked ? (
          <div className="crosshair" />
        ) : (
          <div className="overlay">
            <div className="title">DEADWATER</div>
            <div className="hint">CLICK TO ENTER</div>
            <div className="keys">WASD MOVE&ensp;·&ensp;SHIFT RUN&ensp;·&ensp;SPACE JUMP&ensp;·&ensp;E EDITOR&ensp;·&ensp;ESC RELEASE</div>
          </div>
        ))}
      </div>
      {editor && <EditorPanel />}
    </div>
  )
}
