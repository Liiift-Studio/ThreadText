// threadText/src/react/useThreadText.ts — React hook: instance lifecycle + live updates
import { useEffect, useLayoutEffect, useRef } from 'react'
import { createThreadText } from '../core/threadText'
import type { ThreadTextInstance, ThreadTextOptions } from '../core/types'

/**
 * React hook that mounts a threadText renderer inside a ref'd container.
 *
 * The instance is created once and kept alive; option changes (font, weight, colour,
 * size, sew rate, sheen, editability) are applied live via `instance.update()` — no
 * remount, no re-sew. Text changes route through `setText`. The surface re-fits to the
 * container width via ResizeObserver, and tears down on unmount. Only `reducedMotion`
 * (fixed at creation) forces a fresh instance.
 *
 * @param options - {@link ThreadTextOptions} for the renderer.
 * @returns A ref to attach to the target container element.
 */
export function useThreadText(options: ThreadTextOptions) {
	const ref = useRef<HTMLElement>(null)
	const instanceRef = useRef<ThreadTextInstance | null>(null)
	const optionsRef = useRef(options)
	optionsRef.current = options
	const onTextChangeRef = useRef(options.onTextChange)
	onTextChangeRef.current = options.onTextChange

	const { text, font, weight, threadColor, pitch, fill, animate, sewStyle, stitchMode, sewRate, sheen, editable, reducedMotion, axes } = options
	const axesKey = JSON.stringify(axes ?? null)   // stable dep for the axes object

	// (Re)create only when reducedMotion changes (it's fixed at construction) or on mount.
	useLayoutEffect(() => {
		const el = ref.current
		if (!el) return

		const instance = createThreadText(el, {
			...optionsRef.current,
			// Stable callback wrapper so typing edits always reach the latest handler.
			onTextChange: (t) => onTextChangeRef.current?.(t),
		})
		instanceRef.current = instance

		let rafId = 0
		let lastWidth = 0
		let firstObs = true
		let ro: ResizeObserver | undefined
		if (typeof ResizeObserver !== 'undefined') {
			ro = new ResizeObserver((entries) => {
				const w = Math.round(entries[0].contentRect.width)
				// Skip the observer's initial callback — the instance sized itself on create;
				// re-fitting here would wipe the mount sew-in animation.
				if (firstObs) { firstObs = false; lastWidth = w; return }
				if (w === lastWidth) return
				lastWidth = w
				cancelAnimationFrame(rafId)
				rafId = requestAnimationFrame(() => instanceRef.current?.resize())
			})
			ro.observe(el)
		}

		return () => {
			ro?.disconnect()
			cancelAnimationFrame(rafId)
			instance.destroy()
			instanceRef.current = null
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [reducedMotion])

	// Live option changes → update() (instant redraw, never a re-sew).
	useEffect(() => {
		instanceRef.current?.update({ font, weight, threadColor, pitch, fill, animate, sewStyle, stitchMode, sewRate, sheen, editable, axes })
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [font, weight, threadColor, pitch, fill, animate, sewStyle, stitchMode, sewRate, sheen, editable, axesKey])

	// Text changes → setText.
	useEffect(() => {
		instanceRef.current?.setText(text)
	}, [text])

	return ref
}
