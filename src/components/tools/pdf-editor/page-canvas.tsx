"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { Check, LoaderCircle, Minus, Plus, TriangleAlert, Type } from "lucide-react"
import {
  normalizeRotation,
  pageNumberLabel,
  PAGE_NUMBER_MARGIN,
  PDF_FONT_STACK,
  replaceFontCss,
  TEXT_BASELINE,
  TEXT_LINE_HEIGHT,
  viewToPage,
  visualSize,
  type Annotation,
  type EditorPage,
  type ImageAnnotation,
  type PageNumberSettings,
  type TextAnnotation,
  type TextReplaceAnnotation,
  type WatermarkSettings,
} from "@/lib/pdf/edit"
import { loadLookalikeFile, lookalikeFontId } from "@/lib/pdf/font-info"
import { cn } from "@/lib/utils"
import { capScale, renderPage } from "./pdf-render"
import { uid, type ApplyOptions, type DocState } from "./use-editor-state"
import type { Tool, ToolSettings } from "./types"
import {
  extractEditableBlocks,
  sampleColorsFromCanvas,
  type EditableLine,
  type EditableTextBlock,
} from "./text-replace-helper"
import { TextReplaceModal, type TextReplaceValues } from "./text-replace-modal"

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
  onRemove: (id: string, opts?: ApplyOptions) => void
  /** Record one undo step for changes applied since `base` with `record: false`. */
  onCommit: (base: DocState) => void
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
    onCommit,
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

  // ---- Editable text (Edit text tool) -----------------------------------
  const [blocksState, setBlocksState] = useState<{ src: number; blocks: EditableTextBlock[] } | null>(null)
  const blocks = blocksState?.src === page.srcIndex ? blocksState.blocks : null
  const [inline, setInline] = useState<InlineSession | null>(null)
  const [modalId, setModalId] = useState<string | null>(null)

  useEffect(() => {
    if (tool !== "edit-text") return
    let active = true
    loadBlocks(pdf, page.srcIndex)
      .then((list) => active && setBlocksState({ src: page.srcIndex, blocks: list }))
      .catch((err) => {
        console.error("[PDF text extraction]", err)
        if (active) setBlocksState({ src: page.srcIndex, blocks: [] })
      })
    return () => {
      active = false
    }
  }, [pdf, page.srcIndex, tool])

  const replaceAnns = annotations.filter((a): a is TextReplaceAnnotation => a.type === "text-replace")
  const annsForBlock = (block: EditableTextBlock) =>
    replaceAnns.filter((a) => a.sourceId === block.id || a.sourceId?.startsWith(`${block.id}-l`))

  /** Current text of a block: original lines, with any saved replacements applied. */
  const currentText = (block: EditableTextBlock) => {
    const anns = annsForBlock(block)
    const whole = anns.find((a) => a.sourceId === block.id)
    if (whole) return whole.text
    return block.lines.map((l) => anns.find((a) => a.sourceId === l.id)?.text ?? l.str).join("\n")
  }

  const startInlineEdit = (e: React.MouseEvent, block: EditableTextBlock) => {
    e.stopPropagation()
    if (editingId) onFinishEditing()
    const canvas = hostRef.current?.querySelector("canvas") || null
    const sampled = sampleColorsFromCanvas(canvas, block.x, block.y, block.w, block.h)
    const existing = annsForBlock(block)[0]
    const text = currentText(block)
    const fontFace = hasFontFace(block.fontFace) ? block.fontFace : undefined

    // Put the caret where the user clicked, measured in the original font.
    let caret = text.length
    const r = outerRef.current?.getBoundingClientRect()
    if (r && rot === 0) {
      const px = ((e.clientX - r.left) / r.width) * W
      const py = ((e.clientY - r.top) / r.height) * H
      const textLines = text.split("\n")
      const li = clamp(Math.floor((py - block.y * H) / block.lineGap), 0, textLines.length - 1)
      const x0 = (block.lines[Math.min(li, block.lines.length - 1)]?.x ?? block.x) * W
      caret = textLines.slice(0, li).reduce((n, l) => n + l.length + 1, 0) + caretColumn(textLines[li], px - x0, block, fontFace)
    }

    onSelect(null)
    setInline({
      block,
      text,
      caret,
      color: existing?.color ?? block.color ?? sampled.textColor,
      bgColor: existing?.bgColor ?? sampled.bgColor,
      fontSize: existing?.fontSize ?? block.fontSize,
      fontFace,
    })
  }

  const replaceAnnotation = (
    s: InlineSession,
    style: InlineStyle,
    part: { sourceId: string; x: number; y: number; w: number; h: number; baselineY: number; original: string },
    text: string
  ): TextReplaceAnnotation => ({
    id: uid("ann"),
    type: "text-replace",
    sourceId: part.sourceId,
    stripLines: s.block.lines
      .filter((l) => part.sourceId === s.block.id || l.id === part.sourceId)
      .map((l) => ({ x: l.x, w: l.w, baselineY: l.baselineY, size: s.block.fontSize })),
    x: part.x,
    y: part.y,
    w: part.w,
    h: part.h,
    baselineY: part.baselineY,
    text,
    originalText: part.original,
    fontSize: style.fontSize,
    color: style.color,
    bgColor: s.bgColor,
    fontFamily: s.block.fontFamily,
    fontWeight: s.block.fontWeight,
    rotation: 0,
    pdfFontName: s.block.pdfFontName || undefined,
    fontFace: s.fontFace,
    fontFallback: s.block.fontFallback,
    fontRealFamily: s.block.realFamily,
    fontWeightValue: s.block.weight,
    italic: s.block.italic,
    faceWeighted: s.block.faceWeighted,
    useOriginalFont: true,
    matrix: s.block.matrix,
    lineGap: s.block.lineGap * (style.fontSize / s.block.fontSize),
    ascent: s.block.ascent,
    descent: s.block.descent,
    // Keep a justified line's wider word spacing on screen (single lines only).
    wordSpacing: part.sourceId === s.block.id && s.block.lines.length > 1 ? undefined : justifiedSpacing(
      s.block.lines.find((l) => l.id === part.sourceId) ?? s.block.lines[0], s.block, s.fontFace, W
    ) || undefined,
  })

  /**
   * Save an inline edit. Lines that didn't change are left untouched in the
   * original PDF; only edited lines get covered and redrawn.
   */
  const commitInline = (s: InlineSession, text: string, style: InlineStyle) => {
    setInline(null)
    const { block } = s
    const base = snapshot()
    const anns = annsForBlock(block)
    const whole = anns.find((a) => a.sourceId === block.id)
    const newLines = text.replace(/\r\n/g, "\n").split("\n")
    const original = block.lines.map((l) => l.str)
    const restyled = style.color !== s.color || style.fontSize !== s.fontSize
    const stylePatch = { color: style.color, fontSize: style.fontSize, lineGap: block.lineGap * (style.fontSize / block.fontSize) }
    // An untouched line in the original colour/size needs no replacement at all.
    const pristine = style.fontSize === block.fontSize && (!block.color || style.color === block.color)
    let changed = false
    const add = (a: TextReplaceAnnotation) => {
      onAdd(a, { record: false })
      changed = true
    }
    const remove = (id: string) => {
      onRemove(id, { record: false })
      changed = true
    }
    const update = (a: TextReplaceAnnotation, next: string) => {
      if (a.text === next && !restyled) return
      onUpdate(a.id, { text: next, ...stylePatch }, { record: false })
      changed = true
    }

    if (whole || newLines.length !== original.length) {
      const lineAnns = anns.filter((a) => a !== whole)
      lineAnns.forEach((a) => remove(a.id))
      const same = newLines.length === original.length && newLines.every((l, i) => l === original[i])
      if (same && pristine) {
        if (whole) remove(whole.id)
      } else if (whole) {
        update(whole, text)
      } else {
        const first = block.lines[0]
        add(
          replaceAnnotation(
            s,
            style,
            { sourceId: block.id, x: block.x, y: block.y, w: block.w, h: block.h, baselineY: first.baselineY, original: original.join("\n") },
            text
          )
        )
      }
    } else {
      block.lines.forEach((line, i) => {
        const next = newLines[i]
        const ex = anns.find((a) => a.sourceId === line.id)
        if (next === line.str && pristine) {
          if (ex) remove(ex.id)
        } else if (ex) {
          update(ex, next)
        } else if (next !== line.str || restyled) {
          add(replaceAnnotation(s, style, { ...line, sourceId: line.id, original: line.str }, next))
        }
      })
    }
    if (changed) onCommit(base)
  }

  // Side-panel "Edit text" / double-click opens the detailed options dialog.
  const modalAnn = replaceAnns.find((a) => a.id === (modalId ?? editingId))
  const handleEditExistingReplace = (a: TextReplaceAnnotation) => {
    onSelect(a.id)
    setModalId(a.id)
  }

  const handleApplyReplace = (values: TextReplaceValues) => {
    if (!modalAnn) return
    onUpdate(modalAnn.id, {
      text: values.text,
      fontSize: values.fontSize,
      fontFamily: values.fontFamily,
      fontWeight: values.fontWeight,
      useOriginalFont: values.useOriginalFont,
      color: values.textColor,
      bgColor: values.bgColor,
    })
  }

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
      case "text-replace": {
        const y = clamp(a.y + dy, 0, 1 - a.h)
        return {
          x: clamp(a.x + dx, 0, 1 - a.w),
          y,
          ...(a.baselineY !== undefined ? { baselineY: a.baselineY + (y - a.y) } : {}),
        }
      }
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
    if (tool === "select" || tool === "edit-text") {
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
    } else if (e.key === "Enter" && (a.type === "text" || a.type === "text-replace")) {
      e.preventDefault()
      if (a.type === "text-replace") {
        handleEditExistingReplace(a)
      } else {
        onSelect(a.id)
        onStartEditing(a.id)
      }
    } else if (e.key === "Escape") {
      onSelect(null)
    }
  }

  // ---- Rendering --------------------------------------------------------------
  const interactive = (a: Annotation) =>
    tool === "select" ||
    tool === "edit-text" ||
    (tool === "text" && a.type === "text")
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
  const boxItems = annotations.filter(
    (a): a is TextAnnotation | ImageAnnotation | TextReplaceAnnotation =>
      a.type === "text" || a.type === "image" || a.type === "text-replace"
  )
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
        if (t.tagName !== "TEXTAREA" && !t.closest(".pdf-text-layer")) e.preventDefault()
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
          if (a.type === "text-replace") {
            // Hidden while its paragraph is open in the inline editor.
            if (inline && a.sourceId && (a.sourceId === inline.block.id || a.sourceId.startsWith(`${inline.block.id}-l`))) return null
            const original = Boolean(a.fontFace) && a.useOriginalFont !== false
            const metrics = lineMetrics(a, H)
            return (
              <div
                key={a.id}
                {...common}
                {...annotationA11y(a, `Edited text: ${a.text || a.originalText || "empty"}`)}
                onDoubleClick={() => handleEditExistingReplace(a)}
                style={{ ...common.style, width: `${a.w * 100}%`, height: `${a.h * 100}%` }}
                title="Edited text. Double-click for font and colour options."
              >
                {/* Cover that hides the original glyphs on the rendered page */}
                <div className="pointer-events-none absolute -inset-px" style={{ backgroundColor: a.bgColor || "#ffffff" }} />
                <span
                  className="pointer-events-none absolute left-0 whitespace-pre"
                  style={{
                    top: metrics.top * scale,
                    fontSize: a.fontSize * scale,
                    lineHeight: `${metrics.lineGap * scale}px`,
                    wordSpacing: a.wordSpacing ? a.wordSpacing * scale : undefined,
                    color: a.color,
                    fontFamily: replaceFontCss(a),
                    // pdf.js's own face is declared regular; ours carries the real weight/style.
                    fontWeight: original && !a.faceWeighted ? 400 : (a.fontWeightValue ?? a.fontWeight),
                    fontStyle: a.italic && (!original || a.faceWeighted) ? "italic" : "normal",
                  }}
                >
                  {a.text || " "}
                </span>
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

        {/* Editable text layer: every heading/paragraph on the page is a click target.
            Only in the Edit text tool, so it doesn't steal taps from annotations. */}
        {tool === "edit-text" && blocks && (
          <div className="pdf-text-layer pointer-events-none absolute inset-0">
            {blocks.map((block) => {
              if (inline?.block.id === block.id) return null
              const edited = annsForBlock(block).length > 0
              return (
                <button
                  key={block.id}
                  type="button"
                  className={cn(
                    "pointer-events-auto absolute cursor-text rounded-xs outline-none transition-[box-shadow,background-color]",
                    "hover:bg-primary/8 hover:ring-1 hover:ring-primary/70 focus-visible:ring-2 focus-visible:ring-primary",
                    edited && "ring-1 ring-primary/30"
                  )}
                  style={{
                    left: `${block.x * 100}%`,
                    top: `${block.y * 100}%`,
                    width: `${block.w * 100}%`,
                    height: `${block.h * 100}%`,
                  }}
                  aria-label={`Edit text: ${currentText(block).slice(0, 80)}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => startInlineEdit(e, block)}
                />
              )
            })}
          </div>
        )}

        {inline && (
          <InlineBlockEditor
            key={inline.block.id}
            session={inline}
            scale={scale}
            W={W}
            H={H}
            onCommit={(text, style) => commitInline(inline, text, style)}
            onCancel={() => setInline(null)}
          />
        )}
      </div>

      {tool === "edit-text" && bitmapSrc === page.srcIndex && (!blocks || blocks.length === 0) && (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
          <span className="flex items-center gap-2 rounded-full bg-background/95 px-3 py-1.5 text-xs text-muted-foreground shadow-soft">
            {!blocks ? (
              <>
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Finding editable text…
              </>
            ) : (
              <>
                <TriangleAlert className="size-3.5 text-warning" aria-hidden /> No editable text on this page — it may be a
                scanned image.
              </>
            )}
          </span>
        </div>
      )}

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
      {modalAnn && (
        <TextReplaceModal
          key={modalAnn.id}
          open
          onClose={() => {
            setModalId(null)
            onFinishEditing()
          }}
          originalText={modalAnn.originalText ?? modalAnn.text}
          originalFont={
            modalAnn.fontFace
              ? { face: modalAnn.fontFace, fallback: modalAnn.fontFallback, name: modalAnn.pdfFontName }
              : undefined
          }
          initialValues={{
            text: modalAnn.text,
            fontSize: modalAnn.fontSize,
            fontFamily: modalAnn.fontFamily,
            fontWeight: modalAnn.fontWeight,
            useOriginalFont: Boolean(modalAnn.fontFace) && modalAnn.useOriginalFont !== false,
            textColor: modalAnn.color,
            bgColor: modalAnn.bgColor,
          }}
          onApply={handleApplyReplace}
          onErase={() => onUpdate(modalAnn.id, { text: "" })}
        />
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

// ---- Inline text editing ------------------------------------------------------

interface InlineSession {
  block: EditableTextBlock
  text: string
  caret: number
  color: string
  bgColor: string
  fontSize: number
  /** Set when the original font is loaded in the browser. */
  fontFace?: string
}

interface InlineStyle {
  color: string
  fontSize: number
}

const blockCache = new WeakMap<PDFDocumentProxy, Map<number, Promise<EditableTextBlock[]>>>()

/** Extract a page's editable text once per document. */
function loadBlocks(pdf: PDFDocumentProxy, srcIndex: number) {
  let byPage = blockCache.get(pdf)
  if (!byPage) {
    byPage = new Map()
    blockCache.set(pdf, byPage)
  }
  let job = byPage.get(srcIndex)
  if (!job) {
    const map = byPage
    job = pdf.getPage(srcIndex + 1).then((p) => extractEditableBlocks(p, `p${srcIndex}`))
    job.catch(() => map.delete(srcIndex))
    map.set(srcIndex, job)
  }
  return job
}

function hasFontFace(face: string) {
  try {
    for (const f of document.fonts) {
      if (f.family.replace(/^["']|["']$/g, "") === face && f.status === "loaded") return true
    }
  } catch {
    /* FontFaceSet iteration unsupported */
  }
  return false
}

const lookalikeFaces = new Map<string, Promise<string | null>>()

/**
 * Load the open look-alike font (e.g. Carlito for Calibri) as a web font so
 * characters missing from the embedded subset preview like they will export.
 */
function ensureLookalikeFace(block: EditableTextBlock) {
  const id = lookalikeFontId(block.realFamily)
  if (!id || typeof FontFace === "undefined") return Promise.resolve(null)
  const key = `${id}:${block.weight}:${block.italic}`
  let job = lookalikeFaces.get(key)
  if (!job) {
    job = loadLookalikeFile(id, block.weight, block.italic, "latin")
      .then(async (file) => {
        if (!file) return null
        const family = `lk-fb-${id}`
        const face = new FontFace(family, file.bytes.slice(), {
          weight: String(block.weight),
          style: block.italic ? "italic" : "normal",
        })
        await face.load()
        document.fonts.add(face)
        return family
      })
      .catch(() => null)
    lookalikeFaces.set(key, job)
  }
  return job
}

/** CSS font for a block: the original face first, then the real family, then its look-alike. */
function blockFont(block: EditableTextBlock, fontFace: string | undefined) {
  return {
    fontFamily: replaceFontCss({
      fontFace,
      fontFallback: block.fontFallback,
      fontFamily: block.fontFamily,
      fontRealFamily: block.realFamily,
    }),
    // pdf.js's own face is declared regular; ours carries the real weight/style.
    fontWeight: fontFace && !block.faceWeighted ? 400 : block.weight,
    fontStyle: block.italic && (!fontFace || block.faceWeighted) ? "italic" : "normal",
  } as const
}

/** Characters the embedded font doesn't contain (empty when coverage is unknown). */
function missingChars(text: string, block: EditableTextBlock) {
  if (!block.coverage.size) return []
  const out = new Set<string>()
  for (const ch of Array.from(text)) {
    if (!/\s/.test(ch) && !block.coverage.has(ch.codePointAt(0)!)) out.add(ch)
  }
  return [...out]
}

/** Extra space width (pt) a justified line was drawn with; 0 for normal spacing. */
function justifiedSpacing(line: EditableLine, block: EditableTextBlock, fontFace: string | undefined, W: number) {
  const spaces = (line.str.match(/ /g) ?? []).length
  if (!spaces || typeof document === "undefined") return 0
  const ctx = document.createElement("canvas").getContext("2d")
  if (!ctx) return 0
  const f = blockFont(block, fontFace)
  ctx.font = `${f.fontStyle} ${f.fontWeight} ${block.fontSize}px ${f.fontFamily}`
  const extra = (line.w * W - ctx.measureText(line.str).width * (block.matrix[0] || 1)) / spaces
  return extra > block.fontSize * 0.03 && extra < block.fontSize ? extra : 0
}

/** Index in `line` closest to `xPt` points from the line start. */
function caretColumn(line: string, xPt: number, block: EditableTextBlock, fontFace: string | undefined) {
  const ctx = document.createElement("canvas").getContext("2d")
  if (!ctx) return line.length
  const f = blockFont(block, fontFace)
  ctx.font = `${f.fontStyle} ${f.fontWeight} ${block.fontSize}px ${f.fontFamily}`
  const sx = block.matrix[0] || 1
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i <= line.length; i++) {
    const d = Math.abs(ctx.measureText(line.slice(0, i)).width * sx - xPt)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

/** Line height and the offset (pt) from the cover top to the first CSS line box. */
function lineMetrics(
  a: { fontSize: number; lineGap?: number; ascent?: number; descent?: number; baselineY?: number; y: number },
  H: number
) {
  const lineGap = a.lineGap ?? a.fontSize * TEXT_LINE_HEIGHT
  const asc = a.ascent ?? 0.8
  const desc = a.descent ?? 0.2
  const baseOff = a.baselineY !== undefined ? (a.baselineY - a.y) * H : a.fontSize * TEXT_BASELINE
  // CSS centres the font's ascent+descent inside each line box.
  const top = baseOff - ((lineGap - (asc + desc) * a.fontSize) / 2 + asc * a.fontSize)
  return { lineGap, top }
}

const stripSubset = (name: string) => name.replace(/^[A-Z]{6}\+/, "")

function InlineBlockEditor({
  session,
  scale,
  W,
  H,
  onCommit,
  onCancel,
}: {
  session: InlineSession
  scale: number
  W: number
  H: number
  onCommit: (text: string, style: InlineStyle) => void
  onCancel: () => void
}) {
  const { block } = session
  const [value, setValue] = useState(session.text)
  const [color, setColor] = useState(session.color)
  const [fontSize, setFontSize] = useState(session.fontSize)
  const [lookalike, setLookalike] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)
  const done = useRef(false)
  // The colour input briefly takes focus; that blur isn't "done editing".
  const inToolbar = useRef(false)

  useLayoutEffect(() => {
    const focus = () => {
      const el = ref.current
      if (!el || document.activeElement === el) return
      el.focus({ preventScroll: true })
      el.setSelectionRange(session.caret, session.caret)
    }
    focus()
    const id = window.setTimeout(focus, 0)
    return () => window.clearTimeout(id)
  }, [session.caret])

  useEffect(() => {
    let active = true
    void ensureLookalikeFace(block).then((family) => active && setLookalike(family))
    return () => {
      active = false
    }
  }, [block])

  const finish = (cancel: boolean) => {
    if (done.current) return
    done.current = true
    if (cancel) onCancel()
    else onCommit(value, { color, fontSize })
  }

  const ratio = fontSize / block.fontSize
  const metrics = lineMetrics({ ...block, fontSize, lineGap: block.lineGap * ratio, baselineY: block.lines[0].baselineY }, H)
  const font = blockFont(block, session.fontFace)
  const x0 = (block.lines[0].x - block.x) * W
  const wordSpacing = block.lines.length === 1 ? justifiedSpacing(block.lines[0], block, session.fontFace, W) : 0
  const missing = missingChars(value, block)
  const fontLabel = (session.fontFace && (block.realFamily || stripSubset(block.pdfFontName))) || "Similar font"
  const weightLabel = block.weight >= 600 ? " Bold" : ""
  const lookalikeName = lookalikeFontId(block.realFamily)?.replace(/-/g, " ")
  const stepSize = (d: number) => setFontSize((s) => Math.max(4, Math.min(144, Math.round((s + d) * 10) / 10)))

  return (
    <div
      className="absolute z-20"
      style={{ left: `${block.x * 100}%`, top: `${block.y * 100}%`, width: `${block.w * 100}%`, height: `${block.h * 100}%` }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Hide the original glyphs while typing */}
      <div className="pointer-events-none absolute -inset-px" style={{ backgroundColor: session.bgColor }} />

      {/* Floating toolbar */}
      <div
        className="absolute bottom-full left-0 z-10 mb-2 flex w-max max-w-[min(92vw,560px)] flex-wrap items-center gap-1 rounded-xl border bg-popover p-1 text-popover-foreground shadow-soft"
        onMouseDown={(e) => {
          // Keep focus in the text box, except for the colour input which needs it.
          if ((e.target as HTMLElement).tagName !== "INPUT") e.preventDefault()
          else inToolbar.current = true
        }}
      >
        <span className="flex min-w-0 items-center gap-1.5 px-2 text-xs" title={block.pdfFontName}>
          <Type className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="max-w-40 truncate font-medium">
            {fontLabel}
            {session.fontFace ? weightLabel : ""}
          </span>
        </span>
        <span className="h-6 w-px bg-border" aria-hidden />
        <label className="relative flex size-10 cursor-pointer items-center justify-center rounded-md hover:bg-muted" title="Text colour">
          <span className="size-5 rounded-full border shadow-xs" style={{ backgroundColor: color }} />
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(color) ? color : "#000000"}
            onChange={(e) => setColor(e.target.value)}
            onBlur={() => {
              inToolbar.current = false
              ref.current?.focus({ preventScroll: true })
            }}
            aria-label="Text colour"
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <div className="flex items-center rounded-md border">
          <button type="button" onClick={() => stepSize(-0.5)} className="flex size-10 items-center justify-center hover:bg-muted" aria-label="Smaller text">
            <Minus className="size-3.5" aria-hidden />
          </button>
          <span className="w-12 text-center font-mono text-xs tabular-nums">{fontSize}pt</span>
          <button type="button" onClick={() => stepSize(0.5)} className="flex size-10 items-center justify-center hover:bg-muted" aria-label="Larger text">
            <Plus className="size-3.5" aria-hidden />
          </button>
        </div>
        <span className="h-6 w-px bg-border" aria-hidden />
        <button type="button" onClick={() => finish(true)} className="flex h-10 items-center rounded-md px-3 text-xs font-medium hover:bg-muted">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => finish(false)}
          className="flex h-10 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Check className="size-3.5" aria-hidden /> Done
        </button>
        {missing.length > 0 && (
          <p className="basis-full px-2 pb-1 text-[11px] leading-snug text-muted-foreground">
            <span className="font-medium text-foreground">{missing.slice(0, 6).join(" ")}</span>{" "}
            {missing.length === 1 ? "isn’t" : "aren’t"} in this PDF’s embedded font, so {missing.length === 1 ? "it’s" : "they’re"}{" "}
            drawn with {lookalike && lookalikeName ? <span className="capitalize">{lookalikeName}</span> : "a similar font"}
            {lookalike ? " (a look-alike)" : ""}. Everything else keeps the original font.
          </p>
        )}
      </div>

      <span
        className="absolute block rounded-[1px] outline-2 outline-offset-2 outline-primary"
        style={{
          left: x0 * scale,
          top: metrics.top * scale,
          fontSize: fontSize * scale,
          lineHeight: `${metrics.lineGap * scale}px`,
          wordSpacing: wordSpacing ? wordSpacing * scale : undefined,
          color,
          ...font,
        }}
      >
        <span className="invisible block whitespace-pre" aria-hidden>
          {value + "​"}
        </span>
        <textarea
          ref={ref}
          value={value}
          aria-label="Edit PDF text"
          wrap="off"
          spellCheck={false}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            if (!inToolbar.current) finish(false)
          }}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === "Escape") {
              e.preventDefault()
              finish(true)
            } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              finish(false)
            }
          }}
          className="absolute inset-0 m-0 block size-full resize-none overflow-hidden border-0 bg-transparent p-0 whitespace-pre outline-none selection:bg-primary/25"
          style={{ font: "inherit", lineHeight: "inherit", wordSpacing: "inherit", color: "inherit", caretColor: color }}
        />
      </span>
    </div>
  )
}
