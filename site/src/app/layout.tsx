// Layout and metadata for the threadText site
import type { Metadata } from "next"
import "./globals.css"
import SiteHeader from "../components/SiteHeader"

const TITLE = "Thread Text — Photorealistic satin-stitch embroidery for text"
const DESC = "Render any word as raised satin-stitch embroidery, in real time in the browser, from the font's own glyph geometry — thread flows across each stroke, lifts into 3D, and sews itself in. Procedural, not AI, not a raster filter. React + vanilla JS."

export const metadata: Metadata = {
	title: TITLE,
	icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
	description: DESC,
	keywords: ["thread text", "embroidery", "satin stitch", "procedural embroidery", "text effect", "variable font", "canvas", "typography", "TypeScript", "npm"],
	openGraph: {
		title: TITLE,
		description: DESC,
		url: "https://threadtext.com",
		siteName: "Thread Text",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: TITLE,
		description: DESC,
	},
	metadataBase: new URL("https://threadtext.com"),
	alternates: { canonical: "https://threadtext.com" },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className="h-full antialiased">
			<body className="min-h-full flex flex-col">
				<SiteHeader current="threadText" githubUrl="https://github.com/Liiift-Studio/ThreadText" />{children}</body>
		</html>
	)
}
