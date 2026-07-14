// threadText/src/__tests__/worker.test.ts — verifies the runtime-assembled Web Worker source
// actually evaluates and round-trips (ping→pong and a geometry request), without a browser.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createThreadText } from '../core/threadText'

function makeCtxStub() {
	const gradient = { addColorStop() {} }
	return {
		fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: '', font: '', textAlign: '', textBaseline: '', globalCompositeOperation: '', globalAlpha: 1, filter: '',
		clearRect() {}, fillRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {}, closePath() {}, fill() {}, stroke() {},
		save() {}, restore() {}, translate() {}, rotate() {}, drawImage() {},
		createLinearGradient() { return gradient }, createRadialGradient() { return gradient },
		measureText(s: string) { return { width: (s ? s.length : 1) * 10 } },
		getImageData(_x: number, _y: number, w: number, h: number) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h } },
		putImageData() {}, createImageData(w: number, h: number) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h } },
	}
}

describe('web worker geometry offload', () => {
	const received: unknown[] = []   // messages posted TO the worker
	const sent: unknown[] = []       // messages the worker posted back
	const blobs = new Map<string, string>()
	const orig: Record<string, unknown> = {}

	beforeEach(() => {
		document.body.innerHTML = ''
		received.length = 0; sent.length = 0; blobs.clear()
		;(HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () => makeCtxStub()
		Object.defineProperty(window, 'matchMedia', { configurable: true, value: (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent() { return false } }) })
		Object.defineProperty(document, 'fonts', { configurable: true, value: { check: () => true, load: () => Promise.resolve([]), ready: Promise.resolve() } })

		orig.Blob = (globalThis as Record<string, unknown>).Blob
		orig.URL = (globalThis as Record<string, unknown>).URL
		orig.Worker = (globalThis as Record<string, unknown>).Worker
		;(globalThis as Record<string, unknown>).Blob = class { _t: string; constructor(parts: string[]) { this._t = parts.join('') } }
		;(globalThis as Record<string, unknown>).URL = { createObjectURL: (b: { _t: string }) => { const t = 'blob:' + (blobs.size + 1); blobs.set(t, b._t); return t }, revokeObjectURL() {} }
		;(globalThis as Record<string, unknown>).Worker = class {
			onmessage: ((e: { data: unknown }) => void) | null = null
			onerror: (() => void) | null = null
			_self: { onmessage: ((e: { data: unknown }) => void) | null; postMessage: (m: unknown) => void }
			constructor(url: string) {
				const src = blobs.get(url) || ''
				const self = { onmessage: null as ((e: { data: unknown }) => void) | null, postMessage: (m: unknown) => { sent.push(m); queueMicrotask(() => this.onmessage && this.onmessage({ data: m })) } }
				// Evaluate the assembled worker source exactly as a real Worker would.
				new Function('self', src)(self)
				this._self = self
			}
			postMessage(m: unknown) { received.push(m); queueMicrotask(() => this._self.onmessage && this._self.onmessage({ data: m })) }
			terminate() {}
		}
	})

	afterEach(() => {
		;(globalThis as Record<string, unknown>).Blob = orig.Blob
		;(globalThis as Record<string, unknown>).URL = orig.URL
		;(globalThis as Record<string, unknown>).Worker = orig.Worker
		vi.restoreAllMocks()
	})

	const flush = () => new Promise((r) => setTimeout(r, 0))

	it('the assembled worker source evaluates, pings, and computes geometry', async () => {
		const host = document.createElement('div'); document.body.appendChild(host)
		const inst = createThreadText(host, { text: 'Wk' })
		await flush()   // ping → pong (this also runs computeGeometry once, validating the whole pipeline)

		const ping = received.find((m) => (m as { type?: string })?.type === 'ping')
		const pong = sent.find((m) => (m as { type?: string })?.type === 'pong')
		expect(ping).toBeTruthy()
		expect(pong).toBeTruthy()   // a pong only comes back if the src evaluated AND computeGeometry ran without throwing

		inst.setText('Wkr')
		await flush()   // geometry request → response

		const req = received.find((m) => typeof (m as { id?: number })?.id === 'number' && (m as { W?: number }).W)
		const resp = sent.find((m) => typeof (m as { id?: number })?.id === 'number' && (m as { mask?: unknown }).mask)
		expect(req).toBeTruthy()    // the worker path engaged for a text change
		expect(resp).toBeTruthy()   // and returned mask/ex/ey/shade
		inst.destroy()
	})
})
