// threadText/src/core/threadText.ts — framework-agnostic procedural satin-stitch renderer.
//
// Discrete pre-shaded thread sprites are laid on a flow field derived from the font's
// glyph geometry (an exact Euclidean distance transform, smoothed in double-angle
// orientation space so opposite edge-normals reinforce). A dome-shade map lifts the
// floss into 3D; it sits on procedural woven fabric with a contact shadow, and a
// cursor-following sheen turns the threads over in the light. Sewn in one satin
// cross-row at a time (BFS layers over the stitch graph, needle following each stroke).
//
// This is the demo/index.html renderer with its module-level globals lifted into
// per-instance closure state, exposed through createThreadText() -> ThreadTextInstance.

import type { ThreadTextOptions, ThreadTextInstance } from './types'
import { THREAD_TEXT_CLASSES } from './types'

// ─── Pure helpers (no DOM — unit-testable in isolation) ─────────────────────────

/** 32-bit-safe integer hash of a 2D coordinate, returned in [0, 1]. */
export function hash2(x: number, y: number): number {
	let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0
	h = Math.imul(h ^ (h >>> 13), 1274126177)
	return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** Smooth value noise in [0, 1] built from {@link hash2}. */
export function vnoise(x: number, y: number): number {
	const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
	const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
	const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1)
	return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

// Sentinel "infinite" distance for the EDT.
const INF = 1e20

/** One-dimensional squared-distance transform (Felzenszwalb–Huttenlocher). */
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
	let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF
	for (let q = 1; q < n; q++) {
		let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
		while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]) }
		k++; v[k] = q; z[k] = s; z[k + 1] = INF
	}
	k = 0
	for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]] }
}

/**
 * Exact Euclidean distance (in pixels) from every inside pixel of `mask` to the
 * nearest outside pixel. Two-pass separable EDT over a W×H binary mask.
 */
export function distanceInside(mask: Uint8Array, W: number, H: number): Float32Array {
	const grid = new Float64Array(W * H)
	for (let i = 0; i < W * H; i++) grid[i] = mask[i] ? INF : 0
	const md = Math.max(W, H)
	const f = new Float64Array(md), d = new Float64Array(md), v = new Int32Array(md), z = new Float64Array(md + 1)
	for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) f[y] = grid[y * W + x]; edt1d(f, H, d, v, z); for (let y = 0; y < H; y++) grid[y * W + x] = d[y] }
	for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) f[x] = grid[y * W + x]; edt1d(f, W, d, v, z); for (let x = 0; x < W; x++) grid[y * W + x] = d[x] }
	const out = new Float32Array(W * H)
	for (let i = 0; i < W * H; i++) out[i] = Math.sqrt(grid[i])
	return out
}

/** Separable box blur with clamped edges, run `iters` times at radius `R`. */
export function boxBlur(src: Float32Array, W: number, H: number, R: number, iters: number): Float32Array {
	let a = Float32Array.from(src)
	const b = new Float32Array(W * H)
	const inv = 1 / (2 * R + 1)
	const cl = (val: number, m: number) => (val < 0 ? 0 : val > m ? m : val)
	for (let it = 0; it < iters; it++) {
		for (let y = 0; y < H; y++) {
			const row = y * W; let sum = 0
			for (let x = -R; x <= R; x++) sum += a[row + cl(x, W - 1)]
			for (let x = 0; x < W; x++) { b[row + x] = sum * inv; sum += a[row + cl(x + R + 1, W - 1)] - a[row + cl(x - R, W - 1)] }
		}
		for (let x = 0; x < W; x++) {
			let sum = 0
			for (let y = -R; y <= R; y++) sum += b[cl(y, H - 1) * W + x]
			for (let y = 0; y < H; y++) { a[y * W + x] = sum * inv; sum += b[cl(y + R + 1, H - 1) * W + x] - b[cl(y - R, H - 1) * W + x] }
		}
	}
	return a
}

/** Parse a `#rgb` / `#rrggbb` / `rgb()/rgba()` colour to an [r, g, b] byte triple. */
export function parseColor(input: string, fallback: [number, number, number]): [number, number, number] {
	if (!input) return fallback
	const s = input.trim()
	if (s[0] === '#') {
		let hex = s.slice(1)
		if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
		if (hex.length >= 6) {
			const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), bl = parseInt(hex.slice(4, 6), 16)
			if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(bl)) return [r, g, bl]
		}
		return fallback
	}
	const m = s.match(/rgba?\(([^)]+)\)/i)
	if (m) {
		const parts = m[1].split(',').map((p) => parseFloat(p))
		if (parts.length >= 3 && parts.slice(0, 3).every((n) => !Number.isNaN(n))) {
			return [Math.round(parts[0]), Math.round(parts[1]), Math.round(parts[2])]
		}
	}
	return fallback
}

/** Clamp a number to the 0–255 byte range and round. */
function byte(n: number): number { return n < 0 ? 0 : n > 255 ? 255 : Math.round(n) }

// A single laid stitch: position, thread angle, and pre-shaded sprite brightness bucket.
interface Stitch { x: number; y: number; ang: number; idx: number }

// ─── The instance factory ────────────────────────────────────────────────────────

/**
 * Mount a procedural satin-stitch embroidery renderer inside `target`.
 *
 * When `target` is a plain element, two stacked canvases (base + sheen overlay) are
 * created inside it. When `target` is itself a `<canvas>`, it is used as the base and a
 * sheen overlay is added as a sibling. Returns a {@link ThreadTextInstance} handle.
 */
export function createThreadText(target: HTMLElement, opts: ThreadTextOptions): ThreadTextInstance {
	// SSR / no-DOM guard — return an inert handle.
	if (typeof window === 'undefined' || typeof document === 'undefined' || !target) {
		return { setText() {}, replay() {}, resize() {}, destroy() {}, get text() { return opts.text ?? '' } }
	}

	// ── options / config ──
	let text = opts.text ?? ''
	const font = opts.font ?? 'Georgia, serif'
	const weight = opts.weight ?? 680
	const aspect = opts.aspect ?? 0.46
	const sewRate = opts.sewRate ?? 110
	const sheenOn = opts.sheen ?? true
	const animate = opts.animate ?? true
	const primaryFamily = (font.split(',')[0] || 'serif').trim().replace(/^["']|["']$/g, '')

	const REDUCED = opts.reducedMotion ??
		!!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

	// Thread colour ramp (lit crest → mid → soft ends), derived from threadColor.
	const threadPeak = parseColor(opts.threadColor ?? '#fffbf3', [255, 251, 243])
	const threadMid: [number, number, number] = [threadPeak[0] * 0.585, threadPeak[1] * 0.585, threadPeak[2] * 0.585]
	const threadEnd: [number, number, number] = [threadPeak[0] * 0.47, threadPeak[1] * 0.47, threadPeak[2] * 0.47]
	// Fabric: outer base colour + a slightly-lighter inner (radial ground).
	const fabricOuter = parseColor(opts.fabricColor ?? '#08080a', [8, 8, 10])
	const fabricInner: [number, number, number] = [byte(fabricOuter[0] + 14), byte(fabricOuter[1] + 13), byte(fabricOuter[2] + 15)]
	const rgb = (c: [number, number, number]) => `rgb(${byte(c[0])},${byte(c[1])},${byte(c[2])})`

	// ── target canvases ──
	const created: HTMLCanvasElement[] = []
	let bgC: HTMLCanvasElement
	let container: HTMLElement
	if (target instanceof HTMLCanvasElement) {
		bgC = target
		container = target.parentElement ?? target
	} else {
		container = target
		bgC = document.createElement('canvas'); created.push(bgC)
		container.appendChild(bgC)
	}
	bgC.classList.add(THREAD_TEXT_CLASSES.bg)
	const fxC = document.createElement('canvas'); created.push(fxC)
	fxC.classList.add(THREAD_TEXT_CLASSES.fx)
	container.appendChild(fxC)
	// Layout: bg in flow, fx overlaid with screen blend for the sheen.
	if (getComputedStyle(container).position === 'static') container.style.position = 'relative'
	bgC.style.display = 'block'; bgC.style.width = '100%'
	Object.assign(fxC.style, { position: 'absolute', inset: '0', width: '100%', pointerEvents: 'none', mixBlendMode: 'screen' } as CSSStyleDeclaration)

	// ── per-instance render state (was module globals in the demo) ──
	let W = 0, H = 0
	let FS = 0, ANCHOR_X = 0          // fixed font size + left anchor so appended letters don't reflow
	let PITCH = 4
	let SPRITES: HTMLCanvasElement[] = [], SPRITE_W = 0, SPRITE_H = 0
	let MASK: Uint8Array = new Uint8Array(0)
	let SHADE: Float32Array = new Float32Array(0)
	let EX: Float32Array = new Float32Array(0), EY: Float32Array = new Float32Array(0)
	let MASKCV: HTMLCanvasElement | null = null, SHADOWCV: HTMLCanvasElement | null = null
	let FABRIC_CV: HTMLCanvasElement | null = null, OFFCV: HTMLCanvasElement | null = null
	let OFFCTX: CanvasRenderingContext2D | null = null
	let STITCHES: Stitch[] = [], STEP_G = 3

	const anim = { rows: [] as Stitch[][], idx: 0, acc: 0, rate: 0, on: false }
	const sheen = { x: 0, y: 0, set: false }
	let sheenDirty = true

	let rafId = 0, loopStarted = false, lastTS = 0
	let destroyed = false, booted = false

	// ── sizing ──
	function computeSize(): void {
		const rect = container.getBoundingClientRect()
		const cssW = Math.round(rect.width || Math.min(window.innerWidth * 0.95, 1240))
		const cssH = Math.round(cssW * aspect)
		let scale = Math.min(window.devicePixelRatio || 1, 1.7)
		while (cssW * scale * cssH * scale > 900000 && scale > 0.55) scale -= 0.1   // lower res → snappier per-keystroke rebuild
		W = Math.max(1, Math.round(cssW * scale)); H = Math.max(1, Math.round(cssH * scale))
		for (const c of [bgC, fxC]) { c.width = W; c.height = H; c.style.height = cssH + 'px' }
		container.style.height = cssH + 'px'
	}

	// ── thread sprite (pre-shaded), in 20 brightness variants ──
	function buildSprites(): void {
		const L = Math.max(7, PITCH * 2.5)     // thread length (across the stroke)
		const Wd = Math.max(3.2, PITCH * 1.3)  // thread width
		SPRITE_W = Math.ceil(L) + 2; SPRITE_H = Math.ceil(Wd) + 2
		SPRITES = []
		for (let k = 0; k < 20; k++) {
			const b = 0.34 + (k / 19) * 0.82           // brightness level (20 buckets → less banding)
			const cv = document.createElement('canvas'); cv.width = SPRITE_W; cv.height = SPRITE_H
			const c = cv.getContext('2d')
			if (!c) { SPRITES.push(cv); continue }
			const cx = SPRITE_W / 2, cy = SPRITE_H / 2
			// rounded-tube cross-section (vertical gradient across the width)
			const g = c.createLinearGradient(0, cy - Wd / 2, 0, cy + Wd / 2)
			const col = (base: [number, number, number], a: number) => `rgba(${byte(base[0] * b)},${byte(base[1] * b)},${byte(base[2] * b)},${a})`
			g.addColorStop(0.00, col(threadEnd, 0))
			g.addColorStop(0.16, col(threadMid, 1))
			g.addColorStop(0.50, col(threadPeak, 1))
			g.addColorStop(0.84, col(threadMid, 1))
			g.addColorStop(1.00, col(threadEnd, 0))
			c.fillStyle = g
			// stadium body
			c.beginPath()
			const r = Wd / 2
			c.moveTo(cx - L / 2 + r, cy - r)
			c.lineTo(cx + L / 2 - r, cy - r)
			c.arc(cx + L / 2 - r, cy, r, -Math.PI / 2, Math.PI / 2)
			c.lineTo(cx - L / 2 + r, cy + r)
			c.arc(cx - L / 2 + r, cy, r, Math.PI / 2, -Math.PI / 2)
			c.closePath()
			c.fill()
			// soft fade at the two ends so neighbours blend along the thread
			c.globalCompositeOperation = 'destination-in'
			const ge = c.createLinearGradient(cx - L / 2, 0, cx + L / 2, 0)
			ge.addColorStop(0, 'rgba(0,0,0,0)'); ge.addColorStop(0.22, 'rgba(0,0,0,1)')
			ge.addColorStop(0.78, 'rgba(0,0,0,1)'); ge.addColorStop(1, 'rgba(0,0,0,0)')
			c.fillStyle = ge; c.fillRect(0, 0, SPRITE_W, SPRITE_H)
			SPRITES.push(cv)
		}
	}

	// ── geometry pass for the current word ──
	function build(): void {
		if (!OFFCTX) return
		const o = OFFCTX
		o.clearRect(0, 0, W, H)
		o.fillStyle = '#fff'; o.textAlign = 'left'; o.textBaseline = 'middle'
		o.font = `${weight} ${FS}px ${font}`
		o.fillText(text, ANCHOR_X, H * 0.5)
		const img = o.getImageData(0, 0, W, H).data

		// frayed mask
		const mask = new Uint8Array(W * H)
		for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
			const i = y * W + x, a = img[i * 4 + 3] / 255
			const n = vnoise(x * 0.5, y * 0.5) * 0.22 + vnoise(x * 1.8, y * 1.8) * 0.10
			mask[i] = a > (0.5 + (n - 0.16)) ? 1 : 0
		}
		MASK = mask

		// distance + smoothed
		const dist = distanceInside(mask, W, H)
		const distS = new Float32Array(W * H)
		for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
			const i = y * W + x
			distS[i] = (dist[i] * 4 + dist[i - 1] + dist[i + 1] + dist[i - W] + dist[i + W]) / 8
		}

		// orientation field, smoothed in double-angle space
		const C2 = new Float32Array(W * H), S2 = new Float32Array(W * H)
		const gxF = new Float32Array(W * H), gyF = new Float32Array(W * H)
		for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
			const i = y * W + x; if (!mask[i]) continue
			const gx = (distS[i + 1] - distS[i - 1]) * 0.5, gy = (distS[i + W] - distS[i - W]) * 0.5
			gxF[i] = gx; gyF[i] = gy; C2[i] = gx * gx - gy * gy; S2[i] = 2 * gx * gy
		}
		const R = Math.max(7, Math.round(H * 0.05))
		const C2b = boxBlur(C2, W, H, R, 2), S2b = boxBlur(S2, W, H, R, 2)
		EX = new Float32Array(W * H); EY = new Float32Array(W * H)
		for (let i = 0; i < W * H; i++) { if (!mask[i]) continue; const th = 0.5 * Math.atan2(S2b[i], C2b[i]); EX[i] = Math.cos(th); EY[i] = Math.sin(th) }

		// dome-shade map (raised 3D, fixed top-left light + edge AO)
		const PAD = Math.max(9, H * 0.04)
		const shade = new Float32Array(W * H)
		const Lx = -0.45, Ly = -0.62, Lz = 0.64
		for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
			const i = y * W + x; if (!mask[i]) continue
			let gx = gxF[i], gy = gyF[i]; const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl
			const dd = distS[i]; const domeSlope = (1 - Math.min(dd / PAD, 1)) * 1.25
			let nx = -gx * domeSlope, ny = -gy * domeSlope; const nz = 1.5; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl
			let dif = nx * Lx + ny * Ly + (nz / nl) * Lz; if (dif < 0) dif = 0
			const ao = Math.min(1, 0.45 + 0.55 * Math.min(dd / (PAD * 0.7), 1))
			shade[i] = Math.min(1.12, (0.5 + 0.75 * dif) * ao)
		}
		SHADE = shade

		// solid white mask canvas (for cursor-sheen clipping)
		MASKCV = document.createElement('canvas'); MASKCV.width = W; MASKCV.height = H
		const mc = MASKCV.getContext('2d')
		// dark shadow canvas (black with mask alpha — the contact shadow / seat)
		SHADOWCV = document.createElement('canvas'); SHADOWCV.width = W; SHADOWCV.height = H
		const sc = SHADOWCV.getContext('2d')
		if (mc && sc) {
			const md = mc.createImageData(W, H), sdd = sc.createImageData(W, H)
			for (let i = 0; i < W * H; i++) if (mask[i]) {
				md.data[i * 4] = 255; md.data[i * 4 + 1] = 255; md.data[i * 4 + 2] = 255; md.data[i * 4 + 3] = 255
				sdd.data[i * 4 + 3] = 255   // black, opaque
			}
			mc.putImageData(md, 0, 0)
			sc.putImageData(sdd, 0, 0)
		}
	}

	// ── size-dependent scratch: bake the static woven linen once + reused glyph scratch ──
	function allocForSize(): void {
		FABRIC_CV = document.createElement('canvas'); FABRIC_CV.width = W; FABRIC_CV.height = H
		const c = FABRIC_CV.getContext('2d', { willReadFrequently: true })
		if (c) {
			const g = c.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.5, W * 0.72)
			g.addColorStop(0, rgb(fabricInner)); g.addColorStop(1, rgb(fabricOuter))
			c.fillStyle = g; c.fillRect(0, 0, W, H)
			const img = c.getImageData(0, 0, W, H), d = img.data
			for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
				const i = (y * W + x) * 4
				const warp = Math.sin(x * 1.9) * 0.5 + 0.5, weft = Math.sin(y * 1.9) * 0.5 + 0.5
				const v = (warp * weft) * 9 - 4.5 + (vnoise(x * 0.18, y * 0.18) - 0.5) * 15
				d[i] = byte(d[i] + v); d[i + 1] = byte(d[i + 1] + v); d[i + 2] = byte(d[i + 2] + v * 1.1)
			}
			c.putImageData(img, 0, 0)
		}
		OFFCV = document.createElement('canvas'); OFFCV.width = W; OFFCV.height = H
		OFFCTX = OFFCV.getContext('2d', { willReadFrequently: true })
	}

	// ── stitch list (sorted by x only for leftX/rightX bounds; reveal order is the BFS) ──
	function buildStitchList(): void {
		const STEP = Math.max(1.6, PITCH * 0.6); STEP_G = STEP
		const list: Stitch[] = []
		for (let y = 0; y < H; y += STEP) for (let x = 0; x < W; x += STEP) {
			const jx = (hash2(Math.floor(x), Math.floor(y)) - 0.5) * STEP * 0.9
			const jy = (hash2(Math.floor(y), Math.floor(x)) - 0.5) * STEP * 0.9
			const px = Math.round(x + jx), py = Math.round(y + jy)
			if (px < 1 || py < 1 || px >= W - 1 || py >= H - 1) continue
			const i = py * W + px; if (!MASK[i]) continue
			const ang = Math.atan2(EY[i], EX[i])
			const jit = 0.86 + hash2(px * 7, py * 13) * 0.18
			let b = SHADE[i] * jit; b = b < 0 ? 0 : b > 1.12 ? 1.12 : b
			list.push({ x: px, y: py, ang, idx: Math.min(19, Math.max(0, Math.round((b / 1.12) * 19))) })
		}
		list.sort((a, b) => a.x - b.x)   // for leftX/rightX bounds
		STITCHES = list
	}

	function drawStitch(c: CanvasRenderingContext2D, s: Stitch): void {
		c.save(); c.translate(s.x, s.y); c.rotate(s.ang); c.drawImage(SPRITES[s.idx], -SPRITE_W / 2, -SPRITE_H / 2); c.restore()
	}
	function drawAll(): void { const c = bgC.getContext('2d'); if (!c) return; for (const s of STITCHES) drawStitch(c, s) }
	function rightX(): number { return STITCHES.length ? STITCHES[STITCHES.length - 1].x : 0 }
	function leftX(): number { return STITCHES.length ? STITCHES[0].x : 0 }
	function resetBg(): void {
		const c = bgC.getContext('2d'); if (!c || !FABRIC_CV) return
		c.drawImage(FABRIC_CV, 0, 0)                                   // cached static linen
		if (SHADOWCV) {
			c.save(); c.globalAlpha = 0.85; c.filter = `blur(${Math.round(H * 0.018)}px)`
			c.drawImage(SHADOWCV, 0, Math.round(H * 0.02)); c.restore()   // per-word contact shadow
		}
	}

	// ── satin sewing animation: one BFS cross-row at a time, needle following the stroke ──
	function buildSewRows(subset: Stitch[]): Stitch[][] {
		if (!subset.length) return []
		const CELL = Math.max(4, STEP_G * 1.5), grid = new Map<string, number[]>()
		const key = (cx: number, cy: number) => cx + ',' + cy
		subset.forEach((s, idx) => { const k = key(Math.floor(s.x / CELL), Math.floor(s.y / CELL)); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(idx) })
		const R2 = (STEP_G * 1.8) * (STEP_G * 1.8)
		function nbrs(idx: number): number[] {
			const s = subset[idx], cx = Math.floor(s.x / CELL), cy = Math.floor(s.y / CELL), out: number[] = []
			for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
				const a = grid.get(key(cx + dx, cy + dy)); if (!a) continue
				for (const j of a) { if (j === idx) continue; const ex = subset[j].x - s.x, ey = subset[j].y - s.y; if (ex * ex + ey * ey <= R2) out.push(j) }
			}
			return out
		}
		const visited = new Uint8Array(subset.length), rows: Stitch[][] = []
		const seeds = subset.map((_, i) => i).sort((a, b) => (subset[a].x + subset[a].y) - (subset[b].x + subset[b].y))
		for (const seed of seeds) {
			if (visited[seed]) continue
			let frontier = [seed]; visited[seed] = 1
			while (frontier.length) {
				rows.push(frontier.map((i) => subset[i]))        // one BFS layer = one cross-row (satin stitch)
				const next: number[] = []
				for (const i of frontier) for (const j of nbrs(i)) if (!visited[j]) { visited[j] = 1; next.push(j) }
				frontier = next
			}
		}
		return rows
	}
	function startReveal(fromX: number, rate?: number): void {
		resetBg()
		const c = bgC.getContext('2d'); if (!c) return
		const subset: Stitch[] = []
		for (const s of STITCHES) { if (s.x <= fromX) drawStitch(c, s); else subset.push(s) }   // existing letters appear at once
		if (REDUCED) { for (const s of subset) drawStitch(c, s); anim.on = false; return }        // no motion: draw instantly
		anim.rows = buildSewRows(subset)
		anim.idx = 0; anim.acc = 0
		anim.rate = rate || sewRate                       // satin cross-rows laid per second
		anim.on = anim.rows.length > 0
	}
	function drawRowsTo(n: number): void {
		const c = bgC.getContext('2d'); if (!c) return
		if (n > anim.rows.length) n = anim.rows.length
		while (anim.idx < n) { const row = anim.rows[anim.idx++]; for (const s of row) drawStitch(c, s) }
	}

	// ── cursor sheen ──
	function drawSheen(lx: number, ly: number): void {
		const c = fxC.getContext('2d'); if (!c) return
		c.clearRect(0, 0, W, H)
		if (!sheenOn || !MASKCV) return
		const rad = W * 0.32, g = c.createRadialGradient(lx, ly, 0, lx, ly, rad)
		g.addColorStop(0, 'rgba(255,250,238,0.18)'); g.addColorStop(0.5, 'rgba(255,250,238,0.055)'); g.addColorStop(1, 'rgba(255,250,238,0)')
		c.fillStyle = g; c.fillRect(0, 0, W, H)
		c.globalCompositeOperation = 'destination-in'; c.drawImage(MASKCV, 0, 0); c.globalCompositeOperation = 'source-over'
	}

	// ── fixed font size + left anchor (computed once per size) so letters don't reflow ──
	function calibrate(): void {
		const c = bgC.getContext('2d'); if (!c) { FS = Math.round(H * 0.6); ANCHOR_X = Math.round(W * 0.14); return }
		const ref = text || 'Ag'
		c.font = `${weight} 100px ${font}`; const w = c.measureText(ref).width || 100
		FS = Math.round(100 * (W * 0.72) / w)
		c.font = `${weight} ${FS}px ${font}`; ANCHOR_X = Math.round(W / 2 - c.measureText(ref).width / 2)
	}

	// ── the rAF loop ──
	function loop(ts: number): void {
		if (destroyed) return
		if (!lastTS) lastTS = ts
		const dt = Math.min(0.25, (ts - lastTS) / 1000); lastTS = ts   // catch-up on throttled frames → wall-clock-paced reveal
		if (anim.on) { anim.acc += anim.rate * dt; drawRowsTo(anim.acc); if (anim.idx >= anim.rows.length) anim.on = false }
		if (sheenDirty && MASKCV) { drawSheen(sheen.set ? sheen.x : W * 0.5, sheen.set ? sheen.y : H * 0.34); sheenDirty = false }
		rafId = requestAnimationFrame(loop)
	}

	// ── input: cursor sheen tracking ──
	function onPointerMove(e: PointerEvent): void {
		const r = fxC.getBoundingClientRect()
		sheen.x = ((e.clientX - r.left) / (r.width || 1)) * W
		sheen.y = ((e.clientY - r.top) / (r.height || 1)) * H
		sheen.set = true; sheenDirty = true
	}
	if (sheenOn) window.addEventListener('pointermove', onPointerMove, { passive: true })

	// ── rebuild helpers used by the public API ──
	function paint(withAnimation: boolean): void {
		build(); buildStitchList()
		if (withAnimation && animate && !REDUCED) startReveal(leftX() - 1, sewRate)
		else { resetBg(); drawAll(); anim.on = false }
		sheenDirty = true
	}
	function firstPaint(): void {
		if (destroyed) return
		computeSize(); allocForSize()
		PITCH = Math.max(3.4, H * 0.0095)
		buildSprites(); calibrate()
		paint(true)
		booted = true
		if (!loopStarted) { loopStarted = true; rafId = requestAnimationFrame(loop) }
	}

	// Wait for the requested face if it is not already available, then paint once.
	let fontTimer: ReturnType<typeof setTimeout> | undefined
	function whenFontReady(cb: () => void): void {
		const spec = `${weight} 200px ${primaryFamily}`
		let already = false
		try { already = !!document.fonts && document.fonts.check(spec) } catch { already = true }
		if (!document.fonts || already) { cb(); return }
		let done = false
		const go = () => { if (!done) { done = true; if (fontTimer) clearTimeout(fontTimer); cb() } }
		document.fonts.load(spec, text).then(() => document.fonts.ready).then(go, go)
		fontTimer = setTimeout(go, 1500)   // never wait forever on a font that won't load
	}

	// ── boot ──
	whenFontReady(firstPaint)

	// Debounced self-resize so the standalone (non-React) API stays responsive.
	let resizeTimer: ReturnType<typeof setTimeout> | undefined
	function onResize(): void { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => api.resize(), 200) }
	window.addEventListener('resize', onResize)

	// ── public instance ──
	const api: ThreadTextInstance = {
		get text() { return text },
		setText(next: string): void {
			if (destroyed || !booted) { text = next ?? ''; return }
			next = next ?? ''
			const isAppend = next.length > text.length && text.length > 0 && next.startsWith(text)
			const prev = isAppend ? rightX() : -1
			text = next
			build(); buildStitchList()
			if (REDUCED || !animate) { resetBg(); drawAll(); anim.on = false }
			else startReveal(isAppend && prev > 0 ? Math.min(prev, rightX()) : leftX() - 1, isAppend ? 320 : sewRate)
			sheenDirty = true
		},
		replay(): void {
			if (destroyed || !booted) return
			if (REDUCED || !animate) { resetBg(); drawAll(); anim.on = false }
			else startReveal(leftX() - 1, sewRate)
			sheenDirty = true
		},
		resize(): void {
			if (destroyed) return
			computeSize(); allocForSize()
			PITCH = Math.max(3.4, H * 0.0095)
			buildSprites(); calibrate()
			build(); buildStitchList()
			resetBg(); drawAll(); anim.on = false   // re-fit instantly (no re-sew)
			sheenDirty = true
		},
		destroy(): void {
			if (destroyed) return
			destroyed = true
			cancelAnimationFrame(rafId)
			clearTimeout(resizeTimer)
			if (fontTimer) clearTimeout(fontTimer)
			window.removeEventListener('resize', onResize)
			if (sheenOn) window.removeEventListener('pointermove', onPointerMove)
			for (const c of created) c.remove()
			// drop large buffers so the instance can be GC'd promptly
			SPRITES = []; STITCHES = []; anim.rows = []
			MASK = new Uint8Array(0); SHADE = new Float32Array(0)
			EX = new Float32Array(0); EY = new Float32Array(0)
			MASKCV = SHADOWCV = FABRIC_CV = OFFCV = null; OFFCTX = null
		},
	}
	return api
}
