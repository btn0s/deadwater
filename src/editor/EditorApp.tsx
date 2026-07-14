import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, FlyControls, PerspectiveCamera } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { Room, TEXTURE_OPTIONS } from '../game/Room'
import { DevViews } from '../game/DevViews'
import { EditorChrome, FloorPlacer, ThumbnailFactory } from '../game/EditorExtras'
import { useEditor, editorStore, type LayoutItem, type WorldSettings } from '../game/editorStore'
import { MODELS, FBX_MODELS } from '../game/Prop'

const SPECIAL_KINDS = [
  { kind: 'lamp', label: '💡 lamp' },
  { kind: 'paperWad', label: '📄 wad' },
  { kind: 'trashPile', label: '🗑 pile' },
  { kind: 'loadedPallet', label: '📦 pallet+' },
  { kind: 'rack', label: '🗄 rack' },
] as const

const PALETTE: { kind: 'prop' | 'fbx'; model: string }[] = [
  ...Object.keys(MODELS).map((model) => ({ kind: 'prop' as const, model })),
  ...Object.keys(FBX_MODELS).map((model) => ({ kind: 'fbx' as const, model })),
]

function EditorCamera() {
  const { camMode } = useEditor()
  return (
    <>
      <PerspectiveCamera makeDefault fov={55} near={0.1} far={300} position={[14, 18, 20]} />
      {camMode === 'orbit' ? (
        <OrbitControls makeDefault target={[0, 0, -2]} />
      ) : (
        <FlyControls makeDefault movementSpeed={8} rollSpeed={0.6} dragToLook />
      )}
    </>
  )
}

function Toolbar() {
  const { saving, gizmoMode, camMode, placing, canUndo, canRedo } = useEditor()
  return (
    <div className="ed-toolbar">
      <strong className="ed-logo">DEADWATER</strong>
      <span className="ed-sep" />
      <button className={gizmoMode === 'translate' ? 'on' : ''} onClick={() => editorStore.setGizmoMode('translate')} title="W">
        move
      </button>
      <button className={gizmoMode === 'rotate' ? 'on' : ''} onClick={() => editorStore.setGizmoMode('rotate')} title="E">
        rotate
      </button>
      <span className="ed-sep" />
      <button disabled={!canUndo} onClick={() => editorStore.undo()} title="⌘Z">↩</button>
      <button disabled={!canRedo} onClick={() => editorStore.redo()} title="⇧⌘Z">↪</button>
      <span className="ed-sep" />
      <button className={camMode === 'orbit' ? 'on' : ''} onClick={() => editorStore.setCamMode('orbit')}>orbit</button>
      <button className={camMode === 'fly' ? 'on' : ''} onClick={() => editorStore.setCamMode('fly')}>fly</button>
      <span className="ed-hint">{camMode === 'fly' ? 'WASD+RF · drag look' : 'drag orbit · wheel zoom'}</span>
      {placing && (
        <span className="ed-placing">placing {placing.model ?? placing.kind} — click floor · shift multi · esc cancel</span>
      )}
      <span className="ed-spacer" />
      <button className="save" onClick={() => editorStore.save()}>{saving ?? 'SAVE'}</button>
      <button onClick={() => window.open('/', '_blank')}>▶ play</button>
    </div>
  )
}

function Hierarchy() {
  const { items, selectedId } = useEditor()
  const [filter, setFilter] = useState('')
  return (
    <div className="ed-left">
      <input className="ed-filter" placeholder="filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div className="ed-list">
        {items
          .filter((i) => i.id.includes(filter) || (i.model ?? '').includes(filter) || i.kind.includes(filter))
          .map((i) => (
            <div key={i.id} className={`ed-item${i.id === selectedId ? ' sel' : ''}`} onClick={() => editorStore.select(i.id)}>
              {i.id} <span>{i.kind}{i.model ? `:${i.model}` : ''}</span>
            </div>
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

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="ed-field">
      {label}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="ed-check">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function Details({ item }: { item: LayoutItem }) {
  const set = (patch: Partial<LayoutItem>) => editorStore.update(item.id, patch)
  const setPos = (axis: 0 | 1 | 2, v: number) => {
    const pos = [...item.pos] as [number, number, number]
    pos[axis] = v
    set({ pos })
  }
  return (
    <div className="ed-details">
      <div className="ed-id">{item.id} <span>({item.kind}{item.model ? `:${item.model}` : ''})</span></div>
      <div className="ed-row">
        <Num label="x" value={item.pos[0]} onChange={(v) => setPos(0, v)} />
        <Num label="y" value={item.pos[1]} onChange={(v) => setPos(1, v)} />
        <Num label="z" value={item.pos[2]} onChange={(v) => setPos(2, v)} />
        <Num label="rot°" step={5} value={Math.round(((item.rot ?? 0) * 180) / Math.PI)} onChange={(v) => set({ rot: (v * Math.PI) / 180 })} />
      </div>

      {item.kind === 'lamp' && (
        <div className="ed-section">
          <div className="ed-subhead">light</div>
          <div className="ed-row">
            <ColorField label="color" value={item.color ?? '#d8e6c8'} onChange={(v) => set({ color: v })} />
            <Num label="intensity" step={0.05} value={item.intensity ?? 1.2} onChange={(v) => set({ intensity: v })} />
            <Num label="radius" step={0.5} value={item.radius ?? 18} onChange={(v) => set({ radius: v })} />
            <Num label="light y" step={0.1} value={item.lightY ?? item.pos[1] - 1.4} onChange={(v) => set({ lightY: v })} />
          </div>
          <Check label="flicker" value={item.flicker ?? false} onChange={(v) => set({ flicker: v })} />
        </div>
      )}

      {(item.kind === 'prop' || item.kind === 'fbx') && (
        <div className="ed-section">
          <div className="ed-row">
            <Check label="grabbable" value={item.grabbable ?? false} onChange={(v) => set({ grabbable: v })} />
            <Check label="collide" value={item.collide ?? true} onChange={(v) => set({ collide: v })} />
          </div>
          <Num label="scale" step={0.05} value={item.scale ?? 1} onChange={(v) => set({ scale: v })} />
        </div>
      )}

      {item.kind === 'loadedPallet' && (
        <div className="ed-section">
          <label className="ed-field">
            variant
            <select value={item.variant ?? 0} onChange={(e) => set({ variant: parseInt(e.target.value) })}>
              <option value={0}>boxes</option>
              <option value={1}>crate + box</option>
              <option value={2}>plastic crates</option>
            </select>
          </label>
        </div>
      )}

      {item.kind === 'trashPile' && (
        <div className="ed-row">
          <Num label="radius" value={item.radius ?? 1.2} onChange={(v) => set({ radius: v })} />
          <Num label="height" value={item.height ?? 0.35} onChange={(v) => set({ height: v })} />
          <Num label="junk" step={1} value={item.items ?? 5} onChange={(v) => set({ items: Math.round(v) })} />
          <Num label="seed" step={1} value={item.seed ?? 1} onChange={(v) => set({ seed: Math.round(v) })} />
        </div>
      )}

      {item.kind === 'paperWad' && (
        <div className="ed-row">
          <Num label="size" step={0.01} value={item.size ?? 0.09} onChange={(v) => set({ size: v })} />
          <Num label="seed" step={1} value={item.seed ?? 1} onChange={(v) => set({ seed: Math.round(v) })} />
        </div>
      )}

      <div className="ed-row">
        <button onClick={() => editorStore.duplicate(item.id)}>duplicate</button>
        <button className="danger" onClick={() => editorStore.remove(item.id)}>delete</button>
      </div>
    </div>
  )
}

function SurfaceSection({ name, section }: { name: 'walls' | 'floor' | 'ceiling'; section: WorldSettings['walls'] }) {
  const set = (patch: Partial<WorldSettings['walls']>) => editorStore.updateWorld(name, patch)
  return (
    <div className="ed-section">
      <div className="ed-subhead">{name}</div>
      <label className="ed-field wide">
        texture
        <select value={section.texture} onChange={(e) => set({ texture: e.target.value })}>
          {TEXTURE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
        </select>
      </label>
      <div className="ed-row">
        <Num label="rep x" step={0.5} value={section.repeatX} onChange={(v) => set({ repeatX: v })} />
        <Num label="rep y" step={0.5} value={section.repeatY} onChange={(v) => set({ repeatY: v })} />
        <ColorField label="tint" value={section.tint} onChange={(v) => set({ tint: v })} />
        <Num label="bomb" step={0.25} value={section.bombing} onChange={(v) => set({ bombing: v })} />
      </div>
    </div>
  )
}

function WorldTab() {
  const { world } = useEditor()
  return (
    <div className="ed-details">
      <SurfaceSection name="walls" section={world.walls} />
      <SurfaceSection name="floor" section={world.floor} />
      <SurfaceSection name="ceiling" section={world.ceiling} />
      <div className="ed-section">
        <div className="ed-subhead">lighting & fog</div>
        <div className="ed-row">
          <ColorField label="ambient" value={world.ambient} onChange={(v) => editorStore.updateWorld('ambient', v)} />
          <ColorField label="fog" value={world.fog.color} onChange={(v) => editorStore.updateWorld('fog', { color: v })} />
          <Num label="near" step={0.5} value={world.fog.near} onChange={(v) => editorStore.updateWorld('fog', { near: v })} />
          <Num label="far" step={1} value={world.fog.far} onChange={(v) => editorStore.updateWorld('fog', { far: v })} />
        </div>
      </div>
    </div>
  )
}

function RightPanel() {
  const { items, selectedId, rightTab } = useEditor()
  const selected = items.find((i) => i.id === selectedId)
  return (
    <div className="ed-right">
      <div className="ed-tabs">
        <button className={rightTab === 'details' ? 'on' : ''} onClick={() => editorStore.setRightTab('details')}>details</button>
        <button className={rightTab === 'world' ? 'on' : ''} onClick={() => editorStore.setRightTab('world')}>world</button>
      </div>
      {rightTab === 'details' ? (
        selected ? <Details item={selected} /> : <div className="ed-empty">select something</div>
      ) : (
        <WorldTab />
      )}
    </div>
  )
}

function PaletteStrip() {
  const { placing, thumbs } = useEditor()
  return (
    <div className="ed-bottom">
      {SPECIAL_KINDS.map((s) => (
        <div
          key={s.kind}
          className={`editor-tile text${placing?.kind === s.kind ? ' on' : ''}`}
          onClick={() => editorStore.setPlacing(placing?.kind === s.kind && !placing.model ? null : { kind: s.kind })}
          title={s.kind}
        >
          {s.label}
        </div>
      ))}
      {PALETTE.map((p) => {
        const key = `${p.kind}:${p.model}`
        const armed = placing?.kind === p.kind && placing?.model === p.model
        return (
          <div
            key={key}
            className={`editor-tile${armed ? ' on' : ''}`}
            onClick={() => editorStore.setPlacing(armed ? null : { kind: p.kind, model: p.model })}
            title={p.model}
          >
            {thumbs[key] ? <img src={thumbs[key]} alt={p.model} /> : <span>{p.model}</span>}
          </div>
        )
      })}
    </div>
  )
}

export function EditorApp() {
  useEffect(() => {
    editorStore.setActive(true)
  }, [])

  // keyboard: W/E gizmo (orbit cam only — fly cam owns WASD/QE), undo/redo, delete, escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return
      const s = editorStore.get()
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ') {
        e.preventDefault()
        if (e.shiftKey) editorStore.redo()
        else editorStore.undo()
      } else if (s.camMode === 'orbit' && e.code === 'KeyW') {
        editorStore.setGizmoMode('translate')
      } else if (s.camMode === 'orbit' && e.code === 'KeyE') {
        editorStore.setGizmoMode('rotate')
      } else if ((e.code === 'Delete' || e.code === 'Backspace') && s.selectedId) {
        editorStore.remove(s.selectedId)
      } else if (e.code === 'Escape') {
        if (s.placing) editorStore.setPlacing(null)
        else editorStore.select(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="ed-frame">
      <Toolbar />
      <div className="ed-main">
        <Hierarchy />
        <div className="ed-viewport">
          <Canvas gl={{ antialias: true }} dpr={window.devicePixelRatio}>
            <Suspense fallback={null}>
              <Physics gravity={[0, -12, 0]} paused>
                <Room />
              </Physics>
            </Suspense>
            <EditorCamera />
            <EditorChrome />
            <FloorPlacer />
            <ThumbnailFactory />
            {import.meta.env.DEV && <DevViews />}
          </Canvas>
        </div>
        <RightPanel />
      </div>
      <PaletteStrip />
    </div>
  )
}
