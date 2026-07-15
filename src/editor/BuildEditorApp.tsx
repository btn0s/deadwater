import { Suspense, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import { SceneRoot } from '../engine/render'
import type { SceneNode } from '../engine/types'
import { MODEL_NAMES } from '../engine/models'
import {
  sceneStore,
  useSceneEditor,
  type BuildPanel,
  type PlacingSpec,
} from '../engine/sceneStore'
import { BuildPlayerControls } from './BuildPlayerControls'
import { BuildInteraction } from './BuildInteraction'
import { buildInteractionActions } from './buildInteractionActions'
import { Details } from './EditorApp'
import { ThumbnailFactory } from './Thumbnails'
import { SPECIAL_KINDS } from './catalog'

function placingLabel(spec: PlacingSpec): string {
  return spec.model ?? spec.prefab ?? spec.kind ?? 'asset'
}

function BuildScene() {
  const { nodes } = useSceneEditor()
  return <SceneRoot nodes={nodes} mode="build" />
}

function BuildGrid() {
  const { buildSnap } = useSceneEditor()
  if (!buildSnap) return null
  return (
    <Grid
      position={[0, 0.015, 0]}
      args={[100, 80]}
      cellSize={0.25}
      cellThickness={0.35}
      cellColor="#426849"
      sectionSize={1}
      sectionThickness={0.7}
      sectionColor="#73a77b"
      fadeDistance={45}
      fadeStrength={1.3}
      infiniteGrid
    />
  )
}

interface DrawerProps {
  requestLock: () => void
}

function CatalogDrawer({ requestLock }: DrawerProps) {
  const { nodes, thumbs } = useSceneEditor()
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()
  const prefabs = nodes.filter((node) => node.parent === 'library')
  const choose = (spec: PlacingSpec) => {
    sceneStore.setPlacing(spec)
    sceneStore.setBuildPanel(null)
    requestLock()
  }

  return (
    <aside className="build-drawer build-catalog" aria-label="Build catalog">
      <div className="build-drawer-head">
        <div>
          <strong>BUILD</strong>
          <span>choose an asset, then press E in the world</span>
        </div>
        <button onClick={() => { sceneStore.setBuildPanel(null); requestLock() }}>close</button>
      </div>
      <input
        className="build-search"
        autoFocus
        placeholder="Search models and prefabs…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="build-catalog-scroll">
        <CatalogSection title="Composed">
          {SPECIAL_KINDS.filter((item) => item.kind.toLowerCase().includes(query)).map((item) => (
            <button className="build-card build-card-text" key={item.kind} onClick={() => choose({ kind: item.kind })}>
              <span>{item.label}</span>
              <small>composed</small>
            </button>
          ))}
        </CatalogSection>
        {prefabs.some((prefab) => prefab.id.toLowerCase().includes(query)) && (
          <CatalogSection title="Prefabs">
            {prefabs.filter((prefab) => prefab.id.toLowerCase().includes(query)).map((prefab) => (
              <button className="build-card build-card-text" key={prefab.id} onClick={() => choose({ prefab: prefab.id })}>
                <span>{prefab.id}</span>
                <small>prefab</small>
              </button>
            ))}
          </CatalogSection>
        )}
        <CatalogSection title="Models">
          {MODEL_NAMES.filter((name) => name.toLowerCase().includes(query)).map((name) => (
            <button className="build-card" key={name} onClick={() => choose({ model: name })}>
              {thumbs[name] ? <img src={thumbs[name]} alt="" /> : <span className="build-card-placeholder" />}
              <span>{name}</span>
            </button>
          ))}
        </CatalogSection>
      </div>
    </aside>
  )
}

function CatalogSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="build-catalog-section">
      <h2>{title}</h2>
      <div className="build-card-grid">{children}</div>
    </section>
  )
}

function InspectorDrawer({ requestLock }: DrawerProps) {
  const { nodes, selectedId } = useSceneEditor()
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()
  const selected = nodes.find((node) => node.id === selectedId)
  const matches = query
    ? nodes.filter((node) => {
        const components = (node.components ?? []).map((component) => component.type).join(' ')
        return `${node.id} ${node.name ?? ''} ${components}`.toLowerCase().includes(query)
      }).slice(0, 80)
    : []

  const chooseNode = (node: SceneNode) => {
    sceneStore.select(node.id)
    setSearch('')
  }

  return (
    <aside className="build-drawer build-inspector" aria-label="Tune inspector">
      <div className="build-drawer-head">
        <div>
          <strong>TUNE</strong>
          <span>exact transforms and components</span>
        </div>
        <button onClick={() => { sceneStore.setBuildPanel(null); requestLock() }}>close</button>
      </div>
      <input
        className="build-search"
        placeholder="Find any scene node…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {query && (
        <div className="build-node-results">
          {matches.map((node) => (
            <button key={node.id} className={node.id === selectedId ? 'on' : ''} onClick={() => chooseNode(node)}>
              <span>{node.name ?? node.id}</span>
              <small>{(node.components ?? []).map((component) => component.type).join(' ') || 'group'}</small>
            </button>
          ))}
          {matches.length === 0 && <div className="build-drawer-empty">no matching nodes</div>}
        </div>
      )}
      <div className="build-inspector-scroll">
        {selected ? <Details node={selected} /> : <div className="build-drawer-empty">Aim at an object or search for a node.</div>}
      </div>
    </aside>
  )
}

function ToolbarButton({
  children,
  active = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return <button className={active ? 'on' : ''} {...props}>{children}</button>
}

function promptFor(state: ReturnType<typeof sceneStore.get>): string {
  if (state.placing) return `E  PLACE ${placingLabel(state.placing).toUpperCase()}  ·  ESC CANCEL`
  if (state.buildHoldingId) return 'E  COMMIT  ·  R ROTATE  ·  WHEEL DISTANCE  ·  ESC CANCEL'
  if (state.buildAimedId) return `E  MOVE ${state.buildAimedId.toUpperCase()}`
  return 'AIM AT AN OBJECT'
}

export function BuildEditorApp() {
  const state = useSceneEditor()
  const canvasHolder = useRef<HTMLDivElement>(null)
  const classicQuery = new URLSearchParams(window.location.search)
  classicQuery.set('classic', '')

  const requestLock = () => {
    const canvas = canvasHolder.current?.querySelector('canvas')
    if (!canvas || document.pointerLockElement === canvas) return
    try {
      void canvas.requestPointerLock().catch(() => {})
    } catch {
      // The resume card remains available for another click.
    }
  }

  const openPanel = (panel: Exclude<BuildPanel, null>) => {
    buildInteractionActions.commit()
    sceneStore.setBuildPanel(panel)
    if (document.pointerLockElement) void document.exitPointerLock()
  }

  const undo = () => {
    buildInteractionActions.cancel()
    sceneStore.undo()
  }

  const redo = () => {
    buildInteractionActions.cancel()
    sceneStore.redo()
  }

  const save = () => {
    buildInteractionActions.commit()
    void sceneStore.save()
  }

  const enterDress = () => {
    sceneStore.setBuildPanel(null)
    requestLock()
  }

  useEffect(() => {
    const warnIfDirty = (event: BeforeUnloadEvent) => {
      const current = sceneStore.get()
      if (!current.dirty && !current.buildHoldingId) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warnIfDirty)
    return () => window.removeEventListener('beforeunload', warnIfDirty)
  }, [])

  const selected = state.nodes.find((node) => node.id === state.selectedId)

  return (
    <div className="build-editor">
      <header className="build-toolbar">
        <strong className="build-logo">DEADWATER <span>BUILD</span></strong>
        <div className="build-toolbar-group">
          <ToolbarButton active={state.buildMoveMode === 'walk'} onClick={() => sceneStore.setBuildMoveMode('walk')}>walk</ToolbarButton>
          <ToolbarButton active={state.buildMoveMode === 'fly'} onClick={() => sceneStore.setBuildMoveMode('fly')}>fly <kbd>N</kbd></ToolbarButton>
          <ToolbarButton active={state.buildSnap} onClick={() => sceneStore.setBuildSnap(!state.buildSnap)}>snap <kbd>G</kbd></ToolbarButton>
        </div>
        <div className="build-toolbar-group">
          <button disabled={!state.canUndo} onClick={undo} title="Undo">↩</button>
          <button disabled={!state.canRedo} onClick={redo} title="Redo">↪</button>
        </div>
        <div className="build-toolbar-group build-layers" aria-label="Authoring layer">
          <ToolbarButton active={state.buildPanel === null} onClick={enterDress}>dress <kbd>Esc</kbd></ToolbarButton>
          <ToolbarButton active={state.buildPanel === 'catalog'} onClick={() => openPanel('catalog')}>build <kbd>Q</kbd></ToolbarButton>
          <ToolbarButton active={state.buildPanel === 'inspector'} onClick={() => openPanel('inspector')}>tune <kbd>I</kbd></ToolbarButton>
        </div>
        <div className="build-selection" title={selected?.id}>
          {selected ? <><span>selected</span>{selected.name ?? selected.id}</> : <span>nothing selected</span>}
        </div>
        <div className="build-toolbar-spacer" />
        <a className="build-classic-link" href={`?${classicQuery}`} onClick={() => buildInteractionActions.commit()}>classic</a>
        <button className={`build-save${state.dirty ? ' dirty' : ''}`} disabled={state.saving === 'saving…'} onClick={save}>
          {state.saving ?? (state.dirty ? 'SAVE *' : 'SAVE')}
        </button>
      </header>

      <div className="build-viewport" ref={canvasHolder}>
        <Canvas
          camera={{ fov: 60, near: 0.1, far: 300, position: [-18.3, 1.65, 1.6] }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          dpr={Math.min(window.devicePixelRatio, 2)}
        >
          <Suspense fallback={null}>
            <BuildScene />
          </Suspense>
          <BuildGrid />
          <BuildPlayerControls />
          <BuildInteraction />
          <ThumbnailFactory enabled={state.buildPanel === 'catalog'} />
        </Canvas>

        {state.buildPanel === null && (
          <>
            <div className={`build-crosshair${state.buildAimedId ? ' active' : ''}${state.buildHoldingId ? ' holding' : ''}`} />
            <div className="build-prompt">{promptFor(state)}</div>
            <div className="build-help">
              WASD move · shift fast · N walk/fly · E move/place · Q build · I tune · Esc dress/cancel · ⌘Z undo · ⌘S save
            </div>
          </>
        )}

        {!state.buildLocked && state.buildPanel === null && (
          <button className="build-resume" onClick={requestLock}>
            <strong>ENTER BUILD VIEW</strong>
            <span>click to capture the mouse</span>
          </button>
        )}

        {state.buildPanel === 'catalog' && <CatalogDrawer requestLock={requestLock} />}
        {state.buildPanel === 'inspector' && <InspectorDrawer requestLock={requestLock} />}
      </div>
    </div>
  )
}
