"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Download, ImageIcon, Link2, Link2Off, LoaderCircle, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { FileDropzone } from "@/components/common/file-dropzone"
import { Notice } from "@/components/common/notice"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { downloadBlob, formatBytes, replaceExtension } from "@/lib/files"
import {
  checkCanvasSize,
  decodeImage,
  disposeCanvas,
  encodeCanvas,
  friendlyError,
  renderResized,
  type DecodedImage,
  type FitMode,
} from "@/lib/image/canvas"
import {
  EXTENDED_IMAGE_ACCEPT,
  FORMAT_INFO,
  IMAGE_MAX_BYTES,
  IMAGE_WARN_BYTES,
  isLossy,
  mimeOf,
  resolveOutput,
  shortFormatLabel,
  type OutputChoice,
} from "@/lib/image/formats"
import { QualityField, Segmented, SelectField, Workspace, formatOptions, type Option } from "../image-shared/fields"
import { useEncodableFormats, useObjectUrls } from "../image-shared/hooks"
import { PRESETS, getPreset, type PresetId } from "./presets"

interface Source {
  file: File
  mime: string
  img: DecodedImage
}

interface Preview {
  blob: Blob
  url: string
  width: number
  height: number
  type: string
  key: string
}

const FIT_OPTIONS: Option<FitMode>[] = [
  { value: "cover", label: "Cover (crop)" },
  { value: "contain", label: "Contain (pad)" },
  { value: "stretch", label: "Stretch" },
]
const PRESET_OPTIONS: Option<PresetId>[] = PRESETS.map((p) => ({ value: p.id, label: p.label }))

function parseDim(value: string): number {
  if (!/^\d+$/.test(value.trim())) return NaN
  return Number.parseInt(value, 10)
}

export function ImageResizerTool() {
  const urls = useObjectUrls()
  const encodable = useEncodableFormats()
  const [source, setSource] = useState<Source | null>(null)
  const [loading, setLoading] = useState(false)
  const [preset, setPreset] = useState<PresetId>("custom")
  const [widthStr, setWidthStr] = useState("")
  const [heightStr, setHeightStr] = useState("")
  const [lock, setLock] = useState(true)
  const [fit, setFit] = useState<FitMode>("cover")
  const [format, setFormat] = useState<OutputChoice>("keep")
  const [quality, setQuality] = useState(90)
  const [padColor, setPadColor] = useState("#ffffff")
  const [transparentPad, setTransparentPad] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const previewUrl = useRef<string | null>(null)
  const runId = useRef(0)

  // Free decoded pixels when the image is replaced or the tool unmounts.
  useEffect(() => () => source?.img.release(), [source])

  const width = parseDim(widthStr)
  const height = parseDim(heightStr)
  const sizeError = !source
    ? null
    : !Number.isFinite(width) || !Number.isFinite(height)
      ? "Enter a whole number of pixels for width and height."
      : checkCanvasSize(width, height)

  const outType = source ? resolveOutput(format, source.mime, encodable) : "image/png"
  const lossy = isLossy(outType)
  const ratioDiffers = source ? Math.abs(width / height - source.img.width / source.img.height) > 0.005 : false
  const effectiveFit: FitMode = ratioDiffers ? fit : "stretch"
  const canBeTransparent = outType !== "image/jpeg"
  const background =
    outType === "image/jpeg" ? padColor : effectiveFit === "contain" && !transparentPad ? padColor : null

  const settingsKey = useMemo(
    () => JSON.stringify([source?.file.name, source?.file.lastModified, width, height, effectiveFit, outType, lossy ? quality : 0, background]),
    [source, width, height, effectiveFit, outType, lossy, quality, background]
  )

  // Debounced live preview.
  useEffect(() => {
    if (!source || sizeError) return
    const run = ++runId.current
    const timer = setTimeout(async () => {
      setPreviewing(true)
      try {
        const canvas = renderResized(source.img, { width, height, fit: effectiveFit, background })
        let blob: Blob
        try {
          blob = await encodeCanvas(canvas, outType, lossy ? quality / 100 : undefined)
        } finally {
          disposeCanvas(canvas)
        }
        if (run !== runId.current) return
        const url = urls.create(blob)
        urls.revoke(previewUrl.current)
        previewUrl.current = url
        setPreview({ blob, url, width, height, type: outType, key: settingsKey })
        setPreviewError(null)
      } catch (err) {
        if (run === runId.current) setPreviewError(friendlyError(err, "The preview couldn't be generated."))
      } finally {
        if (run === runId.current) setPreviewing(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [source, sizeError, width, height, effectiveFit, background, outType, lossy, quality, settingsKey, urls])

  const onFiles = async ([file]: File[]) => {
    if (!file) return
    setLoading(true)
    try {
      const img = await decodeImage(file).catch(() => {
        throw new Error("This browser can't read this image. It may be corrupted or in an unsupported format.")
      })
      setSource({ file, mime: mimeOf(file), img })
      setPreviewError(null)
      const p = getPreset(preset)
      if (p.width && p.height) {
        setWidthStr(String(p.width))
        setHeightStr(String(p.height))
      } else {
        setWidthStr(String(img.width))
        setHeightStr(String(img.height))
      }
    } catch (err) {
      toast.error("Couldn't open the image", { description: friendlyError(err) })
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    urls.revoke(previewUrl.current)
    previewUrl.current = null
    runId.current++
    setSource(null)
    setPreview(null)
    setPreviewing(false)
    setPreviewError(null)
    setPreset("custom")
  }

  const choosePreset = (id: PresetId) => {
    setPreset(id)
    const p = getPreset(id)
    if (p.width && p.height) {
      setWidthStr(String(p.width))
      setHeightStr(String(p.height))
      setLock(false)
      setFit("cover")
    } else if (source) {
      setWidthStr(String(source.img.width))
      setHeightStr(String(source.img.height))
      setLock(true)
    }
  }

  const onWidth = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 5)
    setWidthStr(clean)
    setPreset("custom")
    const w = parseDim(clean)
    if (lock && source && w > 0) setHeightStr(String(Math.max(1, Math.round((w * source.img.height) / source.img.width))))
  }
  const onHeight = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 5)
    setHeightStr(clean)
    setPreset("custom")
    const h = parseDim(clean)
    if (lock && source && h > 0) setWidthStr(String(Math.max(1, Math.round((h * source.img.width) / source.img.height))))
  }
  const toggleLock = () => {
    const next = !lock
    setLock(next)
    if (next && source && width > 0) {
      setPreset("custom")
      setHeightStr(String(Math.max(1, Math.round((width * source.img.height) / source.img.width))))
    }
  }
  const scaleBy = (factor: number) => {
    if (!source) return
    setPreset("custom")
    setLock(true)
    setWidthStr(String(Math.max(1, Math.round(source.img.width * factor))))
    setHeightStr(String(Math.max(1, Math.round(source.img.height * factor))))
  }

  const upToDate = preview !== null && preview.key === settingsKey && !sizeError
  const download = () => {
    if (!preview || !source) return
    const base = source.file.name.replace(/\.[^.]+$/, "")
    downloadBlob(preview.blob, replaceExtension(`${base}-${preview.width}x${preview.height}`, FORMAT_INFO[outType].ext))
    toast.success("Image saved")
  }

  const upscaling = source && !sizeError && (width > source.img.width || height > source.img.height)

  const main = !source ? (
    <FileDropzone
      accept={EXTENDED_IMAGE_ACCEPT}
      maxBytes={IMAGE_MAX_BYTES}
      warnBytes={IMAGE_WARN_BYTES}
      onFiles={onFiles}
      disabled={loading}
      title={loading ? "Opening image…" : "Add an image"}
      hint="JPG, PNG, WebP, GIF, BMP or AVIF"
      allowCamera
    />
  ) : (
    <section aria-labelledby="resize-preview-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 id="resize-preview-heading" className="truncate text-base font-semibold" title={source.file.name}>
            {source.file.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            Original: {source.img.width}×{source.img.height} px · {formatBytes(source.file.size)} · {shortFormatLabel(source.mime)}
          </p>
        </div>
        <Button variant="outline" onClick={reset}>
          <RefreshCw aria-hidden /> Change image
        </Button>
      </div>

      <div className="relative flex min-h-56 items-center justify-center overflow-hidden rounded-2xl border bg-checker p-3 sm:min-h-72">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob URL
          <img
            src={preview.url}
            alt={`Resized preview, ${preview.width} by ${preview.height} pixels`}
            className="max-h-[55vh] max-w-full object-contain shadow-soft"
            style={{ aspectRatio: `${preview.width} / ${preview.height}` }}
          />
        ) : (
          <ImageIcon className="size-10 text-muted-foreground" aria-hidden />
        )}
        {previewing ? (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium shadow-soft">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Updating
          </span>
        ) : null}
      </div>

      <div aria-live="polite" className="text-sm">
        {preview && upToDate ? (
          <motion.p key={preview.key} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="font-medium">
            Result: {preview.width}×{preview.height} px · {formatBytes(preview.blob.size)} · {shortFormatLabel(preview.type)}
          </motion.p>
        ) : sizeError ? null : (
          <p className="text-muted-foreground">Preparing preview…</p>
        )}
      </div>

      {previewError ? (
        <Notice tone="danger" title="Couldn't resize">
          {previewError}
        </Notice>
      ) : null}
      {upscaling ? (
        <Notice tone="warning" title="Enlarging the image">
          The new size is bigger than the original, so it may look soft or blurry.
        </Notice>
      ) : null}
    </section>
  )

  const controls = (
    <>
      <h2 className="text-base font-semibold">Size</h2>
      <SelectField label="Preset" value={preset} onChange={choosePreset} options={PRESET_OPTIONS} disabled={!source} />

      <div className="space-y-2">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="resize-width">Width (px)</Label>
            <Input
              id="resize-width"
              inputMode="numeric"
              value={widthStr}
              onChange={(e) => onWidth(e.target.value)}
              disabled={!source}
              aria-invalid={!!sizeError || undefined}
              aria-describedby={sizeError ? "resize-size-error" : undefined}
            />
          </div>
          <Button
            type="button"
            variant={lock ? "secondary" : "outline"}
            size="icon"
            onClick={toggleLock}
            disabled={!source}
            aria-pressed={lock}
            aria-label="Lock aspect ratio"
            title={lock ? "Aspect ratio locked" : "Aspect ratio unlocked"}
          >
            {lock ? <Link2 /> : <Link2Off />}
          </Button>
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="resize-height">Height (px)</Label>
            <Input
              id="resize-height"
              inputMode="numeric"
              value={heightStr}
              onChange={(e) => onHeight(e.target.value)}
              disabled={!source}
              aria-invalid={!!sizeError || undefined}
              aria-describedby={sizeError ? "resize-size-error" : undefined}
            />
          </div>
        </div>
        {sizeError ? (
          <p id="resize-size-error" className="text-sm text-destructive" role="alert">
            {sizeError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick scale">
          {[0.25, 0.5, 0.75].map((f) => (
            <Button key={f} type="button" variant="outline" className="px-3" disabled={!source} onClick={() => scaleBy(f)}>
              {f * 100}%
            </Button>
          ))}
        </div>
      </div>

      {source && ratioDiffers ? (
        <Segmented label="Fit" value={fit} onChange={setFit} options={FIT_OPTIONS} columns={3} />
      ) : null}

      {source && (outType === "image/jpeg" || effectiveFit === "contain") ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="resize-bg">{outType === "image/jpeg" ? "Background colour" : "Padding colour"}</Label>
            <input
              id="resize-bg"
              type="color"
              value={padColor}
              onChange={(e) => setPadColor(e.target.value)}
              disabled={canBeTransparent && transparentPad}
              className="h-10 w-14 cursor-pointer rounded-lg border bg-transparent p-1 disabled:opacity-50"
            />
          </div>
          {canBeTransparent && effectiveFit === "contain" ? (
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="resize-transparent">Transparent padding</Label>
              <Switch id="resize-transparent" checked={transparentPad} onCheckedChange={setTransparentPad} />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="border-t pt-5">
        <SelectField
          label="Output format"
          value={format}
          onChange={setFormat}
          options={formatOptions(encodable, true)}
          disabled={!source}
        />
      </div>
      {lossy ? <QualityField value={quality} onChange={setQuality} disabled={!source} /> : null}
    </>
  )

  const actions = source ? (
    <Button size="lg" className="w-full" onClick={download} disabled={!upToDate || previewing}>
      {previewing ? <LoaderCircle className="animate-spin" aria-hidden /> : <Download aria-hidden />}
      {upToDate && preview ? `Download ${preview.width}×${preview.height}` : sizeError ? "Fix the size to continue" : "Preparing…"}
    </Button>
  ) : null

  return <Workspace main={main} controls={controls} actions={actions} />
}
