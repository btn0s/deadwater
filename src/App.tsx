import { Suspense, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { SewerWater } from './game/SewerWater'
import { ambientColor, fogSettings, lightPositions, lightColors, lightRadii } from './ps2/PS2Material'
import { acquireLightSlot, releaseLightSlot } from './engine/lights'
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
    const data = { title: 'DEADWATER', text: 'A PS2-era dock warehouse. Bring a torch.', url: window.location.href }
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

/** slow drift over the harbor for the mobile gate backdrop */
function MenuCamera() {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    // no environment node mounts here — moonlight the water by hand, and
    // hang a couple of unseen sodium dock lights low over the swell
    const prevAmbient = ambientColor.getHex()
    const prevNear = fogSettings.near.value
    const prevFar = fogSettings.far.value
    // the water texture is intentionally near-black (motion sells it, not
    // contrast) — a menu vignette needs hot values to read at all
    ambientColor.setRGB(1.5, 1.7, 1.8)
    fogSettings.near.value = 4
    fogSettings.far.value = 34
    const slots = [
      { pos: [-3.5, 2.6, -7] as const, rgb: [8.0, 6.2, 3.4] as const, radius: 16 },
      { pos: [5.5, 3.0, -14] as const, rgb: [3.6, 5.6, 4.2] as const, radius: 18 },
    ].map((l) => {
      const i = acquireLightSlot()
      if (i >= 0) {
        lightPositions[i].set(...l.pos)
        lightColors[i].setRGB(...l.rgb)
        lightRadii[i] = l.radius
      }
      return i
    })
    return () => {
      slots.forEach((i) => i >= 0 && releaseLightSlot(i))
      ambientColor.setHex(prevAmbient)
      fogSettings.near.value = prevNear
      fogSettings.far.value = prevFar
    }
  }, [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    camera.position.set(Math.sin(t * 0.05) * 0.6, 2.1 + Math.sin(t * 0.21) * 0.08, 1.5)
    camera.lookAt(Math.sin(t * 0.03) * 3, -0.6, -8)
  })
  return null
}

/** phones get the creepy water and a share button, not broken controls */
function MobileGate() {
  return (
    <div className="frame">
      <div className="viewport gate">
        <Canvas gl={{ antialias: false }} dpr={1} camera={{ fov: 60, near: 0.1, far: 60 }}>
          <color attach="background" args={['#07080a']} />
          <fog attach="fog" args={['#07080a', 5, 30]} />
          {/* dock lights standing in the water, heads glowing */}
          {[
            { x: -3.5, z: -7, head: '#e8cf96' },
            { x: 5.5, z: -14, head: '#b8d8c2' },
          ].map((l) => (
            <group key={l.x} position={[l.x, 0, l.z]}>
              <mesh position={[0, 1.3, 0]}>
                <cylinderGeometry args={[0.06, 0.09, 2.8, 6]} />
                <meshBasicMaterial color="#15171a" />
              </mesh>
              <mesh position={[0, 2.72, 0]}>
                <boxGeometry args={[0.5, 0.14, 0.22]} />
                <meshBasicMaterial color="#1b1e21" />
              </mesh>
              <mesh position={[0, 2.62, 0]}>
                <boxGeometry args={[0.34, 0.06, 0.16]} />
                <meshBasicMaterial color={l.head} />
              </mesh>
            </group>
          ))}
          <Suspense fallback={null}>
            <SewerWater position={[0, 0, -12]} size={[46, 34]} flow={[0.03, 0.012]} />
          </Suspense>
          <MenuCamera />
        </Canvas>
        <div className="overlay mobile-gate">
          <div className="title">DEADWATER</div>
          <div className="hint">NOT OPTIMIZED FOR MOBILE</div>
          <div className="keys">TRY IT ON DESKTOP — MOUSE AND KEYBOARD REQUIRED</div>
          <ShareButton />
        </div>
      </div>
    </div>
  )
}

const isMobile =
  typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches ||
    !('requestPointerLock' in document.documentElement) ||
    new URLSearchParams(window.location.search).has('mobile')) // preview the gate on desktop

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

  if (isMobile) return <MobileGate />

  return (
    <div className="frame">
      <div className="viewport">
        <Canvas gl={{ antialias: false, powerPreference: 'high-performance' }} dpr={1}>
          <Suspense fallback={null}>
            <Physics gravity={[0, -12, 0]}>
              <SceneRoot nodes={sceneNodes} mode="game" />
              <Cctv />
              <PlayerBody />
            </Physics>
          </Suspense>
          <PlayerController onLockChange={setLocked} spawn={[-18.3, 1.6]} initialYaw={-1.35} />
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
        {!locked && (
          <div className="overlay">
            <div className="title">DEADWATER</div>
            <div className="hint">CLICK TO ENTER</div>
            <div className="keys">WASD MOVE&ensp;·&ensp;SHIFT RUN&ensp;·&ensp;SPACE JUMP&ensp;·&ensp;ESC RELEASE</div>
            <div className="keys">E PICK UP / USE&ensp;·&ensp;CLICK PUT DOWN / SWING&ensp;·&ensp;HOLD RMB FLOAT&ensp;·&ensp;F STOW&ensp;·&ensp;1-4 ITEMS</div>
            <ShareButton />
          </div>
        )}
      </div>
    </div>
  )
}
