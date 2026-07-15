# DEADWATER responsive UI fit checklist

- Desktop game windows preserve the 4:3 viewport without stretching the R3F camera.
- The viewport fits common desktop and laptop heights while retaining the hotbar and overlay copy.
- Narrow supported desktop windows do not clip the title, controls, share button, prompt, or hotbar.
- The mobile 4:3 preview fits the screen, its card copy wraps, and the share action remains reachable.
- The editor remains a full-window workspace with a dominant central viewport.
- Hierarchy, details, palette, and asset lists scroll independently instead of growing the page.
- Long ids, deep nesting, large component stacks, and full palettes do not cover the viewport.
- Toolbar controls wrap or scroll intentionally at narrow editor widths.
- Editor inputs, selects, buttons, and labels remain legible and keyboard reachable.
- Dynamic save, placement, and mode messages do not force critical tools offscreen.
- Canvas CSS size and drawing-buffer size remain appropriate for each surface: fixed game output, crisp editor output.
- Screenshots cover the desktop CLOCK IN menu, ordinary play, the smallest supported desktop view, the mobile preview when relevant, and a dense editor state.
