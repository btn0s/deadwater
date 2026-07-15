# DEADWATER game and level design checklist

- The brief names player promise, target feeling, primary verb, objective, pressure, reward or world change, setback or recovery, skill expression, and non-goals.
- The loop maps to existing movement, reticle interaction, carry, inventory, light, door, audio, or scene-component systems.
- The changed area has an arrival frame, orientation anchor, readable first choice, teaching beat, pressure beat, payoff, and recovery point.
- The fixed player camera, not only the editor camera, can see the next decision.
- Important silhouettes, values, light pools, and prompts survive the 512x448 output and fog.
- Interactables are reachable, occluded by solid geometry, and distinct from nearby clutter.
- Carry and inventory rules create an understandable tradeoff when both hands are occupied.
- World changes have visible or audible consequences.
- Required geometry, lights, props, physics, and interactions are authored in `scene.json`.
- Repeated authored pieces use prefabs or seeded generators where they improve consistency.
- Randomized content cannot block a required route or invalidate comparison artifacts.
- Difficulty combines learned verbs and readable constraints instead of adding random density.
- Setbacks explain what happened and recover without repeated setup.
- Active play proves the decision and consequence; contact sheets prove area composition.
- No unresolved rejection test remains for the requested slice.
