"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Archive, ArrowRight, CircleAlert, Download, LoaderCircle, Repeat2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { FileDropzone } from "@/components/common/file-dropzone"
import { Notice } from "@/components/common/notice"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { downloadBlob, formatBytes, replaceExtension } from "@/lib/files"
import { decodeImage, disposeCanvas, encodeCanvas, friendlyError, removeWhiteBackground, renderResized } from "@/lib/image/canvas"
import {
  EXTENDED_IMAGE_ACCEPT,
  FORMAT_INFO,
  IMAGE_MAX_BYTES,
  IMAGE_WARN_BYTES,
  isLossy,
  mimeOf,
  shortFormatLabel,
  type ImageMime,
} from "@/lib/image/formats"
import { readImageInfo } from "@/lib/image/thumbnail"
import { zipBlobs } from "@/lib/image/zip"
import { QualityField, Segmented, Workspace, type Option } from "../image-shared/fields"
import { nextId, useEncodableFormats, useObjectUrls } from "../image-shared/hooks"

interface ConvertItem {
  id: string
  file: File
  mime: string
  thumb: string | null
  width: number
  height: number
  status: "reading" | "ready" | "working" | "done" | "error"
  error?: string
  result?: { blob: Blob; url: string; key: string; type: ImageMime }
}

function outputName(file: File, type: ImageMime) {
  return replaceExtension(file.name, FORMAT_INFO[type].ext)
}

export function ImageConverterTool() {
  const urls = useObjectUrls()
  const encodable = useEncodableFormats()
  const [items, setItems] = useState<ConvertItem[]>([])
  const [formatChoice, setFormatChoice] = useState<ImageMime | null>(null)
  const [quality, setQuality] = useState(90)
  const [background, setBackground] = useState("#ffffff")
  const [removeWhite, setRemoveWhite] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [zipping, setZipping] = useState(false)
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  // Default to WebP where supported; fall back to JPG.
  const format: ImageMime =
    formatChoice && encodable.includes(formatChoice) ? formatChoice : encodable.includes("image/webp") ? "image/webp" : "image/jpeg"
  const lossy = isLossy(format)
  const settingsKey = JSON.stringify([format, lossy ? quality : 0, format === "image/jpeg" ? background : null, removeWhite])
  const formatOpts: Option<ImageMime>[] = useMemo(
    () => encodable.map((m) => ({ value: m, label: FORMAT_INFO[m].label })),
    [encodable]
  )

  const patch = (id: string, p: Partial<ConvertItem>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)))

  const addFiles = async (files: File[]) => {
    const fresh: ConvertItem[] = files.map((file) => ({
      id: nextId("cnv"),
      file,
      mime: mimeOf(file),
      thumb: null,
      width: 0,
      height: 0,
      status: "reading",
    }))
    setItems((prev) => [...prev, ...fresh])
    for (const item of fresh) {
      try {
        const info = await readImageInfo(item.file, 400, true)
        if (!itemsRef.current.some((i) => i.id === item.id)) {
          // Removed while reading.
          continue
        }
        const thumb = urls.create(info.thumb)
        patch(item.id, { thumb, width: info.width, height: info.height, status: "ready" })
      } catch {
        patch(item.id, {
          status: "error",
          error: `This browser can't read ${shortFormatLabel(item.mime)} images.`,
        })
      }
    }
  }

  const remove = (id: string) => {
    const item = items.find((i) => i.id === id)
    if (!item) return
    urls.revoke(item.thumb)
    urls.revoke(item.result?.url)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const clearAll = () => {
    items.forEach((i) => {
      urls.revoke(i.thumb)
      urls.revoke(i.result?.url)
    })
    setItems([])
  }

  const pending = items.filter((i) => i.status === "ready" || (i.status === "done" && i.result?.key !== settingsKey))
  const done = items.filter((i) => i.status === "done" && i.result?.key === settingsKey)
  const reading = items.some((i) => i.status === "reading")
  const hasGif = items.some((i) => i.mime === "image/gif")

  const convertAll = async () => {
    if (busy || !pending.length) return
    const queue = pending
    const key = settingsKey
    const type = format
    setBusy(true)
    setProgress({ done: 0, total: queue.length })
    let failures = 0
    for (let n = 0; n < queue.length; n++) {
      const item = queue[n]
      setProgress({ done: n, total: queue.length })
      if (!itemsRef.current.some((i) => i.id === item.id)) continue
      patch(item.id, { status: "working", error: undefined })
      await new Promise((r) => setTimeout(r, 0))
      try {
        const img = await decodeImage(item.file).catch(() => {
          throw new Error(`This browser can't read ${shortFormatLabel(item.mime)} images.`)
        })
        let blob: Blob
        try {
          const canvas = renderResized(img, {
            width: img.width,
            height: img.height,
            fit: "stretch",
            background: type === "image/jpeg" ? background : null,
          })
          if (removeWhite && type !== "image/jpeg") {
            removeWhiteBackground(canvas)
          }
          try {
            blob = await encodeCanvas(canvas, type, isLossy(type) ? quality / 100 : undefined)
          } finally {
            disposeCanvas(canvas)
          }
        } finally {
          img.release()
        }
        const prevUrl = itemsRef.current.find((i) => i.id === item.id)?.result?.url
        if (!itemsRef.current.some((i) => i.id === item.id)) continue
        const url = urls.create(blob)
        urls.revoke(prevUrl)
        patch(item.id, { status: "done", result: { blob, url, key, type } })
      } catch (err) {
        failures++
        patch(item.id, { status: "error", error: friendlyError(err, "Conversion failed.") })
      }
    }
    setProgress({ done: queue.length, total: queue.length })
    setBusy(false)
    if (failures) toast.error(`${failures} image${failures === 1 ? "" : "s"} couldn't be converted`)
    else toast.success(`Converted to ${FORMAT_INFO[type].label}`)
  }

  const downloadAll = async () => {
    if (!done.length || zipping) return
    if (done.length === 1) {
      const it = done[0]
      downloadBlob(it.result!.blob, outputName(it.file, it.result!.type))
      return
    }
    setZipping(true)
    try {
      const zip = await zipBlobs(done.map((i) => ({ name: outputName(i.file, i.result!.type), blob: i.result!.blob })))
      downloadBlob(zip, `converted-${FORMAT_INFO[format].ext}.zip`)
      toast.success("ZIP downloaded")
    } catch (err) {
      toast.error("Couldn't create the ZIP", { description: friendlyError(err) })
    } finally {
      setZipping(false)
    }
  }

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  const main =
    items.length === 0 ? (
      <FileDropzone
        multiple
        accept={EXTENDED_IMAGE_ACCEPT}
        maxBytes={IMAGE_MAX_BYTES}
        warnBytes={IMAGE_WARN_BYTES}
        onFiles={addFiles}
        title="Add images to convert"
        hint="JPG, PNG, WebP, GIF, BMP or AVIF"
      />
    ) : (
      <section aria-labelledby="cnv-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="cnv-heading" className="text-base font-semibold">
            {items.length} image{items.length === 1 ? "" : "s"}
          </h2>
          <Button variant="ghost" onClick={clearAll} disabled={busy}>
            <Trash2 aria-hidden /> Clear all
          </Button>
        </div>
        <div className="@container">
          <ul className="grid grid-cols-2 gap-2.5 @lg:grid-cols-3 @3xl:grid-cols-4" aria-label="Images">
            <AnimatePresence initial={false}>
              {items.map((item) => {
                const r = item.result && item.result.key === settingsKey ? item.result : undefined
                return (
                  <motion.li
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.18 }}
                    className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-soft"
                  >
                    <div className="relative flex aspect-square items-center justify-center bg-checker">
                      {item.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element -- local blob URL
                        <img
                          src={r?.url ?? item.thumb}
                          alt={item.file.name}
                          className="max-h-full max-w-full object-contain"
                          loading="lazy"
                        />
                      ) : item.status === "error" ? (
                        <CircleAlert className="size-7 text-destructive" aria-hidden />
                      ) : (
                        <LoaderCircle className="size-6 animate-spin text-muted-foreground" aria-label="Reading image" />
                      )}
                      {item.status === "working" ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                          <LoaderCircle className="size-6 animate-spin" aria-label="Converting" />
                        </div>
                      ) : null}
                      {r ? (
                        <span className="absolute top-1.5 left-1.5 rounded-md bg-success px-1.5 py-0.5 text-[0.7rem] font-semibold text-success-foreground">
                          {FORMAT_INFO[r.type].label}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1 p-2">
                      <p className="truncate text-xs font-medium" title={item.file.name}>
                        {item.file.name}
                      </p>
                      <p className="text-[0.7rem] leading-snug text-muted-foreground">
                        {item.status === "error" ? (
                          <span className="text-destructive">{item.error}</span>
                        ) : r ? (
                          <>
                            {shortFormatLabel(item.mime)} {formatBytes(item.file.size)}
                            <ArrowRight className="mx-0.5 inline size-3" aria-label="to" />
                            <span className="font-medium text-foreground">
                              {FORMAT_INFO[r.type].label} {formatBytes(r.blob.size)}
                            </span>
                          </>
                        ) : (
                          <>
                            {shortFormatLabel(item.mime)} · {formatBytes(item.file.size)}
                            {item.width ? ` · ${item.width}×${item.height}` : ""}
                          </>
                        )}
                      </p>
                      <div className="mt-auto flex items-center justify-between">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={!r || busy}
                          onClick={() => r && downloadBlob(r.blob, outputName(item.file, r.type))}
                          aria-label={`Download ${item.file.name} as ${FORMAT_INFO[format].label}`}
                        >
                          <Download />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={item.status === "working"}
                          onClick={() => remove(item.id)}
                          aria-label={`Remove ${item.file.name}`}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        </div>
        <FileDropzone
          compact
          multiple
          accept={EXTENDED_IMAGE_ACCEPT}
          maxBytes={IMAGE_MAX_BYTES}
          warnBytes={IMAGE_WARN_BYTES}
          onFiles={addFiles}
          title="Add more images"
          disabled={busy}
        />
        {hasGif ? (
          <Notice tone="info" title="Animated GIFs">
            Only the first frame of a GIF is converted.
          </Notice>
        ) : null}
      </section>
    )

  const controls = (
    <>
      <h2 className="text-base font-semibold">Convert to</h2>
      <Segmented label="Output format" value={format} onChange={setFormatChoice} options={formatOpts} disabled={busy} />
      {!encodable.includes("image/webp") ? (
        <p className="text-xs text-muted-foreground">This browser can&apos;t create WebP files — update it or try Chrome, Edge or Firefox.</p>
      ) : null}
      {lossy ? <QualityField value={quality} onChange={setQuality} disabled={busy} /> : null}
      {format === "image/jpeg" ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="cnv-bg">Background colour</Label>
            <input
              id="cnv-bg"
              type="color"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              disabled={busy}
              className="h-10 w-14 cursor-pointer rounded-lg border bg-transparent p-1"
            />
          </div>
          <p className="text-xs text-muted-foreground">JPG has no transparency — transparent areas are filled with this colour.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="cnv-remove-white">Remove white background</Label>
              <p className="text-xs text-muted-foreground">Useful for turning logos into transparent PNGs.</p>
            </div>
            <Switch id="cnv-remove-white" checked={removeWhite} onCheckedChange={setRemoveWhite} disabled={busy} />
          </div>
          {format === "image/png" ? (
            <p className="text-xs text-muted-foreground">PNG is lossless and keeps transparency. Files can be larger than JPG or WebP.</p>
          ) : null}
        </div>
      )}
    </>
  )

  const allDone = items.length > 0 && pending.length === 0 && !busy && !reading
  const actions =
    items.length === 0 ? null : (
      <>
        {busy ? (
          <div aria-live="polite" className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span>
                Converting {Math.min(progress.done + 1, progress.total)} of {progress.total}…
              </span>
              <span className="tabular-nums text-muted-foreground">{pct}%</span>
            </div>
            <Progress value={pct} aria-label="Conversion progress" />
          </div>
        ) : null}
        {allDone ? (
          <Button size="lg" className="w-full" onClick={downloadAll} disabled={zipping || !done.length}>
            {zipping ? <LoaderCircle className="animate-spin" aria-hidden /> : done.length > 1 ? <Archive aria-hidden /> : <Download aria-hidden />}
            {zipping ? "Creating ZIP…" : done.length > 1 ? "Download all (ZIP)" : done.length === 1 ? "Download" : "Nothing to download"}
          </Button>
        ) : (
          <Button size="lg" className="w-full" onClick={convertAll} disabled={busy || reading || !pending.length}>
            {busy || reading ? <LoaderCircle className="animate-spin" aria-hidden /> : <Repeat2 aria-hidden />}
            {busy
              ? "Converting…"
              : reading
                ? "Reading images…"
                : `Convert ${pending.length} to ${FORMAT_INFO[format].label}`}
          </Button>
        )}
      </>
    )

  return <Workspace main={main} controls={controls} actions={actions} />
}
