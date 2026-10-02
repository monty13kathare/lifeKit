"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, ChevronUp, GripVertical, LoaderCircle, RotateCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatBytes } from "@/lib/files"
import type { Rotation } from "@/lib/image/canvas"
import { cn } from "@/lib/utils"

export interface PdfItem {
  id: string
  file: File
  /** Thumbnail object URL (null while generating). */
  thumb: string | null
  width: number
  height: number
  rotation: Rotation
}

interface PageGridProps {
  items: PdfItem[]
  disabled?: boolean
  onMove: (from: number, to: number) => void
  onRotate: (id: string) => void
  onRemove: (id: string) => void
}

/**
 * Sortable page list. Desktop: drag and drop. Touch/keyboard: move buttons.
 * Rows on narrow containers, a card grid on wider ones (container queries).
 */
export function PageGrid({ items, disabled, onMove, onRotate, onRemove }: PageGridProps) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const endDrag = () => {
    setDragId(null)
    setOverId(null)
  }

  return (
    <div className="@container">
      <ol className="grid grid-cols-1 gap-2.5 @xl:grid-cols-3 @xl:gap-3" aria-label="Pages in order">
        <AnimatePresence initial={false}>
          {items.map((item, index) => {
            const turned = item.rotation === 90 || item.rotation === 270
            const w = turned ? item.height : item.width
            const h = turned ? item.width : item.height
            return (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.18 }}
              >
                {/* HTML5 drag handlers live on a plain element: motion.* reserves onDrag* for its own gestures. */}
                <div
                  draggable={!disabled}
                  onDragStart={(e) => {
                    setDragId(item.id)
                    e.dataTransfer.effectAllowed = "move"
                    e.dataTransfer.setData("text/plain", item.id)
                  }}
                  onDragOver={(e) => {
                    if (!dragId) return
                    e.preventDefault()
                    if (overId !== item.id) setOverId(item.id)
                  }}
                  onDrop={(e) => {
                    if (!dragId) return
                    e.preventDefault()
                    const from = items.findIndex((x) => x.id === dragId)
                    if (from !== -1 && from !== index) onMove(from, index)
                    endDrag()
                  }}
                  onDragEnd={endDrag}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl border bg-card p-2 shadow-soft @xl:flex-col @xl:items-stretch @xl:gap-2",
                    dragId === item.id && "opacity-50",
                    overId === item.id && dragId !== item.id && "border-primary ring-2 ring-primary/30",
                    !disabled && "lg:cursor-grab lg:active:cursor-grabbing"
                  )}
                >
                  <div className="relative flex size-18 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-checker @xl:aspect-square @xl:size-auto @xl:w-full">
                    {item.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local blob URL
                      <img
                        src={item.thumb}
                        alt=""
                        draggable={false}
                        className="max-h-full max-w-full object-contain transition-transform duration-200"
                        style={{ transform: `rotate(${item.rotation}deg)` }}
                      />
                    ) : (
                      <LoaderCircle className="size-5 animate-spin text-muted-foreground" aria-label="Loading preview" />
                    )}
                    <span className="absolute top-1 left-1 rounded-md bg-black/65 px-1.5 text-xs font-semibold text-white tabular-nums">
                      {index + 1}
                    </span>
                    <GripVertical
                      className="absolute top-1 right-1 hidden size-5 rounded bg-black/40 p-0.5 text-white lg:@xl:block"
                      aria-hidden
                    />
                  </div>
                  <div className="min-w-0 flex-1 @xl:flex-none @xl:px-0.5">
                    <p className="truncate text-sm font-medium" title={item.file.name}>
                      {item.file.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {w > 0 ? `${w}×${h} · ` : ""}
                      {formatBytes(item.file.size)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1 @xl:flex-row @xl:justify-between">
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={disabled || index === 0}
                        onClick={() => onMove(index, index - 1)}
                        aria-label={`Move ${item.file.name} earlier`}
                      >
                        <ChevronUp className="@xl:-rotate-90" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={disabled || index === items.length - 1}
                        onClick={() => onMove(index, index + 1)}
                        aria-label={`Move ${item.file.name} later`}
                      >
                        <ChevronDown className="@xl:-rotate-90" />
                      </Button>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={disabled}
                        onClick={() => onRotate(item.id)}
                        aria-label={`Rotate ${item.file.name} 90 degrees clockwise (currently ${item.rotation}°)`}
                      >
                        <RotateCw />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={disabled}
                        onClick={() => onRemove(item.id)}
                        aria-label={`Remove ${item.file.name}`}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ol>
    </div>
  )
}
