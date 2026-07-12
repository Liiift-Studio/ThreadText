"use client"

// Interactive threadText demo — type a word (in the input or straight on the artwork) and
// watch it embroider itself. Font, size, weight, sew-rate, sheen, and thread colour are all
// live: they redraw instantly via update() without re-running the sew-in animation.
import { useEffect, useRef, useState, useCallback } from "react"
import { createThreadText } from "@liiift-studio/threadtext"
import type { ThreadTextInstance } from "@liiift-studio/threadtext"

/** A spread of type styles (labelled by category, not by name) — each embroiders differently. */
const FONTS = [
	{ label: "Display serif", value: '"Fraunces", Georgia, serif' },
	{ label: "Text serif", value: 'Merriweather, Georgia, serif' },
	{ label: "Sans-serif", value: 'ui-sans-serif, system-ui, "Helvetica Neue", Arial, sans-serif' },
	{ label: "Monospace", value: 'ui-monospace, Menlo, Consolas, "Courier New", monospace' },
	{ label: "Handwriting", value: '"Snell Roundhand", "Segoe Script", "Brush Script MT", cursive' },
]

/** Labelled range slider with the value announced to screen readers. */
function Slider({ label, value, min, max, step, fmt, onChange, title }: { label: string; value: number; min: number; max: number; step: number; fmt?: (v: number) => string; onChange: (v: number) => void; title?: string }) {
	const valueId = `slider-val-${label.replace(/\s+/g, '-').toLowerCase()}`
	return (
		<div className="flex flex-col gap-1">
			<span className="text-xs uppercase tracking-[0.18em] font-medium text-muted">{label}</span>
			<input type="range" min={min} max={max} step={step} value={value} aria-label={label} aria-describedby={valueId} title={title} onChange={e => onChange(Number(e.target.value))} style={{ touchAction: 'none' }} />
			<span id={valueId} className="tabular-nums text-xs text-muted text-right">{fmt ? fmt(value) : value}</span>
		</div>
	)
}

/** Pill toggle button. */
function Toggle({ label, on, onClick, title }: { label: string; on: boolean; onClick: () => void; title?: string }) {
	return (
		<div className="flex flex-col gap-1">
			<span className="text-xs uppercase tracking-[0.18em] font-medium text-muted">{label}</span>
			<button onClick={onClick} aria-pressed={on} title={title} className="text-xs px-3 py-2 rounded-full border transition-opacity self-start" style={{ borderColor: 'currentColor', opacity: on ? 1 : 0.5, background: on ? 'var(--btn-bg)' : 'transparent' }}>
				{on ? 'On' : 'Off'}
			</button>
		</div>
	)
}

export default function Demo() {
	const hostRef = useRef<HTMLDivElement>(null)
	const instRef = useRef<ThreadTextInstance | null>(null)

	const [text, setText] = useState("Thread")
	const [font, setFont] = useState(FONTS[0].value)
	const [weight, setWeight] = useState(680)
	const [fill, setFill] = useState(0.9)
	const [sewRate, setSewRate] = useState(140)
	const [threadColor, setThreadColor] = useState("#fdf3df")
	const [sheen, setSheen] = useState(true)
	const [sewStyle, setSewStyle] = useState<'machine' | 'hand'>('machine')

	const initial = useRef({ text, font, weight, fill, sewRate, threadColor, sheen, sewStyle })

	// Create once; everything below is applied live.
	useEffect(() => {
		const el = hostRef.current
		if (!el) return
		const inst = createThreadText(el, {
			...initial.current,
			editable: true,                       // type straight on the artwork
			onTextChange: (t) => setText(t),      // keep the input in sync when typing on the canvas
		})
		instRef.current = inst

		let raf = 0, lastW = 0, first = true
		const ro = typeof ResizeObserver !== 'undefined'
			? new ResizeObserver((entries) => {
				const w = Math.round(entries[0].contentRect.width)
				// Skip the observer's initial callback — the instance already sized itself on
				// create; re-fitting here would wipe the mount sew-in. Then only react to real
				// width changes (height is driven by the renderer itself).
				if (first) { first = false; lastW = w; return }
				if (w === lastW) return
				lastW = w
				cancelAnimationFrame(raf); raf = requestAnimationFrame(() => instRef.current?.resize())
			})
			: undefined
		ro?.observe(el)

		return () => { ro?.disconnect(); cancelAnimationFrame(raf); inst.destroy(); instRef.current = null }
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// Live parameter changes — instant redraw, no re-sew.
	useEffect(() => {
		instRef.current?.update({ font, weight, fill, sewRate, threadColor, sheen, sewStyle })
	}, [font, weight, fill, sewRate, threadColor, sheen, sewStyle])

	// Text changes (input or canvas typing).
	useEffect(() => { instRef.current?.setText(text) }, [text])

	// Replay so the chosen sew style is immediately visible (skip the initial mount).
	const styleMounted = useRef(false)
	useEffect(() => {
		if (!styleMounted.current) { styleMounted.current = true; return }
		instRef.current?.replay()
	}, [sewStyle])

	const replay = useCallback(() => instRef.current?.replay(), [])

	return (
		<div className="w-full flex flex-col gap-6">
			{/* Embroidery surface — click and type directly, or use the input below */}
			<div ref={hostRef} style={{ width: '100%', cursor: 'text' }} aria-label={`The word "${text}" as satin-stitch embroidery — click and type to change it`} />

			{/* Word input + replay */}
			<div className="flex flex-wrap items-end gap-4">
				<label className="flex flex-col gap-1 flex-1 min-w-[12rem]">
					<span className="text-xs uppercase tracking-[0.18em] font-medium text-muted">Word</span>
					<input
						type="text"
						value={text}
						maxLength={24}
						aria-label="Word to embroider"
						onChange={e => setText(e.target.value)}
						className="bg-transparent border rounded-lg px-3 py-2 text-base"
						style={{ borderColor: 'currentColor', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
					/>
				</label>
				<label className="flex flex-col gap-1">
					<span className="text-xs uppercase tracking-[0.18em] font-medium text-muted">Font</span>
					<select
						value={font}
						aria-label="Font"
						onChange={e => setFont(e.target.value)}
						className="border rounded-lg pl-3 pr-9 py-2 text-base"
						style={{
							borderColor: 'currentColor',
							WebkitAppearance: 'none',
							appearance: 'none',
							// Custom chevron with real breathing room from the right edge.
							background: "transparent url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23b7bece' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\") no-repeat right 0.85rem center",
						}}
					>
						{FONTS.map(f => <option key={f.label} value={f.value} style={{ color: '#111', background: '#fff' }}>{f.label}</option>)}
					</select>
				</label>
				<button
					onClick={replay}
					title="Replay the sew-in animation"
					className="text-xs px-4 py-2 rounded-full border transition-opacity"
					style={{ borderColor: 'currentColor', background: 'var(--btn-bg)' }}
				>
					Replay sew-in
				</button>
			</div>

			{/* Controls */}
			<div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
				<Slider label="Size" value={fill} min={0.4} max={1} step={0.02} fmt={v => `${Math.round(v * 100)}%`} onChange={setFill} title="Fraction of the width the word fills — refits to the container on resize" />
				<Slider label="Weight" value={weight} min={200} max={900} step={10} onChange={setWeight} title="Numeric font weight — heavier strokes give broader satin bands" />
				<Slider label="Sew rate" value={sewRate} min={30} max={320} step={10} fmt={v => `${v}/s`} onChange={setSewRate} title="How fast the sew-in animation lays stitches — hit Replay to watch it" />
				<div className="flex flex-col gap-1">
					<span className="text-xs uppercase tracking-[0.18em] font-medium text-muted">Sew style</span>
					<div role="group" aria-label="Sew style" className="flex gap-2">
						{([['machine', 'Machine'], ['hand', 'Hand']] as const).map(([v, lbl]) => (
							<button
								key={v}
								onClick={() => setSewStyle(v)}
								aria-pressed={sewStyle === v}
								title={v === 'machine' ? 'Satin cross-rows fill each stroke in parallel — like a machine' : 'A single thread wanders stitch by stitch — like hand embroidery'}
								className="text-xs px-3 py-2 rounded-full border transition-opacity"
								style={{ borderColor: 'currentColor', opacity: sewStyle === v ? 1 : 0.5, background: sewStyle === v ? 'var(--btn-bg)' : 'transparent' }}
							>
								{lbl}
							</button>
						))}
					</div>
				</div>
				<Toggle label="Sheen" on={sheen} onClick={() => setSheen(v => !v)} title="Cursor-following highlight that turns the threads over in the light" />
				<label className="flex flex-col gap-1">
					<span className="text-xs uppercase tracking-[0.18em] font-medium text-muted">Thread</span>
					<span className="flex items-center gap-2">
						<input type="color" value={threadColor} aria-label="Thread colour" onChange={e => setThreadColor(e.target.value)} style={{ width: 34, height: 26, border: '1px solid currentColor', borderRadius: 6, background: 'transparent', cursor: 'pointer', padding: 0 }} />
						<span className="tabular-nums text-xs text-muted">{threadColor}</span>
					</span>
				</label>
			</div>

			<p className="text-xs text-muted italic" style={{ lineHeight: 1.8 }}>
				Click the artwork and type — the word re-fits to the width as you go, and colour, font, and size
				change live without re-stitching. Hit <em>Replay sew-in</em> to watch it embroider itself one satin row at a time.
			</p>
		</div>
	)
}
