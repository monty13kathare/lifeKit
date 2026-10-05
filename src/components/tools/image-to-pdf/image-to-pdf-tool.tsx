"use client"

import { useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Download, ExternalLink, FileText, LoaderCircle, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { FileDropzone } from "@/components/common/file-dropzone"
import { Notice } from "@/components/common/notice"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { downloadBlob, formatBytes } from "@/lib/files"
import { friendlyError, type Rotation } from "@/lib/image/canvas"
import { BASIC_IMAGE_ACCEPT, IMAGE_MAX_BYTES, IMAGE_WARN_BYTES } from "@/lib/image/formats"
import { readImageInfo } from "@/lib/image/thumbnail"
import { Segmented, SelectField, Workspace, type Option } from "../image-shared/fields"
import { nextId, useObjectUrls } from "../image-shared/hooks"
import { buildPdf, type PageMargin, type PageOrientation, type PageSize } from "./build-pdf"
import { PageGrid, type PdfItem } from "./page-grid"

const PAGE_SIZES: Option<PageSize>[] = [
  { value: "a4", label: "A4 (210 × 297 mm)" },
  { value: "letter", label: "US Letter (8.5 × 11 in)" },
  { value: "legal", label: "US Legal (8.5 × 14 in)" },
  { value: "fit", label: "Fit to image" },
]
const ORIENTATIONS: Option<PageOrientation>[] = [
  { value: "auto", label: "Auto" },
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Landscape" },
]
const MARGINS: Option<PageMargin>[] = [
  { value: "none", label: "None" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
]

interface PdfResult {
  blob: Blob
  url: string
  pages: number
  /** Snapshot of the inputs used, to detect when the result is out of date. */
  key: string
  filename: string
}

function sanitizeName(name: string) {
  const cleaned = name.replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|]+/g, "").trim()
  return cleaned || "images"
}

export function ImageToPdfTool() {
  const urls = useObjectUrls()
  const [items, setItems] = useState<PdfItem[]>([])
  const [pageSize, setPageSize] = useState<PageSize>("a4")
  const [orientation, setOrientation] = useState<PageOrientation>("portrait")
  const [margin, setMargin] = useState<PageMargin>("small")
  const [fileName, setFileName] = useState("images")
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState<PdfResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const resultRef = useRef<HTMLDivElement>(null)

  const inputKey = useMemo(
    () => JSON.stringify([items.map((i) => [i.id, i.rotation]), pageSize, orientation, margin, fileName]),
    [items, pageSize, orientation, margin, fileName]
  )
  const stale = result !== null && result.key !== inputKey
  const loadingThumbs = items.some((i) => !i.thumb)

  const addFiles = async (files: File[]) => {
    setError(null)
    const fresh: PdfItem[] = files.map((file) => ({ id: nextId("page"), file, thumb: null, width: 0, height: 0, rotation: 0 }))
    setItems((prev) => [...prev, ...fresh])
    setAnnouncement(`Added ${fresh.length} image${fresh.length === 1 ? "" : "s"}.`)
    for (const item of fresh) {
      try {
        const info = await readImageInfo(item.file)
        const thumb = urls.create(info.thumb)
        setItems((prev) => {
          if (!prev.some((p) => p.id === item.id)) {
            urls.revoke(thumb)
            return prev
          }
          return prev.map((p) => (p.id === item.id ? { ...p, thumb, width: info.width, height: info.height } : p))
        })
      } catch (err) {
        setItems((prev) => prev.filter((p) => p.id !== item.id))
        toast.error(`Couldn't read “${item.file.name}”`, { description: friendlyError(err) })
      }
    }
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setItems(next)
    setAnnouncement(`Moved ${moved.file.name} to position ${to + 1} of ${next.length}.`)
  }

  const rotate = (id: string) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, rotation: (((p.rotation + 90) % 360) as Rotation) } : p)))
  }

  const remove = (id: string) => {
    const item = items.find((p) => p.id === id)
    if (!item) return
    urls.revoke(item.thumb)
    setItems((prev) => prev.filter((p) => p.id !== id))
    setAnnouncement(`Removed ${item.file.name}.`)
  }

  const clearAll = () => {
    items.forEach((i) => urls.revoke(i.thumb))
    setItems([])
    if (result) urls.revoke(result.url)
    setResult(null)
    setError(null)
  }

  const generate = async () => {
    if (!items.length || busy) return
    setBusy(true)
    setError(null)
    setProgress({ done: 0, total: items.length })
    try {
      const { blob, pages } = await buildPdf(
        items.map((i) => ({ file: i.file, rotation: i.rotation })),
        { pageSize, orientation, margin, title: sanitizeName(fileName) },
        (done, total) => setProgress({ done, total })
      )
      if (result) urls.revoke(result.url)
      setResult({ blob, url: urls.create(blob), pages, key: inputKey, filename: `${sanitizeName(fileName)}.pdf` })
      toast.success("PDF ready", { description: `${pages} page${pages === 1 ? "" : "s"} · ${formatBytes(blob.size)}` })
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }))
    } catch (err) {
      const msg = friendlyError(err, "The PDF couldn't be created.")
      setError(msg)
      toast.error("PDF generation failed", { description: msg })
    } finally {
      setBusy(false)
    }
  }

  const download = () => {
    if (result) downloadBlob(result.blob, result.filename)
  }

  const canInlinePdf = typeof navigator !== "undefined" && navigator.pdfViewerEnabled !== false
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  const main = (
    <>
      {items.length === 0 ? (
        <FileDropzone
          multiple
          accept={BASIC_IMAGE_ACCEPT}
          maxBytes={IMAGE_MAX_BYTES}
          warnBytes={IMAGE_WARN_BYTES}
          onFiles={addFiles}
          title="Add images"
          hint="JPG, PNG or WebP · select several at once"
          allowCamera
        />
      ) : (
        <section aria-labelledby="pages-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id="pages-heading" className="text-base font-semibold">
              {items.length} page{items.length === 1 ? "" : "s"}
              <span className="ml-2 hidden text-sm font-normal text-muted-foreground lg:inline">Drag to reorder</span>
            </h2>
            <Button type="button" variant="ghost" onClick={clearAll} disabled={busy}>
              <Trash2 aria-hidden /> Clear all
            </Button>
          </div>
          <PageGrid items={items} disabled={busy} onMove={move} onRotate={rotate} onRemove={remove} />
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
        </section>
      )}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {error ? (
        <Notice tone="danger" title="Couldn't create the PDF">
          {error}
        </Notice>
      ) : null}

      {result ? (
        <motion.section
          ref={resultRef}
          aria-labelledby="result-heading"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="scroll-mt-4 space-y-3 rounded-2xl border bg-card p-4 shadow-soft"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
                <FileText className="size-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 id="result-heading" className="truncate text-sm font-semibold">
                  {result.filename}
                </h2>
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {result.pages} page{result.pages === 1 ? "" : "s"} · {formatBytes(result.blob.size)}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              render={<a href={result.url} target="_blank" rel="noopener noreferrer" />}
              nativeButton={false}
            >
              <ExternalLink aria-hidden /> Open
            </Button>
          </div>
          {stale ? (
            <Notice tone="warning" title="Your changes aren't in this PDF yet">
              Generate again to apply the latest pages and settings.
            </Notice>
          ) : null}
          {canInlinePdf ? (
            <iframe
              src={result.url}
              title="PDF preview"
              className="h-[60vh] max-h-[640px] min-h-80 w-full rounded-xl border bg-surface-muted"
            />
          ) : (
            <Notice tone="info" title="Preview isn't available in this browser">
              Your browser doesn&apos;t support inline PDF previews. Use the Download or Open buttons above to view the generated document.
            </Notice>
          )}
        </motion.section>
      ) : null}
    </>
  )

  const controls = (
    <>
      <h2 className="text-base font-semibold">Page settings</h2>
      <SelectField label="Page size" value={pageSize} onChange={setPageSize} options={PAGE_SIZES} disabled={busy} />
      {pageSize !== "fit" ? (
        <Segmented label="Orientation" value={orientation} onChange={setOrientation} options={ORIENTATIONS} disabled={busy} />
      ) : (
        <p className="text-xs text-muted-foreground">Each page takes the exact shape of its image.</p>
      )}
      <Segmented label="Margins" value={margin} onChange={setMargin} options={MARGINS} disabled={busy} />
      <div className="space-y-2">
        <Label htmlFor="pdf-file-name">File name</Label>
        <div className="flex items-center gap-2">
          <Input
            id="pdf-file-name"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            maxLength={80}
            autoComplete="off"
            disabled={busy}
          />
          <span className="text-sm text-muted-foreground">.pdf</span>
        </div>
      </div>
      {orientation === "auto" && pageSize !== "fit" ? (
        <p className="text-xs text-muted-foreground">Auto turns wide images into landscape pages.</p>
      ) : null}
    </>
  )

  const showDownload = result && !stale && !busy
  const actions =
    items.length === 0 ? null : (
      <>
        {busy ? (
          <div aria-live="polite" className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span>
                Adding image {Math.min(progress.done + 1, progress.total)} of {progress.total}…
              </span>
              <span className="tabular-nums text-muted-foreground">{pct}%</span>
            </div>
            <Progress value={pct} aria-label="PDF generation progress" />
          </div>
        ) : null}
        {showDownload ? (
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={download}>
              <Download aria-hidden /> Download PDF
            </Button>
            <Button size="lg" variant="outline" onClick={generate} aria-label="Generate again">
              <RefreshCw aria-hidden />
              <span className="hidden sm:inline lg:hidden xl:inline">Regenerate</span>
            </Button>
          </div>
        ) : (
          <Button size="lg" className="w-full" onClick={generate} disabled={busy || loadingThumbs}>
            {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <FileText aria-hidden />}
            {busy ? "Creating PDF…" : loadingThumbs ? "Reading images…" : `Create PDF (${items.length} page${items.length === 1 ? "" : "s"})`}
          </Button>
        )}
      </>
    )

  return <Workspace main={main} controls={controls} actions={actions} />
}
