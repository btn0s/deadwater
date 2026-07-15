import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import * as THREE from 'three'
import { PS2Pipeline } from './ps2/PS2Pipeline'
import { PlayerController } from './game/PlayerController'
import { PlayerBody } from './game/PlayerBody'
import { CarrySystem } from './game/Carry'
import { ZoneCulling } from './game/zoneCulling'
import { AudioSystem } from './game/audio'
import { Cctv } from './game/Cctv'
import { DevViews } from './game/DevViews'
import { InteractionSystem, usePrompt, useFade } from './game/interactions'
import { InventoryKeys, useInventory, SLOT_COUNT } from './game/inventory'
import { Flashlight } from './game/Flashlight'
import { Crowbar } from './game/Crowbar'
import { player } from './game/playerState'
import { SceneRoot } from './engine/render'
import { sceneNodes } from './engine/scene'

function Hotbar() {
  const { slots, active, stowed, carryLock } = useInventory()
  return (
    <div className={`hotbar${carryLock ? ' locked' : ''}`}>
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

function ShareButton() {
  const [copied, setCopied] = useState(false)
  const share = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const data = { title: 'DEADWATER', text: 'A PS2-era night shift on a dead harbor.', url: window.location.href }
    if (navigator.share) {
      try {
        await navigator.share(data)
        return
      } catch {
        /* dismissed — fall through to copy */
      }
    }
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button className="share-button" onClick={share}>
      {copied ? 'LINK COPIED' : 'SHARE WITH FRIENDS'}
    </button>
  )
}

/** Attract camera: adrift in the harbor, looking back at the lit dock.
 * Runs in the real level — it just stands the "player" out on the water so
 * zone culling keeps the yard visible. */
function MenuOceanRig() {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera & { manual?: boolean }
    cam.fov = 60
    cam.near = 0.1
    cam.far = 120
    cam.manual = false // R3F keeps aspect synced to the canvas
    cam.updateProjectionMatrix()
    player.x = 56
    player.z = 2
  }, [camera])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    camera.position.set(50 + Math.sin(t * 0.05) * 1.2, 2.6 + Math.sin(t * 0.23) * 0.14, 2 + Math.cos(t * 0.04) * 1.6)
    camera.lookAt(26, 2.2, 5)
  })
  return null
}

const isMobile =
  typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches ||
    !('requestPointerLock' in document.documentElement) ||
    new URLSearchParams(window.location.search).has('mobile')) // preview on desktop

export default function App() {
  const [phase, setPhase] = useState<'menu' | 'game'>('menu')
  const [locked, setLocked] = useState(false)
  const [cover, setCover] = useState(false)
  const canvasHolder = useRef<HTMLDivElement>(null)

  const resume = () => {
    // Chrome enforces a short cooldown after an ESC exit — if the request
    // rejects, the pause menu just stays up for the next try
    try {
      void (canvasHolder.current?.querySelector('canvas')?.requestPointerLock() as unknown as Promise<void>)?.catch?.(() => {})
    } catch {
      /* stay paused */
    }
  }

  const clockIn = () => {
    // fade covers the cut from the harbor to the warehouse spawn; the lock
    // request must happen inside this click gesture
    setCover(true)
    setPhase('game')
    resume()
    setTimeout(() => setCover(false), 1100)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      // E from the main menu opens the editor; the editor lives at /editor.html
      if (e.code === 'KeyE' && phase === 'menu' && !document.pointerLockElement && !player.locked) {
        window.location.href = '/editor.html'
      }
      // ESC while paused resumes (ESC while playing exits pointer lock —
      // the browser owns that half of the toggle)
      if (e.code === 'Escape' && phase === 'game' && !player.locked) {
        resume()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  return (
    <div className={`frame${isMobile ? ' mobile-menu' : ''}`}>
      <div className="viewport" ref={canvasHolder}>
        <Canvas gl={{ antialias: false, powerPreference: 'high-performance' }} dpr={1}>
          <Suspense fallback={null}>
            <Physics gravity={[0, -12, 0]}>
              <SceneRoot nodes={sceneNodes} mode="game" />
              <Cctv />
              <PlayerBody />
            </Physics>
          </Suspense>
          {phase === 'menu' ? (
            <MenuOceanRig />
          ) : (
            <PlayerController onLockChange={setLocked} spawn={[-18.3, 1.6]} initialYaw={-1.35} />
          )}
          <CarrySystem />
          <ZoneCulling />
          <AudioSystem />
          <InteractionSystem />
          <InventoryKeys />
          <Flashlight />
          <Crowbar />
          <PS2Pipeline />
          {import.meta.env.DEV && <DevViews />}
        </Canvas>

        <Hud locked={locked} />
        {phase === 'game' && !locked && !cover && (
          <div className="overlay pause">
            <div className="pause-head">PAUSED</div>
            <button className="menu-button" onClick={resume}>
              RESUME
            </button>
            <button className="menu-button quit" onClick={() => setPhase('menu')}>
              QUIT TO TITLE
            </button>
            <div className="keys">WASD MOVE&ensp;·&ensp;SHIFT RUN&ensp;·&ensp;SPACE JUMP&ensp;·&ensp;ESC PAUSE</div>
            <div className="keys">E PICK UP / USE&ensp;·&ensp;CLICK PUT DOWN / SWING&ensp;·&ensp;HOLD RMB FLOAT&ensp;·&ensp;F STOW&ensp;·&ensp;1-4 ITEMS</div>
          </div>
        )}
        {phase === 'menu' && !isMobile && (
          <div className="overlay menu">
            <div className="title">DEADWATER</div>
            <div className="menu-blurb">
              Night shift at a freight depot on dead water. Warehouse, sewer works, dock.
              Find the breakers. Find the torch. Carry what you can.
            </div>
            <button className="clock-in" onClick={clockIn}>
              CLOCK IN
            </button>
            <div className="keys">WASD MOVE&ensp;·&ensp;SHIFT RUN&ensp;·&ensp;SPACE JUMP&ensp;·&ensp;ESC RELEASE</div>
            <div className="keys">E PICK UP / USE&ensp;·&ensp;CLICK PUT DOWN / SWING&ensp;·&ensp;HOLD RMB FLOAT&ensp;·&ensp;F STOW&ensp;·&ensp;1-4 ITEMS</div>
          </div>
        )}
        <div className={`fade${cover ? ' on' : ''}`} />
      </div>
      {isMobile && (
        <div className="menu-card">
          <div className="title">DEADWATER</div>
          <p>
            A playable vignette: the night shift at a freight depot on dead water — a warehouse to
            wander, breakers to flip, a torch to find, junk with real weight, and the harbor lapping
            at the dock.
          </p>
          <p className="menu-card-note">DEADWATER is best on desktop — it needs a mouse and keyboard.</p>
          <ShareButton />
        </div>
      )}
    </div>
  )
}
