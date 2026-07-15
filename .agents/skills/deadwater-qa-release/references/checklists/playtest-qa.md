# Playtest QA checklist

- Start from a clean game load at `/`.
- Enter play with pointer lock or call `__devLock(true)` for automation.
- Record `__playerPos()` before and after WASD movement.
- Exercise run, jump, camera look, and boundary sliding.
- Test the changed interaction paths: doors, switches, pickup/hotbar, carry/throw, flashlight, crowbar, or CCTV.
- Teleport to each changed zone and return through a real door path when relevant.
- Probe changed collision with `__testCollision(x, z, dx, dz, radius)` and record the result.
- Inspect `__lightSlots()` after scene loads, circuit toggles, flashlight equip/stow, and unmounts affected by the change.
- Verify grabbable bodies settle and do not duplicate or remain registered after remount/reload.
- Verify audio starts after a user gesture, relevant events play, ambience changes zones, and loops do not stack.
- Release and regain focus. Confirm movement or audio does not remain stuck.
- Capture player-height screenshots in the changed zones.
- Record bugs with exact start position, input sequence, expected result, actual result, and artifact.
