/**
 * DEADWATER engine scene model: a flat table of nodes forming a tree via
 * parent refs, each node carrying a transform and a list of components.
 * The whole world — props, lights, walls, prefabs — is nodes. scene.json
 * is the single source of truth for both the game and the editor.
 */

export interface Transform {
  pos: [number, number, number]
  /** yaw-only shorthand (radians); full euler as a tuple */
  rot?: number | [number, number, number]
  scale?: number
}

export interface SceneNode {
  id: string
  /** display name; defaults to id */
  name?: string
  /** parent node id; null = child of the scene root */
  parent: string | null
  transform: Transform
  components?: Component[]
  /** library nodes (prefab definitions) are not rendered into the scene */
  library?: boolean
}

export interface SceneFile {
  nodes: SceneNode[]
}

// ---------------------------------------------------------------- components

/** GLTF/FBX mesh. FBX needs an explicit base-color texture. */
export interface ModelComponent {
  type: 'model'
  source: 'gltf' | 'fbx'
  url: string
  texture?: string
  /** split multi-mesh models into independently simulated pieces, grouped by
   * a name pattern: 'suffix-ab' groups *_a / *_b (military crate), 'mesh'
   * makes every mesh its own piece */
  split?: 'mesh' | 'suffix-ab'
}

/** Point light with shaded-fixture downward cone; slot allocated at runtime. */
export interface LightComponent {
  type: 'light'
  color: string
  intensity: number
  radius: number
  /** telegraph-noise fluorescent flicker */
  flicker?: boolean
  /** 0 = omni, 1 = shaded downward cone */
  spot?: number
  /** named circuit a wall switch can kill (e.g. 'warehouse', 'office') */
  group?: string
}

/** Wall switch: E toggles a light group's circuit. */
export interface SwitchComponent {
  type: 'switch'
  group: string
  /** HUD prompt (default 'LIGHTS') */
  label?: string
}

/** World pickup: E takes it into the hotbar and the node disappears. */
export interface PickupComponent {
  type: 'pickup'
  /** inventory item id, e.g. 'flashlight' */
  item: string
  /** HUD prompt (default 'TAKE') */
  label?: string
}

/** Rapier body. Dynamic bodies can be telekinesis-grabbable. On fixed bodies
 * blockPlayer adds a player-movement AABB (from size when given, else the
 * rendered bounds). collider 'none' = no rapier body — player blocking only. */
export interface PhysicsComponent {
  type: 'physics'
  body: 'fixed' | 'dynamic'
  collider: 'hull' | 'trimesh' | 'cuboid' | 'none'
  /** explicit half-extents for cuboid colliders (else derived from bounds) */
  size?: [number, number, number]
  grabbable?: boolean
  blockPlayer?: boolean
}

/** Tessellated textured plane — walls, floors, ceilings, signs. */
export interface SurfaceComponent {
  type: 'surface'
  width: number
  height: number
  segments?: [number, number]
  texture: string
  repeat: [number, number]
  tint?: string
  bombing?: number
}

/** Parametric mesh with a PS2 material — the primitive-assembly vocabulary
 * (pump bodies, desks, railings, trim). */
export interface PrimitiveComponent {
  type: 'primitive'
  shape: 'box' | 'cylinder' | 'torus' | 'plane'
  /** shape-specific dimensions: box [w,h,d]; cylinder [rTop,rBottom,h,segs];
   * torus [r, tube, radialSegs, tubularSegs]; plane [w,h] */
  dims: number[]
  texture?: string
  repeat?: [number, number]
  tint?: string
  fullbright?: boolean
}

/** Procedural set pieces with seeded generation. */
export interface GeneratorComponent {
  type: 'generator'
  generator: 'paperWad' | 'trashPile' | 'rack' | 'railing'
  seed?: number
  /** paperWad: [size]; trashPile: [radius, height];
   * railing: [length, postSpacing] along local x */
  params?: number[]
}

/** Animated sewer-water plane (dual scrolling layers + sine vertex waves). */
export interface WaterComponent {
  type: 'water'
  width: number
  height: number
}

/** Usable door: near it, the player presses E and fades to the target spot.
 * The door never swings — PS2-style area transition. */
export interface DoorComponent {
  type: 'door'
  /** where the player lands: [x, z] */
  target: [number, number]
  /** facing after the transition (radians; 0 = -z) */
  targetYaw?: number
  /** HUD prompt, e.g. "EXIT TO DOCKS" */
  label?: string
  /** interaction radius (default 1.8) */
  radius?: number
  /** locked doors show the prompt but E does nothing — world dressing */
  locked?: boolean
}

/** Scripted actors. */
export interface BehaviorComponent {
  type: 'behavior'
  behavior: 'rat'
  seed?: number
}

/** Instance of a library subtree (prefab). */
export interface InstanceComponent {
  type: 'instance'
  of: string
}

/** Scene-level settings; lives on a root-level node. */
export interface EnvironmentComponent {
  type: 'environment'
  ambient: string
  fog: { color: string; near: number; far: number }
}

export type Component =
  | ModelComponent
  | LightComponent
  | PhysicsComponent
  | SurfaceComponent
  | PrimitiveComponent
  | GeneratorComponent
  | BehaviorComponent
  | InstanceComponent
  | EnvironmentComponent
  | WaterComponent
  | DoorComponent
  | SwitchComponent
  | PickupComponent

export type ComponentType = Component['type']
