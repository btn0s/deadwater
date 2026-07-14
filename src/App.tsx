import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { PS2Pipeline } from './ps2/PS2Pipeline'
import { PlayerController } from './game/PlayerController'
import { PlayerBody } from './game/PlayerBody'
import { Telekinesis } from './game/Telekinesis'
import { Room } from './game/Room'
import { DevViews } from './game/DevViews'
import { editorStore } from './game/editorStore'

export default function App() {
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    // this entry is always game mode; the editor lives at /editor.html
    editorStore.setActive(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' && !document.pointerLockElement && (e.target as HTMLElement)?.tagName !== 'INPUT') {
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
              <Room />
              <PlayerBody />
            </Physics>
          </Suspense>
          <PlayerController onLockChange={setLocked} spawn={[15, 8.5]} initialYaw={Math.PI / 3} />
          <Telekinesis />
          <PS2Pipeline />
          {import.meta.env.DEV && <DevViews />}
        </Canvas>

        {locked ? (
          <div className="crosshair" />
        ) : (
          <div className="overlay">
            <div className="title">DEADWATER</div>
            <div className="hint">CLICK TO ENTER</div>
            <div className="keys">WASD MOVE&ensp;·&ensp;SHIFT RUN&ensp;·&ensp;SPACE JUMP&ensp;·&ensp;E EDITOR&ensp;·&ensp;ESC RELEASE</div>
          </div>
        )}
      </div>
    </div>
  )
}
