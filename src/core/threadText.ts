// threadText/src/core/threadText.ts — framework-agnostic procedural satin-stitch renderer.
//
// Discrete pre-shaded thread sprites are laid on a flow field derived from the font's
// glyph geometry (an exact Euclidean distance transform, smoothed in double-angle
// orientation space so opposite edge-normals reinforce). A dome-shade map lifts the
// floss into 3D on a transparent ground, and a cursor-following sheen turns the threads
// over in the light. The word is re-fitted to the container width on load/resize; it
// can be sewn in one satin cross-row at a time (BFS layers over the stitch graph).
//
// Exposed through createThreadText() -> ThreadTextInstance.

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

/** One-dimensional squared-distance transform (Felzenszwalb–Huttenlocher). */
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
	const INF = 1e20   // local (not module-scoped) so this fn is self-contained inside the Web Worker
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
	const INF = 1e20   // local so this fn is self-contained inside the Web Worker
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
/** Clamp a number to [lo, hi]. */
function clamp(n: number, lo: number, hi: number): number { return n < lo ? lo : n > hi ? hi : n }

/** First font-family token, unquoted — for `document.fonts.load/check`. */
function primaryOf(font: string): string {
	return (font.split(',')[0] || 'serif').trim().replace(/^["']|["']$/g, '')
}

/**
 * The heavy geometry pass: from a glyph's rasterised alpha (RGBA bytes) build the frayed mask,
 * the across-stroke flow field (double-angle-smoothed), and the dome-shade map. Pure and DOM-free
 * so it runs identically on the main thread or inside a Web Worker. Depends only on {@link vnoise},
 * {@link distanceInside}, {@link boxBlur} and Math — kept self-contained for worker assembly.
 */
function computeGeometry(alpha: Uint8ClampedArray, W: number, H: number): { mask: Uint8Array; ex: Float32Array; ey: Float32Array; shade: Float32Array } {
	const mask = new Uint8Array(W * H)
	for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
		const i = y * W + x, a = alpha[i * 4 + 3] / 255
		const n = vnoise(x * 0.5, y * 0.5) * 0.22 + vnoise(x * 1.8, y * 1.8) * 0.10
		mask[i] = a > (0.5 + (n - 0.16)) ? 1 : 0
	}
	const dist = distanceInside(mask, W, H)
	const distS = new Float32Array(W * H)
	for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
		const i = y * W + x
		distS[i] = (dist[i] * 4 + dist[i - 1] + dist[i + 1] + dist[i - W] + dist[i + W]) / 8
	}
	const C2 = new Float32Array(W * H), S2 = new Float32Array(W * H)
	const gxF = new Float32Array(W * H), gyF = new Float32Array(W * H)
	for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
		const i = y * W + x; if (!mask[i]) continue
		const gx = (distS[i + 1] - distS[i - 1]) * 0.5, gy = (distS[i + W] - distS[i - W]) * 0.5
		gxF[i] = gx; gyF[i] = gy; C2[i] = gx * gx - gy * gy; S2[i] = 2 * gx * gy
	}
	const R = Math.max(7, Math.round(H * 0.05))
	const C2b = boxBlur(C2, W, H, R, 2), S2b = boxBlur(S2, W, H, R, 2)
	const ex = new Float32Array(W * H), ey = new Float32Array(W * H)
	for (let i = 0; i < W * H; i++) { if (!mask[i]) continue; const th = 0.5 * Math.atan2(S2b[i], C2b[i]); ex[i] = Math.cos(th); ey[i] = Math.sin(th) }
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
	return { mask, ex, ey, shade }
}

// A single laid stitch: position, thread angle, and pre-shaded sprite brightness bucket.
interface Stitch { x: number; y: number; ang: number; idx: number; pal?: number; outline?: 1 }

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
		return { setText() {}, replay() {}, resize() {}, update() {}, focus() {}, destroy() {}, get text() { return opts.text ?? '' } }
	}

	// ── mutable options / config ──
	let text = opts.text ?? ''
	let font = opts.font ?? 'Georgia, serif'
	let weight = clamp(opts.weight ?? 680, 1, 1000)
	let fill = clamp(opts.fill ?? 0.9, 0.05, 1)
	let align: 'left' | 'center' | 'right' = opts.align === 'left' || opts.align === 'right' ? opts.align : 'center'
	let sewRate = Math.max(1, opts.sewRate ?? 110)
	let sewStyle: 'machine' | 'hand' = opts.sewStyle === 'hand' ? 'hand' : 'machine'
	const STITCH_MODES = ['satin', 'cross', 'chain', 'running'] as const
	type StitchMode = typeof STITCH_MODES[number]
	let stitchMode: StitchMode = (STITCH_MODES as readonly string[]).includes(opts.stitchMode ?? '') ? (opts.stitchMode as StitchMode) : 'satin'
	let sheenOn = opts.sheen ?? true
	let animate = opts.animate ?? true
	let editable = opts.editable ?? false
	let pitchOpt = opts.pitch
	const COLOR_MODES = ['solid', 'twotone', 'gradient'] as const
	type ColorMode = typeof COLOR_MODES[number]
	let colorMode: ColorMode = (COLOR_MODES as readonly string[]).includes(opts.colorMode ?? '') ? (opts.colorMode as ColorMode) : 'solid'
	let threadColor1 = opts.threadColor ?? '#fffbf3'
	let threadColor2 = opts.threadColor2 ?? threadColor1
	let backstitch = opts.backstitch ?? false
	let outlineColorOpt = opts.outlineColor
	let axes = opts.axes
	let onTextChange = opts.onTextChange
	let primaryFamily = primaryOf(font)

	/** Variable-font axes as a CSS fontVariationSettings string (e.g. `"opsz" 40, "SOFT" 60`). */
	function axesStr(): string {
		if (!axes) return ''
		const parts: string[] = []
		for (const k in axes) { const v = axes[k]; if (typeof v === 'number' && isFinite(v)) parts.push(`"${k}" ${v}`) }
		return parts.join(', ')
	}
	/** Apply the current axes to a 2D context via fontVariationSettings, where the browser supports it. */
	function applyVar(ctx: CanvasRenderingContext2D): void {
		if ('fontVariationSettings' in ctx) (ctx as unknown as { fontVariationSettings: string }).fontVariationSettings = axesStr() || 'normal'
	}

	const REDUCED = opts.reducedMotion ??
		!!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

	// Thread colour ramps. Each floss colour becomes a ramp (lit crest → mid → soft ends). A
	// palette holds one ramp for 'solid', two for 'twotone', or N interpolated stops for 'gradient';
	// each stitch picks a palette entry (see buildStitchList). `threadPeak` mirrors the first entry
	// for the caret/sheen tint.
	type Ramp = { peak: [number, number, number]; mid: [number, number, number]; end: [number, number, number] }
	const rampOf = (c: [number, number, number]): Ramp => ({
		peak: c,
		mid: [c[0] * 0.585, c[1] * 0.585, c[2] * 0.585],
		end: [c[0] * 0.47, c[1] * 0.47, c[2] * 0.47],
	})
	const lerp3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] =>
		[a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
	const GRADIENT_STOPS = 6                      // gradient quantised into this many pre-shaded ramps
	let threadPeak: [number, number, number] = [255, 251, 243]
	let PALETTE: Ramp[] = []
	let outlineRamp: Ramp = rampOf([0, 0, 0])
	function buildPalette(): void {
		const c1 = parseColor(threadColor1, [255, 251, 243])
		const c2 = parseColor(threadColor2, c1)
		if (colorMode === 'twotone') PALETTE = [rampOf(c1), rampOf(c2)]
		else if (colorMode === 'gradient') { PALETTE = []; for (let k = 0; k < GRADIENT_STOPS; k++) PALETTE.push(rampOf(lerp3(c1, c2, k / (GRADIENT_STOPS - 1)))) }
		else PALETTE = [rampOf(c1)]
		threadPeak = PALETTE[0].peak
		outlineRamp = rampOf(outlineColorOpt ? parseColor(outlineColorOpt, [0, 0, 0]) : [c1[0] * 0.32, c1[1] * 0.32, c1[2] * 0.32])
	}
	buildPalette()

	// ── target canvases ──
	const created: HTMLElement[] = []
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

	// Editable capture: a real (transparent) <input> overlay — gives assistive tech a proper
	// text value, raises the soft keyboard on touch, and supports IME/paste. The visible caret
	// is drawn on the canvas; the input's own text/caret are transparent.
	let editInput: HTMLInputElement | null = null
	let caretEl: HTMLElement | null = null
	let focused = false

	// ── per-instance render state ──
	let W = 0, H = 0
	let FS = 0, ANCHOR_X = 0
	let PITCH = 4
	let SPRITES: HTMLCanvasElement[] = [], SPRITE_W = 0, SPRITE_H = 0   // flat: palette entry p, brightness k → SPRITES[p * 20 + k]
	let OUTLINE_SPRITES: HTMLCanvasElement[] = []                        // backstitch dashes, 20 brightness variants
	let spriteAngOffset = 0                       // extra rotation per stitch mode (along vs across stroke)
	let spritePitch = -1, spriteColorKey = ''   // cache keys so sprites rebuild only when needed
	let allocW = -1, allocH = -1                // OFFCV realloc only when size changes
	let MASK: Uint8Array = new Uint8Array(0)
	let SHADE: Float32Array = new Float32Array(0)
	let EX: Float32Array = new Float32Array(0), EY: Float32Array = new Float32Array(0)
	let MASKCV: HTMLCanvasElement | null = null
	let OFFCV: HTMLCanvasElement | null = null
	let OFFCTX: CanvasRenderingContext2D | null = null
	let STITCHES: Stitch[] = [], OUTLINE: Stitch[] = [], STEP_G = 3

	const anim = { rows: [] as Stitch[][], idx: 0, acc: 0, rate: 0, on: false }
	const sheen = { x: 0, y: 0, set: false }
	let sheenDirty = true

	let rafId = 0, running = false, lastTS = 0
	let destroyed = false, booted = false

	// Web Worker geometry offload (best-effort; falls back to synchronous build on any failure).
	let worker: Worker | null = null
	let workerUrl = ''
	let workerReady = false
	let reqId = 0, pendingSew = false
	let workerTimer: ReturnType<typeof setTimeout> | undefined

	// ── fit-to-width sizing: derive FS from the container width, height from the glyphs ──
	function layout(): void {
		const rect = container.getBoundingClientRect()
		const cssW = Math.max(1, Math.round(rect.width || Math.min(window.innerWidth * 0.95, 1240)))
		const ref = text || 'Ag'
		const mc = bgC.getContext('2d')
		if (mc) mc.textBaseline = 'middle'   // measure extents around the same baseline build() paints on

		// Font size (CSS px) so the word spans fill × container width.
		let refW100 = 100
		if (mc) { mc.font = `${weight} 100px ${font}`; applyVar(mc); refW100 = mc.measureText(ref).width || 100 }
		const fsCss = Math.max(8, (100 * (cssW * fill)) / refW100)

		// Height (CSS px) from the glyph extent around the middle baseline, plus a little padding.
		let asc = fsCss * 0.62, desc = fsCss * 0.62, refWfs = cssW * fill
		if (mc) {
			mc.font = `${weight} ${fsCss}px ${font}`
			applyVar(mc)
			const m = mc.measureText(ref)
			refWfs = m.width || refWfs
			if (m.actualBoundingBoxAscent > 0) asc = m.actualBoundingBoxAscent
			if (m.actualBoundingBoxDescent > 0) desc = m.actualBoundingBoxDescent
		}
		const cssH = Math.max(1, Math.round(2 * Math.max(asc, desc) * 1.1))

		// DPR + area budget (keep the per-render cost bounded).
		let scale = Math.min(window.devicePixelRatio || 1, 1.7)
		while (cssW * scale * cssH * scale > 900000 && scale > 0.4) scale -= 0.1
		W = Math.max(1, Math.round(cssW * scale))
		H = Math.max(1, Math.round(cssH * scale))
		FS = Math.max(4, Math.round(fsCss * scale))
		// Place the word per `align`; a small pad keeps edge threads (which spill past the glyph
		// outline by half a thread width) off the canvas edge.
		const wordW = refWfs * scale, pad = Math.max(2, Math.round(FS * 0.08))
		ANCHOR_X = Math.round(align === 'left' ? pad : align === 'right' ? W - wordW - pad : W / 2 - wordW / 2)

		for (const c of [bgC, fxC]) { c.width = W; c.height = H; c.style.height = cssH + 'px' }
		container.style.height = cssH + 'px'
		PITCH = pitchOpt != null ? pitchOpt : Math.max(3.0, H * 0.0095)
	}

	// ── reused glyph-raster scratch (reallocated only when the canvas size changes) ──
	function ensureScratch(): void {
		if (OFFCV && allocW === W && allocH === H) return
		OFFCV = document.createElement('canvas'); OFFCV.width = W; OFFCV.height = H
		OFFCTX = OFFCV.getContext('2d', { willReadFrequently: true })
		allocW = W; allocH = H
	}

	/** Cache key: sprites depend on pitch, the whole palette, stitch mode, and the backstitch outline. */
	function spriteKey(): string {
		return PALETTE.map((r) => r.peak.join(',')).join(';') + '|' + stitchMode + '|' + colorMode +
			(backstitch ? '|bs' + outlineRamp.peak.join(',') : '')
	}
	// ── one 20-brightness sprite set for a single ramp, in the current stitch mode ──
	function makeSpriteSet(ramp: Ramp, mode: StitchMode): HTMLCanvasElement[] {
		const L = Math.max(7, PITCH * 2.5)     // thread length
		const Wd = Math.max(3.2, PITCH * 1.3)  // thread width
		const set: HTMLCanvasElement[] = []
		for (let k = 0; k < 20; k++) {
			const b = 0.34 + (k / 19) * 0.82           // brightness level (20 buckets → less banding)
			const cv = document.createElement('canvas'); cv.width = SPRITE_W; cv.height = SPRITE_H
			const c = cv.getContext('2d')
			if (!c) { set.push(cv); continue }
			const cx = SPRITE_W / 2, cy = SPRITE_H / 2
			const col = (base: [number, number, number], a: number) => `rgba(${byte(base[0] * b)},${byte(base[1] * b)},${byte(base[2] * b)},${a})`
			// A shaded rounded floss "tube" of `len`×`wid`, rotated `ang`, centred in the sprite.
			const tube = (len: number, wid: number, ang: number, endFade: boolean) => {
				c.save(); c.translate(cx, cy); c.rotate(ang)
				const g = c.createLinearGradient(0, -wid / 2, 0, wid / 2)
				g.addColorStop(0.00, col(ramp.end, 0))
				g.addColorStop(0.16, col(ramp.mid, 1))
				g.addColorStop(0.50, col(ramp.peak, 1))
				g.addColorStop(0.84, col(ramp.mid, 1))
				g.addColorStop(1.00, col(ramp.end, 0))
				c.fillStyle = g
				const r = wid / 2
				c.beginPath()
				c.moveTo(-len / 2 + r, -r)
				c.lineTo(len / 2 - r, -r)
				c.arc(len / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2)
				c.lineTo(-len / 2 + r, r)
				c.arc(-len / 2 + r, 0, r, Math.PI / 2, -Math.PI / 2)
				c.closePath(); c.fill()
				if (endFade) {   // soft ends so neighbouring satin threads blend along their length
					c.globalCompositeOperation = 'destination-in'
					const ge = c.createLinearGradient(-len / 2, 0, len / 2, 0)
					ge.addColorStop(0, 'rgba(0,0,0,0)'); ge.addColorStop(0.22, 'rgba(0,0,0,1)')
					ge.addColorStop(0.78, 'rgba(0,0,0,1)'); ge.addColorStop(1, 'rgba(0,0,0,0)')
					c.fillStyle = ge; c.fillRect(-len / 2 - 1, -wid / 2 - 1, len + 2, wid + 2)
					c.globalCompositeOperation = 'source-over'
				}
				c.restore()
			}
			if (mode === 'cross') {
				tube(L * 0.92, Wd * 0.82, Math.PI / 4, false)     // an X
				tube(L * 0.92, Wd * 0.82, -Math.PI / 4, false)
			} else if (mode === 'chain') {
				c.save(); c.translate(cx, cy)                     // a looped link
				const g = c.createLinearGradient(0, -Wd, 0, Wd)
				g.addColorStop(0, col(ramp.mid, 1)); g.addColorStop(0.5, col(ramp.peak, 1)); g.addColorStop(1, col(ramp.mid, 1))
				c.strokeStyle = g; c.lineWidth = Math.max(1.6, Wd * 0.7); c.lineCap = 'round'
				c.beginPath(); c.ellipse(0, 0, L * 0.34, Wd * 1.05, 0, 0, Math.PI * 2); c.stroke()
				c.restore()
			} else if (mode === 'running') {
				tube(L * 0.5, Wd, 0, false)                       // a short dash
			} else {
				tube(L, Wd, 0, true)                              // satin (default)
			}
			set.push(cv)
		}
		return set
	}
	// ── build the full sprite bank: one set per palette entry, plus the backstitch dashes ──
	function buildSprites(): void {
		const L = Math.max(7, PITCH * 2.5)
		const Wd = Math.max(3.2, PITCH * 1.3)
		// square sprite for X / loop textures; long-thin for satin / running
		if (stitchMode === 'cross' || stitchMode === 'chain') { SPRITE_W = SPRITE_H = Math.ceil(L) + 2 }
		else { SPRITE_W = Math.ceil(L) + 2; SPRITE_H = Math.ceil(Wd) + 2 }
		// chain / running run ALONG the stroke; satin / cross across it
		spriteAngOffset = (stitchMode === 'chain' || stitchMode === 'running') ? Math.PI / 2 : 0
		SPRITES = []
		for (const ramp of PALETTE) for (const cv of makeSpriteSet(ramp, stitchMode)) SPRITES.push(cv)
		// Backstitch: a darker running dash (rendered on the same sprite canvas, drawn without the
		// mode's angle offset — its long axis follows the boundary tangent, see drawStitch).
		OUTLINE_SPRITES = backstitch ? makeSpriteSet(outlineRamp, 'running') : []
		spritePitch = PITCH; spriteColorKey = spriteKey()
	}
	/** Rebuild the sprite sheet only if the pitch, palette/mode, or backstitch changed. */
	function ensureSprites(): void {
		if (SPRITES.length && spritePitch === PITCH && spriteColorKey === spriteKey()) return
		buildSprites()
	}

	// ── geometry pass, split so it can run inline or in a Web Worker ──
	/** Rasterise the current word into the offscreen scratch and return its RGBA bytes. */
	function rasterizeGlyph(): Uint8ClampedArray | null {
		if (!OFFCTX) return null
		const o = OFFCTX
		o.clearRect(0, 0, W, H)
		o.fillStyle = '#fff'; o.textAlign = 'left'; o.textBaseline = 'middle'
		o.font = `${weight} ${FS}px ${font}`
		applyVar(o)
		o.fillText(text, ANCHOR_X, H * 0.5)
		return o.getImageData(0, 0, W, H).data
	}
	/** Store the computed geometry and (re)build the solid mask canvas used to clip the sheen. */
	function applyGeometry(g: { mask: Uint8Array; ex: Float32Array; ey: Float32Array; shade: Float32Array }): void {
		MASK = g.mask; EX = g.ex; EY = g.ey; SHADE = g.shade
		MASKCV = document.createElement('canvas'); MASKCV.width = W; MASKCV.height = H
		const mc = MASKCV.getContext('2d')
		if (mc) {
			const md = mc.createImageData(W, H)
			for (let i = 0; i < W * H; i++) if (MASK[i]) {
				md.data[i * 4] = 255; md.data[i * 4 + 1] = 255; md.data[i * 4 + 2] = 255; md.data[i * 4 + 3] = 255
			}
			mc.putImageData(md, 0, 0)
		}
	}
	/** Synchronous geometry build (fallback when no worker). */
	function build(): void {
		const alpha = rasterizeGlyph()
		if (!alpha) return
		applyGeometry(computeGeometry(alpha, W, H))
	}

	// ── stitch list: sample the mask on a jittered grid ──
	function buildStitchList(): void {
		const STEP = Math.max(1.6, PITCH * 0.6); STEP_G = STEP
		const list: Stitch[] = []
		let minX = Infinity, maxX = -Infinity
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
			if (px < minX) minX = px; if (px > maxX) maxX = px
		}
		// Assign a palette entry per stitch. twotone alternates the two colours — but how depends on
		// the stitch: satin is a continuous fill, so alternate in bands of threads packed across each
		// stroke; the discrete modes (cross/chain/running) are individual stitches, so alternate each
		// one (a checker on the sampling grid) → every X / link / dash is a single solid colour.
		// gradient quantises the word's horizontal position to the interpolated stops. solid: entry 0.
		if (colorMode === 'twotone') {
			if (stitchMode === 'satin') {
				const bandW = Math.max(4, PITCH * 1.6)
				for (const s of list) { const proj = -Math.sin(s.ang) * s.x + Math.cos(s.ang) * s.y; s.pal = (Math.floor(proj / bandW) & 1) }
			} else {
				for (const s of list) s.pal = ((Math.round(s.x / STEP) + Math.round(s.y / STEP)) & 1)
			}
		} else if (colorMode === 'gradient') {
			const span = Math.max(1, maxX - minX)
			for (const s of list) s.pal = Math.min(GRADIENT_STOPS - 1, Math.max(0, Math.round(((s.x - minX) / span) * (GRADIENT_STOPS - 1))))
		}
		STITCHES = list
		buildOutlineList()
	}

	// ── backstitch: darker running dashes along the glyph boundary, evenly subsampled ──
	function buildOutlineList(): void {
		OUTLINE = []
		if (!backstitch || !MASK.length) return
		const spacing = Math.max(3, PITCH * 1.5)
		const gw = Math.max(1, Math.ceil(W / spacing))
		const taken = new Set<number>()
		const m = (xx: number, yy: number) => (MASK[yy * W + xx] ? 1 : 0)
		for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
			const i = y * W + x
			if (!MASK[i]) continue
			if (MASK[i - 1] && MASK[i + 1] && MASK[i - W] && MASK[i + W]) continue   // interior pixel — skip
			const cell = Math.floor(y / spacing) * gw + Math.floor(x / spacing)
			if (taken.has(cell)) continue
			taken.add(cell)
			// Sobel on the mask → outward gradient; the boundary tangent is perpendicular to it.
			const gx = (m(x + 1, y - 1) + 2 * m(x + 1, y) + m(x + 1, y + 1)) - (m(x - 1, y - 1) + 2 * m(x - 1, y) + m(x - 1, y + 1))
			const gy = (m(x - 1, y + 1) + 2 * m(x, y + 1) + m(x + 1, y + 1)) - (m(x - 1, y - 1) + 2 * m(x, y - 1) + m(x + 1, y - 1))
			const tang = Math.atan2(gx, -gy)
			let b = SHADE[i]; b = b < 0 ? 0 : b > 1.12 ? 1.12 : b
			OUTLINE.push({ x, y, ang: tang, idx: Math.min(19, Math.max(8, Math.round((b / 1.12) * 19))), outline: 1 })
		}
	}

	function drawStitch(c: CanvasRenderingContext2D, s: Stitch): void {
		c.save(); c.translate(s.x, s.y)
		if (s.outline) { c.rotate(s.ang); c.drawImage(OUTLINE_SPRITES[s.idx], -SPRITE_W / 2, -SPRITE_H / 2) }
		else { c.rotate(s.ang + spriteAngOffset); c.drawImage(SPRITES[(s.pal || 0) * 20 + s.idx], -SPRITE_W / 2, -SPRITE_H / 2) }
		c.restore()
	}
	function drawAll(): void { const c = bgC.getContext('2d'); if (!c) return; for (const s of STITCHES) drawStitch(c, s); for (const s of OUTLINE) drawStitch(c, s) }
	/** Clear the base canvas to transparent (no fabric, no contact shadow). */
	function resetBg(): void {
		const c = bgC.getContext('2d'); if (!c) return
		c.clearRect(0, 0, W, H)
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
	/** Connected components of the stitch set — one per letter/stroke-island. */
	function letterComponents(subset: Stitch[]): Stitch[][] {
		const CELL = Math.max(4, STEP_G * 1.5), grid = new Map<string, number[]>()
		const key = (cx: number, cy: number) => cx + ',' + cy
		subset.forEach((s, idx) => { const k = key(Math.floor(s.x / CELL), Math.floor(s.y / CELL)); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(idx) })
		const R2 = (STEP_G * 1.8) * (STEP_G * 1.8)
		const nbrs = (idx: number): number[] => {
			const s = subset[idx], cx = Math.floor(s.x / CELL), cy = Math.floor(s.y / CELL), out: number[] = []
			for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
				const a = grid.get(key(cx + dx, cy + dy)); if (!a) continue
				for (const j of a) { if (j === idx) continue; const ex = subset[j].x - s.x, ey = subset[j].y - s.y; if (ex * ex + ey * ey <= R2) out.push(j) }
			}
			return out
		}
		const visited = new Uint8Array(subset.length), comps: Stitch[][] = []
		for (let i = 0; i < subset.length; i++) {
			if (visited[i]) continue
			const comp: Stitch[] = []
			let frontier = [i]; visited[i] = 1
			while (frontier.length) {
				const next: number[] = []
				for (const idx of frontier) { comp.push(subset[idx]); for (const j of nbrs(idx)) if (!visited[j]) { visited[j] = 1; next.push(j) } }
				frontier = next
			}
			comps.push(comp)
		}
		return comps
	}
	/**
	 * Hand sew order: work one letter at a time (left → right). Within each letter, separate the
	 * satin cross-rows into the "body" (wide threads — the substance of the strokes) and the thin
	 * "edges" (serifs, terminals, hairline curves). Lay the body top-to-bottom — so the thread
	 * enters at the widest region near the top and works its way down the shape — then clean up
	 * the thin edges last. Each row is one thread.
	 */
	function buildHandOrder(subset: Stitch[]): Stitch[][] {
		if (!subset.length) return []
		const minX = (c: Stitch[]) => { let m = Infinity; for (const s of c) if (s.x < m) m = s.x; return m }
		const meanY = (r: Stitch[]) => { let s = 0; for (const st of r) s += st.y; return s / r.length }
		const comps = letterComponents(subset).sort((a, b) => minX(a) - minX(b))   // one letter at a time
		const out: Stitch[][] = []
		for (const comp of comps) {
			const rows = buildSewRows(comp)                    // satin cross-rows (threads) for this letter
			let maxLen = 1; for (const r of rows) if (r.length > maxLen) maxLen = r.length
			const edgeCut = Math.max(2, maxLen * 0.45)         // rows thinner than this read as edges (serifs/terminals)
			const body = rows.filter((r) => r.length >= edgeCut).sort((a, b) => meanY(a) - meanY(b))  // enter at the top of the body, work down
			const edges = rows.filter((r) => r.length < edgeCut).sort((a, b) => meanY(a) - meanY(b))  // then clean up the thin edges
			for (const r of body) out.push(r)
			for (const r of edges) out.push(r)
		}
		return out
	}
	function startReveal(): void {
		resetBg()
		if (REDUCED || !animate) { drawAll(); anim.on = false; return }
		const order = sewStyle === 'hand' ? buildHandOrder : buildSewRows
		// Sew one floss colour at a time, like real embroidery: for two-tone, all of colour 0 then
		// colour 1; for gradient, march band 0 → N across the word so the colour progresses as it sews.
		// Solid keeps the plain spatial order.
		let rows: Stitch[][]
		if (colorMode === 'solid' || PALETTE.length <= 1) {
			rows = order(STITCHES)
		} else {
			rows = []
			const byPal = new Map<number, Stitch[]>()
			for (const s of STITCHES) { const p = s.pal || 0; const a = byPal.get(p); if (a) a.push(s); else byPal.set(p, [s]) }
			for (const p of [...byPal.keys()].sort((a, b) => a - b)) for (const r of order(byPal.get(p)!)) rows.push(r)
		}
		// Backstitch is a finishing pass — sew it in last, in a handful of chunks along the boundary.
		if (OUTLINE.length) {
			const chunks = 24, per = Math.ceil(OUTLINE.length / chunks)
			for (let i = 0; i < OUTLINE.length; i += per) rows.push(OUTLINE.slice(i, i + per))
		}
		anim.rows = rows
		anim.idx = 0; anim.acc = 0
		anim.rate = sewRate
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

	// ── caret (editable mode) ──
	function ensureCaret(): void {
		if (caretEl || !editable) return
		caretEl = document.createElement('span')
		caretEl.className = THREAD_TEXT_CLASSES.caret
		caretEl.setAttribute('aria-hidden', 'true')
		Object.assign(caretEl.style, { position: 'absolute', pointerEvents: 'none', borderRadius: '1px', opacity: '0', background: `rgb(${byte(threadPeak[0])},${byte(threadPeak[1])},${byte(threadPeak[2])})` } as CSSStyleDeclaration)
		container.appendChild(caretEl); created.push(caretEl)
	}
	function updateCaret(): void {
		if (!editable || !caretEl) return
		const c = bgC.getContext('2d'); if (!c) return
		c.font = `${weight} ${FS}px ${font}`; applyVar(c)
		const wWidth = c.measureText(text).width
		const scale = (bgC.clientWidth || W) / W
		const capH = FS * 0.7
		caretEl.style.left = ((ANCHOR_X + wWidth + FS * 0.05) * scale) + 'px'
		caretEl.style.top = (0.5 * (bgC.clientHeight || H) - (capH * scale) / 2) + 'px'
		caretEl.style.height = (capH * scale) + 'px'
		caretEl.style.width = Math.max(2, Math.round(FS * 0.02 * scale)) + 'px'
		caretEl.style.background = `rgb(${byte(threadPeak[0])},${byte(threadPeak[1])},${byte(threadPeak[2])})`
	}

	// ── the rAF loop (parks itself when idle, restarted on demand via kick()) ──
	function kick(): void {
		if (destroyed || running) return
		running = true; lastTS = 0
		rafId = requestAnimationFrame(loop)
	}
	function loop(ts: number): void {
		if (destroyed) { running = false; return }
		if (!lastTS) lastTS = ts
		const dt = Math.min(0.25, (ts - lastTS) / 1000); lastTS = ts   // clamp guards huge jumps after tab-throttle
		if (anim.on) { anim.acc += anim.rate * dt; drawRowsTo(anim.acc); if (anim.idx >= anim.rows.length) anim.on = false }
		if (sheenDirty && MASKCV) { drawSheen(sheen.set ? sheen.x : W * 0.5, sheen.set ? sheen.y : H * 0.45); sheenDirty = false }
		const blinking = editable && focused
		if (caretEl) caretEl.style.opacity = (blinking && (Math.floor(ts / 530) % 2 === 0)) ? '1' : '0'
		if (!anim.on && !sheenDirty && !blinking) { running = false; return }   // idle → stop scheduling
		rafId = requestAnimationFrame(loop)
	}

	// ── input: cursor sheen tracking (scoped to the element, not the whole window) ──
	function onPointerMove(e: PointerEvent): void {
		const r = container.getBoundingClientRect()
		sheen.x = ((e.clientX - r.left) / (r.width || 1)) * W
		sheen.y = ((e.clientY - r.top) / (r.height || 1)) * H
		sheen.set = true; sheenDirty = true; kick()
	}
	function onPointerLeave(): void { sheen.set = false; sheenDirty = true; kick() }   // fall back to a centred resting glow

	// ── input: typing (editable mode) — backed by a real <input> for a11y / touch / IME ──
	function onInput(): void { if (editInput) commitText(editInput.value, true) }
	function onEditKeyDown(e: KeyboardEvent): void { if (e.key === 'Enter') { e.preventDefault(); api.replay() } }
	function onFocus(): void { focused = true; kick() }
	function onBlur(): void { focused = false; if (caretEl) caretEl.style.opacity = '0' }

	function applyEditable(on: boolean): void {
		if (on === editable && editInput) return
		editable = on
		if (on) {
			if (!editInput) {
				editInput = document.createElement('input')
				editInput.type = 'text'
				editInput.value = text
				editInput.maxLength = 64
				editInput.setAttribute('aria-label', 'Embroidered text — type to change it')
				editInput.setAttribute('autocomplete', 'off')
				editInput.setAttribute('autocapitalize', 'off')
				editInput.spellcheck = false
				// Overlays the artwork, fully transparent, but a real focusable text field.
				Object.assign(editInput.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', margin: '0', padding: '0', border: '0', outline: 'none', background: 'transparent', color: 'transparent', caretColor: 'transparent', font: 'inherit', textAlign: 'center', cursor: 'text' } as CSSStyleDeclaration)
				editInput.addEventListener('input', onInput)
				editInput.addEventListener('keydown', onEditKeyDown)
				editInput.addEventListener('focus', onFocus)
				editInput.addEventListener('blur', onBlur)
				container.appendChild(editInput); created.push(editInput)
			}
			ensureCaret(); updateCaret()
		} else {
			if (editInput) { editInput.remove(); editInput = null }
			focused = false
			if (caretEl) caretEl.style.opacity = '0'
		}
	}

	function applySheen(on: boolean): void {
		if (on === sheenOn) return
		sheenOn = on
		if (on) {
			container.addEventListener('pointermove', onPointerMove, { passive: true })
			container.addEventListener('pointerleave', onPointerLeave, { passive: true })
			sheen.set = false     // show a centred resting glow until the cursor moves over the art
			sheenDirty = true; kick()
		} else {
			container.removeEventListener('pointermove', onPointerMove)
			container.removeEventListener('pointerleave', onPointerLeave)
			const c = fxC.getContext('2d'); if (c) c.clearRect(0, 0, W, H)   // clear immediately
		}
	}

	// ── full render: fit to width, rebuild geometry, then sew or draw instantly ──
	/** Given the geometry is in place, build the stitch list and paint (sew-in or instant). */
	function finishDraw(sew: boolean): void {
		buildStitchList()
		if (sew) startReveal()
		else { resetBg(); drawAll(); anim.on = false }
		if (editInput && editInput.value !== text) editInput.value = text
		updateCaret(); sheenDirty = true; kick()
	}
	function render(sew: boolean): void {
		layout(); ensureScratch(); ensureSprites()
		const alpha = rasterizeGlyph()
		if (!alpha) { finishDraw(sew); return }
		if (worker && workerReady) {
			// Offload the geometry pipeline; the response (matched by id) finishes the paint.
			const id = ++reqId; pendingSew = sew
			if (workerTimer) clearTimeout(workerTimer)
			workerTimer = setTimeout(() => workerFallback(id), 800)   // dead-worker guard
			try { worker.postMessage({ id, W, H, alpha }, [alpha.buffer]) }
			catch { workerFallback(id) }
			return
		}
		applyGeometry(computeGeometry(alpha, W, H))   // synchronous fallback
		finishDraw(sew)
	}
	/** A posted worker request didn't come back (dead/errored/CSP) — disable it and render inline. */
	function workerFallback(id: number): void {
		if (id !== reqId || destroyed) return
		if (workerTimer) { clearTimeout(workerTimer); workerTimer = undefined }
		workerReady = false
		const alpha = rasterizeGlyph()   // the posted buffer was transferred away; re-rasterise
		if (alpha) { applyGeometry(computeGeometry(alpha, W, H)); finishDraw(pendingSew) }
	}

	/** Set text and redraw instantly (no sew-in). `notify` fires onTextChange (internal edits only). */
	function commitText(next: string, notify: boolean): void {
		next = next ?? ''
		if (next === text && booted) return
		text = next
		if (!booted) return
		render(false)
		if (notify && onTextChange) onTextChange(text)
	}

	// Wait for a face to be available (bounded), then run cb. Immediate if already loaded / no API.
	const fontTimers = new Set<ReturnType<typeof setTimeout>>()
	function whenFontReady(fam: string, wght: number, cb: () => void): void {
		const spec = `${wght} 200px ${fam}`
		let already = false
		try { already = !!document.fonts && document.fonts.check(spec) } catch { already = true }
		if (!document.fonts || already) { cb(); return }
		let done = false
		let timer: ReturnType<typeof setTimeout>
		const go = () => { if (done) return; done = true; clearTimeout(timer); fontTimers.delete(timer); if (!destroyed) cb() }
		document.fonts.load(spec, text).then(() => document.fonts.ready).then(go, go)
		timer = setTimeout(go, 1500)   // never wait forever on a font that won't load
		fontTimers.add(timer)
	}

	// ── Web Worker geometry offload (best-effort, self-healing) ──
	function onWorkerMessage(ev: MessageEvent): void {
		const d = ev.data
		if (d && d.type === 'pong') { workerReady = true; return }
		if (!d || destroyed || d.id !== reqId) return   // stale / cancelled / superseded
		if (workerTimer) { clearTimeout(workerTimer); workerTimer = undefined }
		applyGeometry({ mask: d.mask, ex: d.ex, ey: d.ey, shade: d.shade })
		finishDraw(pendingSew)
	}
	function setupWorker(): void {
		if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return
		try {
			// Assemble a self-contained worker from the pure helpers (names preserved via esbuild
			// keepNames). The ping validates the whole pipeline before we trust the worker, so a
			// broken assembly (e.g. from an unexpected minifier transform) never flips workerReady.
			// Include the helpers as raw declarations (their code-names stay mutually consistent, so
			// cross-references resolve), and bind computeGeometry to a fixed name we control — its
			// own code-name is minified, so the handler can't hard-code it.
			const src = `${hash2}\n${vnoise}\n${edt1d}\n${distanceInside}\n${boxBlur}\n`
				+ `var __cg=${computeGeometry};\n`
				+ `self.onmessage=function(ev){var d=ev.data;`
				+ `if(d&&d.type==='ping'){try{__cg(new Uint8ClampedArray(4),1,1);self.postMessage({type:'pong'})}catch(e){}return}`
				+ `var g=__cg(d.alpha,d.W,d.H);`
				+ `self.postMessage({id:d.id,mask:g.mask,ex:g.ex,ey:g.ey,shade:g.shade},[g.mask.buffer,g.ex.buffer,g.ey.buffer,g.shade.buffer])};`
			workerUrl = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }))
			worker = new Worker(workerUrl)
			worker.onmessage = onWorkerMessage
			worker.onerror = () => { workerReady = false }
			worker.postMessage({ type: 'ping' })
		} catch { worker = null }
	}

	// ── boot ──
	function firstPaint(): void {
		if (destroyed) return
		render(true)   // sew-in on mount (when animate) — synchronous; the worker takes over later renders
		booted = true
	}
	setupWorker()
	if (editable) { editable = false; applyEditable(true) }
	if (sheenOn) {
		container.addEventListener('pointermove', onPointerMove, { passive: true })
		container.addEventListener('pointerleave', onPointerLeave, { passive: true })
	}
	whenFontReady(primaryFamily, weight, firstPaint)

	// Debounced self-resize so the standalone (non-React) API stays responsive.
	// Guarded on width so height-only changes (which layout() itself induces) don't rebuild.
	let resizeTimer: ReturnType<typeof setTimeout> | undefined
	let lastResizeW = -1
	function onResize(): void {
		clearTimeout(resizeTimer)
		resizeTimer = setTimeout(() => {
			if (destroyed || !booted) return
			const w = Math.round(container.getBoundingClientRect().width)
			if (w === lastResizeW) return
			lastResizeW = w
			render(false)
		}, 200)
	}
	window.addEventListener('resize', onResize)

	// ── public instance ──
	const api: ThreadTextInstance = {
		get text() { return text },
		setText(next: string): void {
			if (destroyed) return
			if (!booted) { text = next ?? ''; if (editInput) editInput.value = text; return }
			commitText(next, false)
		},
		replay(): void {
			if (destroyed || !booted) return
			render(true)
		},
		resize(): void {
			if (destroyed || !booted) return
			render(false)
		},
		update(partial: Partial<ThreadTextOptions>): void {
			if (destroyed) return
			if (partial.text !== undefined) { api.setText(partial.text); }   // text is not a live "instant" field — route it
			let geom = false, spritesOnly = false, restitch = false, recolor = false
			if (partial.font !== undefined && partial.font !== font) { font = partial.font; primaryFamily = primaryOf(font); geom = true }
			if (partial.weight !== undefined) { const w = clamp(partial.weight, 1, 1000); if (w !== weight) { weight = w; geom = true } }
			if (partial.fill !== undefined) { const f = clamp(partial.fill, 0.05, 1); if (f !== fill) { fill = f; geom = true } }
			if (partial.align !== undefined) { const a = partial.align === 'left' || partial.align === 'right' ? partial.align : 'center'; if (a !== align) { align = a; geom = true } }
			if (partial.pitch !== undefined && partial.pitch !== pitchOpt) { pitchOpt = partial.pitch; geom = true }
			if (partial.axes !== undefined) { axes = partial.axes; geom = true }
			if (partial.threadColor !== undefined && partial.threadColor !== threadColor1) { threadColor1 = partial.threadColor; recolor = true }
			if (partial.threadColor2 !== undefined && partial.threadColor2 !== threadColor2) { threadColor2 = partial.threadColor2; recolor = true }
			if (partial.outlineColor !== undefined && partial.outlineColor !== outlineColorOpt) { outlineColorOpt = partial.outlineColor; recolor = true }
			if (partial.colorMode !== undefined && partial.colorMode !== colorMode && (COLOR_MODES as readonly string[]).includes(partial.colorMode)) { colorMode = partial.colorMode as ColorMode; recolor = true; restitch = true }
			if (partial.backstitch !== undefined && partial.backstitch !== backstitch) { backstitch = partial.backstitch; restitch = true }
			if (partial.stitchMode !== undefined && partial.stitchMode !== stitchMode && (STITCH_MODES as readonly string[]).includes(partial.stitchMode)) { stitchMode = partial.stitchMode as StitchMode; spritesOnly = true }
			if (partial.sewRate !== undefined) sewRate = Math.max(1, partial.sewRate)
			if (partial.sewStyle !== undefined) sewStyle = partial.sewStyle === 'hand' ? 'hand' : 'machine'
			if (partial.animate !== undefined) animate = partial.animate
			if (partial.onTextChange !== undefined) onTextChange = partial.onTextChange
			if (partial.sheen !== undefined) applySheen(partial.sheen)
			if (partial.editable !== undefined) applyEditable(partial.editable)
			if (recolor) buildPalette()
			if (!booted) return
			// Colour / mode / backstitch changes redraw instantly (no re-sew), matching threadColor.
			if (geom) whenFontReady(primaryFamily, weight, () => { if (!destroyed) render(false) })
			else if (restitch) { buildSprites(); buildStitchList(); resetBg(); drawAll(); updateCaret(); kick() }
			else if (spritesOnly || recolor) { buildSprites(); resetBg(); drawAll(); updateCaret(); kick() }
		},
		focus(): void { if (!destroyed && editable) editInput?.focus() },
		destroy(): void {
			if (destroyed) return
			destroyed = true
			running = false
			cancelAnimationFrame(rafId)
			clearTimeout(resizeTimer)
			if (workerTimer) clearTimeout(workerTimer)
			for (const t of fontTimers) clearTimeout(t)
			fontTimers.clear()
			if (worker) { worker.terminate(); worker = null }
			if (workerUrl) { try { URL.revokeObjectURL(workerUrl) } catch { /* ignore */ } workerUrl = '' }
			window.removeEventListener('resize', onResize)
			container.removeEventListener('pointermove', onPointerMove)
			container.removeEventListener('pointerleave', onPointerLeave)
			for (const c of created) c.remove()
			SPRITES = []; OUTLINE_SPRITES = []; STITCHES = []; OUTLINE = []; anim.rows = []
			MASK = new Uint8Array(0); SHADE = new Float32Array(0)
			EX = new Float32Array(0); EY = new Float32Array(0)
			MASKCV = OFFCV = null; OFFCTX = null; caretEl = null; editInput = null
		},
	}
	return api
}
