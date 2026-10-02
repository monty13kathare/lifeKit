"use client"

import { useEffect, useId, useState } from "react"
import { Download, ExternalLink, FileText, Loader2, Share2 } from "lucide-react"
import { toast } from "sonner"
import { Notice } from "@/components/common/notice"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { downloadBlob, formatBytes } from "@/lib/files"
import { buildPdf, type PageSize, type PdfQuality, type ScanPage } from "@/lib/scanner/pipeline"

const SIZE_ITEMS: { value: PageSize; label: string }[] = [
  { value: "a4", label: "A4" },
  { value: "letter", label: "US Letter" },
  { value: "fit", label: "Fit to image" },
]
const QUALITY_ITEMS: { value: PdfQuality; label: string }[] = [
  { value: "high", label: "High quality" },
  { value: "balanced", label: "Balanced" },
  { value: "small", label: "Smallest file" },
]

function defaultName() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `Scan ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}.${pad(d.getMinutes())}`
}

interface ExportPanelProps {
  pages: ScanPage[]
}

export function ExportPanel({ pages }: ExportPanelProps) {
  const [size, setSize] = useState<PageSize>("a4")
  const [quality, setQuality] = useState<PdfQuality>("balanced")
  const [name, setName] = useState(defaultName)
  const [progress, setProgress] = useState<number | null>(null)
  const [result, setResult] = useState<{ blob: Blob; url: string; key: string } | null>(null)
  const [error, setError] = useState("")
  const sizeId = useId()
  const qualityId = useId()
  const nameId = useId()

  const ready = pages.filter((p) => p.status === "ready" && p.processed)
  const pending = pages.length - ready.length
  // a generated PDF is stale once pages or options change
  const key = `${ready.map((p) => `${p.id}:${p.processed?.size}`).join("|")}|${size}|${quality}`
  const current = result && result.key === key ? result : null

  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url)
  }, [result])

  const filename = `${(name.trim() || "Scan").replace(/[\\/:*?"<>|]+/g, "-")}.pdf`

  const generate = async () => {
    setError("")
    setProgress(0)
    try {
      const blob = await buildPdf(
        ready.map((p) => ({ blob: p.processed!, width: p.processedW ?? 0, height: p.processedH ?? 0 })),
        { size, quality, title: name.trim() || "Scan" },
        (done, total) => setProgress(Math.round((done / total) * 100))
      )
      setResult({ blob, url: URL.createObjectURL(blob), key })
      toast.success(`PDF ready — ${ready.length} page${ready.length === 1 ? "" : "s"}, ${formatBytes(blob.size)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "The PDF couldn't be created.")
    } finally {
      setProgress(null)
    }
  }

  const file = current ? new File([current.blob], filename, { type: "application/pdf" }) : null
  const canShare =
    !!file && typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })

  const share = async () => {
    if (!file) return
    try {
      await navigator.share({ files: [file], title: filename })
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) toast.error("Sharing failed. Download the PDF instead.")
    }
  }

  return (
    <section aria-labelledby={`${nameId}-h`} className="space-y-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex items-center gap-2">
        <FileText className="size-5 text-primary" aria-hidden />
        <h2 id={`${nameId}-h`} className="text-base font-semibold">
          Create PDF
        </h2>
        <span className="ml-auto text-sm text-muted-foreground">
          {ready.length} page{ready.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-3">
          <Label htmlFor={nameId}>File name</Label>
          <Input id={nameId} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label id={sizeId}>Page size</Label>
          <Select items={SIZE_ITEMS} value={size} onValueChange={(v) => v && setSize(v as PageSize)}>
            <SelectTrigger className="w-full" aria-labelledby={sizeId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIZE_ITEMS.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label id={qualityId}>Quality</Label>
          <Select items={QUALITY_ITEMS} value={quality} onValueChange={(v) => v && setQuality(v as PdfQuality)}>
            <SelectTrigger className="w-full" aria-labelledby={qualityId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUALITY_ITEMS.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {pending > 0 && (
        <Notice tone="warning">
          {pending} page{pending === 1 ? " isn't" : "s aren't"} ready yet and won&apos;t be included until processed.
        </Notice>
      )}
      {error && (
        <Notice tone="danger" title="Couldn't create the PDF">
          {error}
        </Notice>
      )}

      {progress !== null ? (
        <div aria-live="polite" className="space-y-2">
          <p className="text-sm text-muted-foreground">Building PDF… {progress}%</p>
          <Progress value={progress} aria-label="PDF progress" />
        </div>
      ) : current ? (
        <div className="space-y-3">
          <Notice tone="success" title="Your PDF is ready">
            {filename} · {formatBytes(current.blob.size)}
          </Notice>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" className="flex-1 sm:flex-none" onClick={() => downloadBlob(current.blob, filename)}>
              <Download aria-hidden /> Download
            </Button>
            {canShare && (
              <Button size="lg" variant="outline" className="flex-1 sm:flex-none" onClick={share}>
                <Share2 aria-hidden /> Share
              </Button>
            )}
            <Button
              size="lg"
              variant="ghost"
              render={<a href={current.url} target="_blank" rel="noopener noreferrer" />}
              nativeButton={false}
            >
              <ExternalLink aria-hidden /> Preview
            </Button>
          </div>
          <iframe
            src={current.url}
            title="PDF preview"
            className="hidden h-[480px] w-full rounded-xl border bg-surface-muted lg:block"
          />
        </div>
      ) : (
        <Button size="lg" className="w-full" disabled={!ready.length} onClick={generate}>
          {progress !== null ? <Loader2 className="animate-spin" aria-hidden /> : <FileText aria-hidden />}
          Generate PDF
        </Button>
      )}
    </section>
  )
}
