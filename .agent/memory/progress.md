# Progress — stitchType

## Works today
- Photorealistic real-time satin embroidery of any word in any loaded font (`demo/index.html`).
- Flow-field-directed threads (fan around curves, no moiré), 20-bucket shaded thread sprites, dome-shade 3D, procedural woven fabric + contact shadow, subtle cursor sheen.
- Interactive: type to recompose, Backspace unpicks, Enter replays; blinking caret.
- Sew-in animation: one satin cross-row at a time, needle following each stroke (BFS layers).
- Passed a multi-agent code review; those fixes are in the demo (rAF teardown, Math.imul hashing, cached fabric + willReadFrequently, reduced-motion, aria-live, focus mgmt).

## Left to build (to be a real tool — see ../HANDOFF.md)
- [ ] Extract framework-agnostic `src/core/stitchType.ts` (typed API).
- [ ] React hook + component; Framer + Webflow bindings.
- [ ] Vite/vitest/tsconfig/vercel bootstrap; tests.
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
