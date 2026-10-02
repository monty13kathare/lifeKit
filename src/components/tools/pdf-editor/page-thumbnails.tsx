"use client"

import { useEffect, useRef, useState } from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { GripVertical } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { visualSize, type EditorPage } from "@/lib/pdf/edit"
import { cn } from "@/lib/utils"
import { capScale, renderPage, withRenderSlot } from "./pdf-render"

interface PageThumbProps {
  pdf: PDFDocumentProxy
  page: EditorPage
  /** Target CSS width of the thumbnail box. */
  width: number
  annotationCount?: number
}

/** Lazily renders a page thumbnail once it scrolls into view. */
export function PageThumb({ pdf, page, width, annotationCount = 0 }: PageThumbProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [vw, vh] = visualSize(page)
  const height = Math.round((width * vh) / vw)

  useEffect(() => {
    const el = hostRef.current
    if (!el || visible) return
    if (typeof IntersectionObserver === "undefined") {
      const t = window.setTimeout(() => setVisible(true), 0)
      return () => window.clearTimeout(t)
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: "200px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible) return
    let job: ReturnType<typeof renderPage> | null = null
    let cancelled = false
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const scale = capScale(vw, vh, (width * dpr) / vw, 1_000_000)
    withRenderSlot(async () => {
      if (cancelled) return
      job = renderPage(pdf, page.srcIndex + 1, scale, page.rotation)
      const canvas = await job.promise
      if (!canvas || cancelled || !hostRef.current) return
      canvas.className = "block size-full"
      canvas.setAttribute("aria-hidden", "true")
      hostRef.current.replaceChildren(canvas)
      setReady(true)
    }).catch(() => {
      if (!cancelled) setFailed(true)
    })
    return () => {
      cancelled = true
      job?.cancel()
    }
  }, [visible, pdf, page.srcIndex, page.rotation, width, vw, vh])

  return (
    <div className="relative overflow-hidden rounded-md bg-white ring-1 ring-border" style={{ width, height }}>
      <div ref={hostRef} className="size-full" />
      {!ready && !failed && <Skeleton className="absolute inset-0 rounded-none" />}
      {failed && (
        <span className="absolute inset-0 flex items-center justify-center bg-surface-muted text-[10px] text-muted-foreground">
          Preview failed
        </span>
      )}
      {annotationCount > 0 && (
        <span className="absolute top-1 right-1 rounded-full bg-primary px-1.5 text-[10px] leading-4 font-medium text-primary-foreground">
          {annotationCount}
        </span>
      )}
    </div>
  )
}

interface PageListProps {
  pdf: PDFDocumentProxy
  pages: EditorPage[]
  currentId: string
  counts: Record<string, number>
  onSelect: (id: string) => void
  onMove: (from: number, to: number) => void
  orientation: "vertical" | "horizontal"
}

/** Desktop: vertical list with drag-to-reorder. Mobile: compact horizontal strip. */
export function PageList({ pdf, pages, currentId, counts, onSelect, onMove, orientation }: PageListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const vertical = orientation === "vertical"
  const listRef = useRef<HTMLOListElement>(null)

  // Keep the current page in view by scrolling only the list (never the window).
  useEffect(() => {
    const list = listRef.current
    const el = list?.querySelector<HTMLElement>(`[data-page-id="${currentId}"]`)
    const scroller = vertical ? list?.parentElement : list
    if (!el || !scroller) return
    const sr = scroller.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    if (vertical) {
      if (er.top < sr.top) scroller.scrollBy({ top: er.top - sr.top - 8, behavior: "smooth" })
      else if (er.bottom > sr.bottom) scroller.scrollBy({ top: er.bottom - sr.bottom + 8, behavior: "smooth" })
    } else if (er.left < sr.left) scroller.scrollBy({ left: er.left - sr.left - 8, behavior: "smooth" })
    else if (er.right > sr.right) scroller.scrollBy({ left: er.right - sr.right + 8, behavior: "smooth" })
  }, [currentId, vertical])

  return (
    <ol
      ref={listRef}
      aria-label="Pages"
      className={cn(vertical ? "flex flex-col gap-3 p-3" : "flex gap-2 overflow-x-auto px-1 py-2 [scrollbar-width:thin]")}
    >
      {pages.map((page, index) => {
        const active = page.id === currentId
        return (
          <li
            key={page.id}
            data-page-id={page.id}
            className={cn(
              "shrink-0 rounded-lg transition-opacity",
              dragIndex === index && "opacity-40",
              vertical && overIndex === index && dragIndex !== null && dragIndex !== index && "ring-2 ring-primary/50"
            )}
            draggable={vertical}
            onDragStart={(e) => {
              setDragIndex(index)
              e.dataTransfer.effectAllowed = "move"
              e.dataTransfer.setData("text/plain", String(index))
            }}
            onDragOver={(e) => {
              if (dragIndex === null) return
              e.preventDefault()
              e.dataTransfer.dropEffect = "move"
              setOverIndex(index)
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (dragIndex !== null) onMove(dragIndex, index)
              setDragIndex(null)
              setOverIndex(null)
            }}
            onDragEnd={() => {
              setDragIndex(null)
              setOverIndex(null)
            }}
          >
            <button
              type="button"
              onClick={() => onSelect(page.id)}
              aria-label={`Page ${index + 1}${active ? " (current)" : ""}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex flex-col items-center gap-1 rounded-lg p-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active ? "bg-primary/10" : "hover:bg-muted",
                vertical && "w-full"
              )}
            >
              <span className={cn("rounded-md", active && "ring-2 ring-primary ring-offset-2 ring-offset-background")}>
                <PageThumb pdf={pdf} page={page} width={vertical ? 120 : 44} annotationCount={vertical ? counts[page.id] : 0} />
              </span>
              <span className={cn("flex items-center gap-1 text-xs tabular-nums", active ? "font-medium text-primary" : "text-muted-foreground")}>
                {vertical && (
                  <GripVertical className="size-3 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />
                )}
                {index + 1}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
