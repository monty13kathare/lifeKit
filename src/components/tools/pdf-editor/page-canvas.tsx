"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { LoaderCircle, TriangleAlert } from "lucide-react"
import {
  normalizeRotation,
  pageNumberLabel,
  PAGE_NUMBER_MARGIN,
  PDF_FONT_STACK,
  TEXT_LINE_HEIGHT,
  viewToPage,
  visualSize,
  type Annotation,
  type EditorPage,
  type ImageAnnotation,
  type PageNumberSettings,
  type TextAnnotation,
  type WatermarkSettings,
} from "@/lib/pdf/edit"
import { cn } from "@/lib/utils"
import { capScale, renderPage } from "./pdf-render"
import { uid, type ApplyOptions, type DocState } from "./use-editor-state"
import type { Tool, ToolSettings } from "./types"

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

interface PageCanvasProps {
  pdf: PDFDocumentProxy
  page: EditorPage
  pageIndex: number
  pageCount: number
  annotations: Annotation[]
  /** CSS pixels per PDF point. */
  scale: number
  tool: Tool
  settings: ToolSettings
  selectedId: string | null
  editingId: string | null
  watermark: WatermarkSettings
  pageNumbers: PageNumberSettings
  onSelect: (id: string | null) => void
  onStartEditing: (id: string, opts?: { isNew?: boolean; base?: DocState }) => void
  onFinishEditing: () => void
  onAdd: (a: Annotation, opts?: ApplyOptions) => void
  onUpdate: (id: string, patch: Partial<Annotation>, opts?: ApplyOptions) => void
  onRemove: (id: string) => void
  /** Snapshot of the current document, used as the undo base for drags. */
  snapshot: () => DocState
}

type Draft =
  | { kind: "ink"; points: [number, number][] }
  | { kind: "highlight"; start: [number, number]; end: [number, number] }

interface DragState {
  id: string
  mode: "move" | "resize"
  start: [number, number]
  startClient: [number, number]
  orig: Annotation
  base: DocState
  moved: boolean
  wasSelected: boolean
  last?: Partial<Annotation>
}

export function PageCanvas(props: PageCanvasProps) {
  const {
    pdf,
    page,
    pageIndex,
    pageCount,
    annotations,
    scale,
    tool,
    settings,
    selectedId,
    editingId,
    watermark,
    pageNumbers,
    onSelect,
    onStartEditing,
    onFinishEditing,
    onAdd,
    onUpdate,
    onRemove,
    snapshot,
  } = props
  const outerRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const renderedSrc = useRef<number | null>(null)
  const [bitmapSrc, setBitmapSrc] = useState<number | null>(null)
  const [errorSrc, setErrorSrc] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const draftRef = useRef<Draft | null>(null)
  const dragRef = useRef<DragState | null>(null)

  const W = page.width
  const H = page.height
  const [VW, VH] = visualSize(page)
  const rot = page.rotation

  // ---- Render the (unrotated) page bitmap -------------------------------
  useEffect(() => {
    let job: ReturnType<typeof renderPage> | null = null
    const fresh = renderedSrc.current !== page.srcIndex
    if (fresh) {
      hostRef.current?.replaceChildren()
      renderedSrc.current = null
    }
    const timer = window.setTimeout(() => {
      const dpr = Math.min(3, window.devicePixelRatio || 1)
      job = renderPage(pdf, page.srcIndex + 1, capScale(W, H, scale * dpr), 0)
      job.promise
        .then((canvas) => {
          if (!canvas || !hostRef.current) return
          canvas.className = "absolute inset-0 size-full"
          canvas.setAttribute("aria-hidden", "true")
          hostRef.current.replaceChildren(canvas)
          renderedSrc.current = page.srcIndex
          setBitmapSrc(page.srcIndex)
          setErrorSrc(null)
        })
        .catch(() => setErrorSrc(page.srcIndex))
    }, fresh ? 0 : 120)
    return () => {
      window.clearTimeout(timer)
      job?.cancel()
    }
  }, [pdf, page.srcIndex, W, H, scale])

  // ---- Coordinate helpers ------------------------------------------------
  const toPage = (clientX: number, clientY: number): [number, number] => {
    const r = outerRef.current!.getBoundingClientRect()
    const u = clamp((clientX - r.left) / r.width, 0, 1)
    const v = clamp((clientY - r.top) / r.height, 0, 1)
    return viewToPage(u, v, rot)
  }
  /** Convert a visual delta in points to a page-space normalised delta. */
  const visualDeltaToPage = (dxPt: number, dyPt: number): [number, number] => {
    const [x0, y0] = viewToPage(0.5, 0.5, rot)
    const [x1, y1] = viewToPage(0.5 + dxPt / VW, 0.5 + dyPt / VH, rot)
    return [x1 - x0, y1 - y0]
  }

  const movePatch = (a: Annotation, dx: number, dy: number): Partial<Annotation> => {
    switch (a.type) {
      case "ink": {
        let minX = 1,
          minY = 1,
          maxX = 0,
          maxY = 0
        for (const [x, y] of a.points) {
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
        }
        const ddx = clamp(dx, -minX, 1 - maxX)
        const ddy = clamp(dy, -minY, 1 - maxY)
        return { points: a.points.map(([x, y]) => [x + ddx, y + ddy] as [number, number]) }
      }
      case "highlight":
        return { x: clamp(a.x + dx, 0, 1 - a.w), y: clamp(a.y + dy, 0, 1 - a.h) }
      default:
        return { x: clamp(a.x + dx, 0, 1), y: clamp(a.y + dy, 0, 1) }
    }
  }

  const resizePatch = (a: ImageAnnotation, p: [number, number]): Partial<Annotation> => {
    const rad = (a.rotation * Math.PI) / 180
    const vx = (p[0] - a.x) * W
    const vy = (p[1] - a.y) * H
    const along = vx * Math.cos(rad) + vy * Math.sin(rad)
    const across = -vx * Math.sin(rad) + vy * Math.cos(rad)
    const aspect = a.width / a.height
    const width = clamp(Math.max(along, across * aspect), 24, Math.max(W, H))
    return { width, height: width / aspect }
  }

  // ---- Pointer handling ----------------------------------------------------
  const beginDrag = (e: React.PointerEvent, a: Annotation, mode: DragState["mode"]) => {
    e.stopPropagation()
    if (e.pointerType === "mouse" && e.button !== 0) return
    const wasSelected = selectedId === a.id
    onSelect(a.id)
    if (editingId === a.id) return
    if (editingId) onFinishEditing()
    outerRef.current?.setPointerCapture(e.pointerId)
    dragRef.current = {
      id: a.id,
      mode,
      start: toPage(e.clientX, e.clientY),
      startClient: [e.clientX, e.clientY],
      orig: a,
      base: snapshot(),
      moved: false,
      wasSelected,
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return
    const p = toPage(e.clientX, e.clientY)
    if (editingId) {
      onFinishEditing()
      if (tool !== "draw" && tool !== "highlight") return
    }
    if (tool === "select") {
      onSelect(null)
      return
    }
    if (tool === "text") {
      const base = snapshot()
      const a: TextAnnotation = {
        id: uid("ann"),
        type: "text",
        x: p[0],
        y: p[1],
        text: "",
        fontSize: settings.fontSize,
        color: settings.textColor,
        rotation: normalizeRotation(360 - rot),
      }
      onAdd(a, { record: false })
      onSelect(a.id)
      onStartEditing(a.id, { isNew: true, base })
      return
    }
    onSelect(null)
    e.currentTarget.setPointerCapture(e.pointerId)
    const d: Draft = tool === "draw" ? { kind: "ink", points: [p] } : { kind: "highlight", start: p, end: p }
    draftRef.current = d
    setDraft(d)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (drag) {
      if (!drag.moved) {
        const dist = Math.hypot(e.clientX - drag.startClient[0], e.clientY - drag.startClient[1])
        if (dist < 3) return
        drag.moved = true
      }
      const p = toPage(e.clientX, e.clientY)
      const patch =
        drag.mode === "resize" && drag.orig.type === "image"
          ? resizePatch(drag.orig, p)
          : movePatch(drag.orig, p[0] - drag.start[0], p[1] - drag.start[1])
      drag.last = patch
      onUpdate(drag.id, patch, { record: false })
      return
    }
    const d = draftRef.current
    if (!d) return
    if (d.kind === "ink") {
      const native = e.nativeEvent
      const events = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : []
      const list = events.length ? events : [native]
      const pts = [...d.points]
      const minDist = 1.2 / scale // ~1.2 CSS px expressed in points
      for (const ev of list) {
        const p = toPage(ev.clientX, ev.clientY)
        const last = pts[pts.length - 1]
        if (Math.hypot((p[0] - last[0]) * W, (p[1] - last[1]) * H) >= minDist) pts.push(p)
      }
      if (pts.length === d.points.length) return
      const next: Draft = { kind: "ink", points: pts }
      draftRef.current = next
      setDraft(next)
    } else {
      const next: Draft = { ...d, end: toPage(e.clientX, e.clientY) }
      draftRef.current = next
      setDraft(next)
    }
  }

  const endPointer = (e: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    if (outerRef.current?.hasPointerCapture(e.pointerId)) outerRef.current.releasePointerCapture(e.pointerId)
    const drag = dragRef.current
    if (drag) {
      dragRef.current = null
      if (drag.moved && drag.last) {
        onUpdate(drag.id, drag.last, { record: true, base: drag.base })
      } else if (!cancelled && drag.orig.type === "text" && (drag.wasSelected || tool === "text")) {
        onStartEditing(drag.id)
      }
      return
    }
    const d = draftRef.current
    draftRef.current = null
    setDraft(null)
    if (!d || cancelled) return
    if (d.kind === "ink") {
      onAdd({ id: uid("ann"), type: "ink", points: d.points, color: settings.penColor, width: settings.penWidth })
    } else {
      const x = Math.min(d.start[0], d.end[0])
      const y = Math.min(d.start[1], d.end[1])
      const w = Math.abs(d.end[0] - d.start[0])
      const h = Math.abs(d.end[1] - d.start[1])
      if (w * W < 4 || h * H < 4) return
      onAdd({ id: uid("ann"), type: "highlight", x, y, w, h, color: settings.highlightColor })
    }
  }

  const onAnnotationKeyDown = (e: React.KeyboardEvent, a: Annotation) => {
    if (editingId === a.id) return
    const step = e.shiftKey ? 10 : 1
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    if (arrows[e.key]) {
      e.preventDefault()
      e.stopPropagation()
      const [dx, dy] = visualDeltaToPage(...arrows[e.key])
      onUpdate(a.id, movePatch(a, dx, dy))
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault()
      e.stopPropagation()
      onRemove(a.id)
    } else if (e.key === "Enter" && a.type === "text") {
      e.preventDefault()
      onSelect(a.id)
      onStartEditing(a.id)
    } else if (e.key === "Escape") {
      onSelect(null)
    }
  }

  // ---- Rendering --------------------------------------------------------------
  const interactive = (a: Annotation) => tool === "select" || (tool === "text" && a.type === "text")
  const annotationA11y = (a: Annotation, label: string) => ({
    tabIndex: interactive(a) ? 0 : -1,
    role: "button" as const,
    "aria-label": label,
    "aria-pressed": selectedId === a.id,
    onKeyDown: (e: React.KeyboardEvent) => onAnnotationKeyDown(e, a),
    onFocus: () => {
      if (selectedId !== a.id && interactive(a)) onSelect(a.id)
    },
  })

  const vectorItems = annotations.filter((a) => a.type === "ink" || a.type === "highlight")
  const boxItems = annotations.filter((a): a is TextAnnotation | ImageAnnotation => a.type === "text" || a.type === "image")
  const draftRect =
    draft?.kind === "highlight"
      ? {
          x: Math.min(draft.start[0], draft.end[0]) * W,
          y: Math.min(draft.start[1], draft.end[1]) * H,
          w: Math.abs(draft.end[0] - draft.start[0]) * W,
          h: Math.abs(draft.end[1] - draft.start[1]) * H,
        }
      : null

  const inkPath = (points: [number, number][]) =>
    points.length === 1
      ? `M${points[0][0] * W} ${points[0][1] * H} l0.01 0`
      : points.map(([x, y], i) => `${i ? "L" : "M"}${(x * W).toFixed(2)} ${(y * H).toFixed(2)}`).join(" ")

  const pnSize = pageNumbers.fontSize
  const [pnVertical, pnHorizontal] = pageNumbers.position.split("-")

  return (
    <div
      ref={outerRef}
      className={cn(
        "relative mx-auto shrink-0 bg-white shadow-soft ring-1 ring-black/5 select-none",
        tool === "draw" || tool === "highlight" ? "cursor-crosshair touch-none" : tool === "text" ? "cursor-text touch-none" : "touch-pan-x touch-pan-y"
      )}
      style={{ width: VW * scale, height: VH * scale }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endPointer(e)}
      onPointerCancel={(e) => endPointer(e, true)}
      onMouseDown={(e) => {
        const t = e.target as HTMLElement
        if (t.tagName !== "TEXTAREA") e.preventDefault()
      }}
      aria-label={`Page ${pageIndex + 1} of ${pageCount}`}
      role="group"
    >
      {/* Unrotated page frame, rotated with CSS */}
      <div
        className="absolute top-1/2 left-1/2"
        style={{
          width: W * scale,
          height: H * scale,
          transform: `translate(-50%, -50%) rotate(${rot}deg)`,
        }}
      >
        <div ref={hostRef} className="absolute inset-0" />

        <svg
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          aria-hidden={vectorItems.length === 0}
        >
          {vectorItems.map((a) => {
            const selected = selectedId === a.id
            const pe = interactive(a) ? "auto" : "none"
            if (a.type === "highlight") {
              return (
                <g
                  key={a.id}
                  {...annotationA11y(a, "Highlight")}
                  className="outline-none"
                  style={{ pointerEvents: pe, cursor: tool === "select" ? "move" : undefined }}
                  onPointerDown={(e) => beginDrag(e, a, "move")}
                >
                  <rect
                    x={a.x * W}
                    y={a.y * H}
                    width={a.w * W}
                    height={a.h * H}
                    fill={a.color}
                    fillOpacity={0.4}
                    style={{ mixBlendMode: "multiply" }}
                  />
                  {selected && (
                    <rect
                      x={a.x * W}
                      y={a.y * H}
                      width={a.w * W}
                      height={a.h * H}
                      fill="none"
                      className="stroke-primary"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </g>
              )
            }
            const d = inkPath(a.points)
            let box: { x: number; y: number; w: number; h: number } | null = null
            if (selected) {
              const xs = a.points.map((p) => p[0] * W)
              const ys = a.points.map((p) => p[1] * H)
              const pad = a.width / 2 + 3
              box = {
                x: Math.min(...xs) - pad,
                y: Math.min(...ys) - pad,
                w: Math.max(...xs) - Math.min(...xs) + pad * 2,
                h: Math.max(...ys) - Math.min(...ys) + pad * 2,
              }
            }
            return (
              <g
                key={a.id}
                {...annotationA11y(a, "Drawing")}
                className="outline-none"
                style={{ pointerEvents: pe, cursor: tool === "select" ? "move" : undefined }}
                onPointerDown={(e) => beginDrag(e, a, "move")}
              >
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(a.width, 14 / scale)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pointerEvents: pe === "auto" ? "stroke" : "none" }}
                />
                <path d={d} fill="none" stroke={a.color} strokeWidth={a.width} strokeLinecap="round" strokeLinejoin="round" />
                {box && (
                  <rect
                    x={box.x}
                    y={box.y}
                    width={box.w}
                    height={box.h}
                    fill="none"
                    className="stroke-primary"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </g>
            )
          })}
          {draft?.kind === "ink" && (
            <path
              d={inkPath(draft.points)}
              fill="none"
              stroke={settings.penColor}
              strokeWidth={settings.penWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {draftRect && (
            <rect
              x={draftRect.x}
              y={draftRect.y}
              width={draftRect.w}
              height={draftRect.h}
              fill={settings.highlightColor}
              fillOpacity={0.4}
              style={{ mixBlendMode: "multiply" }}
            />
          )}
        </svg>

        {boxItems.map((a) => {
          const selected = selectedId === a.id
          const common = {
            className: cn(
              "absolute outline-none",
              interactive(a) ? "pointer-events-auto touch-none" : "pointer-events-none",
              tool === "select" && editingId !== a.id && "cursor-move",
              selected && "outline-2 outline-offset-2 outline-dashed outline-primary",
              !selected && interactive(a) && "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            ),
            style: {
              left: `${a.x * 100}%`,
              top: `${a.y * 100}%`,
              transform: `rotate(${a.rotation}deg)`,
              transformOrigin: "0 0",
            } as React.CSSProperties,
            onPointerDown: (e: React.PointerEvent) => beginDrag(e, a, "move"),
          }
          if (a.type === "image") {
            return (
              <div
                key={a.id}
                {...common}
                {...annotationA11y(a, "Signature")}
                style={{ ...common.style, width: a.width * scale, height: a.height * scale }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
                <img src={a.src} alt="" draggable={false} className="pointer-events-none size-full select-none" />
                {selected && tool === "select" && (
                  <span
                    aria-hidden
                    className="absolute -right-3.5 -bottom-3.5 flex size-7 cursor-nwse-resize touch-none items-center justify-center"
                    onPointerDown={(e) => beginDrag(e, a, "resize")}
                  >
                    <span className="size-3.5 rounded-full border-2 border-primary bg-background shadow-sm" />
                  </span>
                )}
              </div>
            )
          }
          const editing = editingId === a.id
          return (
            <div
              key={a.id}
              {...common}
              {...(editing ? {} : annotationA11y(a, `Text: ${a.text || "empty"}`))}
              onDoubleClick={() => {
                onSelect(a.id)
                onStartEditing(a.id)
              }}
              style={{
                ...common.style,
                fontSize: a.fontSize * scale,
                lineHeight: TEXT_LINE_HEIGHT,
                color: a.color,
                fontFamily: PDF_FONT_STACK,
              }}
            >
              {editing ? (
                <InlineTextEditor
                  value={a.text}
                  onChange={(text) => onUpdate(a.id, { text }, { record: false })}
                  onDone={onFinishEditing}
                />
              ) : (
                <span className="block whitespace-pre">{a.text || " "}</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Document-wide previews, drawn in the visual frame */}
      {watermark.enabled && watermark.text.trim() && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 whitespace-pre"
          style={{
            transform: `translate(-50%, -50%) rotate(${-watermark.angle}deg)`,
            fontSize: watermark.fontSize * scale,
            lineHeight: 1,
            color: watermark.color,
            opacity: watermark.opacity,
            fontFamily: PDF_FONT_STACK,
          }}
        >
          {watermark.text.trim()}
        </div>
      )}
      {pageNumbers.enabled && (
        <div
          aria-hidden
          className="pointer-events-none absolute whitespace-pre"
          style={{
            fontSize: pnSize * scale,
            lineHeight: 1,
            color: pageNumbers.color,
            fontFamily: PDF_FONT_STACK,
            ...(pnVertical === "top"
              ? { top: (PAGE_NUMBER_MARGIN - pnSize * 0.2) * scale }
              : { bottom: (PAGE_NUMBER_MARGIN - pnSize * 0.2) * scale }),
            ...(pnHorizontal === "left"
              ? { left: PAGE_NUMBER_MARGIN * scale }
              : pnHorizontal === "right"
                ? { right: PAGE_NUMBER_MARGIN * scale }
                : { left: "50%", transform: "translateX(-50%)" }),
          }}
        >
          {pageNumberLabel(pageNumbers.format, pageNumbers.start + pageIndex, pageNumbers.start + pageCount - 1)}
        </div>
      )}

      {bitmapSrc !== page.srcIndex && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {errorSrc !== page.srcIndex ? (
            <span className="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-soft">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Rendering page…
            </span>
          ) : (
            <span className="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs text-destructive shadow-soft">
              <TriangleAlert className="size-3.5" aria-hidden /> This page couldn&apos;t be rendered
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function InlineTextEditor({
  value,
  onChange,
  onDone,
}: {
  value: string
  onChange: (v: string) => void
  onDone: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const focus = () => {
      const el = ref.current
      if (!el || document.activeElement === el) return
      el.focus({ preventScroll: true })
      el.setSelectionRange(el.value.length, el.value.length)
    }
    // Focus synchronously (keeps the user gesture for mobile keyboards), and
    // again after the pointer interaction that created the editor finishes.
    focus()
    const id = window.setTimeout(focus, 0)
    return () => window.clearTimeout(id)
  }, [])
  return (
    <span className="relative inline-block min-w-[2ch]">
      <span className="invisible block whitespace-pre" aria-hidden>
        {(value || "Type here") + "​"}
      </span>
      <textarea
        ref={ref}
        value={value}
        placeholder="Type here"
        aria-label="Annotation text"
        wrap="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onDone}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
            e.preventDefault()
            ref.current?.blur()
          }
        }}
        className="absolute inset-0 m-0 block size-full resize-none overflow-hidden border-0 bg-primary/5 p-0 whitespace-pre outline-none placeholder:text-current placeholder:opacity-40"
        style={{ font: "inherit", lineHeight: "inherit", color: "inherit" }}
      />
    </span>
  )
}
