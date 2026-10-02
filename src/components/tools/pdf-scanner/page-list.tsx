"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp, Camera, Crop, EllipsisVertical, GripVertical, Loader2, SlidersHorizontal, Trash2, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { ScanPage } from "@/lib/scanner/pipeline"

interface PageListProps {
  pages: ScanPage[]
  activeId?: string
  canRetake: boolean
  onMove: (from: number, to: number) => void
  onCrop: (id: string) => void
  onEnhance: (id: string) => void
  onRetake: (id: string) => void
  onDelete: (id: string) => void
}

export function PageList({ pages, activeId, canRetake, onMove, onCrop, onEnhance, onRetake, onDelete }: PageListProps) {
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  return (
    <ol className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-1" aria-label="Scanned pages">
      {pages.map((p, i) => (
        <li
          key={p.id}
          draggable={p.status === "ready"}
          onDragStart={(e) => {
            setDragFrom(i)
            e.dataTransfer.effectAllowed = "move"
            e.dataTransfer.setData("text/plain", String(i))
          }}
          onDragOver={(e) => {
            if (dragFrom === null) return
            e.preventDefault()
            setDragOver(i)
          }}
          onDragLeave={() => setDragOver((v) => (v === i ? null : v))}
          onDrop={(e) => {
            e.preventDefault()
            if (dragFrom !== null && dragFrom !== i) onMove(dragFrom, i)
            setDragFrom(null)
            setDragOver(null)
          }}
          onDragEnd={() => {
            setDragFrom(null)
            setDragOver(null)
          }}
          className={cn(
            "flex items-center gap-2 rounded-xl border bg-card p-2 shadow-soft transition-colors",
            activeId === p.id && "border-primary ring-2 ring-primary/20",
            dragOver === i && dragFrom !== i && "border-primary bg-primary/5",
            dragFrom === i && "opacity-50"
          )}
        >
          <GripVertical className="hidden size-4 shrink-0 cursor-grab text-muted-foreground lg:block" aria-hidden />
          <button
            type="button"
            onClick={() => (p.status === "ready" ? onEnhance(p.id) : onCrop(p.id))}
            className="relative flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-surface-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label={`Edit page ${i + 1}`}
          >
            {p.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL
              <img src={p.thumbUrl} alt="" className="size-full object-contain" />
            ) : p.status === "processing" ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL
              <img src={p.sourceUrl} alt="" className="size-full object-cover opacity-60" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Page {i + 1}</p>
            <p
              className={cn(
                "flex items-center gap-1 truncate text-xs",
                p.status === "error" ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {p.status === "processing" && "Processing…"}
              {p.status === "new" && "Needs cropping"}
              {p.status === "error" && (
                <>
                  <TriangleAlert className="size-3.5 shrink-0" aria-hidden /> {p.error ?? "Failed"}
                </>
              )}
              {p.status === "ready" && p.processed && `${p.processedW}×${p.processedH}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center">
            <div className="flex flex-col">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move page ${i + 1} up`}
                disabled={i === 0}
                onClick={() => onMove(i, i - 1)}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Move page ${i + 1} down`}
                disabled={i === pages.length - 1}
                onClick={() => onMove(i, i + 1)}
              >
                <ArrowDown />
              </Button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon" aria-label={`More actions for page ${i + 1}`} />}
              >
                <EllipsisVertical />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => onCrop(p.id)}>
                  <Crop aria-hidden /> Edit crop
                </DropdownMenuItem>
                <DropdownMenuItem disabled={p.status !== "ready"} onClick={() => onEnhance(p.id)}>
                  <SlidersHorizontal aria-hidden /> Adjust & filters
                </DropdownMenuItem>
                {canRetake && (
                  <DropdownMenuItem onClick={() => onRetake(p.id)}>
                    <Camera aria-hidden /> Retake
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(p.id)}>
                  <Trash2 aria-hidden /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </li>
      ))}
    </ol>
  )
}
