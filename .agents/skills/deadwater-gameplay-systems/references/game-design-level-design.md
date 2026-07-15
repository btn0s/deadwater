# DEADWATER game and level design

Use this reference for new mechanics, objectives, room flow, environmental challenges, resource placement, difficulty, or broad gameplay changes. Keep the design compact and prove it through the existing game and editor.

## Design brief gate

Before broad implementation, state:

- Player promise: what the player gets to feel or do in DEADWATER.
- Target feeling: tension, curiosity, vulnerability, competence, relief, or another precise state.
- Primary verb: move, inspect, carry, use, unlock, light, traverse, or evade.
- Supporting verbs: run, jump, stow, switch equipment, move props, open a route.
- Immediate objective: what the player should understand without reading source.
- Pressure: darkness, uncertain space, limited hands, blocked routes, environmental danger, pursuit, or time.
- Reward: information, access, equipment, safer traversal, a shortcut, or visible world change.
- Setback and recovery: what goes wrong and how play resumes without friction.
- Skill expression: what an attentive or practiced player does better.
- Non-goals: mechanics deliberately excluded from this pass.

Reject a brief that only says to explore a good-looking warehouse. The authored space must create a choice, problem, consequence, or discovery.

## Core loop contract

Write one sentence:

```text
The player uses [verb] to reach or learn [objective] while [pressure] creates risk; success changes [world, route, inventory, or knowledge], and a setback leads to [recovery].
```

Then map the sentence to existing systems:

| Contract part | Likely implementation |
| --- | --- |
| Navigate and frame | `PlayerController`, custom blockers, fixed 4:3 camera |
| Inspect or use | reticle ray and `registerInteractable` |
| Manipulate space | Rapier grabbables and carry modes |
| Resource or tool | inventory, pickup component, equipment component |
| Change access | door transition, switch/light group, moved blocker |
| Communicate state | prompt, hotbar, world light or sound, fade |
| Author layout | `scene.json`, prefabs, editor hierarchy and inspector |

Do not add a new state machine if the loop can be represented by a small component, existing store transition, or authored world change.

## First-person level plan

Plan each changed area around player sightlines and the fixed camera:

- Arrival frame: what the player sees at eye height on entry.
- Orientation anchor: a sign, light, doorway, silhouette, sound, or unique structure.
- First readable choice: route, object, tool, or switch.
- Teaching beat: a safe use of the new mechanic.
- Pressure beat: the mechanic matters under obstruction, darkness, pursuit, limited reach, or limited hands.
- Payoff: route opens, power returns, item is found, threat is avoided, or space changes.
- Recovery and reorientation: a landmark or quiet zone after the pressure.
- Return path: whether the changed space reads differently when crossed again.

Use the editor to block scale and sightlines before writing one-off layout code. Keep walls, props, lights, physics, and authored interactions in `scene.json`.

## Spatial readability at 512x448

The fixed PS2-era render target removes fine detail. Decisions must survive the final image.

- Use silhouette, value, motion, light pools, sound, and placement before small text.
- Keep important interactables distinct from clutter at the distance where the prompt becomes available.
- Put landmarks above or beside dense prop fields rather than inside them.
- Use fog to stage discovery, not to hide every route.
- Check the real 4:3 game view. The editor camera is not evidence of player readability.
- Use contact sheets to compare area-wide composition, then enter the game for reach and occlusion.

## Interaction and inventory decisions

Interactions should create a decision rather than a checklist of E prompts.

- A small carried object can coexist with the active tool. A bulky object consumes both hands.
- Stowing, switching, pickup, and carry lock should force understandable tradeoffs.
- A switch should produce a visible or audible world change.
- A locked interaction may communicate a future route, but repeated inert prompts become noise.
- A door transition should preserve orientation or deliberately reset it with a clear arrival landmark.
- A movable object should matter to access, cover, route, or environmental storytelling when it is more than set dressing.

## Pacing and difficulty

Increase difficulty through clearer combinations rather than random density:

- Teach one input or state transition at a time.
- Combine familiar verbs after the player has used them safely.
- Make the consequence legible before adding harsher timing.
- Alternate constrained spaces with areas that let the player reorient.
- Use named constants and authored component values for reach, movement, light radius, fog, door target, or object mass behavior.
- Keep restart or recovery quick. DEADWATER's tension should come from the situation, not repeated setup.

## Authored data and reusable pieces

- Use library subtrees and `instance` components for repeated composed structures.
- Use generator components with explicit seeds for procedural litter and set pieces.
- Keep repeated model definitions in `MODEL_REGISTRY` so the editor palette and thumbnail path stay synchronized.
- Give nodes stable ids that communicate purpose without embedding runtime logic in the id.
- Parent for meaningful transforms and organization, not merely to shorten the root list.

## Rejection tests

Revise the design if any statement is true:

- The first meaningful action after entering the area is unclear.
- The new mechanic exists but never changes a decision.
- The objective is only explained in overlay copy.
- A prompt appears through a wall or on an object the player cannot reach.
- A critical item disappears in fog, dither, or clutter at normal play distance.
- The editor view looks good but the fixed player camera cannot read the route.
- Random prop placement can block a required path or make screenshots unstable.
- A two-handed carry has no tradeoff because the active tool is never needed.
- Failure or setback gives no clue about the cause.
- The area is decorative and could be removed without changing play.

## Evidence and report

Report the brief, loop sentence, area beats, authored nodes or prefabs, tuning values, editor checks, active-play findings, and relevant contact-sheet output. A contact sheet proves composition; it does not prove pointer lock, reach, occlusion, carry state, or player understanding. Test those in play.
