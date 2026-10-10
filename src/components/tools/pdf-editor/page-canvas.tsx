"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { LoaderCircle, TriangleAlert } from "lucide-react"
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
import { planLine, segmentsOnLine, type LineLayout } from "./line-reflow"

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
  /** Text highlight: from the anchor word to the focus word (indexes into the page's words). */
  | { kind: "text-highlight"; anchor: number; focus: number }

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
  const [typing, setTyping] = useState<{ text: string; style: InlineStyle } | null>(null)
  /** Saves the open inline edit; set by the editor while it's mounted. */
  const saveInlineRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (tool !== "edit-text" && tool !== "highlight") return
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

  const fontFaceOf = (b: EditableTextBlock) => (hasFontFace(b.fontFace) ? b.fontFace : undefined)
  const lineAnn = (line: EditableLine) => replaceAnns.find((a) => a.sourceId === line.id)
  const wholeAnn = (b: EditableTextBlock) => replaceAnns.find((a) => a.sourceId === b.id)
  // Right edge of the page's text column: the widest original line.
  const margin = blocks?.length ? Math.max(...blocks.flatMap((b) => b.lines.map((l) => (l.x + l.w) * W))) : W

  /**
   * Layout of every visual line touched by giving `block` the lines `newLines`:
   * text after an edit on the same line moves so nothing overlaps.
   */
  const planEdit = (block: EditableTextBlock, newLines: string[], fontSize: number): LineLayout[] | null => {
    if (!blocks || newLines.length !== block.lines.length || wholeAnn(block)) return null
    return block.lines.map((line) =>
      planLine({
        segments: segmentsOnLine(blocks, line, block, H),
        state: (seg) => {
          if (seg.block.id === block.id) return { text: newLines[seg.block.lines.indexOf(seg.line)] ?? seg.line.str, fontSize }
          const ex = wholeAnn(seg.block) ? undefined : lineAnn(seg.line)
          return { text: ex?.text ?? seg.line.str, fontSize: ex?.fontSize ?? seg.block.fontSize }
        },
        measure: (text, b, size) => measureWidth(text, b, fontFaceOf(b), size),
        justified: (seg) => justifiedSpacing(seg.line, seg.block, fontFaceOf(seg.block), W),
        W,
        margin,
      })
    )
  }

  // Word boxes for text-snapping highlights, in reading order.
  const words = useMemo(() => (blocks ? buildWordIndex(blocks, W, H) : []), [blocks, W, H])

  /**
   * Word under a page-space point. `strict`: only a word actually under the
   * finger (with a little slack); otherwise the nearest word on the nearest line.
   */
  const hitWord = (pt: [number, number], strict: boolean): number => {
    if (!words.length) return -1
    const [px, py] = pt
    const slackX = 3 / W
    const slackY = 2 / H
    let best = -1
    let bestScore = Infinity
    for (let i = 0; i < words.length; i++) {
      const w = words[i]
      const dy = py < w.y ? w.y - py : py > w.y + w.h ? py - (w.y + w.h) : 0
      const dx = px < w.x0 ? w.x0 - px : px > w.x1 ? px - w.x1 : 0
      if (strict && (dy > slackY || dx > slackX)) continue
      // Lines matter more than columns: stay on the line the finger is on.
      const score = dy * H * 20 + dx * W
      if (score < bestScore) {
        bestScore = score
        best = i
      }
    }
    return best
  }

  const startInlineEdit = (e: React.MouseEvent, block: EditableTextBlock) => {
    e.stopPropagation()
    if (editingId) onFinishEditing()
    const canvas = hostRef.current?.querySelector("canvas") || null
    const sampled = sampleColorsFromCanvas(canvas, block.x, block.y, block.w, block.h)
    const existing = annsForBlock(block)[0]
    const text = currentText(block)
    const fontFace = fontFaceOf(block)
    const shiftX = (block.lines.length === 1 && lineAnn(block.lines[0])?.shiftX) || 0

    // Put the caret where the user clicked, measured in the original font.
    let caret = text.length
    const r = outerRef.current?.getBoundingClientRect()
    if (r && rot === 0) {
      const px = ((e.clientX - r.left) / r.width) * W
      const py = ((e.clientY - r.top) / r.height) * H
      const textLines = text.split("\n")
      const li = clamp(Math.floor((py - block.y * H) / block.lineGap), 0, textLines.length - 1)
      const x0 = (block.lines[Math.min(li, block.lines.length - 1)]?.x ?? block.x) * W + shiftX
      caret = textLines.slice(0, li).reduce((n, l) => n + l.length + 1, 0) + caretColumn(textLines[li], px - x0, block, fontFace)
    }

    onSelect(null)
    setTyping(null)
    setInline({
      block,
      text,
      caret,
      color: existing?.color ?? block.color ?? sampled.textColor,
      bgColor: existing?.bgColor ?? sampled.bgColor,
      fontSize: existing?.fontSize ?? block.fontSize,
      fontFace,
      shiftX,
    })
  }

  interface Look {
    fontFace?: string
    color: string
    bgColor: string
    fontSize: number
  }

  const replaceAnnotation = (
    block: EditableTextBlock,
    look: Look,
    part: { sourceId: string; x: number; y: number; w: number; h: number; baselineY: number; original: string },
    text: string,
    layout: Pick<TextReplaceAnnotation, "shiftX" | "targetWidth" | "wordSpacing"> = {}
  ): TextReplaceAnnotation => ({
    id: uid("ann"),
    type: "text-replace",
    sourceId: part.sourceId,
    stripLines: block.lines
      .filter((l) => part.sourceId === block.id || l.id === part.sourceId)
      .map((l) => ({ x: l.x, w: l.w, baselineY: l.baselineY, size: block.fontSize })),
    x: part.x,
    y: part.y,
    w: part.w,
    h: part.h,
    baselineY: part.baselineY,
    text,
    originalText: part.original,
    fontSize: look.fontSize,
    color: look.color,
    bgColor: look.bgColor,
    fontFamily: block.fontFamily,
    fontWeight: block.fontWeight,
    rotation: 0,
    pdfFontName: block.pdfFontName || undefined,
    fontFace: look.fontFace,
    fontFallback: block.fontFallback,
    fontRealFamily: block.realFamily,
    fontWeightValue: block.weight,
    italic: block.italic,
    faceWeighted: block.faceWeighted,
    useOriginalFont: true,
    matrix: block.matrix,
    lineGap: block.lineGap * (look.fontSize / block.fontSize),
    ascent: block.ascent,
    descent: block.descent,
    ...layout,
  })

  /**
   * Save an inline edit. Unchanged lines stay untouched in the original PDF;
   * edited lines are redrawn, and text after them on the same line is moved
   * so it never overlaps (one undo step for all of it).
   */
  const commitInline = (s: InlineSession, text: string, style: InlineStyle) => {
    setInline(null)
    setTyping(null)
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
    const patch = (a: TextReplaceAnnotation, p: Partial<TextReplaceAnnotation>) => {
      const keys = Object.keys(p) as (keyof TextReplaceAnnotation)[]
      if (keys.every((k) => a[k] === p[k])) return
      onUpdate(a.id, p, { record: false })
      changed = true
    }

    const layouts = planEdit(block, newLines, style.fontSize)
    if (!layouts) {
      // Lines added or removed: the paragraph is replaced as one piece.
      anns.filter((a) => a !== whole).forEach((a) => remove(a.id))
      const same = newLines.length === original.length && newLines.every((l, i) => l === original[i])
      if (same && pristine) {
        if (whole) remove(whole.id)
      } else if (whole) {
        if (whole.text !== text || restyled) patch(whole, { text, ...stylePatch })
      } else {
        const first = block.lines[0]
        add(
          replaceAnnotation(
            block,
            { fontFace: s.fontFace, color: style.color, bgColor: s.bgColor, fontSize: style.fontSize },
            { sourceId: block.id, x: block.x, y: block.y, w: block.w, h: block.h, baselineY: first.baselineY, original: original.join("\n") },
            text
          )
        )
      }
    } else {
      const canvas = hostRef.current?.querySelector("canvas") || null
      for (const layout of layouts) {
        for (const seg of layout.segments) {
          const edited = seg.block.id === block.id
          if (!edited && wholeAnn(seg.block)) continue // replaced as a paragraph; leave it be
          const ex = lineAnn(seg.line)
          const segPristine = edited
            ? pristine
            : !ex || (ex.fontSize === seg.block.fontSize && (!seg.block.color || ex.color === seg.block.color))
          const fields = {
            text: seg.text,
            shiftX: Math.abs(seg.shiftX) > 0.05 ? seg.shiftX : undefined,
            targetWidth: seg.targetWidth,
            wordSpacing: seg.wordSpacing > 0.01 ? seg.wordSpacing : undefined,
          }
          if (!seg.changed && segPristine) {
            if (ex) remove(ex.id)
          } else if (ex) {
            patch(ex, edited ? { ...fields, ...stylePatch } : fields)
          } else {
            const look: Look = edited
              ? { fontFace: s.fontFace, color: style.color, bgColor: s.bgColor, fontSize: style.fontSize }
              : (() => {
                  const l = seg.line
                  const c = sampleColorsFromCanvas(canvas, l.x, l.y, l.w, l.h)
                  return {
                    fontFace: fontFaceOf(seg.block),
                    color: seg.block.color ?? c.textColor,
                    bgColor: c.bgColor,
                    fontSize: seg.block.fontSize,
                  }
                })()
            add(replaceAnnotation(seg.block, look, { ...seg.line, sourceId: seg.line.id, original: seg.line.str }, seg.text, fields))
          }
        }
      }
    }
    if (changed) onCommit(base)
  }

  // Live preview of the reflow while typing.
  const previewLayouts = inline && typing ? planEdit(inline.block, typing.text.split("\n"), typing.style.fontSize) : null
  const previewSegments = (previewLayouts ?? [])
    .flatMap((l) => l.segments)
    .filter((seg) => seg.block.id !== inline?.block.id && seg.changed && !wholeAnn(seg.block))
  const previewIds = new Set(previewSegments.map((seg) => seg.line.id))
  const editedLayout = previewLayouts?.[0]?.segments.find((seg) => seg.block.id === inline?.block.id)
  const overflow = previewLayouts ? Math.max(0, ...previewLayouts.map((l) => l.overflow)) : 0

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
    if (inline) {
      // A click anywhere on the page saves the inline edit. (The page cancels
      // mousedown's default for drawing, so the text box wouldn't lose focus.)
      saveInlineRef.current?.()
      return
    }
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
    // Highlight starting on text selects words like a text selection; elsewhere it draws a box.
    const word = tool === "highlight" ? hitWord(p, true) : -1
    const d: Draft =
      tool === "draw"
        ? { kind: "ink", points: [p] }
        : word >= 0
          ? { kind: "text-highlight", anchor: word, focus: word }
          : { kind: "highlight", start: p, end: p }
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
    } else if (d.kind === "text-highlight") {
      const focus = hitWord(toPage(e.clientX, e.clientY), false)
      if (focus < 0 || focus === d.focus) return
      const next: Draft = { ...d, focus }
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
    } else if (d.kind === "text-highlight") {
      // One highlight per line of the selection, added as a single undo step.
      const rects = selectionRects(words, d.anchor, d.focus)
      if (!rects.length) return
      const base = snapshot()
      for (const r of rects) onAdd({ id: uid("ann"), type: "highlight", ...r, color: settings.highlightColor }, { record: false })
      onCommit(base)
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
          {draft?.kind === "text-highlight" &&
            selectionRects(words, draft.anchor, draft.focus).map((r, i) => (
              <rect
                key={i}
                x={r.x * W}
                y={r.y * H}
                width={r.w * W}
                height={r.h * H}
                fill={settings.highlightColor}
                fillOpacity={0.4}
                style={{ mixBlendMode: "multiply" }}
              />
            ))}
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

        {/* All covers first, so a cover can never hide text redrawn next to it */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {replaceAnns
            .filter((a) => !(a.sourceId && previewIds.has(a.sourceId)))
            .map((a) => (
              <div
                key={`cover-${a.id}`}
                className="absolute"
                style={{
                  left: `calc(${a.x * 100}% - 1px)`,
                  top: `calc(${a.y * 100}% - 1px)`,
                  width: `calc(${a.w * 100}% + 2px)`,
                  height: `calc(${a.h * 100}% + 2px)`,
                  backgroundColor: a.bgColor || "#ffffff",
                }}
              />
            ))}
          {previewSegments.map((seg) => (
            <div
              key={`pcover-${seg.line.id}`}
              className="absolute"
              style={{
                left: `calc(${seg.line.x * 100}% - 1px)`,
                top: `calc(${seg.line.y * 100}% - 1px)`,
                width: `calc(${seg.line.w * 100}% + 2px)`,
                height: `calc(${seg.line.h * 100}% + 2px)`,
                backgroundColor: lineAnn(seg.line)?.bgColor ?? inline?.bgColor ?? "#ffffff",
              }}
            />
          ))}
          {inline && (
            <div
              className="absolute"
              style={{
                left: `calc(${inline.block.x * 100}% - 1px)`,
                top: `calc(${inline.block.y * 100}% - 1px)`,
                width: `calc(${inline.block.w * 100}% + 2px)`,
                height: `calc(${inline.block.h * 100}% + 2px)`,
                backgroundColor: inline.bgColor,
              }}
            />
          )}
        </div>

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
            // Replaced by the live reflow preview while typing.
            if (a.sourceId && previewIds.has(a.sourceId)) return null
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
                <span
                  className="pointer-events-none absolute whitespace-pre"
                  style={{
                    left: (a.shiftX ?? 0) * scale,
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
              // A single moved/edited line: follow the text to where it is now.
              const ann = block.lines.length === 1 ? lineAnn(block.lines[0]) : undefined
              const shift = ann?.shiftX ?? 0
              const widthPt = ann
                ? Math.max(block.w * W, ann.targetWidth ?? measureWidth(ann.text, block, fontFaceOf(block), ann.fontSize))
                : block.w * W
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
                    left: `calc(${block.x * 100}% + ${shift * scale}px)`,
                    top: `${block.y * 100}%`,
                    width: widthPt * scale,
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

        {/* Live reflow: text after the edit on the same line moves as you type */}
        {previewSegments.map((seg) => {
          const ex = lineAnn(seg.line)
          const metrics = lineMetrics({ ...seg.block, fontSize: seg.fontSize, baselineY: seg.line.baselineY, y: seg.line.y }, H)
          return (
            <div
              key={`preview-${seg.line.id}`}
              aria-hidden
              className="pointer-events-none absolute"
              style={{ left: `${seg.line.x * 100}%`, top: `${seg.line.y * 100}%`, width: `${seg.line.w * 100}%`, height: `${seg.line.h * 100}%` }}
            >
              <span
                className="absolute whitespace-pre"
                style={{
                  left: seg.shiftX * scale,
                  top: metrics.top * scale,
                  fontSize: seg.fontSize * scale,
                  lineHeight: `${metrics.lineGap * scale}px`,
                  wordSpacing: seg.wordSpacing ? seg.wordSpacing * scale : undefined,
                  color: ex?.color ?? seg.block.color ?? inline?.color,
                  ...blockFont(seg.block, fontFaceOf(seg.block)),
                }}
              >
                {seg.text}
              </span>
            </div>
          )
        })}

        {inline && (
          <InlineBlockEditor
            key={inline.block.id}
            session={inline}
            scale={scale}
            W={W}
            H={H}
            shiftX={editedLayout?.shiftX ?? inline.shiftX}
            wordSpacing={editedLayout?.wordSpacing}
            overflow={overflow}
            saveRef={saveInlineRef}
            onTyping={(text, style) => setTyping({ text, style })}
            onCommit={(text, style) => commitInline(inline, text, style)}
            onCancel={() => {
              setInline(null)
              setTyping(null)
            }}
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
  /** Saved horizontal shift (pt) of this line from earlier reflows. */
  shiftX: number
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

let measureCtx: CanvasRenderingContext2D | null = null

/** Natural width (pt) of `text` in the block's font at `fontSize`. */
function measureWidth(text: string, block: EditableTextBlock, fontFace: string | undefined, fontSize: number) {
  if (typeof document === "undefined") return 0
  measureCtx ??= document.createElement("canvas").getContext("2d")
  if (!measureCtx) return 0
  const f = blockFont(block, fontFace)
  measureCtx.font = `${f.fontStyle} ${f.fontWeight} ${fontSize}px ${f.fontFamily}`
  return measureCtx.measureText(text).width * (block.matrix[0] || 1)
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

function InlineBlockEditor({
  session,
  scale,
  W,
  H,
  shiftX,
  wordSpacing: plannedSpacing,
  overflow,
  saveRef,
  onTyping,
  onCommit,
  onCancel,
}: {
  session: InlineSession
  scale: number
  W: number
  H: number
  /** Where the line now starts relative to the original (pt), from the reflow plan. */
  shiftX: number
  /** Word spacing (pt) the reflow plan gives this line, when known. */
  wordSpacing?: number
  /** How far (pt) the edited line runs past the text margin. */
  overflow: number
  /** Receives a function that saves this edit (used for clicks elsewhere on the page). */
  saveRef: React.RefObject<(() => void) | null>
  onTyping: (text: string, style: InlineStyle) => void
  onCommit: (text: string, style: InlineStyle) => void
  onCancel: () => void
}) {
  const { block } = session
  const [value, setValue] = useState(session.text)
  // Colour and size changes happen in the side panel / options dialog after saving.
  const color = session.color
  const fontSize = session.fontSize
  const ref = useRef<HTMLTextAreaElement>(null)
  const done = useRef(false)

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

  // Load the look-alike font early so characters missing from the embedded
  // subset already preview the way they'll export.
  useEffect(() => {
    void ensureLookalikeFace(block)
  }, [block])

  // Report every change so the page can reflow the rest of the line live.
  useEffect(() => {
    onTyping(value, { color, fontSize })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onTyping is a fresh closure each render
  }, [value])

  const finish = (cancel: boolean) => {
    if (done.current) return
    done.current = true
    if (cancel) onCancel()
    else onCommit(value, { color, fontSize })
  }
  useEffect(() => {
    saveRef.current = () => finish(false)
    return () => {
      saveRef.current = null
    }
  })

  // Any press outside the editor saves it (other pages, the sidebar, toolbars…).
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) saveRef.current?.()
    }
    document.addEventListener("pointerdown", onDown, true)
    return () => document.removeEventListener("pointerdown", onDown, true)
  }, [saveRef])

  const ratio = fontSize / block.fontSize
  const metrics = lineMetrics({ ...block, fontSize, lineGap: block.lineGap * ratio, baselineY: block.lines[0].baselineY }, H)
  const font = blockFont(block, session.fontFace)
  const x0 = (block.lines[0].x - block.x) * W
  const wordSpacing =
    plannedSpacing ?? (block.lines.length === 1 ? justifiedSpacing(block.lines[0], block, session.fontFace, W) : 0)
  const lines = value.split("\n")
  const addedLines = lines.length - block.lines.length
  const missing = missingChars(value, block)
  // Only speak up when something needs attention; no toolbar otherwise.
  const notes = [
    overflow > 0.5 && `Runs ${Math.round(overflow)}pt past the margin — shorten it or press Enter for a new line.`,
    addedLines > 0 && "New lines go below — make sure there's free space there.",
    missing.length > 0 && `${missing.slice(0, 6).join(" ")} not in this PDF's font; a look-alike is used for ${missing.length === 1 ? "it" : "them"}.`,
  ].filter((n): n is string => Boolean(n))

  return (
    <div
      ref={rootRef}
      className="absolute z-20"
      style={{ left: `${block.x * 100}%`, top: `${block.y * 100}%`, width: `${block.w * 100}%`, height: `${block.h * 100}%` }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span
        className="absolute block rounded-[1px] outline-2 outline-offset-2 outline-primary"
        style={{
          left: (x0 + shiftX) * scale,
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
          aria-label="Edit PDF text. Click outside or press Ctrl+Enter to save, Escape to cancel."
          wrap="off"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => finish(false)}
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
        {notes.length > 0 && (
          <span
            role="status"
            className="pointer-events-none absolute top-full left-0 mt-1.5 w-max max-w-[min(80vw,420px)] rounded-md bg-foreground/90 px-2 py-1 text-[11px] leading-snug font-normal not-italic text-background shadow-soft"
            style={{ fontFamily: "var(--font-sans), system-ui, sans-serif", wordSpacing: "normal" }}
          >
            {notes.map((n) => (
              <span key={n} className="block">
                {n}
              </span>
            ))}
          </span>
        )}
      </span>
    </div>
  )
}

// ---- Text-snapping highlights ---------------------------------------------------

interface WordBox {
  /** Normalised page-space box. */
  x0: number
  x1: number
  y: number
  h: number
  /** Index of its line in reading order. */
  line: number
}

/** Every word on the page, in reading order, positioned with the original font's metrics. */
function buildWordIndex(blocks: EditableTextBlock[], W: number, H: number): WordBox[] {
  const lines = blocks
    .flatMap((b) => b.lines.map((l) => ({ b, l })))
    .sort((a, c) => (Math.abs(a.l.baselineY - c.l.baselineY) * H < 2 ? a.l.x - c.l.x : a.l.baselineY - c.l.baselineY))
  const out: WordBox[] = []
  lines.forEach(({ b, l }, lineIndex) => {
    const face = hasFontFace(b.fontFace) ? b.fontFace : undefined
    const full = measureWidth(l.str, b, face, b.fontSize)
    // Scale measured widths to the line's real width (covers justification and font differences).
    const k = full > 0 ? (l.w * W) / full : 1
    const re = /\S+/g
    let m: RegExpExecArray | null
    while ((m = re.exec(l.str))) {
      const start = measureWidth(l.str.slice(0, m.index), b, face, b.fontSize) * k
      const end = measureWidth(l.str.slice(0, m.index + m[0].length), b, face, b.fontSize) * k
      out.push({ x0: l.x + start / W, x1: l.x + end / W, y: l.y, h: l.h, line: lineIndex })
    }
  })
  return out
}

/** Highlight rectangles (one per line) for the words between two indexes, inclusive. */
function selectionRects(words: WordBox[], a: number, b: number) {
  if (a < 0 || b < 0 || !words.length) return []
  const [from, to] = a <= b ? [a, b] : [b, a]
  const byLine: Record<number, { x0: number; x1: number; y: number; h: number }> = {}
  for (let i = from; i <= to && i < words.length; i++) {
    const w = words[i]
    const r = byLine[w.line]
    if (!r) byLine[w.line] = { x0: w.x0, x1: w.x1, y: w.y, h: w.h }
    else {
      r.x0 = Math.min(r.x0, w.x0)
      r.x1 = Math.max(r.x1, w.x1)
      r.y = Math.min(r.y, w.y)
      r.h = Math.max(r.h, w.h)
    }
  }
  return Object.values(byLine).map((r) => ({ x: r.x0, y: r.y, w: Math.max(0.001, r.x1 - r.x0), h: r.h }))
}
