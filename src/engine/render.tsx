import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useFBX, useTexture } from '@react-three/drei'
import { RigidBody, CuboidCollider, type RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import {
  createPS2Material,
  prepTexture,
  rawColor,
  rawColorFromString,
  sharedLightUniforms,
  MAX_LIGHTS,
  ambientColor,
  fogSettings,
  lightPositions,
  lightColors,
  lightRadii,
  lightSpots,
} from '../ps2/PS2Material'
import { addCollider } from '../game/collision'
import { registerGrabbable } from '../game/grabbables'
import { mulberry32 } from '../game/rand'
import { Rat } from '../game/Rat'
import { Rack } from '../game/Rack'
import { SewerWater } from '../game/SewerWater'
import { registerInteractable } from '../game/interactions'
import { isGroupOn, toggleGroup } from '../game/lightGroups'
import { inventory, ITEM_DEFS } from '../game/inventory'
import { play } from '../game/audio'
import { player } from '../game/playerState'
import { useWorldTexture } from './textures'
import { MODEL_REGISTRY } from './models'
import { acquireLightSlot, releaseLightSlot } from './lights'
import type {
  SceneNode,
  Component,
  ModelComponent,
  LightComponent,
  PhysicsComponent,
  SurfaceComponent,
  PrimitiveComponent,
  GeneratorComponent,
  InstanceComponent,
  EnvironmentComponent,
  WaterComponent,
  DoorComponent,
  SwitchComponent,
  PickupComponent,
} from './types'

/** 'game' runs physics/behaviors; 'editor' renders visuals + lights only. */
export type EngineMode = 'game' | 'editor'
export const EngineContext = createContext<EngineMode>('game')
export const useEngineMode = () => useContext(EngineContext)

/** three.js group of the node currently being rendered (for cross-component
 * effects like a light syncing its fixture's glass glow). */
const NodeGroupContext = createContext<React.RefObject<THREE.Group | null> | null>(null)

/** Swap every mesh's material for the PS2 vertex-lit equivalent, in place. */
export function applyPS2Materials(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const src = (Array.isArray(obj.material) ? obj.material[0] : obj.material) as THREE.MeshStandardMaterial
      // "glass" can live on the mesh OR the material name (gltf sub-primitives
      // get generic mesh names like Cylinder_1)
      if (obj.name.toLowerCase().includes('glass') || src.name?.toLowerCase().includes('glass')) {
        // bulb glass renders as a lit diffuser: fullbright, warm lamp white —
        // PS2 games drew light sources as unlit bright geometry
        obj.material = createPS2Material({ fullbright: true, color: 0xf3f0da })
        // tag so light components can find and drive the glow (and NOT drive
        // other fullbright surfaces like outfall voids)
        obj.material.userData.lampGlass = true
      } else {
        // housing stays scene-lit; emissive texels (the bulb) glow additively
        const map = src.map ? prepTexture(src.map) : null
        const emissiveMap = src.emissiveMap ? prepTexture(src.emissiveMap) : null
        obj.material = createPS2Material({ map, emissiveMap })
      }
      obj.castShadow = false
      obj.receiveShadow = false
    }
  })
}

// preload every registered gltf so props pop in together
Object.values(MODEL_REGISTRY).forEach((def) => {
  if (def.source === 'gltf') useGLTF.preload(def.url)
})

// ---------------------------------------------------------------- transforms

function eulerOf(node: SceneNode): [number, number, number] {
  const r = node.transform.rot
  if (r === undefined) return [0, 0, 0]
  return typeof r === 'number' ? [0, r, 0] : r
}

// ------------------------------------------------------------------ visuals

function ModelVisual({ c }: { c: ModelComponent }) {
  // both loaders suspend; called conditionally is fine because source is stable per component
  const object = c.source === 'gltf' ? <GltfVisual c={c} /> : <FbxVisual c={c} />
  return object
}

function GltfVisual({ c }: { c: ModelComponent }) {
  const { scene } = useGLTF(c.url)
  const cloned = useMemo(() => {
    const g = scene.clone(true)
    applyPS2Materials(g)
    return g
  }, [scene])
  return <primitive object={cloned} />
}

function FbxVisual({ c }: { c: ModelComponent }) {
  const fbx = useFBX(c.url)
  const map = useTexture(c.texture ?? '')
  const cloned = useMemo(() => {
    const g = fbx.clone(true)
    const box = new THREE.Box3().setFromObject(g)
    const size = box.getSize(new THREE.Vector3())
    const unit = Math.max(size.x, size.y, size.z) > 8 ? 0.01 : 1
    g.scale.setScalar(unit)
    g.updateMatrixWorld(true)
    const scaled = new THREE.Box3().setFromObject(g)
    g.position.y -= scaled.min.y
    const material = createPS2Material({ map: prepTexture(map) })
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = material
    })
    return g
  }, [fbx, map])
  return <primitive object={cloned} />
}

/** split models: each piece is its own dynamic body (game) or visual (editor) */
function SplitModel({ c, physics }: { c: ModelComponent; physics?: PhysicsComponent }) {
  const { scene } = useGLTF(c.url)
  const mode = useEngineMode()
  const pieces = useMemo(() => {
    const g = scene.clone(true)
    applyPS2Materials(g)
    g.updateMatrixWorld(true)
    const buckets = new Map<string, THREE.Mesh[]>()
    const keyOf = (name: string) => (c.split === 'suffix-ab' ? (name.endsWith('_a') ? 'a' : 'b') : name)
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const m = new THREE.Mesh(o.geometry, o.material)
        m.applyMatrix4(o.matrixWorld)
        const k = keyOf(o.name)
        buckets.get(k)?.push(m) ?? buckets.set(k, [m])
      }
    })
    return [...buckets.values()].map((meshes) => {
      const container = new THREE.Group()
      meshes.forEach((m) => container.add(m))
      const box = new THREE.Box3().setFromObject(container)
      const center = box.getCenter(new THREE.Vector3())
      const offset = new THREE.Vector3(center.x, 0, center.z)
      meshes.forEach((m) => m.position.sub(offset))
      return { container, offset }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  return (
    <>
      {pieces.map((p, i) =>
        mode === 'game' && physics?.grabbable ? (
          <GrabbableBody key={i} position={[p.offset.x, 0, p.offset.z]}>
            <primitive object={p.container} />
          </GrabbableBody>
        ) : (
          <group key={i} position={[p.offset.x, 0, p.offset.z]}>
            <primitive object={p.container} />
          </group>
        ),
      )}
    </>
  )
}

/** grimy translucent glass: the texture is the dirt layer; a facing-ratio
 * sheen fakes the reflection, alpha varies with the grime so it reads
 * streaky and nasty rather than clean */
function createGlassMaterial(map: THREE.Texture, repeat: [number, number], tint?: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      uniform vec3 uLightPos[${MAX_LIGHTS}];
      uniform vec3 uLightColor[${MAX_LIGHTS}];
      uniform float uLightRadius[${MAX_LIGHTS}];
      uniform vec3 uAmbient;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vLight;
      varying float vFogDepth;
      void main() {
        vUv = uv;
        vN = normalMatrix * normal;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = -mv.xyz;
        vFogDepth = -mv.z;
        // scene-lit like everything else, so glass goes dark with the room
        vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vec3 light = uAmbient;
        for (int i = 0; i < ${MAX_LIGHTS}; i++) {
          vec3 toLight = uLightPos[i] - worldPos;
          float dist = length(toLight);
          float atten = clamp(1.0 - dist / uLightRadius[i], 0.0, 1.0);
          light += uLightColor[i] * (atten * atten);
        }
        vLight = light;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec2 uRepeat;
      uniform vec3 uColor;
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      varying vec3 vLight;
      varying float vFogDepth;
      void main() {
        vec3 grime = texture2D(map, vUv * uRepeat).rgb;
        float dirt = dot(grime, vec3(0.333));
        // glancing views catch a dull sheen — never a clean mirror, and it
        // only shows where there is light to catch
        float glow = clamp(dot(vLight, vec3(0.333)), 0.0, 1.5);
        float sheen = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0) * 0.35 * glow;
        vec3 color = grime * uColor * vLight * 2.0 + vec3(sheen * 0.5);
        float alpha = 0.22 + dirt * 0.4 + sheen;
        float fogFactor = clamp((vFogDepth - fogNear) / (fogFar - fogNear), 0.0, 1.0);
        color = mix(color, fogColor, fogFactor);
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.85));
      }
    `,
    uniforms: {
      ...sharedLightUniforms,
      map: { value: map },
      uRepeat: { value: new THREE.Vector2(...repeat) },
      uColor: { value: tint ? rawColorFromString(tint) : new THREE.Color(0.72, 0.78, 0.72) },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

function SurfaceVisual({ c }: { c: SurfaceComponent }) {
  const map = useWorldTexture(c.texture)
  const material = useMemo(
    () =>
      c.glass
        ? createGlassMaterial(map, c.repeat, c.tint)
        : createPS2Material({ map, repeat: c.repeat, color: c.tint, bombing: c.bombing ?? 0 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, c.repeat[0], c.repeat[1], c.tint, c.bombing, c.glass],
  )
  useEffect(() => () => material.dispose(), [material])
  const segs = c.segments ?? [Math.max(1, Math.round(c.width)), Math.max(1, Math.round(c.height))]
  return (
    <mesh material={material} renderOrder={c.glass ? 1 : 0}>
      <planeGeometry args={[c.width, c.height, segs[0], segs[1]]} />
    </mesh>
  )
}

function PrimitiveVisual({ c }: { c: PrimitiveComponent }) {
  const map = useWorldTexture(c.texture ?? 'Concrete031')
  const material = useMemo(
    () => {
      const m = createPS2Material({ map: c.texture ? map : null, repeat: c.repeat ?? [1, 1], color: c.tint, fullbright: c.fullbright })
      // a fullbright primitive is a fixture's lit face (tube glass, lamp
      // plate) — tag it so a light on the same fixture can drive its glow
      if (c.fullbright) m.userData.lampGlass = true
      return m
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, c.texture, c.repeat?.[0], c.repeat?.[1], c.tint, c.fullbright],
  )
  useEffect(() => () => material.dispose(), [material])
  const d = c.dims
  return (
    <mesh material={material}>
      {c.shape === 'box' && <boxGeometry args={[d[0], d[1], d[2], 2, Math.max(2, Math.round(d[1] * 1.5)), 2]} />}
      {c.shape === 'cylinder' && <cylinderGeometry args={[d[0], d[1], d[2], d[3] ?? 8]} />}
      {c.shape === 'torus' && <torusGeometry args={[d[0], d[1], d[2] ?? 6, d[3] ?? 10, d[4] ?? Math.PI * 2]} />}
      {c.shape === 'plane' && <planeGeometry args={[d[0], d[1]]} />}
    </mesh>
  )
}

function GeneratorVisual({ c }: { c: GeneratorComponent }) {
  if (c.generator === 'rack') return <Rack position={[0, 0]} inert />
  if (c.generator === 'paperWad') return <PaperWadVisual seed={c.seed ?? 1} size={c.params?.[0] ?? 0.09} />
  if (c.generator === 'trashPile') return <TrashMoundVisual seed={c.seed ?? 1} radius={c.params?.[0] ?? 1.4} height={c.params?.[1] ?? 0.4} />
  if (c.generator === 'railing') return <RailingVisual length={c.params?.[0] ?? 4} spacing={c.params?.[1] ?? 2} />
  return null
}

const RAIL_H = 1.02

/** guard railing along local x, centered on the node origin */
function RailingVisual({ length, spacing }: { length: number; spacing: number }) {
  const material = useMemo(() => createPS2Material({ color: 0x53575c }), [])
  useEffect(() => () => material.dispose(), [material])
  const posts: number[] = []
  for (let x = -length / 2 + 0.3; x < length / 2; x += spacing) posts.push(x)
  return (
    <group>
      {posts.map((x) => (
        <mesh key={x} material={material} position={[x, RAIL_H / 2, 0]}>
          <boxGeometry args={[0.05, RAIL_H, 0.05]} />
        </mesh>
      ))}
      <mesh material={material} position={[0, RAIL_H, 0]}>
        <boxGeometry args={[length, 0.07, 0.07]} />
      </mesh>
      <mesh material={material} position={[0, RAIL_H * 0.55, 0]}>
        <boxGeometry args={[length, 0.05, 0.05]} />
      </mesh>
    </group>
  )
}

function WaterVisual({ c }: { c: WaterComponent }) {
  return <SewerWater position={[0, 0, 0]} size={[c.width, c.height]} />
}

/** world pickup: E takes the item; the node vanishes for the session */
const hitProxyMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })

function PickupEffect({ c }: { c: PickupComponent }) {
  const group = useContext(NodeGroupContext)
  const [taken, setTaken] = useState(false)
  useEffect(() => {
    const g = group?.current
    if (!g || taken) return
    return registerInteractable({
      object: g,
      label: c.label ?? 'TAKE',
      fade: false,
      action: () => {
        const def = ITEM_DEFS[c.item as keyof typeof ITEM_DEFS]
        if (def && inventory.add(def)) {
          play('pickup', 0.8)
          g.visible = false
          setTaken(true)
        }
      },
    })
  }, [group, c.item, c.label, taken])
  if (taken) return null
  // invisible hit proxy: small items (a crowbar shaft) are hopeless reticle
  // targets — give the ray something honest to hit
  return (
    <mesh material={hitProxyMaterial} position={[0, 0.06, 0]}>
      <sphereGeometry args={[0.24, 8, 6]} />
    </mesh>
  )
}

/** wall switch: E toggles a light group's circuit — instant, no fade */
function SwitchEffect({ c }: { c: SwitchComponent }) {
  const group = useContext(NodeGroupContext)
  useEffect(() => {
    const g = group?.current
    if (!g) return
    return registerInteractable({
      object: g,
      label: c.label ?? 'LIGHTS',
      fade: false,
      action: () => {
        play('clunk', 0.8)
        toggleGroup(c.group)
      },
    })
  }, [group, c.group, c.label])
  return null
}

/** door = area transition: E near the node fades the player to the target */
function DoorEffect({ c }: { c: DoorComponent }) {
  const group = useContext(NodeGroupContext)
  useEffect(() => {
    const g = group?.current
    if (!g) return
    return registerInteractable({
      object: g,
      label: c.label ?? 'USE',
      maxDist: c.radius,
      action: c.locked
        ? undefined
        : () => {
            play('door', 0.9)
            player.teleport(c.target[0], c.target[1], c.targetYaw)
          },
    })
  }, [group, c.target[0], c.target[1], c.targetYaw, c.label, c.radius, c.locked]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function PaperWadVisual({ seed, size }: { seed: number; size: number }) {
  const { geometry, material } = useMemo(() => {
    const rand = mulberry32(seed)
    const geo = new THREE.IcosahedronGeometry(size, 1)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const s = 0.72 + rand() * 0.55
      pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s, pos.getZ(i) * s)
    }
    const flat = geo.toNonIndexed()
    flat.computeVertexNormals()
    geo.dispose()
    return { geometry: flat, material: createPS2Material({ color: 0xd9d5c9 }) }
  }, [seed, size])
  return <mesh geometry={geometry} material={material} position={[0, size * 0.8, 0]} />
}

function TrashMoundVisual({ seed, radius, height }: { seed: number; radius: number; height: number }) {
  const map = useWorldTexture('TrashPile')
  const { geometry, material, rotation } = useMemo(() => {
    const rand = mulberry32(seed)
    const geo = new THREE.PlaneGeometry(radius * 2, radius * 2, 4, 4)
    const pos = geo.attributes.position
    const cell = (radius * 2) / 4
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const isEdge = Math.max(Math.abs(x), Math.abs(y)) > radius * 0.99
      const jx = x + (rand() - 0.5) * cell * 0.7
      const jy = y + (rand() - 0.5) * cell * 0.7
      if (isEdge) {
        pos.setXYZ(i, jx, jy, -(0.05 + rand() * 0.14))
        continue
      }
      const falloff = 1 - Math.hypot(jx, jy) / (radius * 1.35)
      pos.setXYZ(i, jx, jy, Math.max(0.04, height * falloff * (0.5 + rand())))
    }
    geo.rotateX(-Math.PI / 2)
    const flat = geo.toNonIndexed()
    flat.computeVertexNormals()
    geo.dispose()
    const m = map.clone()
    m.wrapS = THREE.MirroredRepeatWrapping
    m.wrapT = THREE.MirroredRepeatWrapping
    m.needsUpdate = true
    return { geometry: flat, material: createPS2Material({ map: m, repeat: [1.5, 1.5] }), rotation: rand() * Math.PI * 2 }
  }, [seed, radius, height, map])
  return <mesh geometry={geometry} material={material} rotation-y={rotation} />
}

// ------------------------------------------------------------------ physics

function GrabbableBody({ children, position = [0, 0, 0] }: { children: React.ReactNode; position?: [number, number, number] }) {
  const body = useRef<RapierRigidBody>(null)
  const inner = useRef<THREE.Group>(null)
  useEffect(() => {
    if (!body.current || !inner.current) return
    const box = new THREE.Box3().setFromObject(inner.current)
    const radius = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2
    const size = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z)
    return registerGrabbable({ root: inner.current, body: body.current, radius, size })
  }, [])
  return (
    // heavy: high density + damping so a kicked stack settles instead of
    // exploding — cargo should feel like cargo
    <RigidBody ref={body} colliders="hull" position={position} density={5} linearDamping={1.1} angularDamping={2.5} ccd>
      <group ref={inner}>{children}</group>
    </RigidBody>
  )
}

/** blockPlayer: player-movement AABB from the cuboid size when given,
 * else from the node's rendered world bounds */
function BlockPlayer({ size }: { size?: [number, number, number] }) {
  const group = useContext(NodeGroupContext)
  useEffect(() => {
    const g = group?.current
    if (!g) return
    let box: THREE.Box3
    if (size) {
      // run the local half-extents through the world matrix so rotated
      // bodies produce the right AABB (corner-expanded, not just offset)
      g.updateWorldMatrix(true, false)
      box = new THREE.Box3(
        new THREE.Vector3(-size[0], -size[1], -size[2]),
        new THREE.Vector3(size[0], size[1], size[2]),
      )
      box.applyMatrix4(g.matrixWorld)
    } else {
      box = new THREE.Box3().setFromObject(g)
      if (box.isEmpty()) return
    }
    return addCollider({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z, maxY: box.max.y })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, size?.[0], size?.[1], size?.[2]])
  return null
}

// -------------------------------------------------------------- environment

function EnvironmentEffect({ c }: { c: EnvironmentComponent }) {
  useEffect(() => {
    ambientColor.copy(rawColorFromString(c.ambient))
    fogSettings.color.copy(rawColorFromString(c.fog.color))
    fogSettings.near.value = c.fog.near
    fogSettings.far.value = c.fog.far
  }, [c.ambient, c.fog.color, c.fog.near, c.fog.far])
  return null
}

// -------------------------------------------------------------------- light

const GLASS_WARM = rawColor(0xf3f0da)
const GLASS_FLOOR = 0.12

function LightEffect({ c, nodeGroup, transform }: { c: LightComponent; nodeGroup: React.RefObject<THREE.Group | null> | null; transform: SceneNode['transform'] }) {
  const slot = useRef(-1)
  const flickerState = useRef({ on: true, nextToggle: 0.5 })
  const lastLevel = useRef(-1)
  const glass = useRef<THREE.Color[]>([])
  const settings = useRef(c)
  settings.current = c

  useEffect(() => {
    slot.current = acquireLightSlot()
    return () => releaseLightSlot(slot.current)
  }, [])

  // position the light at this node's world position; find fixture glass on
  // the parent fixture (if any) to sync its glow
  useEffect(() => {
    const i = slot.current
    if (i < 0) return
    const g = nodeGroup?.current
    if (g) {
      g.updateWorldMatrix(true, false)
      const p = new THREE.Vector3()
      g.getWorldPosition(p)
      lightPositions[i].copy(p)
      glass.current = []
      // fixture = parent node's group (light nodes are children of fixtures)
      const fixture = g.parent
      // walk the fixture's OWN visuals only: prune sibling scene nodes so a
      // fixtureless light parented to a zone can't grab the whole zone's
      // fullbright surfaces (voids, signs); instance children of the
      // fixture (its prefab visuals) stay in
      if (fixture) {
        const fixtureId = (fixture.userData.nodeId as string | undefined) ?? ''
        const walk = (o: THREE.Object3D) => {
          const nid = o.userData.nodeId as string | undefined
          if (o !== fixture && nid && !nid.startsWith(`${fixtureId}::`)) return
          if (o instanceof THREE.Mesh && o.material instanceof THREE.ShaderMaterial && o.material.userData.lampGlass) {
            glass.current.push(o.material.uniforms.uColor.value as THREE.Color)
          }
          for (const child of o.children) walk(child)
        }
        walk(fixture)
      }
    }
    lightColors[i].copy(rawColorFromString(c.color)).multiplyScalar(c.intensity)
    lightRadii[i] = c.radius
    lightSpots[i] = c.spot ?? 1
    lastLevel.current = -1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.color, c.intensity, c.radius, c.spot, nodeGroup, JSON.stringify(transform)])

  useFrame(({ clock }) => {
    const i = slot.current
    if (i < 0) return
    const s = settings.current
    let level = 1
    if (s.flicker) {
      const f = flickerState.current
      const t = clock.elapsedTime
      if (t > f.nextToggle) {
        f.on = !f.on
        f.nextToggle = t + (f.on ? 0.4 + Math.random() * 2.5 : 0.04 + Math.random() * 0.18)
      }
      level = f.on ? 1 : 0.07
    }
    // circuit dead? the fixture goes fully dark, glass included
    if (!isGroupOn(s.group)) level = 0
    if (level !== lastLevel.current) {
      lastLevel.current = level
      lightColors[i].copy(rawColorFromString(s.color)).multiplyScalar(s.intensity * level)
      const glow = level <= 0 ? 0.02 : Math.max(level, GLASS_FLOOR)
      for (const col of glass.current) col.copy(GLASS_WARM).multiplyScalar(glow)
    }
  })

  return null
}

// ----------------------------------------------------------------- renderer

interface SceneIndex {
  byId: Map<string, SceneNode>
  childrenOf: Map<string | null, SceneNode[]>
}

export function indexScene(nodes: SceneNode[]): SceneIndex {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const childrenOf = new Map<string | null, SceneNode[]>()
  for (const n of nodes) {
    const list = childrenOf.get(n.parent) ?? []
    list.push(n)
    childrenOf.set(n.parent, list)
  }
  return { byId, childrenOf }
}

function componentOf<T extends Component['type']>(node: SceneNode, type: T) {
  return node.components?.find((c) => c.type === type) as Extract<Component, { type: T }> | undefined
}

export function NodeView({ node, index, instancePrefix = '' }: { node: SceneNode; index: SceneIndex; instancePrefix?: string }) {
  const mode = useEngineMode()
  const group = useRef<THREE.Group>(null)

  // tag imperatively — a userData JSX prop would REPLACE the object on every
  // re-render and wipe markers others store there (interactables, grabbables)
  useEffect(() => {
    if (group.current) group.current.userData.nodeId = instancePrefix + node.id
  }, [node.id, instancePrefix])

  const model = componentOf(node, 'model')
  const physics = componentOf(node, 'physics')
  const surface = componentOf(node, 'surface')
  const primitive = componentOf(node, 'primitive')
  const generator = componentOf(node, 'generator')
  const behavior = componentOf(node, 'behavior')
  const instance = componentOf(node, 'instance')
  const light = componentOf(node, 'light')
  const environment = componentOf(node, 'environment')
  const water = componentOf(node, 'water')
  const door = componentOf(node, 'door')
  const switchC = componentOf(node, 'switch')
  const pickup = componentOf(node, 'pickup')

  const children = index.childrenOf.get(node.id) ?? []

  // pure visual stack for this node
  const visuals = (
    <>
      {model && !model.split && <ModelVisual c={model} />}
      {surface && <SurfaceVisual c={surface} />}
      {primitive && <PrimitiveVisual c={primitive} />}
      {generator && <GeneratorVisual c={generator} />}
      {water && <WaterVisual c={water} />}
    </>
  )
  const hasVisuals = !!(model && !model.split) || !!surface || !!primitive || !!generator || !!water

  let body: React.ReactNode = visuals
  if (mode === 'game' && physics && hasVisuals) {
    if (physics.body === 'dynamic' && physics.grabbable) {
      body = <GrabbableBody>{visuals}</GrabbableBody>
    } else if (physics.body === 'fixed' && physics.collider !== 'cuboid' && physics.collider !== 'none') {
      body = (
        <RigidBody type="fixed" colliders={physics.collider}>
          {visuals}
        </RigidBody>
      )
    }
  }

  return (
    <NodeGroupContext.Provider value={group}>
      <group ref={group} name={instancePrefix + node.id} position={node.transform.pos} rotation={eulerOf(node)} scale={node.transform.scale ?? 1}>
        {body}
        {model?.split && <SplitModel c={model} physics={physics} />}
        {mode === 'game' && physics?.collider === 'cuboid' && physics.size && (
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider args={physics.size} />
          </RigidBody>
        )}
        {mode === 'game' && physics?.blockPlayer && <BlockPlayer size={physics.size} />}
        {light && <LightEffect c={light} nodeGroup={group} transform={node.transform} />}
        {environment && <EnvironmentEffect c={environment} />}
        {mode === 'game' && door && <DoorEffect c={door} />}
        {mode === 'game' && switchC && <SwitchEffect c={switchC} />}
        {mode === 'game' && pickup && <PickupEffect c={pickup} />}
        {instance && <InstanceView c={instance} index={index} prefix={`${instancePrefix}${node.id}::`} />}
        {children.map((child) => (
          <NodeView key={child.id} node={child} index={index} instancePrefix={instancePrefix} />
        ))}
      </group>
      {/* rats manage absolute positions themselves — outside the transform */}
      {mode === 'game' && behavior?.behavior === 'rat' && (
        <Rat seed={behavior.seed ?? 1} spawn={[node.transform.pos[0], node.transform.pos[2]]} />
      )}
    </NodeGroupContext.Provider>
  )
}

function InstanceView({ c, index, prefix }: { c: InstanceComponent; index: SceneIndex; prefix: string }) {
  const def = index.byId.get(c.of)
  if (!def) return null
  const children = index.childrenOf.get(def.id) ?? []
  return (
    <>
      {children.map((child) => (
        <NodeView key={child.id} node={child} index={index} instancePrefix={prefix} />
      ))}
    </>
  )
}

/** Render a whole scene: root-level nodes except the library. */
export function SceneRoot({ nodes, mode }: { nodes: SceneNode[]; mode: EngineMode }) {
  const index = useMemo(() => indexScene(nodes), [nodes])
  const roots = (index.childrenOf.get(null) ?? []).filter((n) => !n.library)
  return (
    <EngineContext.Provider value={mode}>
      <group name="level">
        {roots.map((n) => (
          <NodeView key={n.id} node={n} index={index} />
        ))}
      </group>
    </EngineContext.Provider>
  )
}
