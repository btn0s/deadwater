# DEADWATER visual scorecard checklist

Use with `references/visual-scorecard.md`.

- [ ] Baseline and current live `.viewport canvas` captures use the same player pose, window size, light state, and flashlight state.
- [ ] Relevant `contact-sheet*.png` files were refreshed through `await window.__sheet()`.
- [ ] Contact sheets are used only for coverage and direct scene quality, not final CRT proof.
- [ ] Renderer-contract fidelity is scored 0 to 3.
- [ ] Art direction and atmosphere is scored 0 to 3.
- [ ] World composition and geometry is scored 0 to 3.
- [ ] Model and set-piece quality is scored 0 to 3.
- [ ] Texture and material language is scored 0 to 3.
- [ ] Vertex lighting, darkness, and fog is scored 0 to 3.
- [ ] Modern-cheat discipline is scored 0 to 3.
- [ ] 4:3 and CRT presentation is scored 0 to 3.
- [ ] Gameplay-state readability is scored 0 to 3.
- [ ] Performance and verification evidence is scored 0 to 3.
- [ ] Every Automatic Failures item in `references/visual-scorecard.md` is checked from the canonical list.
- [ ] Per-pass counts identify main, depth, flashlight shadow, CCTV, and blit where relevant.
- [ ] Frame-time evidence names hardware, browser, build mode, view, and state.
- [ ] Light-slot output is included when lighting changed.
- [ ] An independent score or adversarial lower-score argument is included.
- [ ] Renderer-conformant gate passes only with contract fidelity 3, all other categories at least 2, average at least 2.3, and no automatic failure.
- [ ] Release-ready gate passes only with contract fidelity and performance 3, at least six other categories 3, no category below 2, average at least 2.7, and complete state evidence.
