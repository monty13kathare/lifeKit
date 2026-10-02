"use client"

import { useId, useRef, useState } from "react"
import { ArrowLeft, Check, Loader2, Maximize, ScanSearch } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { clamp01, isConvex } from "@/lib/scanner/geometry"
import { redetect, type ScanPage } from "@/lib/scanner/pipeline"
import type { Quad } from "@/lib/scanner/types"

const CORNER_NAMES = ["Top-left", "Top-right", "Bottom-right", "Bottom-left"] as const
const FULL: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
]
const LOUPE = 104
const ZOOM = 2.5

interface CropEditorProps {
  page: ScanPage
  busy: boolean
  onCancel: () => void
  onConfirm: (quad: Quad) => void
  cancelLabel?: string
}

export function CropEditor({ page, busy, onCancel, onConfirm, cancelLabel = "Back" }: CropEditorProps) {
  const [quad, setQuad] = useState<Quad>(page.quad)
  const [drag, setDrag] = useState<{ index: number; w: number; h: number } | null>(null)
  const [detecting, setDetecting] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const helpId = useId()

  const convex = isConvex(quad)

  const setCorner = (i: number, x: number, y: number) =>
    setQuad((q) => q.map((p, k) => (k === i ? { x: clamp01(x), y: clamp01(y) } : p)) as Quad)

  const onPointerDown = (i: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.focus()
    const r = wrapRef.current?.getBoundingClientRect()
    if (r) setDrag({ index: i, w: r.width, h: r.height })
  }
  const onPointerMove = (i: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag || drag.index !== i) return
    const r = wrapRef.current?.getBoundingClientRect()
    if (!r) return
    setCorner(i, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
  }
  const endDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    setDrag(null)
  }
  const onKeyDown = (i: number) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 0.02 : 0.004
    const p = quad[i]
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const m = moves[e.key]
    if (!m) return
    e.preventDefault()
    setCorner(i, p.x + m[0], p.y + m[1])
  }

  const autoDetect = async () => {
    setDetecting(true)
    try {
      const res = page.confidence > 0 ? { quad: page.autoQuad, confidence: page.confidence } : await redetect(page)
      setQuad(res.quad)
      if (res.confidence < 0.45) toast.info("Couldn't find clear page edges. Drag the corners to fit the page.")
    } catch {
      toast.error("Auto detection failed. Drag the corners manually.")
    } finally {
      setDetecting(false)
    }
  }

  const pts = quad.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")
  const active = drag ? quad[drag.index] : null
  // put the loupe in the corner away from the finger
  const loupeLeft = active ? active.x > 0.5 : false

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          <ArrowLeft aria-hidden /> {cancelLabel}
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={autoDetect} disabled={busy || detecting}>
            {detecting ? <Loader2 className="animate-spin" aria-hidden /> : <ScanSearch aria-hidden />}
            Auto detect
          </Button>
          <Button variant="outline" onClick={() => setQuad(FULL)} disabled={busy}>
            <Maximize aria-hidden /> Reset
          </Button>
        </div>
      </div>

      <p id={helpId} className="text-sm text-muted-foreground">
        Drag the four corners onto the page edges. Focus a corner and use the arrow keys to nudge it (hold Shift for
        bigger steps).
      </p>

      <div className="flex justify-center rounded-2xl bg-surface-muted p-3 sm:p-5">
        <div ref={wrapRef} className="relative w-fit touch-none select-none">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
          <img
            src={page.sourceUrl}
            alt="Captured page to crop"
            draggable={false}
            className="block h-auto max-h-[min(60dvh,640px)] w-auto max-w-full rounded-md"
          />
          <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <path
              d={`M0 0H100V100H0Z M${quad.map((p) => `${p.x * 100} ${p.y * 100}`).join(" L")}Z`}
              fillRule="evenodd"
              className="fill-black/45"
            />
            <polygon
              points={pts}
              fill="none"
              vectorEffect="non-scaling-stroke"
              strokeWidth={2}
              className={convex ? "stroke-primary" : "stroke-destructive"}
            />
          </svg>
          {quad.map((p, i) => (
            <button
              key={CORNER_NAMES[i]}
              type="button"
              aria-label={`${CORNER_NAMES[i]} corner, ${Math.round(p.x * 100)}% across, ${Math.round(p.y * 100)}% down`}
              aria-describedby={helpId}
              onPointerDown={onPointerDown(i)}
              onPointerMove={onPointerMove(i)}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={onKeyDown(i)}
              className="group absolute flex size-11 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-full outline-none active:cursor-grabbing"
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            >
              <span
                className={cn(
                  "block size-5 rounded-full border-2 border-white bg-primary shadow-soft transition-transform group-focus-visible:ring-4 group-focus-visible:ring-ring/60",
                  drag?.index === i && "scale-125"
                )}
              />
            </button>
          ))}
          {active && drag && (
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-2 overflow-hidden rounded-full border-2 border-white shadow-soft",
                loupeLeft ? "left-2" : "right-2"
              )}
              style={{
                width: LOUPE,
                height: LOUPE,
                backgroundImage: `url(${page.sourceUrl})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: `${drag.w * ZOOM}px ${drag.h * ZOOM}px`,
                backgroundPosition: `${LOUPE / 2 - active.x * drag.w * ZOOM}px ${LOUPE / 2 - active.y * drag.h * ZOOM}px`,
              }}
            >
              <span className="absolute top-1/2 left-1/2 h-px w-5 -translate-x-1/2 bg-primary" />
              <span className="absolute top-1/2 left-1/2 h-5 w-px -translate-y-1/2 bg-primary" />
            </div>
          )}
        </div>
      </div>

      {!convex && (
        <p role="alert" className="text-sm text-destructive">
          The corners cross over. Drag them so they outline the page.
        </p>
      )}

      <Button size="lg" className="w-full sm:w-auto" disabled={busy || !convex} onClick={() => onConfirm(quad)}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
        {busy ? "Straightening…" : "Crop & straighten"}
      </Button>
    </div>
  )
}
