import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Physics, useRapier } from '@react-three/rapier'
import * as THREE from 'three'
import { PS2Pipeline } from './ps2/PS2Pipeline'
import { PlayerController } from './game/PlayerController'
import { PlayerBody } from './game/PlayerBody'
import { carry, CarrySystem } from './game/Carry'
import { ZoneCulling } from './game/zoneCulling'
import { AudioSystem, playOnce, prepareAudio } from './game/audio'
import { Cctv } from './game/Cctv'
import { DevViews } from './game/DevViews'
import { InteractionSystem, usePrompt, useFade } from './game/interactions'
import { inventory, InventoryKeys, useInventory, SLOT_COUNT } from './game/inventory'
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
        <div
          key={i}
          className={`hotbar-slot${i === active ? ' on' : ''}${i === active && stowed ? ' stowed' : ''}`}
        >
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
  const crosshairClass =
    prompt?.kind === 'action'
      ? ' on-interactable'
      : prompt?.kind === 'manipulate'
        ? ' on-grabbable'
        : prompt?.kind === 'holding'
          ? ' holding'
          : ''
  return (
    <>
      {locked && <div className={`crosshair${crosshairClass}`} />}
      {locked && prompt && (
        <div className="use-prompt">
          {prompt.input}&ensp;{prompt.label}
        </div>
      )}
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

/** Props are authored slightly above their rest poses, so a fresh world
 * visibly rains junk everywhere. Whenever new bodies mount during the boot
 * window, fast-forward the simulation so they're already settled by the
 * time anything is on screen. */
const BOOT_SETTLE_SECONDS = 5
function SettleSim() {
  const { world } = useRapier()
  const age = useRef(0)
  const lastCount = useRef(-1)
  useFrame((_, dt) => {
    age.current += dt
    if (age.current > BOOT_SETTLE_SECONDS) return
    const n = world.bodies.len()
    if (n !== lastCount.current) {
      lastCount.current = n
      // pin the timestep: in vary mode it holds the last frame's dt, and
      // huge steps make the settle burst explode instead of settle
      const prev = world.timestep
      world.timestep = 1 / 60
      for (let i = 0; i < 90; i++) world.step()
      world.timestep = prev
    }
  })
  return null
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
  const [boot, setBoot] = useState(true) // hides first-load pop-in while SettleSim works
  const canvasHolder = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setBoot(false), 1600)
    return () => clearTimeout(t)
  }, [])

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
    // fade fully to black over the harbor first, cut to the spawn under
    // black, then fade back in — switching before the cover lands flashes
    // one raw frame of the warehouse. The delayed pointer-lock request is
    // still inside the click's transient activation window.
    setCover(true)
    void prepareAudio(10_000).then(() => playOnce('stinger_clock_in'))
    setTimeout(() => {
      setPhase('game')
      resume()
    }, 400)
    setTimeout(() => setCover(false), 1300)
  }

  const quitToTitle = () => {
    carry.reset()
    inventory.resetForMenu()
    setLocked(false)
    setPhase('menu')
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
              <SettleSim />
            </Physics>
          </Suspense>
          {phase === 'menu' ? (
            <MenuOceanRig />
          ) : (
            <PlayerController onLockChange={setLocked} spawn={[-18.3, 1.6]} initialYaw={-1.35} />
          )}
          <CarrySystem />
          <ZoneCulling />
          <AudioSystem active={phase === 'game'} />
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
            <button className="menu-button quit" onClick={quitToTitle}>
              QUIT TO TITLE
            </button>
            <div className="keys">WASD MOVE&ensp;·&ensp;SHIFT RUN&ensp;·&ensp;SPACE JUMP&ensp;·&ensp;ESC PAUSE</div>
            <div className="keys">E INTERACT / PICK UP / PUT DOWN&ensp;·&ensp;LMB ITEM ACTION&ensp;·&ensp;H HOLSTER / DRAW</div>
            <div className="keys">1-4 ITEMS&ensp;·&ensp;RMB RESERVED&ensp;·&ensp;F UNBOUND</div>
          </div>
        )}
        {phase === 'menu' && !isMobile && (
          <div className="overlay menu">
            <div className="title">DEADWATER</div>
            <div className="menu-blurb">
              A freight depot on dead water. Everyone else went home hours ago.
            </div>
            <button className="clock-in" onClick={clockIn}>
              CLOCK IN
            </button>
          </div>
        )}
        <div className={`fade${cover || boot ? ' on' : ''}`} />
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
