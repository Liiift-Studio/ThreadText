# stitchType — Project Brief

## What
A type-tools tool that renders arbitrary text as **photorealistic, procedural satin-stitch embroidery** in real time in the browser, driven by the font's actual glyph geometry (no pre-baked assets, no AI, no raster filter).

## Why
The niche is empty — no existing tool combines {real-time · text-from-a-font · procedural · photoreal satin · in-browser}. See `../HANDOFF.md` §Research appendix. It's a strong, novel addition to the type-tools family.

## Scope (v1)
- Satin-stitch look, white floss on dark woven fabric (colours should become options).
- Any loaded (variable) font; type to recompose; sew-in animation; cursor sheen.
- Ship as `@liiift-studio/threadtext` (domain threadtext.com) per `../GUIDE.md` (Vite/TS core → React/Framer/Webflow → landing site → npm + Vercel).

## Not this tool
The sibling WebGL "strike-on book page" (imprinted-paper hero) is a *different* exploration; it now lives in the Darden site as `daithHero`. Ignore it here.

## Source of truth
`demo/index.html` — the verified-working reference renderer. Everything else is to be built around it.
