// shared player state, written by PlayerController and read by game systems
export const player = {
  locked: false,
  x: 15,
  z: 8.5,
  /** move the player instantly; registered by PlayerController on mount */
  teleport: (_x: number, _z: number, _yaw?: number, _pitch?: number) => {},
}
