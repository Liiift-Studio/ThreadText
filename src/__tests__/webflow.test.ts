// threadText/src/__tests__/webflow.test.ts — Webflow embed auto-init / manual control
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { init, destroy } from '../webflow/embed'
import { THREAD_TEXT_CLASSES } from '../core/types'

// Same canvas-2D stub the core tests use — happy-dom has no canvas backend.
function makeCtxStub() {
	const gradient = { addColorStop() {} }
	return {
		fillStyle: '', font: '', textAlign: '', textBaseline: '', globalCompositeOperation: '', globalAlpha: 1, filter: '',
		clearRect() {}, fillRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, closePath() {}, fill() {},
		save() {}, restore() {}, translate() {}, rotate() {}, drawImage() {},
		createLinearGradient() { return gradient }, createRadialGradient() { return gradient },
		measureText(s: string) { return { width: (s ? s.length : 1) * 10 } },
		getImageData(_x: number, _y: number, w: number, h: number) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h } },
		putImageData() {},
		createImageData(w: number, h: number) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h } },
	}
}

beforeEach(() => {
	document.body.innerHTML = ''
	;(HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () => makeCtxStub()
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		value: (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent() { return false } }),
	})
	Object.defineProperty(document, 'fonts', {
		configurable: true,
		value: { check: () => true, load: () => Promise.resolve([]), ready: Promise.resolve() },
	})
})

afterEach(() => { vi.restoreAllMocks() })

describe('webflow embed', () => {
	it('init mounts the renderer on [data-threadtext] and exposes the word to a11y', () => {
		const el = document.createElement('div')
		el.setAttribute('data-threadtext', '')
		el.textContent = 'Web'
		document.body.appendChild(el)

		init()

		expect(el.querySelectorAll('canvas').length).toBe(2)
		expect(el.querySelector('.' + THREAD_TEXT_CLASSES.bg)).toBeTruthy()
		expect(el.getAttribute('role')).toBe('img')
		expect(el.getAttribute('aria-label')).toBe('Web')
	})

	it('data-tt-text overrides the element text content', () => {
		const el = document.createElement('div')
		el.setAttribute('data-threadtext', '')
		el.setAttribute('data-tt-text', 'Floss')
		document.body.appendChild(el)

		init()
		expect(el.getAttribute('aria-label')).toBe('Floss')
		expect(el.querySelectorAll('canvas').length).toBe(2)
	})

	it('destroy tears down and restores the original markup', () => {
		const el = document.createElement('div')
		el.setAttribute('data-threadtext', '')
		el.textContent = 'Bye'
		document.body.appendChild(el)

		init()
		expect(el.querySelectorAll('canvas').length).toBe(2)

		destroy(el)
		expect(el.querySelectorAll('canvas').length).toBe(0)
		expect(el.textContent).toBe('Bye')
		expect(el.getAttribute('role')).toBeNull()
	})

	it('re-init on the same element does not stack canvases', () => {
		const el = document.createElement('div')
		el.setAttribute('data-threadtext', '')
		el.textContent = 'Once'
		document.body.appendChild(el)

		init()
		init() // second pass must tear down the first
		expect(el.querySelectorAll('canvas').length).toBe(2)
	})
})
