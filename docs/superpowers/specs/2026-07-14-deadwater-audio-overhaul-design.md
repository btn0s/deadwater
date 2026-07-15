# DEADWATER audio overhaul design

Date: 2026-07-14

## Goal

Replace the current generic sound kit with a full authored soundscape that combines grounded industrial-horror recordings with dry, compressed PS2 survival-horror treatment. The result should make the freight depot, sewer, harbor, player body, tools, props, and rats sound like parts of one physical place. Quiet gaps are part of the mix. Rare non-diegetic stingers may mark major transitions, but there is no continuous horror score.

## Scope

This pass includes:

- walking, running, jumping, landing, clothing, and carried-gear Foley;
- concrete, damp-floor, and metal footstep families;
- inventory, pickup, carry, release, and throw sounds by material;
- crowbar swings, misses, and contacts by material;
- switches, relays, doors, and power-state changes;
- warehouse, sewer, and harbor ambience;
- localized machinery, chains, pipes, drips, water, building movement, and wind;
- rat vocalizations and scurrying tied to rat locations;
- three or fewer rare transition stinger moments;
- source provenance, deterministic processing commands, runtime safeguards, and browser verification.

This pass excludes voice, music, dynamic acoustic occlusion, a general reverb system, third-party audio middleware, and new gameplay whose only purpose is to trigger sound.

## Direction

The source material should sound believable before processing: heavy work boots, clothing and equipment movement, resonant metal, electrical hardware, wet concrete, harbor water, chain, and distant machinery. The final treatment should be dry, slightly band-limited, transient-forward, and restrained. It may exaggerate weight and mechanical state changes, but it should not sound like an arcade effects pack.

The environment carries tension most of the time. Non-diegetic stingers are reserved for the initial clock-in, first sewer entry, and at most one selected power event. Recognizable environmental details occur irregularly so silence remains audible.

## Event matrix

| State transition | Listener/location | Expected frequency | Priority | Maximum duration | Variation | Loop | Acceptance read |
| --- | --- | --- | --- | ---: | ---: | --- | --- |
| Walk or sprint stride | Listener-centered | high | high | 350 ms | 6-8 per surface | no | Heavy boot cadence without a metronomic or arcade read |
| Jump takeoff | Listener-centered | medium | medium | 300 ms | 3-4 | no | Sole scuff and clothing lift, not a reused footstep |
| Landing | Listener-centered | medium | high | 700 ms | 4 | no | Weight follows airtime without excessive sub-bass |
| Clothing or carried-gear movement | Listener-centered | high while moving | low | 450 ms | 5-6 | no | Felt more than noticed; never plays on every frame |
| Inventory draw or stow | Listener-centered | low | medium | 500 ms | 3 per material/action family | no | Physical handling replaces the current UI click |
| Pick up or carry a prop | Listener-centered | medium | medium | 500 ms | 4 per material family | no | Wood, metal, and plastic remain distinguishable |
| Release or throw a prop | Listener-centered plus world contact | medium | medium | 800 ms | 4 per material family | no | Air movement and later contact are separate events |
| Crowbar swing or miss | Listener-centered | medium | high | 450 ms | 4 | no | Cloth wind-up and narrow air cut track the animation |
| Crowbar contact | Contact position | medium | high | 900 ms | 4 per material family | no | Metal rings briefly; wood and concrete stop more quickly |
| Switch or relay changes state | Switch position | low | high | 600 ms | 3 | no | Snap, enclosure resonance, and circuit state read once |
| Door area transition | Door position, then listener | low | high | 1.2 s | 2-3 | no | Latch and heavy mechanism sell the transition without a swinging-door animation |
| Rat vocalization or scurry | Rat position | low | low | 900 ms | 5 vocal, 5 scurry | no | Nearby and directional; no disembodied periodic chirp |
| Warehouse room tone | Non-spatial bed | continuous | low | seamless | 1 authored bed | yes | Quiet electrical and structural foundation without a constant obvious drone |
| Sewer room tone | Non-spatial bed | continuous | low | seamless | 1 authored bed | yes | Damp, enclosed, and distinct from the warehouse |
| Harbor room tone | Non-spatial bed | continuous | low | seamless | 1 authored bed | yes | Wind and water foundation without rhythmic repetition |
| Local environmental detail | Believable world emitter | sparse | low-medium | 4 s | at least 3 per family | no | Pipes, chains, machinery, drips, and building movement leave long gaps |
| Major transition stinger | Listener-centered | at most 3 moments | medium | 2 s | one per moment | no | Industrial and restrained; never louder than the strongest tool impact |

## Source strategy

Use a hybrid authored soundscape:

1. Source isolated real recordings for every recognizable action and environmental object.
2. Prefer CC0. Accept CC BY only when the recording is materially better and exact attribution is available. Reject NC, ND, unclear, AI-generated, musically layered, clipped, excessively reverberant, or contaminated material.
3. Search Freesound with its Free Cultural Works filter and inspect the license on each sound page. Use OpenGameArt CC0 recordings as a second pool. Initial vetted leads are [Freesound's license and filtering guidance](https://freesound.org/help/faq/), [The Shop CC0 ambience samples](https://opengameart.org/content/the-shop), and [Footsteps CC0](https://opengameart.org/content/footsteps-0).
4. Audition two to four viable candidates for each family against the actual gameplay timing. Choose the family that best matches the scene after level matching, not the loudest preview.
5. Use deterministic synthesis only for low transformer undertones, wind pressure, or a stinger layer that cannot be isolated cleanly in a recording. Record the script, seed, parameters, and input sources.

Untouched downloads live in an ignored `.cache/deadwater-audio/sources/` production directory. The repository records each original filename, SHA-256, author, page URL, direct source URL when stable, license and license URL, retrieval date, processing command, and shipped filename. Exact attribution stays in `public/models/CREDITS.md`. The acquisition and processing ledger stays in the Audio section of `docs/ASSETS.md`.

## Runtime architecture

`src/game/audio.ts` remains the only owner of the lazy `AudioContext`, master output, decode lifecycle, ambience lifecycle, and mounted `AudioSystem`. The implementation must not add `new Audio()`, another context, or a parallel audio manager.

A focused `src/game/audioCatalog.ts` module defines typed cue families. Each entry contains:

- shipped variant URLs;
- output bus;
- base gain and bounded gain variation;
- explicit playback-rate bounds;
- maximum simultaneous voices and optional retrigger cooldown;
- centered or spatial playback;
- reference distance, maximum distance, and rolloff for spatial cues;
- authored-loop metadata when applicable.

The existing `play(name, volume, rate)` entry point remains for listener-centered cues. A `playAt(name, position, options)` entry point handles environmental details, rat sounds, switches, doors, and world contacts. Both paths select a variant, enforce cooldown and voice limits, route through the correct bus, and disconnect nodes after playback.

The mix has five buses: player Foley, interactions, world emitters, ambience, and stingers. Each bus feeds the shared master. This provides family-level mix control without exposing a general mixer UI.

Spatial one-shots use mono buffers and an HRTF `PannerNode`. Each cue defines attenuation. Initial defaults are a 1.5 m reference distance, 12 m maximum distance, and no more than six simultaneous world voices. High-priority interaction cues may replace the oldest low-priority environmental voice when the cap is reached.

`AudioSystem` owns footstep distance accumulation, surface selection, zone selection, ambience crossfades, and sparse environmental scheduling. It never triggers a one-shot from an unguarded frame condition. Continuous beds crossfade over 1.2 seconds, and the replaced source stops and disconnects after the fade.

## Scene and gameplay data

Add an optional `acoustics` scene component with a small fixed vocabulary:

- `material`: `metal`, `wood`, `plastic`, `concrete`, `wetConcrete`, or `cloth`;
- `footstepSurface`: `concrete`, `wetConcrete`, or `metal` when the node is walkable;
- optional `emitter` with a cue family (`machinery`, `chain`, `pipe`, `drip`, or `water`), minimum and maximum interval in seconds, gain, and maximum distance. The node transform supplies the world position.

This keeps material decisions in `scene.json`, alongside the objects they describe. It also gives the editor a clear field instead of hiding model-to-sound mappings in gameplay code.

Registered grabbables retain their acoustic material. Carry, throw, and crowbar contact events pass that material to the cue catalog. Horizontal nodes with `footstepSurface` register their world-space floor bounds. `AudioSystem` chooses the highest registered floor containing the player's horizontal position, then falls back to the current zone's default surface when no tagged floor contains the player.

Rat vocal and scurry events move from the global random timer to the owning rat behavior so their positions match visible rats. A cooldown and distance check prevent several rats from firing together.

Door audio starts at the interacted door before teleport. The destination zone crossfade begins after the teleport. Switch audio fires only after the circuit state changes successfully. Rare stingers have explicit first-entry or first-state-change guards and never replay during ordinary backtracking.

## Processing and format

For imported one-shots:

1. Preserve the untouched source in the production cache.
2. Trim leading silence without cutting the attack.
3. Remove DC offset, steady background contamination, and unusable tails.
4. Downmix positional Foley to mono.
5. High-pass only enough to remove rumble that does not belong to the event.
6. Use controlled low-pass filtering, mild saturation, and transient compression to establish the shared dry PS2 character. Do not apply the same preset blindly to every family.
7. Add a short tail fade and only enough early reflection to identify metal or concrete space.
8. Level-match all variants in a family before in-engine gain tuning.
9. Ship OGG Vorbis at 44.1 kHz and quality level 5. Keep scene-wide ambience stereo only when the stereo field contributes useful non-positional width.

Loops must have intentional crossfades and survive at least ten consecutive boundaries without an audible seam, pulse, or repeated event. Environmental recordings with recognizable events are split into randomized one-shots instead of baked into short loops.

Footsteps are the mix reference. In the final gameplay mix, ambience should sit about 12-18 dB below ordinary footsteps. Common interactions must remain readable without approaching full scale. Rapid overlapping cues must leave at least 6 dB of master headroom. Stingers remain below the strongest crowbar contact.

No authored animal or tuned material receives blanket pitch randomization. Small pitch ranges are allowed only where the catalog explicitly opts in. Variation should come primarily from distinct recordings.

## Loading, errors, and cleanup

The clock-in gesture unlocks the context and begins decoding all required cue families before active play. Clock-in waits for decoding or a 1.5-second timeout, whichever happens first. Audio failure must never trap the user at the menu.

Fetch and decode failures report the cue key and exact URL once in development. A failed family degrades to silence without rejecting the entire preload set. Missing buffers are not queued indefinitely because a late footstep or impact is worse than a skipped one.

Every one-shot removes itself from voice tracking and disconnects on `ended`. Replaced ambience sources stop and disconnect after their fade. Remounting, pointer-lock release and re-entry, hidden-tab return, and zone backtracking cannot stack beds or leave stale timers running.

## Verification

The project has no general unit-test runner, so verification uses the existing audio production helper, focused scripts, the browser, and the production build.

Static checks:

- `deadwater_audio_asset.py audit-project .` reports no missing or unreferenced shipped files;
- audio inspection records codec, sample rate, channels, duration, and file size;
- a provenance check confirms that every imported file has source, license, hash, processing, and credit entries;
- catalog validation confirms valid gain and rate bounds, voice limits, loop metadata, and enough variants for repeated families;
- loop checks cover each authored bed;
- retired Kenney files are either removed or unreferenced after an explicit blind comparison decision.

Browser checks:

- the first clock-in gesture unlocks audio without an autoplay error;
- every `/sounds/` request returns successfully and decodes;
- walking, sprinting, jumping, landing, and teleport suppression use the correct cadence and surface family;
- pickup, draw, stow, carry, release, throw, crowbar miss, and material contacts each emit one correct cue per transition;
- switches and doors emit once and at the expected world position;
- rat sounds originate near a rat and respect cooldown and distance;
- warehouse, sewer, and harbor beds crossfade without stacking or gaps;
- environmental details remain sparse and respect voice limits;
- clock-in and first-entry guards prevent repeated stingers;
- rapid repetition does not clip or build uncontrolled gain;
- pointer-lock release, re-entry, remount, hidden-tab return, and zone backtracking do not duplicate loops or timers;
- browser console and network contain no audio errors.

Production checks:

- `npm run lint` passes;
- `npm run build` passes;
- production preview resolves the same asset paths;
- a final listening pass on headphones and ordinary laptop speakers keeps boots readable, ambience subordinate, impacts controlled, and quiet sections intentional.

Keep a before-and-after cue sheet for family-by-family A/B listening. The pass is accepted only after the real gameplay actions, not isolated files, satisfy these checks.

## Known risks

- Freesound quality and provenance vary by uploader. Every selected file needs individual inspection even when the site-level filter is correct.
- Material tagging can become busy if every decorative object needs an override. Defaults should cover common props, with scene tags only where the default is wrong.
- Too many localized emitters can erase the intended silence. Voice limits, long intervals, and explicit priority are part of the design, not later polish.
- Heavy band-limiting can turn grounded Foley back into cheap game effects. Processing must be judged in context and applied per family.
- Laptop speakers can hide low machinery and landing weight. Important cues need midrange definition rather than more sub-bass.
