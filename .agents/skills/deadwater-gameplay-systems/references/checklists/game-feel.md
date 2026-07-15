# DEADWATER game-feel checklist

- One input owner handles each changed action.
- Pointer-lock loss clears held keys and re-entry restores control.
- Per-frame motion clamps large delta and keeps mutable frame state in refs or stable objects.
- Ordinary gameplay `useFrame` callbacks do not take positive render priority or call `gl.render`.
- Walk, run, jump, look, head bob, collision radius, and step height remain coherent.
- Reticle prompts identify the first unobstructed valid target and stay stable at the edge of reach.
- Interaction state, HUD, inventory, held body, and equipment agree after success and failure paths.
- Small and large carries use the intended anchors and inventory lock rules.
- Every carry release path restores dynamic body type and clears carry lock.
- Audio fires once on the owning state transition and the first gesture unlocks Web Audio.
- HUD or camera feedback remains readable in the 4:3 view and does not hide the next decision.
- Any FOV change restores 60 degrees, retains 4:3 aspect, and updates the projection matrix.
- Authored procedural and actor behavior uses scene seeds and `mulberry32`.
- Named tuning values and before/after observations are recorded.
- Active input, console, final game view, and relevant contact-sheet verification pass.
