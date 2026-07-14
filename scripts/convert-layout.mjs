#!/usr/bin/env node
/**
 * One-time migration: src/game/layout.json (flat items) -> src/engine/scene.json
 * (node/component tree). Also emits the warehouse shell (previously hardcoded
 * in Room.tsx) as surface/primitive/physics nodes.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const layout = JSON.parse(fs.readFileSync(path.join(root, 'src/game/layout.json'), 'utf8'))

const nodes = []
const add = (n) => (nodes.push(n), n)

// deterministic PRNG matching src/game/rand.ts
function mulberry32(a) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------- structure
const W = 40, D = 24, H = 6
const world = layout.world

add({ id: 'environment', parent: null, transform: { pos: [0, 0, 0] }, components: [
  { type: 'environment', ambient: world.ambient, fog: world.fog },
]})

// zone group nodes
for (const id of ['warehouse', 'sewer-zone', 'office-zone', 'library']) {
  add({ id, parent: null, transform: { pos: [0, 0, 0] }, ...(id === 'library' ? { library: true } : {}) })
}
add({ id: 'shell', parent: 'warehouse', transform: { pos: [0, 0, 0] } })

const surf = (id, pos, rot, width, height, segments, mat, extra = {}) =>
  add({
    id, parent: 'shell', transform: { pos, ...(rot ? { rot } : {}) },
    components: [
      { type: 'surface', width, height, segments, texture: mat.texture, repeat: mat.repeat, tint: mat.tint, bombing: mat.bombing },
      ...(extra.physics ? [extra.physics] : []),
    ],
  })

const wallsMat = { texture: world.walls.texture, repeat: [world.walls.repeatX, world.walls.repeatY], tint: world.walls.tint, bombing: world.walls.bombing }
const wallsSide = { ...wallsMat, repeat: [world.walls.repeatX * (D / W), world.walls.repeatY] }
const floorMat = { texture: world.floor.texture, repeat: [world.floor.repeatX, world.floor.repeatY], tint: world.floor.tint, bombing: world.floor.bombing }
const ceilMat = { texture: world.ceiling.texture, repeat: [world.ceiling.repeatX, world.ceiling.repeatY], tint: world.ceiling.tint, bombing: world.ceiling.bombing }
const cuboid = (size, blockPlayer = false) => ({ type: 'physics', body: 'fixed', collider: 'cuboid', size, blockPlayer })

surf('floor', [0, 0, 0], [-Math.PI / 2, 0, 0], W, D, [40, 24], floorMat)
add({ id: 'floor-body', parent: 'shell', transform: { pos: [0, -0.5, 0] }, components: [cuboid([W / 2 + 1, 0.5, D / 2 + 1])] })
surf('ceiling', [0, H, 0], [Math.PI / 2, 0, 0], W, D, [40, 24], ceilMat)
add({ id: 'ceiling-body', parent: 'shell', transform: { pos: [0, H + 0.5, 0] }, components: [cuboid([W / 2 + 1, 0.5, D / 2 + 1])] })

// north wall, split around the hallway opening (x -11.5..-8.5, 3m tall)
surf('wall-n-left', [-15.75, H / 2, -D / 2], undefined, 8.5, H, [9, 8], { ...wallsMat, repeat: [world.walls.repeatX * (8.5 / W), world.walls.repeatY] })
add({ id: 'wall-n-left-body', parent: 'shell', transform: { pos: [-16.25, H / 2, -D / 2 - 0.5] }, components: [cuboid([4.75, H / 2, 0.5], true)] })
surf('wall-n-right', [5.75, H / 2, -D / 2], undefined, 28.5, H, [29, 8], { ...wallsMat, repeat: [world.walls.repeatX * (28.5 / W), world.walls.repeatY] })
add({ id: 'wall-n-right-body', parent: 'shell', transform: { pos: [6.25, H / 2, -D / 2 - 0.5] }, components: [cuboid([14.75, H / 2, 0.5], true)] })
surf('lintel-front', [-10, 4.5, -D / 2], undefined, 3, 3, [3, 4], { ...wallsMat, repeat: [world.walls.repeatX * (3 / W), world.walls.repeatY / 2] })
surf('lintel-back', [-10, 4.5, -D / 2 - 0.01], [0, Math.PI, 0], 3, 3, [3, 4], { ...wallsMat, repeat: [world.walls.repeatX * (3 / W), world.walls.repeatY / 2] })
add({ id: 'lintel-body', parent: 'shell', transform: { pos: [-10, 4.5, -D / 2 - 0.5] }, components: [cuboid([1.5, 1.5, 0.5])] })
surf('wall-s', [0, H / 2, D / 2], [0, Math.PI, 0], W, H, [40, 8], wallsMat)
add({ id: 'wall-s-body', parent: 'shell', transform: { pos: [0, H / 2, D / 2 + 0.5] }, components: [cuboid([W / 2 + 1, H / 2, 0.5], true)] })
surf('wall-w', [-W / 2, H / 2, 0], [0, Math.PI / 2, 0], D, H, [24, 8], wallsSide)
add({ id: 'wall-w-body', parent: 'shell', transform: { pos: [-W / 2 - 0.5, H / 2, 0] }, components: [cuboid([0.5, H / 2, D / 2 + 1], true)] })
surf('wall-e', [W / 2, H / 2, 0], [0, -Math.PI / 2, 0], D, H, [24, 8], wallsSide)
add({ id: 'wall-e-body', parent: 'shell', transform: { pos: [W / 2 + 0.5, H / 2, 0] }, components: [cuboid([0.5, H / 2, D / 2 + 1], true)] })

// danger signs
surf('sign-hallway', [-13.2, 1.9, -D / 2 + 0.06], undefined, 1.1, 1.1, [2, 2], { texture: 'DangerSign', repeat: [1, 1] })
surf('sign-dock', [W / 2 - 0.06, 1.8, 2.5], [0, -Math.PI / 2, 0], 1.1, 1.1, [2, 2], { texture: 'DangerSign', repeat: [1, 1] })

// pillars
const PILLARS = [[-12, -6.8], [0, -6.8], [12, -6.8], [-12, 6.8], [0, 6.8], [12, 6.8]]
PILLARS.forEach(([x, z], i) => {
  add({
    id: `pillar-${i + 1}`, parent: 'shell', transform: { pos: [x, H / 2, z] },
    components: [
      { type: 'primitive', shape: 'box', dims: [0.7, H, 0.7], texture: world.walls.texture, repeat: [1, 4], tint: world.walls.tint },
      cuboid([0.35, H / 2, 0.35], true),
    ],
  })
})

// rats (previously hardcoded in Room)
const RATS = [[101, 10, -10.5], [211, -15, 9], [307, 18, -2], [401, -4, 11], [503, 2, -10.5]]
RATS.forEach(([seed, x, z], i) => {
  add({ id: `rat-${i + 1}`, parent: 'warehouse', transform: { pos: [x, 0, z] }, components: [{ type: 'behavior', behavior: 'rat', seed }] })
})

// ------------------------------------------------------------------- assets
// model URL registries (mirror src/game/Prop.tsx)
const MODELS = {
  barrelExplosive: '/models/Barrel_01/Barrel_01_1k.gltf',
  barrel: '/models/barrel_03/barrel_03_1k.gltf',
  cardboardBox: '/models/cardboard_box_01/cardboard_box_01_1k.gltf',
  ammoBox: '/models/ammo_box/ammo_box_1k.gltf',
  hangingLamp: '/models/hanging_industrial_lamp/hanging_industrial_lamp_1k.gltf',
  canRusted: '/models/can_rusted/can_rusted_1k.gltf',
  foodCans: '/models/russian_food_cans_01/russian_food_cans_01_1k.gltf',
  jerrycan: '/models/metal_jerrycan/metal_jerrycan_1k.gltf',
  oilTin: '/models/oil_tin/oil_tin_1k.gltf',
  plasticCrate: '/models/plastic_crate_01/plastic_crate_01_1k.gltf',
  woodenCrate: '/models/wooden_crate_01/wooden_crate_01_1k.gltf',
  militaryCrate: '/models/old_military_crate/old_military_crate_1k.gltf',
  trashCan: '/models/metal_trash_can/metal_trash_can_1k.gltf',
  trashbag: '/models/trashbag/trashbag_1k.gltf',
  compressor: '/models/old_military_compressor/old_military_compressor_1k.gltf',
  generator: '/models/portable_generator/portable_generator_1k.gltf',
  propaneTank: '/models/propane_tank/propane_tank_1k.gltf',
  table: '/models/WoodenTable_02/WoodenTable_02_1k.gltf',
  chair: '/models/painted_wooden_chair_01/painted_wooden_chair_01_1k.gltf',
  cabinet: '/models/drawer_cabinet/drawer_cabinet_1k.gltf',
  binder: '/models/binder_notebook/binder_notebook_1k.gltf',
  toolbox: '/models/metal_toolbox/metal_toolbox_1k.gltf',
}
const IP = '/models/industrial-pack', IP2 = '/models/industrial-pack2'
const FBX = {
  palletTruck: [`${IP}/PalletTruck/PalletTruck.fbx`, `${IP}/PalletTruck/PalletTruck_Base_Color.png`],
  trolley: [`${IP}/Platform_Trolley/Platform_Trolley.fbx`, `${IP}/Platform_Trolley/Platform_Trolley_Base_Color.png`],
  electricalBox: [`${IP}/ElectricalBox/ElectricalBox.fbx`, `${IP}/ElectricalBox/ElectricalBox_Base_Color.png`],
  electricalBox2: [`${IP}/ElectricalBox02/ElectricalBox02.fbx`, `${IP}/ElectricalBox02/ElectricalBox02_Base_Color.png`],
  cableDrum: [`${IP}/CableDrum/CableDrum.fbx`, `${IP}/CableDrum/CableDrum_Base_Color.png`],
  workLight: [`${IP}/WorkLight/WorkLight.fbx`, `${IP}/WorkLight/WorkLight_Base_Color.png`],
  workLight2: [`${IP}/Worklight02/WorkLight02.fbx`, `${IP}/Worklight02/WorkLight02_Base_Color.png`],
  gasCylinder: [`${IP}/Gas_Cylinder/Gas_Cylinder.fbx`, `${IP}/Gas_Cylinder/Gas_Cylinder_Base_Color.png`],
  gasCan: [`${IP}/Gas_can/Gas_Canister.fbx`, `${IP}/Gas_can/GasCan_Base_Color.png`],
  waterBarrel: [`${IP}/Water_Barrel/Water_Barrel.fbx`, `${IP}/Water_Barrel/Water_Barrel_Base_Color.png`],
  explosiveBarrel2: [`${IP}/ExplosiveBarrel/ExplosiveBarrel.fbx`, `${IP}/ExplosiveBarrel/ExplosiveBarrel_Base_Color.png`],
  carJack: [`${IP}/Car_Jack/CarJack.fbx`, `${IP}/Car_Jack/CarJack_Base_Color.png`],
  pallet: [`${IP2}/Wood_Pallet/Wood_Pallet.fbx`, `${IP2}/Wood_Pallet/Wood_Pallet_Base_Color.png`],
  locker: [`${IP2}/Locker/Locker.fbx`, `${IP2}/Locker/Locker_Base_Color.png`],
  cautionSign: [`${IP2}/CautionSign_WetFloor/Caution_Sign.fbx`, `${IP2}/CautionSign_WetFloor/Caution_Sign_Base_Color.png`],
  fireExtinguisher: [`${IP2}/Fire_Extinguisher/Fire_extinguisher.fbx`, `${IP2}/Fire_Extinguisher/Fire_extinguisher_Base_Color.png`],
  cementMixer: [`${IP2}/Cement_Mixer/Cement_Mixer.fbx`, `${IP2}/Cement_Mixer/Cement_Mixer_Base_Color.png`],
  generator2: [`${IP2}/Generator/Generator.fbx`, `${IP2}/Generator/Generator_Base_Color.png`],
  motorOil: [`${IP2}/Motor_Oil/Motor_Oil.fbx`, `${IP2}/Motor_Oil/Motor_Oil_Base_Color.png`],
  sprayCan: [`${IP2}/SprayCan/Spray_can.fbx`, `${IP2}/SprayCan/SprayCan_Base_Color.png`],
}

const zoneFor = (id) => (id.startsWith('sewer') || id === 'lamp-hall' ? 'sewer-zone' : id.startsWith('office') ? 'office-zone' : 'warehouse')

const propComponents = (item) => {
  const comps = [{ type: 'model', source: 'gltf', url: MODELS[item.model] }]
  if (item.grabbable) comps.push({ type: 'physics', body: 'dynamic', collider: 'hull', grabbable: true })
  else if (item.physics !== 'none') comps.push({ type: 'physics', body: 'fixed', collider: item.physics === 'trimesh' ? 'trimesh' : 'hull', blockPlayer: item.collide !== false })
  return comps
}

const fbxComponents = (item) => {
  const [url, texture] = FBX[item.model]
  const comps = [{ type: 'model', source: 'fbx', url, texture }]
  if (item.grabbable) comps.push({ type: 'physics', body: 'dynamic', collider: 'hull', grabbable: true })
  else if (item.physics !== 'none') comps.push({ type: 'physics', body: 'fixed', collider: item.physics === 'trimesh' ? 'trimesh' : 'hull', blockPlayer: item.collide !== false })
  return comps
}

// loaded-pallet variants become real library prefabs
const palletPrefab = (name, children) => {
  add({ id: name, parent: 'library', transform: { pos: [0, 0, 0] }, library: true })
  add({ id: `${name}/base`, parent: name, transform: { pos: [0, 0, 0] }, components: [
    { type: 'model', source: 'fbx', url: FBX.pallet[0], texture: FBX.pallet[1] },
    { type: 'physics', body: 'dynamic', collider: 'hull', grabbable: true },
  ]})
  children.forEach(([model, pos, rot], i) =>
    add({ id: `${name}/load-${i + 1}`, parent: name, transform: { pos, rot }, components: [
      { type: 'model', source: 'gltf', url: MODELS[model] },
      { type: 'physics', body: 'dynamic', collider: 'hull', grabbable: true },
    ]}),
  )
}
palletPrefab('pallet-boxes', [
  ['cardboardBox', [-0.25, 0.17, 0.2], 0.05],
  ['cardboardBox', [0.3, 0.17, -0.15], 1.62],
  ['cardboardBox', [0, 0.73, 0], 0.9],
])
palletPrefab('pallet-crate', [
  ['woodenCrate', [0, 0.17, 0], 0.03],
  ['cardboardBox', [-0.15, 0.8, 0.1], 0.5],
])
palletPrefab('pallet-plastic', [
  ['plasticCrate', [-0.3, 0.17, -0.2], 0.08],
  ['plasticCrate', [0.35, 0.17, 0.15], 1.55],
  ['ammoBox', [0, 0.78, 0], 0.4],
])
const PALLET_VARIANT = ['pallet-boxes', 'pallet-crate', 'pallet-plastic']

// user prefabs from the flat model, if any
for (const p of layout.prefabs ?? []) {
  add({ id: p.name, parent: 'library', transform: { pos: [0, 0, 0] }, library: true })
  p.children.forEach((c, i) => {
    const item = { ...c, id: `${p.name}/${i}` }
    const comps = c.kind === 'prop' ? propComponents(item) : c.kind === 'fbx' ? fbxComponents(item) : []
    add({ id: item.id, parent: p.name, transform: { pos: c.pos, rot: c.rot, scale: c.scale }, components: comps })
  })
}

// trash-pile junk expansion (matches TrashPile's seeded spawn exactly)
const pickKind = (r) => (r < 0.3 ? 'bag' : r < 0.55 ? 'can' : r < 0.85 ? 'paper' : 'tin')
const JUNK_MODEL = { bag: 'trashbag', can: 'canRusted', tin: 'oilTin' }

// ------------------------------------------------------------------ items
for (const item of layout.items) {
  const zone = zoneFor(item.id)
  const t = { pos: item.pos, ...(item.rot ? { rot: item.rot } : {}), ...(item.scale && item.scale !== 1 ? { scale: item.scale } : {}) }

  switch (item.kind) {
    case 'prop':
      add({ id: item.id, parent: zone, transform: t, components: propComponents(item) })
      break
    case 'fbx':
      add({ id: item.id, parent: zone, transform: t, components: fbxComponents(item) })
      break
    case 'split':
      add({ id: item.id, parent: zone, transform: t, components: [
        { type: 'model', source: 'gltf', url: MODELS[item.model], split: item.model === 'militaryCrate' ? 'suffix-ab' : 'mesh' },
        { type: 'physics', body: 'dynamic', collider: 'hull', grabbable: true },
      ]})
      break
    case 'paperWad':
      add({ id: item.id, parent: zone, transform: t, components: [
        { type: 'generator', generator: 'paperWad', seed: item.seed, params: [item.size ?? 0.09] },
        { type: 'physics', body: 'dynamic', collider: 'hull', grabbable: true },
      ]})
      break
    case 'rack': {
      // rack visual + player blocking on the node; shelf colliders as children
      add({ id: item.id, parent: zone, transform: t, components: [
        { type: 'generator', generator: 'rack' },
        { type: 'physics', body: 'fixed', collider: 'cuboid', blockPlayer: true },
      ]})
      ;[0.12, 1.0, 1.85].forEach((y, i) =>
        add({ id: `${item.id}/shelf-${i + 1}`, parent: item.id, transform: { pos: [0, y, 0] }, components: [
          { type: 'physics', body: 'fixed', collider: 'cuboid', size: [2, 0.035, 0.55] },
        ]}),
      )
      break
    }
    case 'loadedPallet':
      add({ id: item.id, parent: zone, transform: t, components: [{ type: 'instance', of: PALLET_VARIANT[item.variant ?? 0] }] })
      break
    case 'lamp': {
      add({ id: item.id, parent: zone, transform: t, components: [{ type: 'model', source: 'gltf', url: MODELS.hangingLamp }] })
      add({ id: `${item.id}/light`, parent: item.id, transform: { pos: [0, (item.lightY ?? item.pos[1] - 1.4) - item.pos[1], 0] }, components: [
        { type: 'light', color: item.color ?? '#d8e6c8', intensity: item.intensity ?? 1.2, radius: item.radius ?? 18, spot: 1, ...(item.flicker ? { flicker: true } : {}) },
      ]})
      break
    }
    case 'trashPile': {
      const radius = item.radius ?? 1.4, height = item.height ?? 0.4, count = item.items ?? 6
      add({ id: item.id, parent: zone, transform: t, components: [
        { type: 'generator', generator: 'trashPile', seed: item.seed, params: [radius, height] },
        { type: 'physics', body: 'fixed', collider: 'trimesh', blockPlayer: true },
      ]})
      // junk becomes real child-of-zone nodes (positions were world-space spawns)
      const rand = mulberry32(item.seed * 7 + 1)
      for (let i = 0; i < count; i++) {
        const angle = rand() * Math.PI * 2
        const dist = rand() * radius * 0.55
        const x = item.pos[0] + Math.cos(angle) * dist
        const z = item.pos[2] + Math.sin(angle) * dist
        const y = height + 0.4 + rand() * 0.7
        const kind = pickKind(rand())
        const rot = rand() * Math.PI * 2
        const id = `${item.id}-junk-${i + 1}`
        if (kind === 'paper') {
          add({ id, parent: zone, transform: { pos: [x, y, z], rot }, components: [
            { type: 'generator', generator: 'paperWad', seed: item.seed * 31 + i, params: [0.07 + ((item.seed * 31 + i) % 5) * 0.01] },
            { type: 'physics', body: 'dynamic', collider: 'hull', grabbable: true },
          ]})
        } else {
          add({ id, parent: zone, transform: { pos: [x, y, z], rot }, components: [
            { type: 'model', source: 'gltf', url: MODELS[JUNK_MODEL[kind]] },
            { type: 'physics', body: 'dynamic', collider: 'hull', grabbable: true },
          ]})
        }
      }
      break
    }
    case 'prefab':
      add({ id: item.id, parent: zone, transform: t, components: [{ type: 'instance', of: item.model }] })
      break
    default:
      throw new Error(`unhandled kind ${item.kind} (${item.id})`)
  }
}

// -------------------------------------------------------------------- write
const out = path.join(root, 'src/engine/scene.json')
fs.writeFileSync(out, JSON.stringify({ nodes }, null, 2) + '\n')
console.log(`wrote ${out}: ${nodes.length} nodes`)
