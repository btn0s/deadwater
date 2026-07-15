# DEADWATER audio overhaul implementation plan

Design: `docs/superpowers/specs/2026-07-14-deadwater-audio-overhaul-design.md`

## Outcome

Replace the generic Kenney one-shots and bare procedural beds with a coherent industrial-horror soundscape: real Foley and environmental recordings, restrained PS2-style processing, positional world cues, material-aware interactions, sparse ambience, and rare stingers.

## 1. Build the sourcing and audition pipeline

Files:

- Modify `.gitignore`
- Add `scripts/build-audio-audition.mjs`
- Add `audio-audition.html`
- Modify `docs/ASSETS.md`
- Modify `public/models/CREDITS.md`

Work:

1. Ignore `.cache/deadwater-audio/` and store untouched downloads there.
2. Search Freesound with the Free Cultural Works filter and OpenGameArt CC0 listings.
3. Collect two to four candidates for each family: dry concrete boots, wet concrete boots, metal steps, clothing, jump, landing, wood/plastic/metal handling, crowbar swing, material impacts, switches, doors, rats, warehouse tone, sewer tone, harbor tone, machinery, chain, pipe, drip, water, and three stinger layers.
4. Record author, source page, license, original filename, retrieval date, and SHA-256 before processing.
5. Generate a local audition page with level-matched A/B buttons grouped by event family.
6. Reject noisy, clipped, highly reverberant, musical, AI-generated, NC, ND, or unclear material.
7. Select one coherent family per event and preserve at least four variants for frequently repeated Foley.

Checkpoint: audition the page in Chrome and lock the winning source set before runtime integration.

## 2. Process the selected recordings reproducibly

Files:

- Add `scripts/build-deadwater-audio.mjs`
- Add processed files under `public/sounds/`
- Modify `docs/ASSETS.md`
- Modify `public/models/CREDITS.md`

Work:

1. Encode every processing recipe in the build script rather than editing files by hand.
2. Trim attacks and tails, remove DC offset, clean steady noise, and add short fades.
3. Prepare positional cues as mono; the repo's native Vorbis encoder writes them as dual-mono stereo before Web Audio's HRTF stage.
4. Apply family-specific high-pass, controlled low-pass, mild saturation, and transient compression.
5. Level-match variants within each family.
6. Build seamless warehouse, sewer, and harbor beds. Keep recognizable events out of the loops.
7. Encode shipped assets as 44.1 kHz OGG Vorbis at quality 5.
8. Record the exact command and shipped filename beside each source entry.
9. Run metadata inspection and ten-boundary loop checks.

Verification:

```sh
python3 .agents/skills/deadwater-audio-generator/scripts/deadwater_audio_asset.py inspect public/sounds/*.ogg
python3 .agents/skills/deadwater-audio-generator/scripts/deadwater_audio_asset.py loop-check .cache/deadwater-audio/processed/warehouse.wav
python3 .agents/skills/deadwater-audio-generator/scripts/deadwater_audio_asset.py loop-check .cache/deadwater-audio/processed/sewer.wav
python3 .agents/skills/deadwater-audio-generator/scripts/deadwater_audio_asset.py loop-check .cache/deadwater-audio/processed/harbor.wav
```

## 3. Replace the loose sample map with a typed cue catalog

Files:

- Add `src/game/audioCatalog.ts`
- Add `scripts/test-audio-catalog.mjs`
- Modify `package.json`

Work:

1. Add a failing catalog test for missing files, invalid gain/rate bounds, invalid voice limits, loop metadata, and minimum variant counts.
2. Define cue entries with URLs, bus, gain range, pitch range, cooldown, maximum voices, priority, spatial settings, and loop settings.
3. Add every selected asset to the catalog.
4. Disable blanket pitch variation. Opt individual cue families into narrow ranges only where useful.
5. Add `npm run test:audio` for catalog and provenance checks.

Verification:

```sh
npm run test:audio
npm run build
```

## 4. Upgrade the Web Audio runtime

Files:

- Modify `src/game/audio.ts`
- Modify `src/App.tsx`

Work:

1. Keep `audio.ts` as the sole `AudioContext` owner.
2. Add Foley, interaction, world, ambience, and stinger gain buses.
3. Preserve `play(name, volume, rate)` and add `playAt(name, position, volume, rate)` using HRTF panning.
4. Enforce per-cue cooldowns, voice limits, priority replacement, and cleanup on `ended`.
5. Load cue families independently so one bad file does not reject the full set.
6. Log the cue name and URL once for fetch or decode failures in development.
7. Start loading on clock-in without blocking the transition; wait for readiness or 10 seconds only before attempting the clock-in stinger.
8. Crossfade ambience over 1.2 seconds and stop/disconnect the replaced source.
9. Clear ambience, timers, and voices on remount or return to the title screen.

Verification:

```sh
npm run test:audio
npm run lint
npm run build
```

## 5. Add acoustic material and emitter data to the scene

Files:

- Modify `src/engine/types.ts`
- Modify `src/engine/inspector.ts`
- Modify `src/engine/render.tsx`
- Modify `src/engine/scene.json`
- Modify `src/game/grabbables.ts`
- Add `src/game/acoustics.ts`

Work:

1. Add an `acoustics` component with material, footstep surface, and optional emitter profile.
2. Add editor fields and defaults for the component.
3. Register tagged floor bounds and choose the highest floor under the player, with zone fallback.
4. Carry acoustic material through registered grabbables.
5. Tag the warehouse floor as concrete, sewer platforms as wet concrete, and appropriate metal walkways as metal.
6. Tag dynamic props as wood, plastic, metal, concrete, or cloth.
7. Add sparse emitters to existing scene nodes such as the sewer generator, compressor, pipe bank, sewer water, yard harbor, and chained door.
8. Use named world regions for warehouse, sewer, and harbor ambience selection.

Verification:

```sh
npm run test:audio
npm run lint
npm run build
```

Open the editor and confirm the new component can be added, edited, saved, and reloaded without changing unrelated scene data.

## 6. Replace player, inventory, tool, and prop cues

Files:

- Modify `src/game/audio.ts`
- Modify `src/game/PlayerController.tsx`
- Modify `src/game/inventory.ts`
- Modify `src/game/Carry.tsx`
- Modify `src/game/Crowbar.tsx`
- Modify `src/engine/render.tsx`

Work:

1. Play surface-aware boot variants from travel distance.
2. Layer low clothing/gear Foley at a slower cadence than footsteps.
3. Replace the reused takeoff step with a dedicated jump scuff.
4. Scale landing gain and variant choice by airtime.
5. Replace inventory clicks with draw/stow handling cues.
6. Select pickup, carry, release, and throw cues by acoustic material.
7. Add collision-speed-gated contact sounds to dynamic props with per-body cooldowns.
8. Keep crowbar wind-up and air movement centered on the player.
9. Remove the unconditional crowbar thunk. Play a positional material impact only when a target is actually hit.

Browser checks:

- Walk, sprint, stop, jump, and land on each surface.
- Confirm teleports do not produce footsteps.
- Pick up, carry, release, and throw wood, plastic, and metal objects.
- Swing the crowbar into empty air and then into each material.
- Rapidly repeat each action and confirm there is no clipping or machine-gun repetition.

## 7. Replace interaction, rat, ambience, and horror cues

Files:

- Modify `src/engine/render.tsx`
- Modify `src/game/Rat.tsx`
- Modify `src/game/audio.ts`
- Modify `src/App.tsx`
- Modify `src/engine/scene.json`

Work:

1. Spatialize switches and doors at their scene positions.
2. Fire switch sounds only after a successful circuit state change.
3. Start the door latch/mechanism cue before teleport, then crossfade to the destination ambience.
4. Move rat squeaks and scurries into `Rat.tsx`, tied to idle/dash transitions and actual rat positions.
5. Remove the global procedural rat timer.
6. Replace synthesized hum and wash with the warehouse, sewer, and harbor beds.
7. Schedule machinery, chain, pipe, drip, water, and structural details from scene emitters with long randomized gaps and a six-world-voice cap.
8. Add guarded stingers for clock-in, first sewer entry, and one selected power-loss event.
9. Confirm stingers never replay during normal backtracking.

## 8. Remove retired assets and finish the mix

Files:

- Remove superseded files from `public/sounds/`
- Modify `docs/ASSETS.md`
- Modify `public/models/CREDITS.md`
- Modify `README.md` only if its audio description becomes inaccurate

Work:

1. Run a family-by-family before/after comparison.
2. Remove every Kenney file that lost the comparison and delete its catalog reference.
3. Balance footsteps first, then interactions, world emitters, ambience, and stingers.
4. Keep ambience roughly 12-18 dB below ordinary footsteps.
5. Preserve at least 6 dB of master headroom during rapid overlapping events.
6. Check the mix on headphones and laptop speakers.
7. Finalize exact credits and processing records.

Final verification:

```sh
python3 .agents/skills/deadwater-audio-generator/scripts/deadwater_audio_asset.py audit-project .
python3 .agents/skills/deadwater-audio-generator/scripts/deadwater_audio_asset.py inspect public/sounds/*.ogg
npm run test:audio
npm run lint
npm run build
npm run preview
```

In the production preview, verify clock-in unlock, every gameplay cue, all three ambience zones, rapid repetition, pointer-lock release and re-entry, title return, hidden-tab return, remount cleanup, `/sounds/` network responses, and a clean browser console.
