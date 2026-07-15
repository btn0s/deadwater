// shared player state, written by PlayerController and read by game systems
export const player = {
  locked: false,
  x: 15,
  z: 8.5,
  /** feet on the floor (false mid-jump) — written by PlayerController */
  grounded: true,
  /** move the player instantly; registered by PlayerController on mount */
  teleport: (_x: number, _z: number, _yaw?: number, _pitch?: number) => {},
}
