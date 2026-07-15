# DEADWATER first-playable definition of done

- The change extends the existing React 19 and R3F app instead of creating a new scaffold, renderer, loop, or scene graph.
- `npm run build` completes.
- The game entry opens at `/`; the editor remains a separate `/editor.html` entry.
- A compact brief names player promise, primary verb, objective, pressure, reward or world change, setback or recovery, and non-goals.
- The core behavior works through real pointer-lock keyboard or mouse input.
- The fixed 60 degree, 4:3 camera and 512x448 pipeline remain intact.
- Authored world changes live in `scene.json` and have valid ids, parents, transforms, and typed components.
- New component types have renderer, inspector field, inspector default, and game/editor mode behavior.
- Interactions respect reticle occlusion, reach, pointer lock, and registration cleanup.
- Inventory, equipment, carry, and prompts read their existing single sources of truth.
- Rapier bodies live below the existing Physics provider; player navigation still uses custom AABB collision.
- Audio starts from a user gesture and fires on state transitions rather than every frame.
- Authored procedural content carries a stable seed and uses `mulberry32`.
- Relevant development hooks remain available and truthful.
- `/editor.html` can inspect, edit, undo, redo, and save affected authored content without running gameplay side effects.
- Active play, console inspection, and a relevant contact sheet or screenshot show the expected result.
