import type { Metadata, Viewport } from "next"
import { Geist_Mono, Inter } from "next/font/google"
import { AppShell } from "@/components/layout/app-shell"
import { Providers } from "@/components/layout/providers"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "LifeKit — Everyday Utility Toolbox",
    template: "%s · LifeKit",
  },
  description:
    "PDF, image, scan, QR, OCR, calculators, tasks, calendar and more — processed privately in your browser.",
  applicationName: "LifeKit",
  appleWebApp: {
    capable: true,
    title: "LifeKit",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#14151c" },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${geistMono.variable} antialiased`}>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
