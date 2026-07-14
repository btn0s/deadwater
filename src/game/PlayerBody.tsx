import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CapsuleCollider, type RapierRigidBody } from '@react-three/rapier'
import { player } from './playerState'

/**
 * Kinematic capsule that follows the player so walking into loose junk
 * shoves it aside instead of passing through it.
 */
export function PlayerBody() {
  const body = useRef<RapierRigidBody>(null)

  useFrame(() => {
    body.current?.setNextKinematicTranslation({ x: player.x, y: 0.9, z: player.z })
  })

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[player.x, 0.9, player.z]}>
      <CapsuleCollider args={[0.55, 0.35]} />
    </RigidBody>
  )
}
