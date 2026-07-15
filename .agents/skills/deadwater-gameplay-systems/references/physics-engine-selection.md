# Physics ownership in DEADWATER

Use this reference for bodies, colliders, player blocking, grabbables, carrying, contact behavior, tunneling, and physics performance. The engine choice is already made. DEADWATER uses `@react-three/rapier` inside R3F plus a small custom AABB navigation layer.

## Do not choose a new engine

Do not install or create a second physics world. Use the existing `<Physics gravity={[0, -12, 0]}>` boundary in `App.tsx` and declarative `RigidBody` and collider components. The editor mounts the same boundary paused so authoring renders do not simulate.

The two collision systems have separate jobs:

| System | Job | Owners |
| --- | --- | --- |
| Custom 2D AABB | Authoritative player XZ navigation, wall sliding, step-over threshold | `collision.ts`, `PlayerController.tsx`, `BlockPlayer` |
| Rapier | Dynamic props, fixed physical surfaces, debris contact, carry bodies, player push capsule | `@react-three/rapier`, `render.tsx`, `PlayerBody.tsx`, `Carry.tsx` |

Do not make both systems resolve the same player movement. The custom path moves the player; the Rapier capsule follows and pushes loose bodies.

## Scene physics components

`PhysicsComponent` is authored in `scene.json`:

```ts
interface PhysicsComponent {
  type: 'physics'
  body: 'fixed' | 'dynamic'
  collider: 'hull' | 'trimesh' | 'cuboid' | 'none'
  size?: [number, number, number]
  grabbable?: boolean
  blockPlayer?: boolean
}
```

Interpret it consistently:

- `fixed + hull/trimesh` wraps visuals in a fixed Rapier body.
- `fixed + cuboid + size` mounts an explicit `CuboidCollider`.
- `dynamic + grabbable` uses `GrabbableBody`, a dynamic hull, damping, density, and CCD.
- `collider: none` can still set `blockPlayer` for custom navigation blocking.
- `blockPlayer` registers a world-space AABB derived from explicit half-extents or rendered bounds.

Any schema change must also update the inspector and both engine modes.

## Collider selection

- Use cuboids for walls, shelves, barriers, and predictable box-shaped fixtures.
- Use hulls for ordinary convex loose props and fixed props where a rough shape is enough.
- Use trimesh only for fixed concave containers or level geometry that truly needs the shape.
- Never use a dynamic trimesh.
- Keep detailed visual geometry independent from the physical proxy.
- When deriving bounds, update world matrices first and test rotation and scale.
- Use `blockPlayer` only for geometry that should affect the custom navigation path.

If a prop catches, explodes, or floats, first simplify its collider and inspect spawn overlap before changing global gravity or solver settings.

## Body ownership and cleanup

Create bodies declaratively under the existing `<Physics>` provider. Hold `RapierRigidBody` refs only in the component that must issue commands.

- Register a grabbable after the body and visual root exist.
- Return the unregister function from the mounting effect.
- Avoid retaining a body handle after unmount or scene replacement.
- Use stable refs for per-frame target vectors and velocities.
- Do not call React state setters every physics frame.
- Let the React tree remove bodies and colliders. Do not mirror handles in a second world registry unless a gameplay query needs it.

## Carry state transitions

Carry changes an existing dynamic body rather than spawning a proxy:

```text
dynamic -> pick up -> KinematicPositionBased -> update next transform -> release -> dynamic
```

On every release path:

- Restore the dynamic body type.
- Apply capped linear velocity only when a toss is intended.
- Restore angular motion intentionally.
- Clear the held record.
- Clear inventory carry lock.

Test left-click release, right-button release, pointer-lock loss, component unmount, and scene reload. A body stuck kinematic or a hotbar stuck locked is a state-transition bug.

## Player contact

`PlayerController` calls `moveWithCollision` for XZ movement. It resolves one axis at a time to slide along AABBs and ignores blockers below `STEP_HEIGHT`. `PlayerBody` sends the shared position into `setNextKinematicTranslation` each frame.

When changing player size or blockers, update and test both representations:

- Custom circle radius and AABB bounds control navigation clearance.
- Capsule dimensions and height control physical contact with debris.
- Camera eye height controls what the player sees, not collision.

Keep these values related but do not assume they are interchangeable.

## Delta, CCD, and fast movement

R3F and Rapier own the simulation step. Gameplay callbacks should clamp `rawDt` before using it for held-object smoothing, player movement, or impulses.

- Keep CCD on loose grabbables that can be tossed quickly.
- Cap toss velocity.
- Do not enable CCD globally as a first response.
- Test after tab sleep and deliberate low-frame-rate throttling.
- Test spawn overlap, tight doorways, rotated blockers, shelves, and world-bound clamping.

## Diagnostics

Use the existing development hooks before adding new ones:

- `window.__testCollision(x, z, dx, dz, r)` checks custom player motion and returns collider count.
- `window.__colliders()` exposes registered AABBs.
- `window.__playerPos()` and `window.__teleport(...)` make locations repeatable.

For Rapier bugs, add a narrow development-only readout near the owning component. Useful values include body type, translation, linear velocity, sleeping state, collider shape, and held mode. Remove or gate high-frequency logging.

## Verification checklist

- Build and typecheck pass.
- The actual pointer-lock input path changes player position.
- Custom blockers prevent entry and allow wall sliding.
- Low geometry steps remain traversable.
- The kinematic capsule pushes loose props without steering the player.
- Dynamic props settle and wake when touched.
- Carry and floating modes enter and leave kinematic state cleanly.
- Ordinary tosses do not tunnel.
- Editor mode stays paused and does not scatter props.
- Body, collider, and registration counts return to baseline after unmount or reload.

## Common mistakes

- Adding an imperative Rapier world beside `@react-three/rapier`.
- Treating the player capsule as authoritative navigation.
- Wrapping editor visuals in live gameplay bodies.
- Using trimesh for dynamic props.
- Deriving blockers before world transforms settle.
- Switching body type without waking it or without restoring inventory state.
- Allocating vectors and quaternions inside every frame when stable scratch objects work.
- Fixing a local collider problem by changing global gravity.
