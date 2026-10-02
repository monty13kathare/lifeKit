"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import {
  ClipboardCopy,
  Contact,
  Download,
  FileUp,
  FileCode,
  Link as LinkIcon,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  QrCode,
  Type,
  Wifi,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/common/copy-button"
import { Notice } from "@/components/common/notice"
import { canvasToBlob, downloadBlob, downloadText, loadImage } from "@/lib/files"
import { QR_BYTE_CAPACITY, utf8Length } from "@/lib/qr/capacity"
import { DEFAULTS, buildPayload, type FormValues, type QrContentType } from "@/lib/qr/generator"
import { qrErrorMessage, renderQrCanvas, renderQrSvg, type QrLogo, type QrStyle } from "@/lib/qr/render"
import { cn } from "@/lib/utils"
import { FileQrForm, INITIAL_FILE_STATE, fileQrPayload, type FileQrState } from "./file-qr-form"
import { QrCustomize } from "./qr-customize"
import { QrTypeForm } from "./qr-type-form"

const TYPES: Array<{ id: QrContentType; label: string; icon: LucideIcon }> = [
  { id: "url", label: "URL", icon: LinkIcon },
  { id: "text", label: "Text", icon: Type },
  { id: "contact", label: "Contact", icon: Contact },
  { id: "wifi", label: "Wi-Fi", icon: Wifi },
  { id: "email", label: "Email", icon: Mail },
  { id: "phone", label: "Phone", icon: Phone },
  { id: "sms", label: "SMS", icon: MessageSquare },
  { id: "location", label: "Location", icon: MapPin },
  { id: "file", label: "File", icon: FileUp },
]

const DEFAULT_STYLE: QrStyle = { fg: "#111827", bg: "#ffffff", size: 1024, margin: 4, ecc: "M", logoRatio: 0.2 }

const noop = () => () => {}
function useCanCopyImage() {
  return useSyncExternalStore(
    noop,
    () => typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write,
    () => false
  )
}

export function QrGeneratorTool() {
  const [type, setType] = useState<QrContentType>("url")
  const [values, setValues] = useState(DEFAULTS)
  const [touched, setTouched] = useState<Partial<Record<QrContentType, boolean>>>({})
  const [fileState, setFileState] = useState<FileQrState>(INITIAL_FILE_STATE)
  const [style, setStyle] = useState<QrStyle>(DEFAULT_STYLE)
  const [logo, setLogo] = useState<(QrLogo & { name: string }) | null>(null)
  const [renderState, setRenderState] = useState<{ key: string; error: string | null } | null>(null)
  const [busy, setBusy] = useState<"svg" | "png" | "copy" | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canCopyImage = useCanCopyImage()

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
  const renderError = renderState?.key === renderKey ? renderState.error : null
  const ready = !!renderKey && renderState?.key === renderKey && !renderState.error

  // Live preview.
  useEffect(() => {
    if (!renderKey || !payload || !canvasRef.current) return
    let cancelled = false
    const canvas = canvasRef.current
    renderQrCanvas(payload, effectiveStyle, canvas, logo)
      .then(() => !cancelled && setRenderState({ key: renderKey, error: null }))
      .catch((e) => !cancelled && setRenderState({ key: renderKey, error: qrErrorMessage(e) }))
    return () => {
      cancelled = true
    }
  }, [renderKey, payload, effectiveStyle, logo])

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

  const downloadPng = async () => {
    if (!canvasRef.current || !ready) return
    setBusy("png")
    try {
      downloadBlob(await canvasToBlob(canvasRef.current), `${fileBase}.png`)
    } catch {
      toast.error("PNG export failed.")
    } finally {
      setBusy(null)
    }
  }

  const downloadSvg = async () => {
    if (!payload || !ready) return
    setBusy("svg")
    try {
      downloadText(await renderQrSvg(payload, effectiveStyle, logo), `${fileBase}.svg`, "image/svg+xml")
    } catch (e) {
      toast.error(qrErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const copyImage = async () => {
    if (!canvasRef.current || !ready) return
    setBusy("copy")
    try {
      const blob = canvasToBlob(canvasRef.current)
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
      toast.success("QR image copied")
    } catch {
      toast.error("Couldn't copy the image. Try downloading it instead.")
    } finally {
      setBusy(null)
    }
  }

  const bytes = payload ? utf8Length(payload) : 0
  const cap = QR_BYTE_CAPACITY[ecc]
  const showErrors = !!touched[type]
  const fileError = type === "file" ? built.errors._ : undefined

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:items-start">
      {/* Content */}
      <section aria-labelledby="qr-content" className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5">
        <h2 id="qr-content" className="mb-3 font-medium">
          Content
        </h2>
        <div className="-mx-4 mb-5 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
          <div className="flex gap-2 sm:flex-wrap" role="radiogroup" aria-label="QR content type">
            {TYPES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={type === id}
                onClick={() => setType(id)}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
                  type === id ? "border-primary bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
        </div>

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

      {/* Preview + export */}
      <section
        aria-labelledby="qr-preview"
        className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1"
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

        <div className="relative mx-auto flex aspect-square w-full max-w-80 items-center justify-center overflow-hidden rounded-2xl border bg-surface">
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

        <div aria-live="polite" className="mt-3 space-y-2">
          {renderError ? <Notice tone="danger">{renderError}</Notice> : null}
          {type === "file" && fileState.mode === "local" && payload ? (
            <Notice tone="warning">This QR only works in this browser tab on this device.</Notice>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button size="lg" className="col-span-2" disabled={!ready || !!busy} onClick={() => void downloadPng()}>
            {busy === "png" ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />} Download PNG
          </Button>
          <Button variant="outline" disabled={!ready || !!busy} onClick={() => void downloadSvg()}>
            {busy === "svg" ? <Loader2 className="animate-spin" aria-hidden /> : <FileCode aria-hidden />} SVG
          </Button>
          {canCopyImage ? (
            <Button variant="outline" disabled={!ready || !!busy} onClick={() => void copyImage()}>
              {busy === "copy" ? <Loader2 className="animate-spin" aria-hidden /> : <ClipboardCopy aria-hidden />} Copy image
            </Button>
          ) : (
            <CopyButton value={ready && payload ? payload : ""} label="Copy content" />
          )}
          {canCopyImage ? <CopyButton className="col-span-2" variant="ghost" value={ready && payload ? payload : ""} label="Copy encoded content" /> : null}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Test your code with a phone before printing it.</p>
      </section>

      {/* Customize */}
      <section aria-labelledby="qr-style" className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="qr-style" className="font-medium">
            Customize
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setStyle(DEFAULT_STYLE)
              setLogo(null)
            }}
          >
            Reset
          </Button>
        </div>
        <QrCustomize
          style={style}
          onStyle={(patch) => setStyle((s) => ({ ...s, ...patch }))}
          hasLogo={!!logo}
          logoName={logo?.name}
          onLogo={(f) => void addLogo(f)}
          onRemoveLogo={() => setLogo(null)}
        />
      </section>
    </div>
  )
}
