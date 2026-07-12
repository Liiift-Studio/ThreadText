# Panel Review — Project Specialists

Saved: 2026-07-12

## Specialists (slots 11–15, auto-detected)
1. Font / Variable-Font Engineer — detected: .woff2, font-variation-settings, opsz/wght
2. Graphics / Rendering Engineer — detected: canvas 2D, getImageData, sprite compositing
3. Animation Engineer — detected: requestAnimationFrame sew-in loop
4. Browser Layout Engineer — detected: ResizeObserver, getBoundingClientRect, fit-to-width
5. Deep Accessibility Specialist — detected: editable mode, role/aria, focus, caret

## Known intentional patterns (do not re-flag)
- **Sew-in animation runs only on mount + `replay()`** — deliberate. Fit-to-width means text/size/
  font changes reflow the whole word, so per-edit sewing would be chaotic; live changes redraw
  instantly via `update()`/`setText`. `buildSewRows(subset)` keeps a `subset` param as a small
  vestige but is always called with all stitches.
- **Canvas `fillText` cannot set `font-variation-settings`** — so `opsz`/`SOFT`/`WONK` axes render
  at the font's default instance; only numeric `weight` is reachable. Inherent to canvas; the hero
  `<h1>` therefore avoids `opsz` overrides so it matches the canvas. Real VF-axis control would need
  path-based glyph rendering (tracked, HANDOFF).
- **Per-keystroke full geometry rebuild** (EDT + double-angle blur over the whole canvas) is the
  known dominant cost — accepted for now, tracked as a perf issue (Worker/region-limit).
- **`update()` sewRate/animate/onTextChange changes don't redraw** — correct; they only affect the
  next sew/edit. Only visual fields (colour/font/weight/fill) redraw.
- **`weight` slider is near-inert for non-variable system fonts** (sans/mono/cursive resolve to
  static 400/700) and clamps below the font's axis floor — inherent to those faces, not a bug.

## 2026-07-12 session
15-engineer panel (10 core + 5 specialists) reviewed src/ (core, hook, component, Framer, Webflow,
types) + site/ (Demo, page, globals). Fixed in one pass: RO-wiped mount sew-in; editable backed by a
real `<input>` (a11y/touch/IME); parked idle rAF loop; element-scoped sheen; cached scratch/sprites;
removed dead `leftX/rightX` + sort; font-timer Set; middle-baseline height metrics; option clamping;
`update({text})` routing; `role=img` hidden-input a11y conflict; stale docs; demo select/input/length.
Deferred → GitHub issues: per-keystroke perf, test-stub coverage gap, runtime reduced-motion, caret
mid-word editing.
