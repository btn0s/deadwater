import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { createPS2Material, prepTexture } from '../ps2/PS2Material'
import { Surface } from './Surface'

// three dock bays on the east wall (x = +20), where the player spawns
const WALL_X = 20
const BAYS = [-7, 0, 7]
const DOOR_W = 4.4
const DOOR_H = 3.5

export function LoadingDock() {
  const steel = useTexture('/textures/CorrugatedSteel005.jpg', prepTexture)
  const trimMaterial = useMemo(() => createPS2Material({ color: 0x3d4044 }), [])
  const bumperMaterial = useMemo(() => createPS2Material({ color: 0x17181a }), [])

  return (
    <group>
      {BAYS.map((z) => (
        <group key={z}>
          {/* roller door panel — in-plane spin makes the corrugation slats horizontal */}
          <Surface
            size={[DOOR_H, DOOR_W]}
            segments={[4, 5]}
            position={[WALL_X - 0.06, DOOR_H / 2, z]}
            rotation={[0, -Math.PI / 2, Math.PI / 2]}
            map={steel}
            repeat={[2.6, 5]}
            color={0xb9bdc0}
          />
          {/* jambs + header */}
          <mesh material={trimMaterial} position={[WALL_X - 0.1, DOOR_H / 2 + 0.1, z - DOOR_W / 2 - 0.09]}>
            <boxGeometry args={[0.16, DOOR_H + 0.2, 0.18]} />
          </mesh>
          <mesh material={trimMaterial} position={[WALL_X - 0.1, DOOR_H / 2 + 0.1, z + DOOR_W / 2 + 0.09]}>
            <boxGeometry args={[0.16, DOOR_H + 0.2, 0.18]} />
          </mesh>
          <mesh material={trimMaterial} position={[WALL_X - 0.1, DOOR_H + 0.28, z]}>
            <boxGeometry args={[0.2, 0.36, DOOR_W + 0.55]} />
          </mesh>
          {/* rubber bumpers at floor level */}
          <mesh material={bumperMaterial} position={[WALL_X - 0.14, 0.28, z - DOOR_W / 2 + 0.35]}>
            <boxGeometry args={[0.22, 0.56, 0.4]} />
          </mesh>
          <mesh material={bumperMaterial} position={[WALL_X - 0.14, 0.28, z + DOOR_W / 2 - 0.35]}>
            <boxGeometry args={[0.22, 0.56, 0.4]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
