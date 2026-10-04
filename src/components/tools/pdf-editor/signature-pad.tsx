"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Eraser } from "lucide-react"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const PEN_COLORS = [
  { value: "#111827", label: "Black" },
  { value: "#1d4ed8", label: "Blue" },
]

export interface SignatureImage {
  src: string
  width: number
  height: number
}

interface SignaturePadProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Previously drawn signature, offered for quick reuse. */
  saved: SignatureImage | null
  onUse: (sig: SignatureImage) => void
}

export function SignaturePad({ open, onOpenChange, saved, onUse }: SignaturePadProps) {
  const [color, setColor] = useState(PEN_COLORS[0].value)
  const [hasInk, setHasInk] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const bounds = useRef({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
  const last = useRef<{ x: number; y: number; mx: number; my: number } | null>(null)
  const dpr = useRef(1)
  const lineWidth = 2.6

  const setup = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas
    if (!canvas) return
    // offsetWidth ignores the dialog's opening zoom transform.
    const ratio = Math.min(3, window.devicePixelRatio || 1)
    dpr.current = ratio
    canvas.width = Math.max(1, Math.round(canvas.offsetWidth * ratio))
    canvas.height = Math.max(1, Math.round(canvas.offsetHeight * ratio))
    bounds.current = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    setHasInk(false)
  }, [])

  useEffect(() => {
    if (!open) last.current = null
  }, [open])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) * e.currentTarget.width) / rect.width,
      y: ((e.clientY - rect.top) * e.currentTarget.height) / rect.height,
    }
  }

  const grow = (x: number, y: number) => {
    const b = bounds.current
    b.minX = Math.min(b.minX, x)
    b.minY = Math.min(b.minY, y)
    b.maxX = Math.max(b.maxX, x)
    b.maxY = Math.max(b.maxY, y)
  }

  const ctx = () => {
    const c = canvasRef.current?.getContext("2d")
    if (!c) return null
    c.strokeStyle = color
    c.fillStyle = color
    c.lineWidth = lineWidth * dpr.current
    c.lineCap = "round"
    c.lineJoin = "round"
    return c
  }

  const clear = () => {
    const c = canvasRef.current
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height)
    bounds.current = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    setHasInk(false)
  }

  const use = () => {
    const canvas = canvasRef.current
    const b = bounds.current
    if (!canvas || !hasInk) return
    const pad = Math.ceil(lineWidth * dpr.current * 2)
    const x = Math.max(0, Math.floor(b.minX - pad))
    const y = Math.max(0, Math.floor(b.minY - pad))
    const w = Math.min(canvas.width - x, Math.ceil(b.maxX - b.minX + pad * 2))
    const h = Math.min(canvas.height - y, Math.ceil(b.maxY - b.minY + pad * 2))
    const out = document.createElement("canvas")
    out.width = Math.max(1, w)
    out.height = Math.max(1, h)
    out.getContext("2d")?.drawImage(canvas, x, y, w, h, 0, 0, w, h)
    onUse({ src: out.toDataURL("image/png"), width: out.width, height: out.height })
    onOpenChange(false)
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add signature"
      description="Draw your signature with a finger, stylus or mouse. You can move and resize it on the page."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={use} disabled={!hasInk}>
            Place signature
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <canvas
            ref={setup}
            data-base-ui-swipe-ignore=""
            aria-label="Signature drawing area"
            role="img"
            className="block aspect-[2/1] w-full cursor-crosshair touch-none rounded-xl border-2 border-dashed bg-white"
            onPointerDown={(e) => {
              e.stopPropagation()
              e.currentTarget.setPointerCapture(e.pointerId)
              const p = point(e)
              last.current = { ...p, mx: p.x, my: p.y }
              const c = ctx()
              if (!c) return
              c.beginPath()
              c.arc(p.x, p.y, (lineWidth * dpr.current) / 2, 0, Math.PI * 2)
              c.fill()
              grow(p.x, p.y)
              setHasInk(true)
            }}
            onPointerMove={(e) => {
              const prev = last.current
              if (!prev) return
              const c = ctx()
              if (!c) return
              const native = e.nativeEvent
              const evs = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : []
              const rect = e.currentTarget.getBoundingClientRect()
              let state = prev
              for (const ev of evs.length ? evs : [native]) {
                const x = ((ev.clientX - rect.left) * e.currentTarget.width) / rect.width
                const y = ((ev.clientY - rect.top) * e.currentTarget.height) / rect.height
                const mx = (state.x + x) / 2
                const my = (state.y + y) / 2
                c.beginPath()
                c.moveTo(state.mx, state.my)
                c.quadraticCurveTo(state.x, state.y, mx, my)
                c.stroke()
                grow(x, y)
                state = { x, y, mx, my }
              }
              last.current = state
            }}
            onPointerUp={() => {
              const prev = last.current
              const c = ctx()
              if (prev && c) {
                c.beginPath()
                c.moveTo(prev.mx, prev.my)
                c.lineTo(prev.x, prev.y)
                c.stroke()
              }
              last.current = null
            }}
            onPointerCancel={() => {
              last.current = null
            }}
          />
          {!hasInk && (
            <span className="pointer-events-none absolute inset-x-6 bottom-6 border-b border-neutral-300 pb-1 text-xs text-neutral-400">
              Sign above this line
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2" role="radiogroup" aria-label="Pen colour">
            {PEN_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={color === c.value}
                aria-label={c.label}
                onClick={() => setColor(c.value)}
                className={cn(
                  "size-10 rounded-full border-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  color === c.value ? "border-primary" : "border-transparent"
                )}
              >
                <span className="m-auto block size-6 rounded-full" style={{ backgroundColor: c.value }} />
              </button>
            ))}
          </div>
          <Button variant="ghost" onClick={clear} disabled={!hasInk}>
            <Eraser aria-hidden /> Clear
          </Button>
        </div>
        {saved && (
          <div className="flex items-center gap-3 rounded-xl border bg-surface p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
            <img src={saved.src} alt="Your last signature" className="h-12 max-w-40 rounded bg-white object-contain p-1" />
            <Button
              variant="outline"
              className="ml-auto"
              onClick={() => {
                onUse(saved)
                onOpenChange(false)
              }}
            >
              Use last signature
            </Button>
          </div>
        )}
      </div>
    </ResponsiveSheet>
  )
}
