"use client"

import { motion } from "framer-motion"
import { CircleAlert, Columns2, Download, LoaderCircle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { formatBytes } from "@/lib/files"
import { percentSaved } from "@/lib/image/formats"
import { cn } from "@/lib/utils"

export interface CompressResult {
  blob: Blob
  url: string
  key: string
  type: string
}

export interface CompressItem {
  id: string
  file: File
  mime: string
  /** Object URL of the original file. */
  url: string
  status: "pending" | "working" | "done" | "error"
  progress: number
  result?: CompressResult
  error?: string
}

interface RowProps {
  item: CompressItem
  stale: boolean
  busy: boolean
  onCompare: () => void
  onDownload: (useOriginal: boolean) => void
  onRemove: () => void
}

export function CompressItemRow({ item, stale, busy, onCompare, onDownload, onRemove }: RowProps) {
  const r = item.result
  const bigger = r ? r.blob.size >= item.file.size : false
  const saved = r ? percentSaved(item.file.size, r.blob.size) : 0

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className="list-none rounded-xl border bg-card p-2.5 shadow-soft"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCompare}
          disabled={!r}
          className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-checker outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default"
          aria-label={r ? `Compare before and after for ${item.file.name}` : undefined}
          tabIndex={r ? 0 : -1}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
          <img src={r?.url ?? item.url} alt="" className="size-full object-cover" loading="lazy" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={item.file.name}>
            {item.file.name}
          </p>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {item.status === "working" ? (
              <span className="inline-flex items-center gap-1">
                <LoaderCircle className="size-3 animate-spin" aria-hidden /> Compressing… {Math.round(item.progress)}%
              </span>
            ) : item.status === "error" ? (
              <span className="inline-flex items-center gap-1 text-destructive">
                <CircleAlert className="size-3" aria-hidden /> {item.error ?? "Failed"}
              </span>
            ) : r ? (
              <>
                <span className="sr-only">Original </span>
                {formatBytes(item.file.size)} → <span className="sr-only">compressed </span>
                <span className="font-medium text-foreground">{formatBytes(r.blob.size)}</span>
                {" · "}
                <span className={cn("font-medium", bigger ? "text-warning-foreground dark:text-warning" : "text-success")}>
                  {bigger ? `${Math.abs(saved)}% larger` : `Saved ${saved}%`}
                </span>
                {stale ? <span className="block">Settings changed — compress again</span> : null}
              </>
            ) : (
              <>{formatBytes(item.file.size)} · Ready</>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          {r ? (
            <Button variant="ghost" size="icon" onClick={onCompare} aria-label={`Compare ${item.file.name}`} className="hidden sm:inline-flex">
              <Columns2 />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDownload(bigger)}
            disabled={!r || busy}
            aria-label={bigger ? `Download original ${item.file.name} (smaller)` : `Download compressed ${item.file.name}`}
          >
            <Download />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            disabled={item.status === "working"}
            aria-label={`Remove ${item.file.name}`}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      {item.status === "working" ? (
        <Progress value={item.progress} className="mt-2" aria-label={`Compressing ${item.file.name}`} />
      ) : null}
      {r && bigger && !stale ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-warning/10 p-2 text-xs">
          <span className="min-w-0 flex-1">This file got bigger. The original is already well optimised.</span>
          <Button variant="outline" onClick={() => onDownload(true)} disabled={busy}>
            Keep original
          </Button>
          <Button variant="ghost" onClick={() => onDownload(false)} disabled={busy}>
            Download anyway
          </Button>
        </div>
      ) : null}
    </motion.li>
  )
}
