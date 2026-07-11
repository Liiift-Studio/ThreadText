# Progress — stitchType

## Works today
- Photorealistic real-time satin embroidery of any word in any loaded font (`demo/index.html`).
- Flow-field-directed threads (fan around curves, no moiré), 20-bucket shaded thread sprites, dome-shade 3D, procedural woven fabric + contact shadow, subtle cursor sheen.
- Interactive: type to recompose, Backspace unpicks, Enter replays; blinking caret.
- Sew-in animation: one satin cross-row at a time, needle following each stroke (BFS layers).
- Passed a multi-agent code review; those fixes are in the demo (rAF teardown, Math.imul hashing, cached fabric + willReadFrequently, reduced-motion, aria-live, focus mgmt).

## Extracted (2026-07-11)
- [x] Framework-agnostic `src/core/stitchType.ts` — `createStitchText()` factory, typed API.
- [x] `src/core/types.ts` — `StitchOptions`, `StitchInstance`, `STITCH_CLASSES`.
- [x] React hook + component (`src/react/useStitchType.ts`, `StitchType.tsx`).
- [x] Vite/vitest/tsconfig bootstrap; `src/index.ts` public exports.
- [x] Tests (10 passing: pure math + lifecycle, canvas-2D stub for happy-dom).
- [x] Verified: lint clean, tests 10/10, build → ESM + CJS + `.d.ts`.

## Left to build (see ../HANDOFF.md)
- [ ] Framer + Webflow bindings (`src/framer/`, `src/webflow/`).
- [ ] `vercel.json`, `.claude/`, and the shared site-kit files (via parent `npm run sync`).
- [ ] Landing site (Next.js) with a free-licensed demo font.
- [ ] Register as a type-tools submodule; npm publish; Vercel deploy.
- [ ] Perf: region-limit or Worker/WASM the per-keystroke geometry rebuild.
- [ ] Mobile/touch story.
- [ ] Optional: additional stitch modes; real VF-axis control (path-based glyphs).

## Known issues
- Per-keystroke rebuild recomputes the whole canvas (main cost).
- Tiny residual swirl at some bowl centres; BFS cross-row can span forks momentarily.
- No `opsz`/VF-axis control via canvas `ctx.font` (numeric weight only).
- Demo font proprietary (swap before publish).
