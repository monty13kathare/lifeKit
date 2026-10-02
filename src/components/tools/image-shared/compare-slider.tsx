"use client"

import { useRef, useState } from "react"
import { ChevronsLeftRight } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Before/after comparison. Drag (mouse or touch) anywhere on the image, or
 * focus the slider and use the arrow keys.
 */
export function CompareSlider({
  before,
  after,
  beforeLabel = "Original",
  afterLabel = "Result",
  aspect,
  className,
}: {
  before: string
  after: string
  beforeLabel?: string
  afterLabel?: string
  /** width / height of the image, to reserve space. */
  aspect?: number
  className?: string
}) {
  const [pos, setPos] = useState(50)
  const box = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const update = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)))
  }

  return (
    <div className={cn("group space-y-2", className)}>
      <div
        ref={box}
        className="relative w-full touch-pan-y overflow-hidden rounded-xl border bg-checker select-none group-has-[input:focus-visible]:ring-3 group-has-[input:focus-visible]:ring-ring/50"
        style={{ aspectRatio: aspect && Number.isFinite(aspect) ? String(Math.min(Math.max(aspect, 0.5), 2.5)) : "4 / 3" }}
        onPointerDown={(e) => {
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          update(e.clientX)
        }}
        onPointerMove={(e) => {
          if (dragging.current) update(e.clientX)
        }}
        onPointerUp={() => {
          dragging.current = false
        }}
        onPointerCancel={() => {
          dragging.current = false
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob URLs */}
        <img src={before} alt={beforeLabel} draggable={false} className="pointer-events-none absolute inset-0 size-full object-contain" />
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob URLs */}
        <img
          src={after}
          alt={afterLabel}
          draggable={false}
          className="pointer-events-none absolute inset-0 size-full object-contain"
          style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
        />
        <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.25)]" style={{ left: `${pos}%` }}>
          <span className="absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-neutral-800 shadow-md">
            <ChevronsLeftRight className="size-4" aria-hidden />
          </span>
        </div>
        <span className="pointer-events-none absolute top-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
          {beforeLabel}
        </span>
        <span className="pointer-events-none absolute top-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
          {afterLabel}
        </span>
      </div>
      <label className="sr-only">
        Comparison position
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(pos)}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-valuetext={`${Math.round(pos)}% ${afterLabel.toLowerCase()} hidden`}
        />
      </label>
      <p className="text-center text-xs text-muted-foreground">Drag across the image to compare</p>
    </div>
  )
}
