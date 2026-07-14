import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PS2Pipeline } from './ps2/PS2Pipeline'
import { PlayerController } from './game/PlayerController'
import { Room } from './game/Room'

export default function App() {
  const [locked, setLocked] = useState(false)

  return (
    <div className="frame">
      <div className="viewport">
        <Canvas gl={{ antialias: false, powerPreference: 'high-performance' }} dpr={1}>
          <Suspense fallback={null}>
            <Room />
          </Suspense>
          <PlayerController onLockChange={setLocked} spawn={[15, 8.5]} initialYaw={Math.PI / 3} />
          <PS2Pipeline />
        </Canvas>

        {locked ? (
          <div className="crosshair" />
        ) : (
          <div className="overlay">
            <div className="title">STORAGE — SUBLEVEL 2</div>
            <div className="hint">CLICK TO ENTER</div>
            <div className="keys">WASD MOVE&ensp;·&ensp;SHIFT RUN&ensp;·&ensp;SPACE JUMP&ensp;·&ensp;ESC RELEASE</div>
          </div>
        )}
      </div>
    </div>
  )
}
