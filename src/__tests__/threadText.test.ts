// threadText/src/__tests__/threadText.test.ts — core math + instance lifecycle
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createThreadText, hash2, distanceInside, boxBlur, parseColor } from '../core/threadText'
import { THREAD_TEXT_CLASSES } from '../core/types'
import type { ThreadTextInstance } from '../core/types'

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
describe('createThreadText', () => {
	let host: HTMLDivElement
	let inst: ThreadTextInstance | null = null

	beforeEach(() => {
		host = document.createElement('div')
		document.body.appendChild(host)
	})
	afterEach(() => {
		inst?.destroy()
		inst = null
	})

	it('creates two stacked canvases inside a container', () => {
		inst = createThreadText(host, { text: 'Hi' })
		const canvases = host.querySelectorAll('canvas')
		expect(canvases.length).toBe(2)
		expect(host.querySelector('.' + THREAD_TEXT_CLASSES.bg)).toBeTruthy()
		expect(host.querySelector('.' + THREAD_TEXT_CLASSES.fx)).toBeTruthy()
		expect(inst.text).toBe('Hi')
	})

	it('setText updates the current text and refits (no sew-in)', () => {
		inst = createThreadText(host, { text: 'Th' })
		inst.setText('Thr')
		expect(inst.text).toBe('Thr')
		inst.setText('World')
		expect(inst.text).toBe('World')
	})

	it('update() changes options live without remounting (no re-sew)', () => {
		inst = createThreadText(host, { text: 'Hue' })
		const before = host.querySelectorAll('canvas')
		expect(() => inst!.update({ threadColor: '#ff0000' })).not.toThrow()
		expect(() => inst!.update({ weight: 400, fill: 0.7, sewRate: 200, animate: false, sheen: false })).not.toThrow()
		const after = host.querySelectorAll('canvas')
		// Same canvases — update() does not tear down and recreate.
		expect(after.length).toBe(2)
		expect(after[0]).toBe(before[0])
	})

	it('editable creates a real input control + caret; removing it tears down', () => {
		inst = createThreadText(host, { text: 'Type' })
		inst.update({ editable: true })
		const input = host.querySelector('input')
		expect(input).toBeTruthy()
		expect(input?.getAttribute('aria-label')?.toLowerCase()).toContain('type')
		expect(input?.value).toBe('Type')
		expect(host.querySelector('.' + THREAD_TEXT_CLASSES.caret)).toBeTruthy()
		expect(() => inst!.focus()).not.toThrow()
		inst.update({ editable: false })
		expect(host.querySelector('input')).toBeNull()
	})

	it('editable + onTextChange fires on typed edits via the input', () => {
		let latest = ''
		inst = createThreadText(host, { text: 'Go', editable: true, onTextChange: (t) => { latest = t } })
		const input = host.querySelector('input') as HTMLInputElement
		expect(input).toBeTruthy()
		input.value = 'Gox'
		input.dispatchEvent(new Event('input'))
		expect(inst.text).toBe('Gox')
		expect(latest).toBe('Gox')
	})

	it('clamps out-of-range fill and weight without throwing', () => {
		inst = createThreadText(host, { text: 'Hi', fill: 5, weight: 9999 })
		expect(host.querySelectorAll('canvas').length).toBe(2)
		expect(() => inst!.update({ fill: -3, weight: 0 })).not.toThrow()
	})

	it('replay and resize do not throw', () => {
		inst = createThreadText(host, { text: 'Sew' })
		expect(() => inst!.replay()).not.toThrow()
		expect(() => inst!.resize()).not.toThrow()
	})

	it('reduced-motion draws instantly and still renders', () => {
		inst = createThreadText(host, { text: 'Calm', reducedMotion: true })
		expect(host.querySelectorAll('canvas').length).toBe(2)
		expect(() => inst!.replay()).not.toThrow()
	})

	it('destroy removes created canvases and is idempotent', () => {
		inst = createThreadText(host, { text: 'Bye' })
		expect(host.querySelectorAll('canvas').length).toBe(2)
		inst.destroy()
		expect(host.querySelectorAll('canvas').length).toBe(0)
		expect(() => inst!.destroy()).not.toThrow() // second call is a no-op
		inst = null
	})

	it('accepts a <canvas> target and only adds the sheen overlay', () => {
		const cv = document.createElement('canvas')
		host.appendChild(cv)
		inst = createThreadText(cv, { text: 'Ok' })
		// bg is the passed canvas; one extra fx overlay is created.
		expect(host.querySelectorAll('canvas').length).toBe(2)
		expect(cv.classList.contains(THREAD_TEXT_CLASSES.bg)).toBe(true)
		inst.destroy()
		// The passed canvas is left in place; only the created overlay is removed.
		expect(host.contains(cv)).toBe(true)
		expect(host.querySelectorAll('canvas').length).toBe(1)
		inst = null
	})
})
