import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Nexora — Creator operations, connected",
  description: "A unified workspace for your media library and connected tools.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
