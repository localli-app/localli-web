import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Localli',
  description: 'Book beauty appointments without creating an account.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Never block pinch-zoom: the audience spans every age and ability.
  maximumScale: 5,
  themeColor: '#efe9e1',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en-GB" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  )
}
