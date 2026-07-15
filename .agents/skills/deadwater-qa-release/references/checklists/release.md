# Release checklist

- `npm run build` passes.
- The build contains both `index.html` and `editor.html` only when the editor is intended to ship.
- `npm run preview -- --host 127.0.0.1` serves the built entry points.
- Production game canvas is nonblank, 4:3, and free of console/page/network errors.
- The main movement and one interaction path work in production preview.
- Dev-only hooks and `DevViews` are absent from the production runtime.
- Static asset URLs for models, textures, sounds, and editor entry points resolve under the intended Vite base.
- `src/engine/scene.json` parses, all model/texture references exist, and no library-only nodes render as roots.
- Large files and unexpected bundle growth are reviewed.
- CC BY assets have entries in `public/models/CREDITS.md`; no NC/ND or unapproved paid assets ship.
- No credentials, provider URLs, debug panels, local absolute paths, or temporary artifacts leak into the build.
- Final report lists build command, preview URL, screenshots, artifacts, deployment assumptions, and residual risks.
