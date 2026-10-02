"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { FileDropzone } from "@/components/common/file-dropzone"
import { Notice } from "@/components/common/notice"
import { MB } from "@/lib/files"
import { scanImageFile, type DetectedCode } from "@/lib/qr/detect"
import type { CodeFormat } from "@/lib/qr/formats"
import { cn } from "@/lib/utils"

interface ImageScanProps {
  formats: CodeFormat[]
  onDetect: (code: DetectedCode) => void
  title?: string
  hint?: string
  compact?: boolean
  className?: string
}

/** Upload / photo fallback that decodes a code from a still image. */
export function ImageScan({ formats, onDetect, title = "Scan from an image", hint = "PNG, JPG, WebP or a screenshot", compact, className }: ImageScanProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

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
      const result = await scanImageFile(file, formats)
      if (result) onDetect(result)
      else setError("No code found in this image. Try a sharper, well-lit photo with the whole code visible.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "This image couldn't be scanned.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <FileDropzone
        accept={["image/*"]}
        maxBytes={25 * MB}
        warnBytes={8 * MB}
        allowCamera
        compact={compact}
        title={title}
        hint={hint}
        disabled={busy}
        onFiles={([file]) => void handle(file)}
      />
      <div aria-live="polite" className="space-y-3">
        {busy ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Looking for a code…
          </p>
        ) : null}
        {error ? <Notice tone="warning">{error}</Notice> : null}
      </div>
      {preview && (busy || error) ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob preview
        <img src={preview} alt="Uploaded image" className="mx-auto max-h-48 rounded-xl border object-contain" />
      ) : null}
    </div>
  )
}
