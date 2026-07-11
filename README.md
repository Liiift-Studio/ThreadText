# stitchType

**Render any text as photorealistic, procedural satin-stitch embroidery — in real time, in the browser, from the font's actual glyph geometry.**

> Status: **early / in-progress.** A fully working reference renderer lives in [`demo/index.html`](./demo/index.html). It has **not yet** been extracted into the `@liiift-studio` Vite/TS package + React/Framer/Webflow bindings + landing site that the other type-tools ship as. See [`HANDOFF.md`](./HANDOFF.md) for exactly what's done, what's left, and how to finish it. The tool-build conventions are in the monorepo [`../GUIDE.md`](../GUIDE.md).

Name is a placeholder — rename freely (`satinType`, `threadText`, `sewType`, …).

---

## What it is

Give it a word set in any loaded (variable) font and it renders it as **raised white satin floss on woven fabric** — threads that run *across* each stroke and fan around the curves, lifted into 3D, seated with a contact shadow, and sewn in one satin stitch at a time. It's photorealistic **by construction** (real thread geometry + lighting), not a raster filter and not an AI image.

## Why it's worth building (the niche is empty)

A survey of the field (embroidery-digitizing software, JS libraries, mockup generators, CSS tricks, creative-coding shaders, AI generators, and the graphics literature) found **no existing tool that does all of**: real-time · arbitrary text from a font · procedural (no pre-baked assets) · photorealistic satin · in a plain browser. Every existing thing drops at least one pillar:

- **Digitizing software** (Ink/Stitch, PEmbroider, Wilcom/Hatch **TrueView**) — real stitch logic, but desktop, machine-file-oriented; previews are schematic (TrueView's photoreal render is an exported still, not live procedural web).
- **The one close browser lib** (`p5.embroider`) — right platform, but alpha & non-photoreal.
- **Fakes** (Photoshop actions, Placeit/Printful mockups, CSS, AI diffusion "embroidery" generators) — raster or generative, not procedural-from-font, not real-time-relightable.
- **Research/shaders** (Chen–McCool–Kitamoto 2012; Blender knit shaders; Shadertoy stitch patterns) — closest ideas, but not text-from-font, not browser, and either non-photoreal or non-real-time.

Defensible novelty to lead with: **(a)** font/variable-font glyph geometry drives the stitch flow field, **(b)** photoreal-by-construction (not AI, not a raster filter), **(c)** fully real-time + relightable + animated in a plain browser with zero pre-baked assets. (Full source list in `HANDOFF.md`.)

## Run the demo

It's a single self-contained file — no build step:

```bash
# from this folder
python3 -m http.server 8080
# open http://localhost:8080/demo/
```

Type to embroider a new word · Backspace to unpick · Enter to replay the sew-in · move the cursor for the sheen.

> The demo font (`demo/DaithVF.woff2`) is **Darden Studio proprietary** — fine for local dev, but **swap it for a freely-licensed variable font before this repo is made public or published.** The renderer works with any loaded font.

## How it works (one paragraph)

Rasterise the glyphs → compute a signed-distance field → derive a **flow field** (smoothed in double-angle orientation space so opposite edge-normals reinforce) so threads run across each stroke → lay thousands of discrete pre-shaded **thread sprites** oriented by the flow → lift to 3D with a dome-shade/normal map → seat on procedural woven fabric with a contact shadow → **sew it in** one BFS cross-row at a time (the needle follows the stroke) → a subtle cursor-driven sheen. Full walkthrough with line references in `HANDOFF.md`.

## What's next

The renderer is proven. Finishing it means productionising per [`../GUIDE.md`](../GUIDE.md): extract a framework-agnostic **core** with a typed API, add the **React hook + component**, **Framer** + **Webflow** bindings, tests, a landing **site**, then ship (npm + Vercel). A proposed core API and step-by-step plan are in `HANDOFF.md`.

---

Part of [type-tools](https://github.com/Liiift-Studio/type-tools) by [Liiift Studio](https://liiift.studio). MIT (intended).
