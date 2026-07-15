import type { ModelComponent } from './types'

/** Canonical model registry: palette name → model component source fields.
 * The converter script keeps a mirrored copy (it can't import TS). */
export const MODEL_REGISTRY: Record<string, Pick<ModelComponent, 'source' | 'url' | 'texture'>> = {
  // Poly Haven GLTF (real-world scale)
  barrelExplosive: { source: 'gltf', url: '/models/Barrel_01/Barrel_01_1k.gltf' },
  barrel: { source: 'gltf', url: '/models/barrel_03/barrel_03_1k.gltf' },
  cardboardBox: { source: 'gltf', url: '/models/cardboard_box_01/cardboard_box_01_1k.gltf' },
  ammoBox: { source: 'gltf', url: '/models/ammo_box/ammo_box_1k.gltf' },
  hangingLamp: { source: 'gltf', url: '/models/hanging_industrial_lamp/hanging_industrial_lamp_1k.gltf' },
  canRusted: { source: 'gltf', url: '/models/can_rusted/can_rusted_1k.gltf' },
  foodCans: { source: 'gltf', url: '/models/russian_food_cans_01/russian_food_cans_01_1k.gltf' },
  jerrycan: { source: 'gltf', url: '/models/metal_jerrycan/metal_jerrycan_1k.gltf' },
  oilTin: { source: 'gltf', url: '/models/oil_tin/oil_tin_1k.gltf' },
  plasticCrate: { source: 'gltf', url: '/models/plastic_crate_01/plastic_crate_01_1k.gltf' },
  woodenCrate: { source: 'gltf', url: '/models/wooden_crate_01/wooden_crate_01_1k.gltf' },
  militaryCrate: { source: 'gltf', url: '/models/old_military_crate/old_military_crate_1k.gltf' },
  trashCan: { source: 'gltf', url: '/models/metal_trash_can/metal_trash_can_1k.gltf' },
  trashbag: { source: 'gltf', url: '/models/trashbag/trashbag_1k.gltf' },
  compressor: { source: 'gltf', url: '/models/old_military_compressor/old_military_compressor_1k.gltf' },
  generator: { source: 'gltf', url: '/models/portable_generator/portable_generator_1k.gltf' },
  propaneTank: { source: 'gltf', url: '/models/propane_tank/propane_tank_1k.gltf' },
  table: { source: 'gltf', url: '/models/WoodenTable_02/WoodenTable_02_1k.gltf' },
  chair: { source: 'gltf', url: '/models/painted_wooden_chair_01/painted_wooden_chair_01_1k.gltf' },
  cabinet: { source: 'gltf', url: '/models/drawer_cabinet/drawer_cabinet_1k.gltf' },
  binder: { source: 'gltf', url: '/models/binder_notebook/binder_notebook_1k.gltf' },
  toolbox: { source: 'gltf', url: '/models/metal_toolbox/metal_toolbox_1k.gltf' },
  crowbar: { source: 'gltf', url: '/models/crowbar_01/crowbar_01_1k.gltf' },
  // itch industrial packs (FBX, cm scale — normalized at load)
  palletTruck: { source: 'fbx', url: '/models/industrial-pack/PalletTruck/PalletTruck.fbx', texture: '/models/industrial-pack/PalletTruck/PalletTruck_Base_Color.png' },
  trolley: { source: 'fbx', url: '/models/industrial-pack/Platform_Trolley/Platform_Trolley.fbx', texture: '/models/industrial-pack/Platform_Trolley/Platform_Trolley_Base_Color.png' },
  electricalBox: { source: 'fbx', url: '/models/industrial-pack/ElectricalBox/ElectricalBox.fbx', texture: '/models/industrial-pack/ElectricalBox/ElectricalBox_Base_Color.png' },
  electricalBox2: { source: 'fbx', url: '/models/industrial-pack/ElectricalBox02/ElectricalBox02.fbx', texture: '/models/industrial-pack/ElectricalBox02/ElectricalBox02_Base_Color.png' },
  cableDrum: { source: 'fbx', url: '/models/industrial-pack/CableDrum/CableDrum.fbx', texture: '/models/industrial-pack/CableDrum/CableDrum_Base_Color.png' },
  workLight: { source: 'fbx', url: '/models/industrial-pack/WorkLight/WorkLight.fbx', texture: '/models/industrial-pack/WorkLight/WorkLight_Base_Color.png' },
  workLight2: { source: 'fbx', url: '/models/industrial-pack/Worklight02/WorkLight02.fbx', texture: '/models/industrial-pack/Worklight02/WorkLight02_Base_Color.png' },
  gasCylinder: { source: 'fbx', url: '/models/industrial-pack/Gas_Cylinder/Gas_Cylinder.fbx', texture: '/models/industrial-pack/Gas_Cylinder/Gas_Cylinder_Base_Color.png' },
  gasCan: { source: 'fbx', url: '/models/industrial-pack/Gas_can/Gas_Canister.fbx', texture: '/models/industrial-pack/Gas_can/GasCan_Base_Color.png' },
  waterBarrel: { source: 'fbx', url: '/models/industrial-pack/Water_Barrel/Water_Barrel.fbx', texture: '/models/industrial-pack/Water_Barrel/Water_Barrel_Base_Color.png' },
  explosiveBarrel2: { source: 'fbx', url: '/models/industrial-pack/ExplosiveBarrel/ExplosiveBarrel.fbx', texture: '/models/industrial-pack/ExplosiveBarrel/ExplosiveBarrel_Base_Color.png' },
  carJack: { source: 'fbx', url: '/models/industrial-pack/Car_Jack/CarJack.fbx', texture: '/models/industrial-pack/Car_Jack/CarJack_Base_Color.png' },
  pallet: { source: 'fbx', url: '/models/industrial-pack2/Wood_Pallet/Wood_Pallet.fbx', texture: '/models/industrial-pack2/Wood_Pallet/Wood_Pallet_Base_Color.png' },
  locker: { source: 'fbx', url: '/models/industrial-pack2/Locker/Locker.fbx', texture: '/models/industrial-pack2/Locker/Locker_Base_Color.png' },
  cautionSign: { source: 'fbx', url: '/models/industrial-pack2/CautionSign_WetFloor/Caution_Sign.fbx', texture: '/models/industrial-pack2/CautionSign_WetFloor/Caution_Sign_Base_Color.png' },
  fireExtinguisher: { source: 'fbx', url: '/models/industrial-pack2/Fire_Extinguisher/Fire_extinguisher.fbx', texture: '/models/industrial-pack2/Fire_Extinguisher/Fire_extinguisher_Base_Color.png' },
  cementMixer: { source: 'fbx', url: '/models/industrial-pack2/Cement_Mixer/Cement_Mixer.fbx', texture: '/models/industrial-pack2/Cement_Mixer/Cement_Mixer_Base_Color.png' },
  generator2: { source: 'fbx', url: '/models/industrial-pack2/Generator/Generator.fbx', texture: '/models/industrial-pack2/Generator/Generator_Base_Color.png' },
  motorOil: { source: 'fbx', url: '/models/industrial-pack2/Motor_Oil/Motor_Oil.fbx', texture: '/models/industrial-pack2/Motor_Oil/Motor_Oil_Base_Color.png' },
  sprayCan: { source: 'fbx', url: '/models/industrial-pack2/SprayCan/Spray_can.fbx', texture: '/models/industrial-pack2/SprayCan/SprayCan_Base_Color.png' },
}

export const MODEL_NAMES = Object.keys(MODEL_REGISTRY)

/** reverse lookup: model url → registry name (for display/thumbnails) */
export function modelNameOf(url: string): string | null {
  for (const [name, def] of Object.entries(MODEL_REGISTRY)) if (def.url === url) return name
  return null
}
