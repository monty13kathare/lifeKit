"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, ImageUp, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FileDropzone } from "@/components/common/file-dropzone"
import { Notice } from "@/components/common/notice"
import { checkFile, formatBytes, MB } from "@/lib/files"
import { scanImageFileAll, type DetectedCode } from "@/lib/qr/detect"
import type { CodeFormat } from "@/lib/qr/formats"
import { cn } from "@/lib/utils"

interface ImageScanProps {
  formats: CodeFormat[]
  /** Called with the first code found (and, when `onDetectMany` isn't set, only that one). */
  onDetect: (code: DetectedCode) => void
  /** Optional: receive every code found in the image (several codes in one photo). */
  onDetectMany?: (codes: DetectedCode[]) => void
  title?: string
  hint?: string
  compact?: boolean
  className?: string
}

const RULES = { accept: ["image/*"], maxBytes: 25 * MB, warnBytes: 8 * MB } as const

/** Upload / photo fallback that decodes codes from a still image. */
export function ImageScan({
  formats,
  onDetect,
  onDetectMany,
  title = "Scan from an image",
  hint = "PNG, JPG, WebP or a screenshot",
  compact,
  className,
}: ImageScanProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const handle = async (file: File) => {
    setBusy(true)
    setError(null)
    setPreview(URL.createObjectURL(file))
    try {
      const codes = await scanImageFileAll(file, formats, { max: onDetectMany ? 8 : 1 })
      if (!codes.length) setError("No code found in this image. Try a sharper, well-lit photo with the whole code visible and not too small.")
      else if (onDetectMany) onDetectMany(codes)
      else onDetect(codes[0])
    } catch (e) {
      setError(e instanceof Error ? e.message : "This image couldn't be scanned.")
    } finally {
      setBusy(false)
    }
  }

  const pick = (list: FileList | null) => {
    const file = list?.[0]
    if (!file) return
    const res = checkFile(file, RULES)
    setWarning(res.ok && file.size > RULES.warnBytes ? `Large image (${formatBytes(file.size)}) — scanning may take a few seconds.` : null)
    if (!res.ok) {
      setError(res.error ?? "This file can't be scanned.")
      return
    }
    void handle(file)
  }

  return (
    <div className={cn("space-y-3", className)}>
      {compact ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            if (!busy) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (!busy) pick(e.dataTransfer.files)
          }}
          className={cn(
            "space-y-3 rounded-2xl border-2 border-dashed bg-surface p-4 transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border",
            busy && "opacity-70"
          )}
        >
          <div>
            <p className="font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">
              {hint} · up to {formatBytes(RULES.maxBytes, 0)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
              <ImageUp aria-hidden /> Upload image
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => cameraRef.current?.click()}>
              <Camera aria-hidden /> Take photo
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            aria-label={title}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              pick(e.target.files)
              e.target.value = ""
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            aria-hidden
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              pick(e.target.files)
              e.target.value = ""
            }}
          />
        </div>
      ) : (
        <FileDropzone
          accept={RULES.accept}
          maxBytes={RULES.maxBytes}
          warnBytes={RULES.warnBytes}
          allowCamera
          title={title}
          hint={hint}
          disabled={busy}
          onFiles={([file]) => void handle(file)}
        />
      )}
      <div aria-live="polite" className="space-y-3">
        {busy ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Looking for codes…
          </p>
        ) : null}
        {warning && busy ? <p className="text-xs text-muted-foreground">{warning}</p> : null}
        {error ? <Notice tone="warning">{error}</Notice> : null}
      </div>
      {preview && (busy || error) ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob preview
        <img src={preview} alt="Uploaded image" className="mx-auto max-h-48 rounded-xl border object-contain" />
      ) : null}
    </div>
  )
}
