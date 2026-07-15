import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { PS2Pipeline } from './ps2/PS2Pipeline'
import { PlayerController } from './game/PlayerController'
import { PlayerBody } from './game/PlayerBody'
import { Telekinesis } from './game/Telekinesis'
import { DevViews } from './game/DevViews'
import { InteractionSystem, usePrompt, useFade } from './game/interactions'
import { InventoryKeys, useInventory, SLOT_COUNT } from './game/inventory'
import { Flashlight } from './game/Flashlight'
import { player } from './game/playerState'
import { SceneRoot } from './engine/render'
import { sceneNodes } from './engine/scene'

function Hotbar() {
  const { slots, active, stowed } = useInventory()
  return (
    <div className="hotbar">
      {Array.from({ length: SLOT_COUNT }, (_, i) => (
        <div key={i} className={`hotbar-slot${i === active ? (stowed ? ' on stowed' : ' on') : ''}`}>
          <span className="hotbar-key">{i + 1}</span>
          {slots[i] && <span className="hotbar-item">{slots[i].label}</span>}
        </div>
      ))}
    </div>
  )
}

function Hud({ locked }: { locked: boolean }) {
  const prompt = usePrompt()
  const faded = useFade()
  return (
    <>
      {locked && <div className="crosshair" />}
      {locked && prompt && <div className="use-prompt">E&ensp;{prompt}</div>}
      {locked && <Hotbar />}
      <div className={`fade${faded ? ' on' : ''}`} />
    </>
  )
}

export default function App() {
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    // this entry is always game mode; the editor lives at /editor.html
    const onKey = (e: KeyboardEvent) => {
      if (
        e.code === 'KeyE' &&
        !document.pointerLockElement &&
        !player.locked && // dev-lock counts as playing too
        (e.target as HTMLElement)?.tagName !== 'INPUT'
      ) {
        window.location.href = '/editor.html'
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="frame">
      <div className="viewport">
        <Canvas gl={{ antialias: false, powerPreference: 'high-performance' }} dpr={1}>
          <Suspense fallback={null}>
            <Physics gravity={[0, -12, 0]}>
              <SceneRoot nodes={sceneNodes} mode="game" />
              <PlayerBody />
            </Physics>
          </Suspense>
          <PlayerController onLockChange={setLocked} spawn={[-18.3, 1.6]} initialYaw={-1.35} />
          <Telekinesis />
          <InteractionSystem />
          <InventoryKeys />
          <Flashlight />
          <PS2Pipeline />
          {import.meta.env.DEV && <DevViews />}
        </Canvas>

        <Hud locked={locked} />
        {!locked && (
          <div className="overlay">
            <div className="title">DEADWATER</div>
            <div className="hint">CLICK TO ENTER</div>
            <div className="keys">WASD MOVE&ensp;·&ensp;SHIFT RUN&ensp;·&ensp;SPACE JUMP&ensp;·&ensp;E USE/EDITOR&ensp;·&ensp;ESC RELEASE</div>
          </div>
        )}
      </div>
    </div>
  )
}
