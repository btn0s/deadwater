# DEADWATER game feel

Use this reference when movement, looking, grabbing, carrying, using equipment, prompts, transitions, or environmental feedback works but feels unclear or weightless. Tune the existing R3F systems. Do not add a class-based loop or bypass the fixed render pipeline.

## Order of work

1. Input truth: the intended pointer, key, or button reaches one owner.
2. State truth: the player, inventory, held body, interaction, and HUD agree.
3. Motion response: acceleration, damping, reach, anchor, and delta clamping feel deliberate.
4. Contact response: prompt, world change, sound, and animation occur on the same transition.
5. Camera and screen response: feedback remains readable in the 4:3 view.
6. Repetition: variants and timing avoid obvious mechanical repetition without breaking deterministic artifacts.

Fix disagreement or latency before adding camera motion, flashes, or extra sound.

## R3F frame discipline

Use `useFrame` only for continuous render-time behavior. Keep mutable frame state in refs and scratch objects. Clamp `rawDt` before applying movement, smoothing, timers, or carried velocity:

```tsx
const velocity = useRef(new THREE.Vector3())
const target = useMemo(() => new THREE.Vector3(), [])

useFrame((_, rawDt) => {
  const dt = Math.min(rawDt, 0.05)
  const blend = 1 - Math.exp(-12 * dt)
  velocity.current.lerp(target, blend)
})
```

Do not call React state setters each frame for values used only by the scene. Publish state to DOM UI only when the value changes meaningfully. Ordinary gameplay updates use default priority. `PS2Pipeline` owns positive-priority rendering.

## Movement and look

The controller's feel comes from several values that must be tuned together:

- walk and run speed
- grounded and air acceleration
- jump speed and gravity
- player radius and step height
- look sensitivity and pitch clamp
- head-bob frequency and amplitude
- eye height and fixed projection

Keep exponential velocity approach so response remains frame-rate independent. Do not make head bob continue while airborne or still. Reset held keys when pointer lock leaves the game. Test diagonal movement, short taps, run transitions, jump release, wall sliding, stairs or low clutter, and re-entering pointer lock.

The camera is the player. Avoid arbitrary shake or FOV animation unless a specific event earns it. Any FOV change must restore the 60 degree base and call `updateProjectionMatrix`, while retaining 4:3 aspect and `manual = true`.

## Reticle and prompt feel

Interaction feedback should answer three questions immediately:

1. What am I aiming at?
2. What input is available?
3. What changed when I used it?

The center ray must stop at the first solid hit. Use a modest invisible hit proxy for thin small pickups, but do not make the proxy extend beyond the believable object area. Keep prompts short and stable. The crosshair may change for a grabbable or held state, but it should not bloom into a large targeting UI.

Fire the world action, prompt update, HUD change, and one-shot sound from the same state transition or from observers of that transition. Avoid timers that make an immediate switch or pickup feel delayed.

## Carry feel

Hands mode and floating mode should feel different:

| Mode | Desired response | Main tuning |
| --- | --- | --- |
| Small hands carry | Fixed to left-hand view anchor, no visible lag | anchor, object-size offset |
| Large hands carry | Centered, blocks equipment, feels bulky | threshold, centered anchor, hotbar lock |
| Floating carry | Smooth arm's-length follow with slight motion | stiffness, distance, vertical clamp, spin |
| Release or toss | Restores physics and carries bounded player motion | velocity sample, forward nudge, cap |

Never add spring lag to the hands path if it makes held items trail through the camera. Keep floating carry smooth with exponential interpolation. Clamp target position against world bounds before sending a kinematic transform. Clear carry and inventory lock together.

## Inventory and equipment feel

- Slot changes and stow happen on key down, not through a per-frame poll.
- The hotbar keeps fixed slot dimensions and reveals active, stowed, and locked states without moving.
- Pickup selects the new item only after `inventory.add` succeeds.
- Two-handed carry dims or locks the hotbar and restores the prior stow state on release.
- Tool animation can use `useFrame`, but tool availability comes from `useInventory`.
- Repeated swing or toggle input needs one owner and a clear cooldown if applicable.

## Audio coupling

`play()` lazily resumes Web Audio and chooses a sample variant. Call it at the owning event:

- takeoff scuff and landing
- distance-based grounded footsteps
- pickup success
- light switch state change
- door transition
- carry pickup or release
- equipment action

Do not fire a sound merely because a boolean remains true. If a sample is not decoded yet, failing quietly may be acceptable for existing optional feedback, but new critical audio should expose a load or decode error during development.

Pitch variation may use runtime randomness for non-authoritative sound. Keep authored geometry, collision, objectives, actor seeds, and visual comparison setup deterministic.

## Transitions and screen feedback

Use the existing DOM fade for area transitions. It should:

- begin immediately after a valid action
- run the teleport at the darkest point
- prevent overlapping transitions
- release within the existing short hold
- leave pointer-lock and input state coherent

Prefer small CSS or DOM pulses for HUD state. Do not add a generic post-processing stack. `PS2Pipeline` already renders depth, torch shadow, CCTV, main color, and the final CRT-style blit.

If adding camera impulse, write it after the controller's base transform and before the pipeline renders, then make it additive and bounded. Never call `gl.render` for the effect.

## Determinism and contact sheets

`mulberry32(seed)` is the stable PRNG for generator geometry and actors. Store the seed in the corresponding scene component and keep generated results in `useMemo` or refs.

Use `window.__teleport` to put the player at a known position and `window.__sheet(name?)` to create labeled visual comparisons. Contact sheets render their own cameras into an offscreen target and temporarily lift fog and ambient values. They do not use the player camera or the full `PS2Pipeline` final blit, so also inspect the active game view for final dither, letterboxing, prompts, and held equipment.

Do not add global deterministic claims that the code cannot support. Random light flicker and audio variation may differ between play sessions. Stabilize only the source that invalidates the test you need.

## Tuning table

Record changed values and the observation behind them.

| Axis | Current owner | Evidence |
| --- | --- | --- |
| Movement response | `PlayerController` constants | short tap, sustained walk/run, diagonal |
| Collision clearance | player radius, `STEP_HEIGHT`, scene blockers | doorway, wall slide, low clutter |
| Interaction read | `MAX_REACH`, per-entry `maxDist`, hit proxy | aimed, occluded, edge of range |
| Hand weight | carry anchors, `BIG_SIZE`, toss cap | small prop, large prop, sprint toss |
| Equipment feedback | equipment component and `play()` | input-to-motion and sound timing |
| Area transition | `fadeThrough` hold | double input, arrival orientation |
| Visual readability | light/fog/component values | active game view and named sheet |

## Common mistakes

- Adding feedback before fixing competing input owners.
- Writing state to React on every frame.
- Using variable raw delta after tab sleep.
- Adding FOV or shake that hides the prompt or next doorway.
- Letting a held body remain kinematic after release.
- Playing sound every frame while a condition remains true.
- Randomizing authored prop geometry without a scene seed.
- Treating contact sheets as proof of the final 4:3 postprocessed view.
- Adding screen effects through another composer or render loop.
