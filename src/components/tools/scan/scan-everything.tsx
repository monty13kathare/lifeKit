"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import { ChevronRight, FileScan, QrCode, ScanBarcode, ScanText, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CameraScanner } from "@/components/tools/scanner/camera-scanner"
import { ImageScan } from "@/components/tools/scanner/image-scan"
import { ScanHistory } from "@/components/tools/scanner/scan-history"
import { ScanResultCard } from "@/components/tools/scanner/scan-result"
import { checkFile, MB } from "@/lib/files"
import type { DetectedCode } from "@/lib/qr/detect"
import { ALL_FORMATS, formatLabel } from "@/lib/qr/formats"
import { parsePayload, PAYLOAD_LABELS } from "@/lib/qr/payload"
import { scanHistory } from "@/lib/qr/session"
import { cn } from "@/lib/utils"

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



function codeLabel(c: DetectedCode) {
  const p = parsePayload(c.value)
  return p.type === "text" ? c.value : `${PAYLOAD_LABELS[p.type]} · ${c.value}`
}

export function ScanEverything() {
  const [current, setCurrent] = useState<Current | null>(null)
  const [found, setFound] = useState<DetectedCode[]>([])
  const resultRef = useRef<HTMLDivElement>(null)

  const show = useCallback((code: DetectedCode, source: "camera" | "image") => {
    const latest = scanHistory.get().find((h) => h.value === code.value && h.format === code.format)
    setCurrent({ code, source, historyId: latest?.id })
    requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 1023px)").matches) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [])

  const handle = useCallback(
    (code: DetectedCode, source: "camera" | "image") => {
      scanHistory.add({ value: code.value, format: code.format, source })
      setFound([])
      show(code, source)
    },
    [show]
  )

  const handleMany = useCallback(
    (codes: DetectedCode[]) => {
      // Oldest first so the first code found ends up on top of the history.
      for (const c of [...codes].reverse()) scanHistory.add({ value: c.value, format: c.format, source: "image" })
      setFound(codes.length > 1 ? codes : [])
      show(codes[0], "image")
    },
    [show]
  )

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
      <div className="min-w-0 space-y-3">
        <CameraScanner
          formats={ALL_FORMATS}
          viewfinder="square"
          idleTitle="Scan QR codes and barcodes"
          idleDescription="Codes are detected automatically — links, Wi-Fi, contacts, events, UPI, product barcodes and more."
          onDetect={(c) => handle(c, "camera")}
          pausedLabel={codeLabel}
        />
        <ImageScan
          formats={ALL_FORMATS}
          compact
          title="Scan a code from an image"
          hint="Screenshot or photo"
          onDetect={(c) => handle(c, "image")}
          onDetectMany={handleMany}
        />
      </div>

      <div className="min-w-0 space-y-4">
        <div ref={resultRef} aria-live="polite" className="scroll-mt-20 space-y-3 empty:hidden">
          {found.length > 1 ? (
            <div className="rounded-2xl border bg-card p-3">
              <p className="mb-2 text-sm font-medium">{found.length} codes found in this image</p>
              <ul className="space-y-1.5">
                {found.map((c, i) => {
                  const active = current?.code.value === c.value && current.code.format === c.format
                  return (
                    <li key={`${c.format}-${c.value}`}>
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => show(c, "image")}
                        className={cn(
                          "flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                          active ? "border-primary/50 bg-primary/5" : "bg-surface hover:bg-muted"
                        )}
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate">{codeLabel(c)}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatLabel(c.format)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
          {current ? (
            <ScanResultCard
              key={`${current.code.format}-${current.code.value}`}
              code={current.code}
              source={current.source}
              onDismiss={() => {
                setCurrent(null)
                setFound([])
              }}
            />
          ) : null}
        </div>

        <ScanHistory
          activeId={current?.historyId}
          onSelect={(item) => {
            setFound([])
            setCurrent({ code: { value: item.value, format: item.format }, source: item.source, historyId: item.id })
          }}
        />

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
      </div>
    </div>
  )
}

