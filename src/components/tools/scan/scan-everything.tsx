"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, FileScan, QrCode, ScanText, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CameraScanner } from "@/components/tools/scanner/camera-scanner"
import { ImageScan } from "@/components/tools/scanner/image-scan"
import { ScanHistory } from "@/components/tools/scanner/scan-history"
import { ScanResultCard } from "@/components/tools/scanner/scan-result"
import type { CameraController } from "@/components/tools/scanner/use-camera"
import type { DetectedCode } from "@/lib/qr/detect"
import { ALL_FORMATS } from "@/lib/qr/formats"
import { parsePayload, PAYLOAD_LABELS } from "@/lib/qr/payload"
import { scanHistory, setOcrHandoff } from "@/lib/qr/session"

const QUICK_LINKS: Array<{ href: string; label: string; description: string; icon: LucideIcon }> = [
  { href: "/tools/pdf-scanner", label: "Document scan", description: "Paper to PDF", icon: FileScan },
  { href: "/tools/ocr", label: "OCR", description: "Text from images", icon: ScanText },
  { href: "/tools/qr-generator", label: "QR Generator", description: "Make your own", icon: QrCode },
]

interface Current {
  code: DetectedCode
  source: "camera" | "image"
  historyId?: string
}

export function ScanEverything() {
  const router = useRouter()
  const [current, setCurrent] = useState<Current | null>(null)
  const [capturing, setCapturing] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const handle = useCallback((code: DetectedCode, source: "camera" | "image") => {
    scanHistory.add({ value: code.value, format: code.format, source })
    const latest = scanHistory.get()[0]
    setCurrent({ code, source, historyId: latest?.value === code.value ? latest.id : undefined })
    requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 1023px)").matches) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [])

  const captureText = (camera: CameraController) => {
    setCapturing(true)
    const attempts: Array<[number, number]> = [
      [2000, 0.9],
      [1400, 0.75],
      [1000, 0.6],
    ]
    for (const [size, quality] of attempts) {
      const canvas = camera.captureFrame(size)
      if (!canvas) break
      if (setOcrHandoff(canvas.toDataURL("image/jpeg", quality))) {
        camera.stop()
        router.push("/tools/ocr")
        return
      }
    }
    setCapturing(false)
    toast.error("Couldn't capture this frame. Try OCR with a photo instead.")
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
      <div className="min-w-0 space-y-3">
        <CameraScanner
          formats={ALL_FORMATS}
          viewfinder="square"
          idleTitle="Scan QR codes, barcodes and text"
          idleDescription="Codes are detected automatically. Tap “Capture text” to read printed text."
          onDetect={(c) => handle(c, "camera")}
          pausedLabel={(c) => {
            const p = parsePayload(c.value)
            return p.type === "text" ? c.value : `${PAYLOAD_LABELS[p.type]} · ${c.value}`
          }}
          toolbar={(camera) => (
            <Button
              size="lg"
              className="h-10 rounded-full px-4 text-sm"
              disabled={capturing}
              onClick={() => captureText(camera)}
            >
              <ScanText aria-hidden /> Capture text
            </Button>
          )}
        />
        <ImageScan formats={ALL_FORMATS} compact title="Scan a code from an image" hint="Screenshot or photo" onDetect={(c) => handle(c, "image")} />
      </div>

      <div className="min-w-0 space-y-4">
        <div ref={resultRef} aria-live="polite" className="scroll-mt-4">
          {current ? (
            <ScanResultCard
              key={`${current.code.value}-${current.historyId ?? ""}`}
              code={current.code}
              source={current.source}
              onDismiss={() => setCurrent(null)}
            />
          ) : null}
        </div>

        <nav aria-label="Other scan tools">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">More ways to scan</h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-2">
            {QUICK_LINKS.map(({ href, label, description, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex h-full items-center gap-3 rounded-2xl border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/50"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{description}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground sm:hidden lg:block" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <ScanHistory
          activeId={current?.historyId}
          onSelect={(item) => setCurrent({ code: { value: item.value, format: item.format }, source: item.source, historyId: item.id })}
        />
      </div>
    </div>
  )
}
