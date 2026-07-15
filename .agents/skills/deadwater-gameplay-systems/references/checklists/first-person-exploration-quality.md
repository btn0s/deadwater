# First-person exploration quality checklist

- The fixed 60 degree, 4:3 camera shows the next doorway, hazard, or interactable without changing `PlayerController`'s projection contract.
- WASD, run, jump, pointer lock, and Escape release work after entering, leaving, and re-entering pointer lock.
- Reticle prompts only appear for the first unobstructed interactable within reach.
- Doors, switches, pickups, grabbables, inventory slots, stow, and carry lock agree about current player state.
- Small carried objects leave the active hand usable; large carried objects center and lock the hotbar until release.
- Player AABB movement slides along blockers and steps over geometry below `STEP_HEIGHT`.
- The kinematic Rapier capsule pushes dynamic debris without becoming a second player controller.
- Dynamic props use simple colliders, settle under damping, and do not tunnel during ordinary tosses.
- Each new authored path has a landmark, a readable choice, and a recovery or orientation point.
- Important items remain visible through the 512x448 target, raw-color lighting, fog, and dither.
- Interaction, pickup, door, footstep, landing, and carry actions emit the existing audio hooks on the triggering event.
- Seeded generators and actors produce the same layout or behavior for the same `scene.json` seed.
- `window.__teleport`, `window.__playerPos`, `window.__testCollision`, and `window.__sheet` still support agent verification in development.
- The game entry does not import editor state or editor chrome; `/editor.html` remains a separate authoring entry.
- Build, active play, console inspection, and a relevant labeled contact sheet all pass.
