"use client"

// Interactive threadText demo — type a word and watch it sew itself in as satin-stitch
// embroidery, with live thread/fabric colour, weight, sew-rate, and sheen controls.
import { useEffect, useRef, useState, useCallback } from "react"
import { createThreadText } from "@liiift-studio/threadtext"
import type { ThreadTextInstance } from "@liiift-studio/threadtext"

/** Demo/hero face — the OFL Fraunces variable font (declared in globals.css). */
const FONT = '"Fraunces", Georgia, serif'

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

/** Small labelled colour swatch input. */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
	return (
		<label className="flex flex-col gap-1">
			<span className="text-xs uppercase tracking-[0.18em] font-medium text-muted">{label}</span>
			<span className="flex items-center gap-2">
				<input type="color" value={value} aria-label={label} onChange={e => onChange(e.target.value)} style={{ width: 34, height: 26, border: '1px solid currentColor', borderRadius: 6, background: 'transparent', cursor: 'pointer', padding: 0 }} />
				<span className="tabular-nums text-xs text-muted">{value}</span>
			</span>
		</label>
	)
}

export default function Demo() {
	const hostRef = useRef<HTMLDivElement>(null)
	const instRef = useRef<ThreadTextInstance | null>(null)

	const [text, setText] = useState("Thread")
	const [weight, setWeight] = useState(680)
	const [sewRate, setSewRate] = useState(140)
	const [threadColor, setThreadColor] = useState("#fdf3df")
	const [fabricColor, setFabricColor] = useState("#0b0b12")
	const [sheen, setSheen] = useState(true)

	// Structural options — a change here re-embroiders from scratch. Text is handled separately
	// (via setText) so typing animates only the newly-added letters.
	const structuralKey = `${weight}|${sewRate}|${threadColor}|${fabricColor}|${sheen}`

	useEffect(() => {
		const el = hostRef.current
		if (!el) return
		const inst = createThreadText(el, { text, font: FONT, weight, sewRate, threadColor, fabricColor, sheen })
		instRef.current = inst
		return () => { inst.destroy(); instRef.current = null }
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [structuralKey])

	// Text-only changes route through setText — appends sew in, replacements re-sew the word.
	useEffect(() => { instRef.current?.setText(text) }, [text])

	const replay = useCallback(() => instRef.current?.replay(), [])

	return (
		<div className="w-full flex flex-col gap-6">
			{/* Embroidery surface */}
			<div ref={hostRef} style={{ width: '100%' }} role="img" aria-label={`The word "${text}" rendered as satin-stitch embroidery`} />

			{/* Word input + replay */}
			<div className="flex flex-wrap items-end gap-4">
				<label className="flex flex-col gap-1 flex-1 min-w-[12rem]">
					<span className="text-xs uppercase tracking-[0.18em] font-medium text-muted">Word</span>
					<input
						type="text"
						value={text}
						maxLength={14}
						aria-label="Word to embroider"
						onChange={e => setText(e.target.value)}
						className="bg-transparent border rounded-lg px-3 py-2 text-base"
						style={{ borderColor: 'currentColor', fontFamily: FONT }}
					/>
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
				<Slider label="Weight" value={weight} min={200} max={900} step={10} onChange={setWeight} title="Numeric font weight — heavier strokes give broader satin bands" />
				<Slider label="Sew rate" value={sewRate} min={30} max={320} step={10} fmt={v => `${v}/s`} onChange={setSewRate} title="Satin cross-rows laid per second during the sew-in" />
				<div className="flex flex-col gap-1">
					<span className="text-xs uppercase tracking-[0.18em] font-medium text-muted">Sheen</span>
					<button
						onClick={() => setSheen(v => !v)}
						aria-pressed={sheen}
						title="Cursor-following highlight that turns the threads over in the light"
						className="text-xs px-3 py-2 rounded-full border transition-opacity self-start"
						style={{ borderColor: 'currentColor', opacity: sheen ? 1 : 0.5, background: sheen ? 'var(--btn-bg)' : 'transparent' }}
					>
						{sheen ? 'On' : 'Off'}
					</button>
				</div>
				<ColorField label="Thread" value={threadColor} onChange={setThreadColor} />
				<ColorField label="Fabric" value={fabricColor} onChange={setFabricColor} />
			</div>

			<p className="text-xs text-muted italic" style={{ lineHeight: 1.8 }}>
				Type to re-embroider — new letters sew in one satin cross-row at a time; move the cursor for the sheen.
				Every stitch is placed procedurally from Fraunces&rsquo; glyph geometry — no pre-baked assets, no AI.
			</p>
		</div>
	)
}
