// stitchType/src/__tests__/stitchType.test.ts — core math + instance lifecycle
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createStitchText, hash2, distanceInside, boxBlur, parseColor } from '../core/stitchType'
import { STITCH_CLASSES } from '../core/types'
import type { StitchInstance } from '../core/types'

// ─── Canvas 2D stub (happy-dom has no canvas backend) ───────────────────────────
// Every drawing call is a no-op; the data-returning calls hand back correctly-sized
// buffers so the geometry passes run without touching a real canvas.
function makeCtxStub() {
	const gradient = { addColorStop() {} }
	return {
		canvas: null as unknown,
		fillStyle: '', strokeStyle: '', font: '', textAlign: '', textBaseline: '',
		globalCompositeOperation: '', globalAlpha: 1, filter: '',
		clearRect() {}, fillRect() {}, fillText() {},
		beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, closePath() {}, fill() {},
		save() {}, restore() {}, translate() {}, rotate() {}, drawImage() {},
		createLinearGradient() { return gradient }, createRadialGradient() { return gradient },
		measureText(s: string) { return { width: (s ? s.length : 1) * 10 } },
		getImageData(_x: number, _y: number, w: number, h: number) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h } },
		putImageData() {},
		createImageData(w: number, h: number) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h } },
	}
}

let ctxStub: ReturnType<typeof makeCtxStub>

beforeEach(() => {
	document.body.innerHTML = ''
	ctxStub = makeCtxStub()
	// Route every getContext to the shared stub.
	;(HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () => ctxStub
	// Deterministic reduced-motion + font readiness so firstPaint runs synchronously.
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		value: (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent() { return false } }),
	})
	Object.defineProperty(document, 'fonts', {
		configurable: true,
		value: { check: () => true, load: () => Promise.resolve([]), ready: Promise.resolve() },
	})
})

afterEach(() => {
	vi.restoreAllMocks()
})

// ─── Pure math ──────────────────────────────────────────────────────────────────
describe('pure helpers', () => {
	it('hash2 is deterministic and in [0, 1)', () => {
		for (const [x, y] of [[0, 0], [12, 7], [-3, 99], [123456, -654321]] as const) {
			const v = hash2(x, y)
			expect(v).toBeGreaterThanOrEqual(0)
			expect(v).toBeLessThanOrEqual(1)
			expect(hash2(x, y)).toBe(v) // stable
		}
	})

	it('distanceInside gives 0 outside and grows toward the interior', () => {
		// 5×5, a solid 3×3 block inset by 1 px.
		const W = 5, H = 5
		const mask = new Uint8Array(W * H)
		for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) mask[y * W + x] = 1
		const d = distanceInside(mask, W, H)
		expect(d[0 * W + 0]).toBe(0)          // outside → 0
		expect(d[2 * W + 2]).toBeGreaterThan(0) // centre → positive
		// The centre is the deepest inside pixel of the block.
		expect(d[2 * W + 2]).toBeGreaterThanOrEqual(d[1 * W + 1])
	})

	it('boxBlur preserves a constant field', () => {
		const W = 8, H = 8
		const src = new Float32Array(W * H).fill(5)
		const out = boxBlur(src, W, H, 2, 2)
		for (let i = 0; i < out.length; i++) expect(out[i]).toBeCloseTo(5, 4)
	})

	it('parseColor handles hex, shorthand, rgb() and falls back', () => {
		expect(parseColor('#ff8800', [0, 0, 0])).toEqual([255, 136, 0])
		expect(parseColor('#f80', [0, 0, 0])).toEqual([255, 136, 0])
		expect(parseColor('rgb(10, 20, 30)', [0, 0, 0])).toEqual([10, 20, 30])
		expect(parseColor('not-a-color', [1, 2, 3])).toEqual([1, 2, 3])
		expect(parseColor('', [4, 5, 6])).toEqual([4, 5, 6])
	})
})

// ─── Instance lifecycle ─────────────────────────────────────────────────────────
describe('createStitchText', () => {
	let host: HTMLDivElement
	let inst: StitchInstance | null = null

	beforeEach(() => {
		host = document.createElement('div')
		document.body.appendChild(host)
	})
	afterEach(() => {
		inst?.destroy()
		inst = null
	})

	it('creates two stacked canvases inside a container', () => {
		inst = createStitchText(host, { text: 'Hi' })
		const canvases = host.querySelectorAll('canvas')
		expect(canvases.length).toBe(2)
		expect(host.querySelector('.' + STITCH_CLASSES.bg)).toBeTruthy()
		expect(host.querySelector('.' + STITCH_CLASSES.fx)).toBeTruthy()
		expect(inst.text).toBe('Hi')
	})

	it('setText updates the current text (append animates the delta)', () => {
		inst = createStitchText(host, { text: 'Da' })
		inst.setText('Dai')
		expect(inst.text).toBe('Dai')
		inst.setText('World') // non-append → full re-sew, must not throw
		expect(inst.text).toBe('World')
	})

	it('replay and resize do not throw', () => {
		inst = createStitchText(host, { text: 'Sew' })
		expect(() => inst!.replay()).not.toThrow()
		expect(() => inst!.resize()).not.toThrow()
	})

	it('reduced-motion draws instantly and still renders', () => {
		inst = createStitchText(host, { text: 'Calm', reducedMotion: true })
		expect(host.querySelectorAll('canvas').length).toBe(2)
		expect(() => inst!.replay()).not.toThrow()
	})

	it('destroy removes created canvases and is idempotent', () => {
		inst = createStitchText(host, { text: 'Bye' })
		expect(host.querySelectorAll('canvas').length).toBe(2)
		inst.destroy()
		expect(host.querySelectorAll('canvas').length).toBe(0)
		expect(() => inst!.destroy()).not.toThrow() // second call is a no-op
		inst = null
	})

	it('accepts a <canvas> target and only adds the sheen overlay', () => {
		const cv = document.createElement('canvas')
		host.appendChild(cv)
		inst = createStitchText(cv, { text: 'Ok' })
		// bg is the passed canvas; one extra fx overlay is created.
		expect(host.querySelectorAll('canvas').length).toBe(2)
		expect(cv.classList.contains(STITCH_CLASSES.bg)).toBe(true)
		inst.destroy()
		// The passed canvas is left in place; only the created overlay is removed.
		expect(host.contains(cv)).toBe(true)
		expect(host.querySelectorAll('canvas').length).toBe(1)
		inst = null
	})
})
