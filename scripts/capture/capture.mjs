// scripts/capture/capture.mjs — reproducible README capture harness.
// Serves the repo root over HTTP, drives capture.html with Playwright (real Chromium canvas),
// and writes hero + stitch-mode stills and a sew-in GIF to /assets. Run: `npm run capture`.
// Requires devDep `playwright` (+ `npx playwright install chromium`) and `ffmpeg` on PATH.
import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { mkdir, rm } from "node:fs/promises"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join, extname } from "node:path"
import { chromium } from "playwright"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, "..", "..")          // repo root (threadText/)
const ASSETS = join(ROOT, "assets")
const PORT = 8123
const SCALE = 2                              // retina stills

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff", ".json": "application/json" }

// A characterful OFL display serif reads well as thick floss; warm gold on the dark showcase card.
const FONT = '"Fraunces", Georgia, serif'
const GOLD = "#e7c56a"

/** Static file server rooted at the repo, so /dist and /site/public/fonts resolve. */
function serve() {
	return new Promise((resolve) => {
		const server = createServer(async (req, res) => {
			try {
				const url = decodeURIComponent(req.url.split("?")[0])
				const path = url === "/" ? "/scripts/capture/capture.html" : url
				const buf = await readFile(join(ROOT, path))
				res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream", "cache-control": "no-store" })
				res.end(buf)
			} catch {
				res.writeHead(404); res.end("not found")
			}
		})
		server.listen(PORT, () => resolve(server))
	})
}

/** Run ffmpeg, resolving on exit 0. */
function ffmpeg(args) {
	return new Promise((resolve, reject) => {
		const p = spawn("ffmpeg", ["-y", ...args], { stdio: "inherit" })
		p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg exit " + code))))
	})
}

async function main() {
	await rm(ASSETS, { recursive: true, force: true })
	await mkdir(ASSETS, { recursive: true })
	const frameDir = join(ASSETS, "_frames")
	await mkdir(frameDir, { recursive: true })

	const server = await serve()
	const browser = await chromium.launch()
	const page = await browser.newPage({ deviceScaleFactor: SCALE, viewport: { width: 1400, height: 1000 } })
	page.on("console", (m) => { if (m.type() === "error") console.log("  page error:", m.text()) })
	await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" })
	await page.waitForFunction("window.__ready === true")

	const shot = async (name) => {
		await page.locator(".stage").screenshot({ path: join(ASSETS, name) })
		console.log("  ✓", name)
	}

	// 1) Hero — one word, big, warm floss on the dark card.
	console.log("Hero…")
	await page.evaluate((o) => window.mount(o), {
		layout: "single",
		common: { font: '"Fraunces", Georgia, serif', threadColor: "#e7c56a", weight: 600, animate: false, sheen: false },
		options: { text: "Thread", fill: 0.92, axes: { opsz: 120 } },
	})
	await page.waitForFunction("window.waitDrawn()")
	await shot("hero.png")

	// 2) Stitch modes — the four textures, labelled.
	console.log("Stitch modes…")
	await page.evaluate((o) => window.mount(o), {
		layout: "grid",
		common: { font: '"Fraunces", Georgia, serif', threadColor: "#e7c56a", weight: 640, animate: false, sheen: false, fill: 0.82 },
		cells: [
			{ caption: "satin", options: { text: "Sew", stitchMode: "satin" } },
			{ caption: "cross", options: { text: "Sew", stitchMode: "cross" } },
			{ caption: "chain", options: { text: "Sew", stitchMode: "chain" } },
			{ caption: "running", options: { text: "Sew", stitchMode: "running" } },
		],
	})
	await page.waitForFunction("window.waitDrawn()")
	await shot("stitch-modes.png")

	// 3) Thread styles — solid / two-tone / gradient / backstitch, labelled.
	console.log("Thread styles…")
	await page.evaluate((o) => window.mount(o), {
		layout: "grid",
		common: { font: '"Fraunces", Georgia, serif', animate: false, sheen: false, fill: 0.82, weight: 640, threadColor: "#e7c56a" },
		cells: [
			{ caption: "solid", options: { text: "Sew" } },
			{ caption: "two-tone", options: { text: "Sew", colorMode: "twotone", threadColor2: "#c0532f" } },
			{ caption: "gradient", options: { text: "Sew", colorMode: "gradient", threadColor2: "#7a1f8c" } },
			{ caption: "backstitch", options: { text: "Sew", backstitch: true, outlineColor: "#3a2410" } },
		],
	})
	await page.waitForFunction("window.waitDrawn()")
	await shot("thread-styles.png")

	// 4) Sew-in GIF — the signature animation, captured frame by frame.
	// The GIF must survive its own FIRST frame (GitHub/npm often show the poster, not motion),
	// so we lead with a few frames of the FINISHED word, then play the sew-in, then hold on the
	// finished piece. Poster = a recognisable embroidered word, not an empty canvas.
	const gifScene = {
		layout: "single",
		common: { font: '"Fraunces", Georgia, serif', threadColor: "#e7c56a", weight: 600, sheen: false },
		options: { text: "Sew", fill: 0.8, sewStyle: "machine", sewRate: 90, axes: { opsz: 120 } },
	}
	let f = 0
	const grab = () => page.locator(".stage").screenshot({ path: join(frameDir, `f${String(f++).padStart(3, "0")}.png`) })

	console.log("Sew-in GIF (poster)…")
	await page.evaluate((o) => window.mount({ ...o, options: { ...o.options, animate: false } }), gifScene)
	await page.waitForFunction("window.waitDrawn()")
	for (let i = 0; i < 6; i++) await grab()      // finished-word poster / lead-in

	console.log("Sew-in GIF (animation)…")
	await page.evaluate((o) => window.mount({ ...o, options: { ...o.options, animate: true } }), gifScene)
	for (let i = 0; i < 42; i++) { await grab(); await page.waitForTimeout(55) }   // empty → sewn
	for (let i = 0; i < 12; i++) await grab()      // hold on the finished piece

	await browser.close()
	server.close()

	// Assemble GIF with a generated palette (clean colour, small file), scaled to 720px wide.
	console.log("Encoding GIF…")
	const palette = join(frameDir, "palette.png")
	const vf = "fps=18,scale=720:-1:flags=lanczos"
	await ffmpeg(["-framerate", "18", "-i", join(frameDir, "f%03d.png"), "-vf", `${vf},palettegen=stats_mode=diff`, palette])
	await ffmpeg(["-framerate", "18", "-i", join(frameDir, "f%03d.png"), "-i", palette, "-lavfi", `${vf} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=3`, "-loop", "0", join(ASSETS, "sew-in.gif")])
	await rm(frameDir, { recursive: true, force: true })

	console.log("Done → assets/hero.png, assets/stitch-modes.png, assets/sew-in.gif")
}

main().catch((e) => { console.error(e); process.exit(1) })
