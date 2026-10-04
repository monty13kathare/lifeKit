"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence } from "framer-motion"
import { Archive, Download, LoaderCircle, Minimize2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { FileDropzone } from "@/components/common/file-dropzone"
import { Notice } from "@/components/common/notice"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { downloadBlob, formatBytes, replaceExtension } from "@/lib/files"
import { friendlyError } from "@/lib/image/canvas"
import {
  BASIC_IMAGE_ACCEPT,
  FORMAT_INFO,
  IMAGE_MAX_BYTES,
  IMAGE_WARN_BYTES,
  isLossy,
  mimeOf,
  percentSaved,
  resolveOutput,
  type ImageMime,
  type OutputChoice,
} from "@/lib/image/formats"
import { zipBlobs } from "@/lib/image/zip"
import { CompareSlider } from "../image-shared/compare-slider"
import { QualityField, Segmented, SelectField, Workspace, formatOptions, type Option } from "../image-shared/fields"
import { nextId, useEncodableFormats, useObjectUrls } from "../image-shared/hooks"
import { CompressItemRow, type CompressItem } from "./compress-item-row"

type SizeUnit = "KB" | "MB"
type MaxDim = "original" | "3840" | "2560" | "1920" | "1280"

const UNIT_OPTIONS: Option<SizeUnit>[] = [
  { value: "KB", label: "KB" },
  { value: "MB", label: "MB" },
]
const MAX_DIM_OPTIONS: Option<MaxDim>[] = [
  { value: "original", label: "Keep original dimensions" },
  { value: "3840", label: "Max 3840 px (4K)" },
  { value: "2560", label: "Max 2560 px" },
  { value: "1920", label: "Max 1920 px (Full HD)" },
  { value: "1280", label: "Max 1280 px" },
]

function outputName(file: File, type: ImageMime) {
  const base = file.name.replace(/\.[^.]+$/, "")
  return replaceExtension(`${base}-compressed`, FORMAT_INFO[type].ext)
}

export function ImageCompressorTool() {
  const urls = useObjectUrls()
  const allEncodable = useEncodableFormats()
  // browser-image-compression handles JPG/PNG/WebP; AVIF is left to the converter.
  const encodable = useMemo(() => allEncodable.filter((m) => m !== "image/avif"), [allEncodable])

  const [items, setItems] = useState<CompressItem[]>([])
  const [quality, setQuality] = useState(75)
  const [useTarget, setUseTarget] = useState(false)
  const [targetStr, setTargetStr] = useState("500")
  const [unit, setUnit] = useState<SizeUnit>("KB")
  const [format, setFormat] = useState<OutputChoice>("keep")
  const [maxDim, setMaxDim] = useState<MaxDim>("original")
  const [busy, setBusy] = useState(false)
  const [zipping, setZipping] = useState(false)
  const [compareId, setCompareId] = useState<string | null>(null)
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const target = Number.parseFloat(targetStr)
  const targetMB = useTarget && Number.isFinite(target) && target > 0 ? (unit === "MB" ? target : target / 1024) : null
  const targetError = useTarget && targetMB === null ? "Enter a target size greater than 0." : null
  const settingsKey = JSON.stringify([quality, targetMB, format, maxDim])

  const needsWork = items.filter((i) => i.status !== "working" && (!i.result || i.result.key !== settingsKey))
  const done = items.filter((i) => i.result && i.result.key === settingsKey)
  const totalBefore = done.reduce((s, i) => s + i.file.size, 0)
  const totalAfter = done.reduce((s, i) => s + Math.min(i.result!.blob.size, i.file.size), 0)
  const compareItem = items.find((i) => i.id === compareId && i.result)

  const patch = (id: string, p: Partial<CompressItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)))

  const addFiles = (files: File[]) => {
    const fresh: CompressItem[] = files.map((file) => ({
      id: nextId("cmp"),
      file,
      mime: mimeOf(file),
      url: urls.create(file),
      status: "pending",
      progress: 0,
    }))
    setItems((prev) => [...prev, ...fresh])
  }

  const remove = (id: string) => {
    const item = items.find((i) => i.id === id)
    if (!item) return
    urls.revoke(item.url)
    urls.revoke(item.result?.url)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const clearAll = () => {
    if (busy) return
    items.forEach((i) => {
      urls.revoke(i.url)
      urls.revoke(i.result?.url)
    })
    setItems([])
  }

  const compressAll = async () => {
    if (busy || targetError) return
    const queue = needsWork
    if (!queue.length) return
    setBusy(true)
    const key = settingsKey
    let failures = 0
    let overTarget = 0
    let imageCompression: typeof import("browser-image-compression").default
    try {
      imageCompression = (await import("browser-image-compression")).default
    } catch {
      toast.error("The compressor couldn't load. Check your connection and try again.")
      setBusy(false)
      return
    }
    for (const item of queue) {
      if (!itemsRef.current.some((i) => i.id === item.id)) continue
      patch(item.id, { status: "working", progress: 0, error: undefined })
      try {
        const outType = resolveOutput(format, item.mime, encodable)
        // The library rejects files whose MIME type is empty; restore it from the extension.
        const input = item.file.type ? item.file : new File([item.file], item.file.name, { type: item.mime })
        const out = await imageCompression(input, {
          useWebWorker: true,
          // Self-hosted copy so the worker never fetches code from a CDN.
          libURL: "/vendor/browser-image-compression.js",
          initialQuality: quality / 100,
          maxSizeMB: targetMB ?? undefined,
          maxWidthOrHeight: maxDim === "original" ? undefined : Number(maxDim),
          fileType: outType,
          maxIteration: targetMB ? 20 : 10,
          alwaysKeepResolution: targetMB === null,
          onProgress: (p) => patch(item.id, { progress: p }),
        })
        const blob = new Blob([out], { type: outType })
        if (targetMB && blob.size > targetMB * 1024 * 1024) overTarget++
        const prevUrl = itemsRef.current.find((i) => i.id === item.id)?.result?.url
        if (!itemsRef.current.some((i) => i.id === item.id)) continue
        const url = urls.create(blob)
        urls.revoke(prevUrl)
        patch(item.id, { status: "done", progress: 100, result: { blob, url, key, type: outType } })
      } catch (err) {
        failures++
        patch(item.id, { status: "error", error: friendlyError(err, "Couldn't compress this image.") })
      }
    }
    setBusy(false)
    if (failures) toast.error(`${failures} image${failures === 1 ? "" : "s"} couldn't be compressed`)
    else if (overTarget)
      toast.warning(`${overTarget} image${overTarget === 1 ? "" : "s"} couldn't reach the target size`, {
        description: "They were compressed as far as possible. Try a larger target or smaller dimensions.",
      })
    else toast.success(queue.length === 1 ? "Image compressed" : `${queue.length} images compressed`)
  }

  const downloadOne = (item: CompressItem, useOriginal: boolean) => {
    if (useOriginal) downloadBlob(item.file, item.file.name)
    else if (item.result) downloadBlob(item.result.blob, outputName(item.file, item.result.type as ImageMime))
  }

  const downloadAll = async () => {
    if (!done.length || zipping) return
    if (done.length === 1) {
      const it = done[0]
      downloadOne(it, it.result!.blob.size >= it.file.size)
      return
    }
    setZipping(true)
    try {
      const zip = await zipBlobs(
        done.map((i) => {
          const bigger = i.result!.blob.size >= i.file.size
          return bigger
            ? { name: i.file.name, blob: i.file }
            : { name: outputName(i.file, i.result!.type as ImageMime), blob: i.result!.blob }
        })
      )
      downloadBlob(zip, "compressed-images.zip")
      toast.success("ZIP downloaded")
    } catch (err) {
      toast.error("Couldn't create the ZIP", { description: friendlyError(err) })
    } finally {
      setZipping(false)
    }
  }

  const resolvedLossy = format === "keep" ? true : isLossy(format)

  const main = (
    <>
      {items.length === 0 ? (
        <FileDropzone
          multiple
          accept={BASIC_IMAGE_ACCEPT}
          maxBytes={IMAGE_MAX_BYTES}
          warnBytes={IMAGE_WARN_BYTES}
          onFiles={addFiles}
          title="Add images to compress"
          hint="JPG, PNG or WebP · batch supported"
        />
      ) : (
        <section aria-labelledby="cmp-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id="cmp-heading" className="text-base font-semibold">
              {items.length} image{items.length === 1 ? "" : "s"}
            </h2>
            <Button variant="ghost" onClick={clearAll} disabled={busy}>
              <Trash2 aria-hidden /> Clear all
            </Button>
          </div>
          {done.length > 0 ? (
            <div aria-live="polite" className="rounded-xl border border-success/30 bg-success/8 p-3 text-sm">
              <span className="font-medium">
                {formatBytes(totalBefore)} → {formatBytes(totalAfter)}
              </span>
              <span className="text-muted-foreground"> · </span>
              <span className="font-medium text-success">Saved {Math.max(0, percentSaved(totalBefore, totalAfter))}%</span>
              <span className="text-muted-foreground">
                {" "}
                across {done.length} image{done.length === 1 ? "" : "s"}
              </span>
            </div>
          ) : null}
          <ul className="space-y-2" aria-label="Images">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <CompressItemRow
                  key={item.id}
                  item={item}
                  stale={!!item.result && item.result.key !== settingsKey}
                  busy={busy}
                  onCompare={() => setCompareId(item.id)}
                  onDownload={(orig) => downloadOne(item, orig)}
                  onRemove={() => remove(item.id)}
                />
              ))}
            </AnimatePresence>
          </ul>
          <FileDropzone
            compact
            multiple
            accept={BASIC_IMAGE_ACCEPT}
            maxBytes={IMAGE_MAX_BYTES}
            warnBytes={IMAGE_WARN_BYTES}
            onFiles={addFiles}
            title="Add more images"
            disabled={busy}
          />
          {done.length > 0 ? (
            <p className="text-xs text-muted-foreground">Tap a thumbnail to compare before and after.</p>
          ) : null}
          {items.some((i) => i.status === "error") && !busy ? (
            <Notice tone="danger" title="Some images couldn't be compressed">
              They may be corrupted or use a format this browser can&apos;t read. Remove them or try again.
            </Notice>
          ) : null}
        </section>
      )}
    </>
  )

  const controls = (
    <>
      <h2 className="text-base font-semibold">Compression</h2>
      <QualityField
        value={quality}
        onChange={setQuality}
        disabled={busy}
        hint={
          resolvedLossy
            ? "Lower quality = smaller files. 60–80% is a good balance for photos."
            : "PNG stays lossless in format but reduces colours — lower values shrink more."
        }
      />
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="cmp-target">Target file size</Label>
          <Switch id="cmp-target" checked={useTarget} onCheckedChange={setUseTarget} disabled={busy} />
        </div>
        {useTarget ? (
          <div className="space-y-2">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Label htmlFor="cmp-target-value" className="sr-only">
                  Maximum size per image
                </Label>
                <Input
                  id="cmp-target-value"
                  inputMode="decimal"
                  value={targetStr}
                  onChange={(e) => setTargetStr(e.target.value.replace(/[^\d.]/g, "").slice(0, 8))}
                  aria-invalid={!!targetError || undefined}
                  aria-describedby="cmp-target-help"
                  disabled={busy}
                />
              </div>
              <Segmented label="Unit" value={unit} onChange={setUnit} options={UNIT_OPTIONS} className="w-32 [&_legend]:sr-only" disabled={busy} />
            </div>
            <p id="cmp-target-help" className={targetError ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>
              {targetError ?? "Quality is lowered (and dimensions reduced slightly if needed) until each image fits."}
            </p>
          </div>
        ) : null}
      </div>
      <SelectField label="Output format" value={format} onChange={setFormat} options={formatOptions(encodable, true)} disabled={busy} />
      <SelectField label="Dimensions" value={maxDim} onChange={setMaxDim} options={MAX_DIM_OPTIONS} disabled={busy} />
    </>
  )

  const allDone = items.length > 0 && needsWork.length === 0 && !busy
  const actions =
    items.length === 0 ? null : allDone ? (
      <Button size="lg" className="w-full" onClick={downloadAll} disabled={zipping || !done.length}>
        {zipping ? <LoaderCircle className="animate-spin" aria-hidden /> : done.length > 1 ? <Archive aria-hidden /> : <Download aria-hidden />}
        {zipping ? "Creating ZIP…" : done.length > 1 ? `Download all (ZIP)` : "Download"}
      </Button>
    ) : (
      <>
        <Button size="lg" className="w-full" onClick={compressAll} disabled={busy || !!targetError}>
          {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Minimize2 aria-hidden />}
          {busy ? "Compressing…" : `Compress ${needsWork.length} image${needsWork.length === 1 ? "" : "s"}`}
        </Button>
        {done.length > 1 && !busy ? (
          <Button variant="outline" className="w-full" onClick={downloadAll} disabled={zipping}>
            <Archive aria-hidden /> Download {done.length} finished (ZIP)
          </Button>
        ) : null}
      </>
    )

  return (
    <>
      <Workspace main={main} controls={controls} actions={actions} />
      <ResponsiveSheet
        open={!!compareItem}
        onOpenChange={(o) => !o && setCompareId(null)}
        title="Before and after"
        description={compareItem?.file.name}
        size="lg"
      >
        {compareItem?.result ? (
          <div className="space-y-3">
            <CompareSlider before={compareItem.url} after={compareItem.result.url} beforeLabel="Original" afterLabel="Compressed" />
            <p className="text-center text-sm">
              Original {formatBytes(compareItem.file.size)} → Compressed {formatBytes(compareItem.result.blob.size)} ·{" "}
              {compareItem.result.blob.size >= compareItem.file.size ? (
                <span className="text-warning-foreground dark:text-warning">No saving</span>
              ) : (
                <span className="text-success">Saved {percentSaved(compareItem.file.size, compareItem.result.blob.size)}%</span>
              )}
            </p>
          </div>
        ) : null}
      </ResponsiveSheet>
    </>
  )
}
