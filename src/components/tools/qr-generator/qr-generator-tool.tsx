"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import {
  CalendarDays,
  ChevronDown,
  ClipboardCopy,
  Contact,
  Download,
  FileCode,
  FileText,
  FileUp,
  IndianRupee,
  Link as LinkIcon,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  QrCode,
  RotateCcw,
  Share2,
  TriangleAlert,
  Type,
  Wifi,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CopyButton } from "@/components/common/copy-button"
import { Notice } from "@/components/common/notice"
import { canvasToBlob, downloadBlob, downloadText, loadImage } from "@/lib/files"
import { QR_BYTE_CAPACITY, utf8Length } from "@/lib/qr/capacity"
import { DEFAULTS, buildPayload, type FormValues, type QrContentType } from "@/lib/qr/generator"
import { qrErrorMessage, qrSymbolInfo, renderQrCanvas, renderQrSvg, type QrLogo, type QrStyle } from "@/lib/qr/render"
import { cn } from "@/lib/utils"
import { FileQrForm, INITIAL_FILE_STATE, fileQrPayload, type FileQrState } from "./file-qr-form"
import { QrCustomize } from "./qr-customize"
import { QrTypeForm } from "./qr-type-form"

const TYPES: Array<{ id: QrContentType; label: string; icon: LucideIcon }> = [
  { id: "url", label: "URL", icon: LinkIcon },
  { id: "text", label: "Text", icon: Type },
  { id: "wifi", label: "Wi-Fi", icon: Wifi },
  { id: "contact", label: "Contact", icon: Contact },
  { id: "upi", label: "UPI", icon: IndianRupee },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "event", label: "Event", icon: CalendarDays },
  { id: "email", label: "Email", icon: Mail },
  { id: "phone", label: "Phone", icon: Phone },
  { id: "sms", label: "SMS", icon: MessageSquare },
  { id: "location", label: "Location", icon: MapPin },
  { id: "file", label: "File", icon: FileUp },
]

const DEFAULT_STYLE: QrStyle = { fg: "#111827", bg: "#ffffff", size: 1024, margin: 4, ecc: "M", logoRatio: 0.2 }

/** Above this many modules a code gets hard to scan from small prints or screens. */
const DENSE_MODULES = 77 // version 15

const noop = () => () => {}
function useBrowserFlag(check: () => boolean) {
  return useSyncExternalStore(noop, check, () => false)
}

interface RenderState {
  key: string
  error: string | null
  modules?: number
  version?: number
}

export function QrGeneratorTool() {
  const [type, setType] = useState<QrContentType>("url")
  const [values, setValues] = useState(DEFAULTS)
  const [touched, setTouched] = useState<Partial<Record<QrContentType, boolean>>>({})
  const [fileState, setFileState] = useState<FileQrState>(INITIAL_FILE_STATE)
  const [style, setStyle] = useState<QrStyle>(DEFAULT_STYLE)
  const [logo, setLogo] = useState<(QrLogo & { name: string }) | null>(null)
  const [renderState, setRenderState] = useState<RenderState | null>(null)
  const [busy, setBusy] = useState<"svg" | "png" | "pdf" | "copy" | "share" | null>(null)
  const [caption, setCaption] = useState("")
  const [previewVisible, setPreviewVisible] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const thumbRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLElement>(null)
  const canCopyImage = useBrowserFlag(() => typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write)
  const canShare = useBrowserFlag(() => typeof navigator.share === "function")

  const ecc = logo ? "H" : style.ecc
  const colorsValid = /^#[0-9a-f]{6}$/i.test(style.fg) && /^#[0-9a-f]{6}$/i.test(style.bg)

  const built = useMemo(() => {
    if (type === "file") {
      const r = fileQrPayload(fileState, ecc)
      return { payload: r.payload, errors: r.error ? { _: r.error } : ({} as Record<string, string>) }
    }
    return buildPayload(type, values[type])
  }, [type, values, fileState, ecc])

  const payload = built.payload
  const effectiveStyle = useMemo<QrStyle>(() => ({ ...style, ecc }), [style, ecc])
  const renderKey = payload && colorsValid ? JSON.stringify([payload, effectiveStyle, logo?.dataUrl.length ?? 0]) : ""
  const current = renderState?.key === renderKey ? renderState : null
  const renderError = current?.error ?? null
  const ready = !!renderKey && !!current && !current.error

  // Live preview (+ the small thumbnail used by the mobile sticky bar).
  useEffect(() => {
    if (!renderKey || !payload || !canvasRef.current) return
    let cancelled = false
    const canvas = canvasRef.current
    Promise.all([renderQrCanvas(payload, effectiveStyle, canvas, logo), qrSymbolInfo(payload, effectiveStyle.ecc)])
      .then(([, info]) => {
        if (cancelled) return
        const thumb = thumbRef.current
        if (thumb) {
          thumb.width = thumb.height = 96
          thumb.getContext("2d")?.drawImage(canvas, 0, 0, 96, 96)
        }
        setRenderState({ key: renderKey, error: null, modules: info?.modules, version: info?.version })
      })
      .catch((e) => !cancelled && setRenderState({ key: renderKey, error: qrErrorMessage(e) }))
    return () => {
      cancelled = true
    }
  }, [renderKey, payload, effectiveStyle, logo])

  // Show the compact sticky bar on phones once the big preview scrolls away.
  useEffect(() => {
    const el = previewRef.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(([entry]) => setPreviewVisible(entry.isIntersecting), { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Release the temporary blob: URL when it's replaced or the page closes.
  const localUrl = fileState.local?.url
  useEffect(() => {
    return () => {
      if (localUrl) URL.revokeObjectURL(localUrl)
    }
  }, [localUrl])

  const setField = (name: string, value: string | boolean) => {
    if (type === "file") return
    setValues((prev) => ({ ...prev, [type]: { ...prev[type], [name]: value } as FormValues }))
    setTouched((t) => ({ ...t, [type]: true }))
  }

  const addLogo = async (file: File) => {
    try {
      const img = await loadImage(file)
      const max = 512
      const k = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max))
      const c = document.createElement("canvas")
      c.width = Math.max(1, Math.round((img.naturalWidth || max) * k))
      c.height = Math.max(1, Math.round((img.naturalHeight || max) * k))
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height)
      const dataUrl = c.toDataURL("image/png")
      setLogo({ image: await loadImage(dataUrl), dataUrl, name: file.name })
      toast.success("Logo added — error correction set to High")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This logo couldn't be loaded.")
    }
  }

  const fileBase = `lifekit-qr-${type}`

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>, fail: string) => {
    if (!ready) return
    setBusy(kind)
    try {
      await fn()
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return
      toast.error(e instanceof Error && /too big|amount of data/i.test(e.message) ? qrErrorMessage(e) : fail)
    } finally {
      setBusy(null)
    }
  }

  const downloadPng = () => run("png", async () => downloadBlob(await canvasToBlob(canvasRef.current!), `${fileBase}.png`), "PNG export failed.")
  const downloadSvg = () =>
    run("svg", async () => downloadText(await renderQrSvg(payload!, effectiveStyle, logo), `${fileBase}.svg`, "image/svg+xml"), "SVG export failed.")
  const downloadPdf = () =>
    run(
      "pdf",
      async () => {
        const { buildQrPdf } = await import("@/lib/qr/export")
        downloadBlob(await buildQrPdf(canvasRef.current!, caption, caption.trim() || "QR code"), `${fileBase}.pdf`)
      },
      "PDF export failed."
    )
  const copyImage = () =>
    run(
      "copy",
      async () => {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": canvasToBlob(canvasRef.current!) })])
        toast.success("QR image copied")
      },
      "Couldn't copy the image. Try downloading it instead."
    )
  const share = () =>
    run(
      "share",
      async () => {
        const file = new File([await canvasToBlob(canvasRef.current!)], `${fileBase}.png`, { type: "image/png" })
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "QR code" })
        else await navigator.share({ title: "QR code", text: payload! })
      },
      "Couldn't open the share sheet. Download the image instead."
    )

  const bytes = payload ? utf8Length(payload) : 0
  const cap = QR_BYTE_CAPACITY[ecc]
  const showErrors = !!touched[type]
  const fileError = type === "file" ? built.errors._ : undefined
  const dense = !!current?.modules && current.modules >= DENSE_MODULES
  // A module should be ≥ 0.4 mm for phone cameras at arm's length.
  const minPrintCm = current?.modules ? Math.ceil(((current.modules + style.margin * 2) * 0.4) / 10) : null

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:items-start lg:gap-5">
      {/* Type picker */}
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
        <h2 className="sr-only">QR content type</h2>
        <div className="-mx-4 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0">
          <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap" role="radiogroup" aria-label="QR content type">
            {TYPES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={type === id}
                onClick={() => setType(id)}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  type === id ? "border-primary bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Preview + export (above the form on phones, sticky on desktop) */}
      <section
        ref={previewRef}
        aria-labelledby="qr-preview"
        className="min-w-0 rounded-2xl border bg-card p-4 shadow-soft sm:p-5 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-3 lg:row-start-1"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="qr-preview" className="font-medium">
            Preview
          </h2>
          {payload ? (
            <span className={cn("text-xs tabular-nums", bytes > cap ? "text-destructive" : "text-muted-foreground")}>
              {bytes.toLocaleString()} / {cap.toLocaleString()} bytes
            </span>
          ) : null}
        </div>

        <div className="relative mx-auto flex aspect-square w-full max-w-60 items-center justify-center overflow-hidden rounded-2xl border bg-surface sm:max-w-72 lg:max-w-80">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={ready ? "Generated QR code" : undefined}
            className={cn("size-full object-contain transition-opacity", ready ? "opacity-100" : "opacity-0")}
          />
          {!ready ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
              {renderKey && !renderError ? <Loader2 className="size-8 animate-spin" aria-hidden /> : <QrCode className="size-10" aria-hidden />}
              <p className="text-sm">
                {renderError ? "Can't generate" : !payload ? "Fill in the details to see your QR code" : !colorsValid ? "Enter valid hex colours" : "Generating…"}
              </p>
            </div>
          ) : null}
        </div>

        <div aria-live="polite" className="mt-3 space-y-2 empty:hidden">
          {renderError ? <Notice tone="danger">{renderError}</Notice> : null}
          {ready && dense ? (
            <p className="flex gap-2 text-xs text-warning-foreground dark:text-warning" role="status">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Dense code ({current!.modules}×{current!.modules} modules). Print it at least {minPrintCm} cm wide, or shorten the content, so phones can read it.
            </p>
          ) : null}
          {type === "file" && fileState.mode === "local" && payload ? (
            <Notice tone="warning">This QR only works in this browser tab on this device.</Notice>
          ) : null}
        </div>

        <div className="mt-4 space-y-2">
          <Button size="lg" className="w-full" disabled={!ready || !!busy} onClick={() => void downloadPng()}>
            {busy === "png" ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />} Download PNG
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={!ready || !!busy} onClick={() => void downloadSvg()}>
              {busy === "svg" ? <Loader2 className="animate-spin" aria-hidden /> : <FileCode aria-hidden />} SVG
            </Button>
            <Button variant="outline" disabled={!ready || !!busy} onClick={() => void downloadPdf()}>
              {busy === "pdf" ? <Loader2 className="animate-spin" aria-hidden /> : <FileText aria-hidden />} PDF
            </Button>
            {canShare ? (
              <Button variant="outline" disabled={!ready || !!busy} onClick={() => void share()}>
                {busy === "share" ? <Loader2 className="animate-spin" aria-hidden /> : <Share2 aria-hidden />} Share
              </Button>
            ) : null}
            {canCopyImage ? (
              <Button variant="outline" disabled={!ready || !!busy} onClick={() => void copyImage()}>
                {busy === "copy" ? <Loader2 className="animate-spin" aria-hidden /> : <ClipboardCopy aria-hidden />} Copy image
              </Button>
            ) : null}
            <CopyButton
              className={cn((Number(canShare) + Number(canCopyImage)) % 2 === 0 && "col-span-2")}
              value={ready && payload ? payload : ""}
              label="Copy content"
            />
          </div>
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="qr-caption" className="text-xs text-muted-foreground">
              Caption under the code (PDF only, optional)
            </Label>
            <Input id="qr-caption" value={caption} maxLength={120} placeholder="e.g. Scan to join our Wi-Fi" onChange={(e) => setCaption(e.target.value)} />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Test your code with a phone before printing it.</p>
      </section>

      {/* Content form */}
      <section aria-labelledby="qr-content" className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5 lg:col-start-1 lg:row-start-2">
        <h2 id="qr-content" className="mb-4 font-medium">
          {TYPES.find((t) => t.id === type)?.label} details
        </h2>
        {type === "file" ? (
          <FileQrForm
            state={fileState}
            ecc={ecc}
            logoForcesH={!!logo}
            onChange={(patch) => setFileState((s) => ({ ...s, ...patch }))}
            onError={(m) => toast.error(m)}
          />
        ) : (
          <QrTypeForm type={type} values={values[type]} errors={built.errors} showErrors={showErrors} onChange={setField} />
        )}
        {fileError && fileState.mode === "embed" ? (
          <Notice tone="danger" className="mt-4">
            {fileError}
          </Notice>
        ) : null}
      </section>

      {/* Customize (collapsed by default) */}
      <details className="group min-w-0 rounded-2xl border bg-card lg:col-start-1 lg:row-start-3">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-5 [&::-webkit-details-marker]:hidden">
          <span>
            Customize
            <span className="block text-xs font-normal text-muted-foreground">Colours, size, margin, error correction, logo</span>
          </span>
          <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="space-y-4 border-t p-4 sm:p-5">
          <QrCustomize
            style={style}
            onStyle={(patch) => setStyle((s) => ({ ...s, ...patch }))}
            hasLogo={!!logo}
            logoName={logo?.name}
            onLogo={(f) => void addLogo(f)}
            onRemoveLogo={() => setLogo(null)}
          />
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => {
              setStyle(DEFAULT_STYLE)
              setLogo(null)
            }}
          >
            <RotateCcw aria-hidden /> Reset style
          </Button>
        </div>
      </details>

      {/* Phones: compact bar with the code + download once the preview is off-screen */}
      <div
        aria-hidden={previewVisible || !ready}
        className={cn(
          "sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-3 rounded-2xl border bg-card/95 p-2 pr-3 shadow-soft backdrop-blur transition-opacity lg:hidden",
          previewVisible || !ready ? "pointer-events-none invisible opacity-0" : "opacity-100"
        )}
      >
        <canvas ref={thumbRef} className="size-12 shrink-0 rounded-lg border bg-white" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{payload ?? ""}</p>
        <Button disabled={!ready || !!busy} onClick={() => void downloadPng()} tabIndex={previewVisible ? -1 : undefined}>
          <Download aria-hidden /> PNG
        </Button>
      </div>
    </div>
  )
}
