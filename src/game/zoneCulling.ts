import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { player } from './playerState'

/**
 * Portal-style cell visibility, the way the era did it: the world splits at
 * the east wall (x = 20). Inside, the exterior yard/harbor subtree doesn't
 * render; outside, the interior zones don't. Physics and lights keep
 * running — only rendering is culled — and the door fade covers the swap.
 */

const INTERIOR = ['warehouse', 'sewer-zone', 'office-zone']
const EXTERIOR = ['yard']
const SPLIT_X = 20

export function ZoneCulling() {
  const scene = useThree((s) => s.scene)
  const lastInside = useRef<boolean | null>(null)

  useFrame(() => {
    const inside = player.x < SPLIT_X
    if (inside === lastInside.current) return
    lastInside.current = inside
    for (const id of EXTERIOR) {
      const g = scene.getObjectByName(id)
      if (g) g.visible = !inside
    }
    for (const id of INTERIOR) {
      const g = scene.getObjectByName(id)
      if (g) g.visible = inside
    }
  })

  return null
}
