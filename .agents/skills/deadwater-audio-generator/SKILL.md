---
name: deadwater-audio-generator
description: Use when sourcing, synthesizing, editing, integrating, or verifying DEADWATER sound effects, footsteps, interactions, ambience, spatial cues, and Web Audio behavior.
---

# DEADWATER audio production

## Purpose

Own the path from a named gameplay event to a licensed or reproducible sound that works through DEADWATER's existing Web Audio system. Reuse the current Kenney CC0 sample kit and in-engine synthesis before adding another source. No external generator, account, or credential is required.

## Required reference

Load `references/audio-workflows.md` for every audio task. Record the reference, source provenance, processing commands, runtime trigger, and browser verification in the final report.

## Project truth

- Runtime owner: `src/game/audio.ts`
- Imported one-shots: `public/sounds/*.ogg`
- Attribution: `public/models/CREDITS.md`
- Source index and acquisition policy: `docs/ASSETS.md`
- Existing imported families: concrete footsteps, landing, relay/door/carry impacts, pickup, switch, and torch clicks from Kenney CC0 packs
- Existing synthesized sounds: crowbar swing, rat squeak, interior hum, and harbor wash
- Public API: `play(name, volume, rate)` plus the mounted `AudioSystem`
- Unlock boundary: first pointer gesture and pointer-lock entry

Do not add scattered `new Audio()` calls, a second `AudioContext`, or a parallel audio manager.

## Workflow

1. Name the gameplay state transition, listener location, expected frequency, priority, maximum duration, variation need, and whether the cue loops.
2. Inspect the current `SAMPLES` map, `play()` call sites, synth buffers, ambience transition, and credits before creating anything.
3. Choose the source in this order:
   - reuse or retune an existing sample or synth;
   - source a CC0 or approved CC BY asset through the repo's asset-search workflow;
   - synthesize a simple mechanical, tonal, noise, or ambience cue reproducibly;
   - use an available generation tool only when the user requests it or the first three options cannot meet the brief.
4. Record source URL, author, license, original filename, processing, shipped path, and credit change before integration. Generated output records the tool and prompt as provenance.
5. Trim silence, remove DC offset, create intentional fades, downmix when spatial width has no value, and encode short browser cues as OGG. Make at least three variants for rapid repeated Foley when practical.
6. Add imported files under `public/sounds/` and one canonical entry in `SAMPLES`. Keep seamless procedural beds in `bakeSynth()` when that is smaller and easier to tune with the scene.
7. Call `play()` from the state transition that owns the cue. Never trigger a one-shot every frame. Preserve gesture unlock, random pitch bounds, and ambience cleanup.
8. Verify the real action with audio unlocked, then test rapid repetition, pause/re-entry, zone transition, hidden-tab return, missing/decode errors, and production asset URLs as relevant.

## Local production helper

The bundled script audits project references, inspects audio metadata, creates reproducible WAV starting points, and checks WAV loop seams:

```bash
python3 .agents/skills/deadwater-audio-generator/scripts/deadwater_audio_asset.py audit-project .
python3 .agents/skills/deadwater-audio-generator/scripts/deadwater_audio_asset.py inspect public/sounds/*.ogg
python3 .agents/skills/deadwater-audio-generator/scripts/deadwater_audio_asset.py synth /tmp/deadwater-hum.wav --kind hum --duration 2 --seed 7
python3 .agents/skills/deadwater-audio-generator/scripts/deadwater_audio_asset.py loop-check /tmp/deadwater-hum.wav
```

`inspect` uses `ffprobe` when available and falls back to WAV metadata or file size. `synth` produces a source WAV, not an automatically approved shipping asset; audition and process it before integration.

## Mix and runtime rules

- Keep interaction cues short and transient-led so they read under the hum or harbor wash.
- Use conservative gain. `play()` feeds the shared master and applies bounded pitch variation.
- Avoid random pitch on authored voice or musically tuned material unless deliberately designed.
- Keep footsteps grounded and distance-driven; test walk, sprint, jump, landing, and teleport suppression.
- Crossfade ambience changes and stop the old source. Do not stack loops across remounts or restarts.
- Treat synthesized randomness used to bake a buffer as an authored source decision. Use a stable seed when repeatable output matters.
- Add spatial audio only for a gameplay reason and define attenuation, maximum voices, and cleanup first.

## Completion evidence

Report the event matrix, source/provenance, original and shipped files, processing commands, durations and formats, variants or loop decision, `SAMPLES` key and trigger owner, unlock behavior, runtime path exercised, console/network result, production check, and remaining mix risks. A file existing on disk is not evidence that the cue works in play.
