import type { EditableLine, EditableTextBlock } from "./text-replace-helper"

/**
 * Same-line reflow: when an edit makes a piece of a line wider or narrower,
 * everything after it on that visual line moves by the difference, so text
 * never overlaps and gaps close up. On a justified line the last piece absorbs
 * the change by adjusting its word spacing, keeping the right margin straight.
 *
 * Widths are in PDF points. `measure` returns the natural (unjustified) width.
 */

export interface Segment {
  block: EditableTextBlock
  line: EditableLine
}

export interface SegmentState {
  text: string
  fontSize: number
}

export interface SegmentLayout extends Segment {
  text: string
  fontSize: number
  /** Horizontal shift from the original position. */
  shiftX: number
  /** Width the text should occupy (spaces widen/narrow to fit), when justified. */
  targetWidth?: number
  /** Extra space per word gap to reach `targetWidth`, for the on-screen preview. */
  wordSpacing: number
  /** True when this piece must be redrawn (text, size, position or spacing changed). */
  changed: boolean
}

export interface LineLayout {
  segments: SegmentLayout[]
  /** How far (pt) the line now runs past the page's text margin; 0 if it fits. */
  overflow: number
}

const spacesIn = (t: string) => (t.match(/ /g) ?? []).length

/** All pieces of text that share `line`'s baseline, left to right. */
export function segmentsOnLine(blocks: EditableTextBlock[], line: EditableLine, block: EditableTextBlock, H: number): Segment[] {
  const base = line.baselineY * H
  const tol = Math.max(0.6, block.fontSize * 0.3)
  const out: Segment[] = []
  for (const b of blocks) {
    for (const l of b.lines) {
      if (Math.abs(l.baselineY * H - base) < tol) out.push({ block: b, line: l })
    }
  }
  return out.sort((a, b) => a.line.x - b.line.x)
}

export function planLine(opts: {
  segments: Segment[]
  /** Current text/size of each piece (edited or saved), keyed by line id. */
  state: (seg: Segment) => SegmentState
  /** Natural width (pt) of `text` drawn in `block`'s font at `fontSize`. */
  measure: (text: string, block: EditableTextBlock, fontSize: number) => number
  /** Extra per-space width (pt) the original piece was justified with (0 = ragged). */
  justified: (seg: Segment) => number
  W: number
  /** Right edge (pt) of the text column on this page. */
  margin: number
}): LineLayout {
  const { segments, state, measure, justified, W, margin } = opts
  const out: SegmentLayout[] = []
  // Text stacked on top of other text (overlays, fake bold, shadows) moves
  // as one slot with it instead of pushing the line further.
  let slotShift = 0
  let slotGrowth = 0
  let slotEnd = -Infinity
  let lastWidth = 0
  segments.forEach((seg, k) => {
    const st = state(seg)
    const origWidth = seg.line.w * W
    const x = seg.line.x * W
    const stacked = x < slotEnd - 0.5
    if (!stacked) {
      slotShift += slotGrowth
      slotGrowth = 0
    }
    const shift = slotShift
    const perSpace = justified(seg)
    const same = st.text === seg.line.str && Math.abs(st.fontSize - seg.block.fontSize) < 0.01
    const last = k === segments.length - 1
    let width: number
    let targetWidth: number | undefined
    if (last && perSpace > 0 && (!same || Math.abs(shift) > 0.05)) {
      // Justified line: the last piece soaks up the change to keep the margin.
      const natural = measure(st.text, seg.block, st.fontSize)
      targetWidth = Math.max(natural, origWidth - shift)
      width = targetWidth
    } else if (same) {
      width = origWidth
    } else {
      const natural = measure(st.text, seg.block, st.fontSize)
      width = natural + perSpace * spacesIn(st.text)
      if (perSpace > 0) targetWidth = width
    }
    const natural = targetWidth !== undefined ? measure(st.text, seg.block, st.fontSize) : 0
    const gaps = spacesIn(st.text)
    out.push({
      ...seg,
      text: st.text,
      fontSize: st.fontSize,
      shiftX: shift,
      targetWidth,
      wordSpacing: targetWidth !== undefined && gaps ? Math.min(seg.block.fontSize * 2, Math.max(0, (targetWidth - natural) / gaps)) : same ? perSpace : 0,
      changed: !same || Math.abs(shift) > 0.05 || (targetWidth !== undefined && Math.abs(targetWidth - origWidth) > 0.3),
    })
    slotGrowth = stacked ? Math.max(slotGrowth, width - origWidth) : width - origWidth
    slotEnd = stacked ? Math.max(slotEnd, x + origWidth) : x + origWidth
    lastWidth = width
  })
  const lastSeg = out[out.length - 1]
  const end = lastSeg ? lastSeg.line.x * W + lastSeg.shiftX + lastWidth : 0
  return { segments: out, overflow: Math.max(0, end - margin - 0.5) }
}
