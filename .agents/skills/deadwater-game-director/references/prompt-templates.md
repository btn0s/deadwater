# Director prompt templates

Use these only when the user asks for a reusable prompt or task template.

## Broad feature

```text
Use deadwater-game-director to implement [player-facing outcome].

Preserve:
- scene.json as the world source of truth
- the existing R3F and Rapier ownership boundaries
- the PS2-style renderer contract
- game/editor agreement
- asset provenance and credits

Route through the relevant gameplay, PS2 graphics, UI, debug, QA, 3D asset,
image, and audio specialists. Exercise [input/editor path] in the browser and
capture [contact-sheet areas or states] before reporting completion.
```

## PS2 visual pass

```text
Use deadwater-game-director to improve [areas/surfaces] without changing the
game into PSX or retro-PBR.

Classify each rendering choice as PS2 hardware fact, DEADWATER policy, or
modern cheat. Preserve diffuse/emissive-only runtime materials, Gouraud-style
lighting, raw display-space color, the fixed internal frame, ordered dither,
and 4:3 presentation unless the task explicitly redesigns one of them.

Use active-game screenshots and contact sheets. Fill the PS2 visual scorecard,
report renderer costs, and verify every changed area through the real game.
```

## Gameplay and level pass

```text
Use deadwater-game-director to add or revise [mechanic/encounter/area]. Keep the
world layout in scene.json and extend existing state, interaction, physics,
audio, and editor boundaries instead of adding a parallel engine layer.

Prove the path through real input, reset/cleanup, state feedback, collision,
and the relevant contact-sheet view. Run build, lint, and browser QA.
```

## Release pass

```text
Use deadwater-game-director to prepare DEADWATER for [target host/build]. Run
the production build and preview, exercise the changed play path, check game
and editor URLs when applicable, inspect console/page errors, verify asset URLs
and credits, capture artifacts, and report remaining risks with owners.
```
