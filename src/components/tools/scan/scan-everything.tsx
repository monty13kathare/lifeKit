"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, FileScan, ImageUp, Loader2, QrCode, ScanBarcode, ScanText, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CameraScanner } from "@/components/tools/scanner/camera-scanner"
import { CameraView } from "@/components/tools/scanner/camera-view"
import { ImageScan } from "@/components/tools/scanner/image-scan"
import { ScanHistory } from "@/components/tools/scanner/scan-history"
import { ScanResultCard } from "@/components/tools/scanner/scan-result"
import { useCamera, type CameraController } from "@/components/tools/scanner/use-camera"
import { checkFile, MB } from "@/lib/files"
import type { DetectedCode } from "@/lib/qr/detect"
import { ALL_FORMATS, formatLabel } from "@/lib/qr/formats"
import { parsePayload, PAYLOAD_LABELS } from "@/lib/qr/payload"
import { scanHistory, setOcrHandoff } from "@/lib/qr/session"
import { cn } from "@/lib/utils"

const QUICK_LINKS: Array<{ href: string; label: string; description: string; icon: LucideIcon }> = [
  { href: "/tools/pdf-scanner", label: "Document scan", description: "Paper to PDF", icon: FileScan },
  { href: "/tools/ocr", label: "OCR", description: "Text from images", icon: ScanText },
  { href: "/tools/qr-generator", label: "QR Generator", description: "Make your own", icon: QrCode },
]

type Mode = "code" | "text"
const MODES: Array<{ id: Mode; label: string; icon: LucideIcon }> = [
  { id: "code", label: "QR & barcode", icon: ScanBarcode },
  { id: "text", label: "Text", icon: ScanText },
]

interface Current {
  code: DetectedCode
  source: "camera" | "image"
  historyId?: string
}

/** Downscale a frame/photo into a JPEG data URL small enough for the OCR hand-off. */
function handoffCanvas(canvasFor: (maxDim: number) => HTMLCanvasElement | null): boolean {
  for (const [size, quality] of [
    [2000, 0.9],
    [1400, 0.75],
    [1000, 0.6],
  ] as const) {
    const canvas = canvasFor(size)
    if (!canvas) return false
    if (setOcrHandoff(canvas.toDataURL("image/jpeg", quality))) return true
  }
  return false
}

function codeLabel(c: DetectedCode) {
  const p = parsePayload(c.value)
  return p.type === "text" ? c.value : `${PAYLOAD_LABELS[p.type]} · ${c.value}`
}

export function ScanEverything() {
  const [mode, setMode] = useState<Mode>("code")
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
        <div role="radiogroup" aria-label="What to scan" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={mode === id}
              onClick={() => setMode(id)}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                mode === id ? "bg-background text-foreground shadow-sm dark:bg-input/40" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" aria-hidden /> {label}
            </button>
          ))}
        </div>

        {mode === "code" ? (
          <>
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
          </>
        ) : (
          <TextMode />
        )}
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

/** Text mode: capture a camera frame or pick a photo and hand it to the OCR tool. */
function TextMode() {
  const router = useRouter()
  const camera = useCamera()
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const go = () => {
    router.push("/tools/ocr")
  }

  const captureText = (cam: CameraController) => {
    setBusy(true)
    if (handoffCanvas((max) => cam.captureFrame(max))) {
      cam.stop()
      go()
      return
    }
    setBusy(false)
    toast.error("Couldn't capture this frame. Try a photo instead.")
  }

  const fromFile = async (file: File | undefined) => {
    if (!file) return
    const check = checkFile(file, { accept: ["image/*"], maxBytes: 25 * MB })
    if (!check.ok) {
      toast.error(check.error ?? "This file can't be read.")
      return
    }
    setBusy(true)
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
      const ok = handoffCanvas((max) => {
        const k = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
        const c = document.createElement("canvas")
        c.width = Math.round(bitmap.width * k)
        c.height = Math.round(bitmap.height * k)
        const ctx = c.getContext("2d")
        if (!ctx) return null
        ctx.fillStyle = "#fff"
        ctx.fillRect(0, 0, c.width, c.height)
        ctx.drawImage(bitmap, 0, 0, c.width, c.height)
        return c
      })
      bitmap.close()
      if (ok) {
        go()
        return
      }
      toast.error("This image is too large to hand over. Open it in the OCR tool instead.")
    } catch {
      toast.error("This image couldn't be read. Try a JPG or PNG.")
    }
    setBusy(false)
  }

  return (
    <div className="space-y-3">
      <CameraView
        camera={camera}
        viewfinder="document"
        idleTitle="Read printed text"
        idleDescription="Point at a page, sign or label, then tap “Capture text”. Text is recognised in your browser."
        toolbar={
          <Button size="lg" className="h-11 rounded-full px-5" disabled={busy} onClick={() => captureText(camera)}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ScanText aria-hidden />} Capture text
          </Button>
        }
      />
      <div className="space-y-3 rounded-2xl border-2 border-dashed bg-surface p-4">
        <div>
          <p className="font-medium">Read text from a photo</p>
          <p className="text-sm text-muted-foreground">Opens it in the OCR tool · JPG, PNG or WebP</p>
        </div>
        <Button variant="outline" className="w-full" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ImageUp aria-hidden />} Choose a photo
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          aria-label="Choose a photo to read text from"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            void fromFile(e.target.files?.[0])
            e.target.value = ""
          }}
        />
      </div>
    </div>
  )
}
