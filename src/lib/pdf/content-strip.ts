/**
 * Remove the original glyphs of edited lines from a page's content stream, so
 * the old words don't survive under the replacement (copy/paste, search and
 * screen readers would otherwise still find them).
 *
 * Each removed text-showing operator is replaced with an empty `TJ` that
 * advances the text position by the same amount, so text drawn later in the
 * same text object stays exactly where it was. Anything we can't measure is
 * left alone and reported, and the exporter then falls back to a cover box.
 *
 * Like `font-reuse.ts`, this receives the lazily loaded pdf-lib module.
 */
import type * as PdfLibModule from "pdf-lib"
import type { StandardWidths } from "./standard-metrics"

type PdfLib = typeof PdfLibModule
type PDFDocument = PdfLibModule.PDFDocument
type PDFPage = PdfLibModule.PDFPage
type PDFDict = PdfLibModule.PDFDict
type PDFObject = PdfLibModule.PDFObject

/** One edited line, in PDF user space. */
export interface StripTarget {
  x0: number
  x1: number
  baseline: number
  fontSize: number
  fontName: string
}

/** Text state of the removed text, in page user space (so it can be reapplied). */
export interface TextSpacing {
  /** Character spacing (Tc) in points. */
  charSpacing: number
  /** Word spacing (Tw) in points. */
  wordSpacing: number
  /** Horizontal scaling (Tz) in percent (already folded into pdf.js's text matrix and size). */
  scaling: number
}

export interface StripResult {
  /** Per target: true when its original glyphs were removed and nothing else drawn there was left behind. */
  clean: boolean[]
  /** Per target: the spacing the original text was drawn with, when found. */
  spacing: (TextSpacing | undefined)[]
}

type Matrix = [number, number, number, number, number, number]
const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
]
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type Token =
  | { t: "num"; v: number; s: number; e: number }
  | { t: "str"; v: Uint8Array; s: number; e: number }
  | { t: "name"; v: string; s: number; e: number }
  | { t: "op"; v: string; s: number; e: number }
  | { t: "["; s: number; e: number }
  | { t: "]"; s: number; e: number }
  | { t: "other"; s: number; e: number }

const isWs = (c: number) => c === 0 || c === 9 || c === 10 || c === 12 || c === 13 || c === 32
const isDelim = (c: number) => c === 40 || c === 41 || c === 60 || c === 62 || c === 91 || c === 93 || c === 123 || c === 125 || c === 47 || c === 37

function* tokenize(d: Uint8Array): Generator<Token> {
  let i = 0
  const n = d.length
  while (i < n) {
    const c = d[i]
    if (isWs(c)) {
      i++
      continue
    }
    const s = i
    if (c === 37) {
      while (i < n && d[i] !== 10 && d[i] !== 13) i++
      continue
    }
    if (c === 40) {
      // literal string
      const out: number[] = []
      let depth = 1
      i++
      while (i < n && depth > 0) {
        let b = d[i++]
        if (b === 92) {
          const x = d[i++]
          if (x === 110) b = 10
          else if (x === 114) b = 13
          else if (x === 116) b = 9
          else if (x === 98) b = 8
          else if (x === 102) b = 12
          else if (x === 10 || x === 13) {
            if (x === 13 && d[i] === 10) i++
            continue
          } else if (x >= 48 && x <= 55) {
            let v = x - 48
            for (let k = 0; k < 2 && d[i] >= 48 && d[i] <= 55; k++) v = v * 8 + (d[i++] - 48)
            b = v & 255
          } else b = x
          out.push(b)
          continue
        }
        if (b === 40) depth++
        else if (b === 41 && --depth === 0) break
        out.push(b)
      }
      yield { t: "str", v: Uint8Array.from(out), s, e: i }
      continue
    }
    if (c === 60) {
      if (d[i + 1] === 60) {
        i += 2
        yield { t: "other", s, e: i }
        continue
      }
      i++
      let hex = ""
      while (i < n && d[i] !== 62) {
        if (!isWs(d[i])) hex += String.fromCharCode(d[i])
        i++
      }
      i++
      if (hex.length % 2) hex += "0"
      const v = new Uint8Array(hex.length / 2)
      for (let k = 0; k < v.length; k++) v[k] = parseInt(hex.slice(k * 2, k * 2 + 2), 16) || 0
      yield { t: "str", v, s, e: i }
      continue
    }
    if (c === 62) {
      i += d[i + 1] === 62 ? 2 : 1
      yield { t: "other", s, e: i }
      continue
    }
    if (c === 91 || c === 93) {
      i++
      yield { t: c === 91 ? "[" : "]", s, e: i }
      continue
    }
    if (c === 123 || c === 125 || c === 41) {
      i++
      yield { t: "other", s, e: i }
      continue
    }
    if (c === 47) {
      i++
      while (i < n && !isWs(d[i]) && !isDelim(d[i])) i++
      yield { t: "name", v: new TextDecoder("latin1").decode(d.subarray(s + 1, i)), s, e: i }
      continue
    }
    while (i < n && !isWs(d[i]) && !isDelim(d[i])) i++
    const word = new TextDecoder("latin1").decode(d.subarray(s, i))
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) {
      yield { t: "num", v: parseFloat(word), s, e: i }
      continue
    }
    if (word === "BI") {
      // Inline image: skip binary data up to "EI".
      while (i < n) {
        if (isWs(d[i - 1]) && d[i] === 69 && d[i + 1] === 73 && (i + 2 >= n || isWs(d[i + 2]))) {
          i += 2
          break
        }
        i++
      }
      yield { t: "other", s, e: i }
      continue
    }
    yield { t: "op", v: word, s, e: i }
  }
}

// ---------------------------------------------------------------------------
// Fonts (widths + names)
// ---------------------------------------------------------------------------

interface FontMetrics {
  names: string[]
  bytes: 1 | 2
  /** Glyph width in 1/1000 em, or undefined when unknown. */
  width(code: number): number | undefined
}

function fontMetrics(lib: PdfLib, doc: PDFDocument, dict: PDFDict, standard?: StandardWidths): FontMetrics | null {
  const { PDFName, PDFNumber, PDFArray, PDFRef, PDFDict } = lib
  const ctx = doc.context
  const deref = (o: PDFObject | undefined) => (o instanceof PDFRef ? ctx.lookup(o) : o)
  const num = (o: PDFObject | undefined) => {
    const v = deref(o)
    return v instanceof PDFNumber ? v.asNumber() : undefined
  }
  const name = (o: PDFObject | undefined) => {
    const v = deref(o)
    return v instanceof PDFName ? v.decodeText() : undefined
  }
  const subtype = name(dict.get(PDFName.of("Subtype")))
  if (subtype === "Type3") return null
  const names: string[] = []
  const base = name(dict.get(PDFName.of("BaseFont")))
  if (base) names.push(base)

  if (subtype === "Type0") {
    const arr = deref(dict.get(PDFName.of("DescendantFonts")))
    const desc = arr instanceof PDFArray ? deref(arr.get(0)) : undefined
    if (!(desc instanceof PDFDict)) return null
    const fd = deref(desc.get(PDFName.of("FontDescriptor")))
    const fn = fd instanceof PDFDict ? name(fd.get(PDFName.of("FontName"))) : undefined
    if (fn) names.push(fn)
    if (name(dict.get(PDFName.of("Encoding"))) !== "Identity-H") return null
    const dw = num(desc.get(PDFName.of("DW"))) ?? 1000
    const widths = new Map<number, number>()
    const w = deref(desc.get(PDFName.of("W")))
    if (w instanceof PDFArray) {
      for (let i = 0; i < w.size(); ) {
        const first = num(w.get(i))
        const next = deref(w.get(i + 1))
        if (first === undefined) break
        if (next instanceof PDFArray) {
          for (let k = 0; k < next.size(); k++) widths.set(first + k, num(next.get(k)) ?? dw)
          i += 2
        } else {
          const last = num(next)
          const value = num(w.get(i + 2))
          if (last === undefined || value === undefined) break
          for (let c = first; c <= last && c - first < 65536; c++) widths.set(c, value)
          i += 3
        }
      }
    }
    return { names, bytes: 2, width: (c) => widths.get(c) ?? dw }
  }

  const fd = deref(dict.get(PDFName.of("FontDescriptor")))
  const fn = fd instanceof PDFDict ? name(fd.get(PDFName.of("FontName"))) : undefined
  if (fn) names.push(fn)
  const first = num(dict.get(PDFName.of("FirstChar")))
  const widths = deref(dict.get(PDFName.of("Widths")))
  const missing = fd instanceof PDFDict ? num(fd.get(PDFName.of("MissingWidth"))) : undefined
  if (first === undefined || !(widths instanceof PDFArray)) {
    // Standard-14 fonts may omit /Widths; use the built-in metrics.
    const std = base ? standard?.(base) : null
    return std ? { names, bytes: 1, width: (c) => std(c) ?? missing } : null
  }
  return {
    names,
    bytes: 1,
    width: (c) => (c >= first && c - first < widths.size() ? num(widths.get(c - first)) : missing),
  }
}

const stripPrefix = (n: string) => n.replace(/^[A-Z]{6}\+/, "")

// ---------------------------------------------------------------------------
// Strip
// ---------------------------------------------------------------------------

export function stripOriginalText(
  lib: PdfLib,
  doc: PDFDocument,
  page: PDFPage,
  targets: StripTarget[],
  standard?: StandardWidths
): StripResult {
  const clean = targets.map(() => false)
  const spacing: (TextSpacing | undefined)[] = targets.map(() => undefined)
  if (!targets.length) return { clean, spacing }
  const { PDFName, PDFArray, PDFRef, PDFDict, PDFRawStream, PDFContentStream, decodePDFRawStream } = lib
  const ctx = doc.context
  const deref = (o: PDFObject | undefined) => (o instanceof PDFRef ? ctx.lookup(o) : o)

  // 1. Concatenate the page's content streams.
  const contents = deref(page.node.get(PDFName.of("Contents")))
  const streams: PDFObject[] = contents instanceof PDFArray ? contents.asArray().map((o) => deref(o)!) : contents ? [contents] : []
  const parts: Uint8Array[] = []
  for (const s of streams) {
    try {
      // pdf-lib's own operator streams (added while copying/normalising) expose their bytes directly.
      if (s instanceof PDFContentStream) parts.push(s.getUnencodedContents())
      else if (s instanceof PDFRawStream) parts.push(decodePDFRawStream(s).decode())
      else return { clean, spacing }
    } catch {
      return { clean, spacing }
    }
  }
  const total = parts.reduce((n, p) => n + p.length + 1, 0)
  const data = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    data.set(p, off)
    data[off + p.length] = 10
    off += p.length + 1
  }

  // 2. Fonts by resource name.
  const fontRes = deref(page.node.Resources()?.get(PDFName.of("Font")))
  const metricsCache = new Map<string, FontMetrics | null>()
  const metricsFor = (key: string) => {
    if (!metricsCache.has(key)) {
      const dict = fontRes instanceof PDFDict ? deref(fontRes.get(PDFName.of(key))) : undefined
      metricsCache.set(key, dict instanceof PDFDict ? fontMetrics(lib, doc, dict, standard) : null)
    }
    return metricsCache.get(key)!
  }
  const sameFont = (m: FontMetrics | null, name: string) =>
    !!m && m.names.some((n) => n === name || stripPrefix(n) === stripPrefix(name))

  // 3. Walk the operators.
  const edits: { s: number; e: number; replacement: string }[] = []
  const dirty = targets.map(() => false)
  const found = targets.map(() => false)
  let ctm: Matrix = IDENTITY
  const stack: Matrix[] = []
  let tm: Matrix = IDENTITY
  let tlm: Matrix = IDENTITY
  let tmKnown = true
  let fontKey = ""
  let fs = 0
  let tc = 0
  let tw = 0
  let th = 1
  let tl = 0
  let rise = 0
  let operands: Token[] = []
  let arrayDepth = 0
  let opStart = -1

  const advance = (strs: (Uint8Array | number)[], m: FontMetrics | null): number | null => {
    if (!m) return null
    let tx = 0
    for (const s of strs) {
      if (typeof s === "number") {
        tx += (-s / 1000) * fs * th
        continue
      }
      for (let i = 0; i + m.bytes <= s.length; i += m.bytes) {
        const code = m.bytes === 2 ? (s[i] << 8) | s[i + 1] : s[i]
        const w = m.width(code)
        if (w === undefined) return null
        tx += ((w / 1000) * fs + tc + (m.bytes === 1 && code === 32 ? tw : 0)) * th
      }
    }
    return tx
  }

  const show = (strs: (Uint8Array | number)[], s: number, e: number, prefix: string) => {
    const m = metricsFor(fontKey)
    const adv = advance(strs, m)
    if (tmKnown) {
      const user = mul(mul([1, 0, 0, 1, 0, rise], tm), ctm)
      const x = user[4]
      const y = user[5]
      // Text-space → user-space scale along the baseline.
      const k = Math.hypot(user[0], user[1])
      const size = Math.abs(fs) * k
      const xe = adv === null ? x : x + adv * k
      const hasGlyphs = strs.some((p) => typeof p !== "number" && p.length > 0)
      targets.forEach((t, i) => {
        if (!hasGlyphs) return
        const em = t.fontSize
        // Anything drawn on this line inside the edited span?
        const near = Math.abs(y - t.baseline) < em * 0.5
        const overlaps =
          adv === null ? x >= t.x0 - em * 0.6 && x < t.x1 : xe > t.x0 + 0.1 && x < t.x1 - 0.1
        if (!near || !overlaps) return
        const removable =
          adv !== null &&
          sameFont(m, t.fontName) &&
          Math.abs(y - t.baseline) < Math.max(0.6, em * 0.08) &&
          Math.abs(size - em) < Math.max(0.3, em * 0.04) &&
          x >= t.x0 - em * 0.6 &&
          xe <= t.x1 + em * 0.6
        if (!removable) {
          dirty[i] = true // something else is drawn here; keep the cover box
          return
        }
        found[i] = true
        spacing[i] ??= { charSpacing: tc * k * th, wordSpacing: tw * k * th, scaling: th * 100 }
        if (!edits.some((ed) => ed.s === s)) {
          const n = fs && th ? -(adv * 1000) / (fs * th) : 0
          edits.push({ s, e, replacement: `${prefix}[${n.toFixed(3)}] TJ` })
        }
      })
    }
    if (adv === null) tmKnown = false
    else tm = mul([1, 0, 0, 1, adv, 0], tm)
  }

  for (const tok of tokenize(data)) {
    if (opStart < 0) opStart = tok.s
    if (tok.t === "[") {
      arrayDepth++
      operands.push(tok)
      continue
    }
    if (tok.t === "]") {
      arrayDepth--
      operands.push(tok)
      continue
    }
    if (tok.t !== "op" || arrayDepth > 0) {
      operands.push(tok)
      continue
    }
    const nums = operands.filter((o): o is Extract<Token, { t: "num" }> => o.t === "num").map((o) => o.v)
    const s = opStart
    const e = tok.e
    switch (tok.v) {
      case "q":
        stack.push(ctm)
        break
      case "Q":
        ctm = stack.pop() ?? IDENTITY
        break
      case "cm":
        if (nums.length === 6) ctm = mul(nums as Matrix, ctm)
        break
      case "BT":
        tm = tlm = IDENTITY
        tmKnown = true
        break
      case "Tf": {
        const nm = operands.find((o) => o.t === "name")
        if (nm && nm.t === "name") fontKey = nm.v
        fs = nums[0] ?? fs
        break
      }
      case "Tc":
        tc = nums[0] ?? tc
        break
      case "Tw":
        tw = nums[0] ?? tw
        break
      case "Tz":
        th = (nums[0] ?? 100) / 100
        break
      case "TL":
        tl = nums[0] ?? tl
        break
      case "Ts":
        rise = nums[0] ?? rise
        break
      case "Tm":
        if (nums.length === 6) {
          tm = tlm = nums as Matrix
          tmKnown = true
        }
        break
      case "Td":
      case "TD":
        if (nums.length === 2) {
          if (tok.v === "TD") tl = -nums[1]
          tlm = mul([1, 0, 0, 1, nums[0], nums[1]], tlm)
          tm = tlm
        }
        break
      case "T*":
        tlm = mul([1, 0, 0, 1, 0, -tl], tlm)
        tm = tlm
        break
      case "Tj": {
        const str = operands.find((o) => o.t === "str")
        if (str && str.t === "str") show([str.v], s, e, "")
        break
      }
      case "TJ": {
        const parts: (Uint8Array | number)[] = []
        for (const o of operands) if (o.t === "str" || o.t === "num") parts.push(o.v)
        show(parts, s, e, "")
        break
      }
      case "'":
      case '"': {
        if (tok.v === '"' && nums.length >= 2) {
          tw = nums[0]
          tc = nums[1]
        }
        tlm = mul([1, 0, 0, 1, 0, -tl], tlm)
        tm = tlm
        const str = operands.find((o) => o.t === "str")
        const prefix = tok.v === '"' ? `${tw} Tw ${tc} Tc T* ` : "T* "
        if (str && str.t === "str") show([str.v], s, e, prefix)
        break
      }
      case "Do":
        // Form XObjects can't be edited here; their text is covered instead.
        break
    }
    operands = []
    opStart = -1
  }

  if (!edits.length) return { clean: found.map((f, i) => f && !dirty[i]), spacing }

  // 4. Splice each original stream in place (pdf-lib keeps handles to its own streams).
  edits.sort((x, y) => x.s - y.s)
  const enc = new TextEncoder()
  const starts: number[] = []
  let acc = 0
  for (const p of parts) {
    starts.push(acc)
    acc += p.length + 1
  }
  const partOf = (at: number) => {
    let k = starts.length - 1
    while (k > 0 && starts[k] > at) k--
    return k
  }
  const perPart = new Map<number, typeof edits>()
  for (const ed of edits) {
    const k = partOf(ed.s)
    // An operator split across streams, or one inside pdf-lib's own streams: don't touch anything.
    if (partOf(ed.e - 1) !== k || !(streams[k] instanceof PDFRawStream)) return { clean: targets.map(() => false), spacing }
    perPart.set(k, [...(perPart.get(k) ?? []), ed])
  }
  const refs = contents instanceof PDFArray ? contents.asArray() : [page.node.get(PDFName.of("Contents"))!]
  const next = refs.slice()
  for (const [k, list] of perPart) {
    const src = parts[k]
    const chunks: Uint8Array[] = []
    let pos = 0
    for (const ed of list) {
      chunks.push(src.subarray(pos, ed.s - starts[k]), enc.encode(ed.replacement))
      pos = ed.e - starts[k]
    }
    chunks.push(src.subarray(pos))
    const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
    let o = 0
    for (const c of chunks) {
      bytes.set(c, o)
      o += c.length
    }
    next[k] = ctx.register(ctx.flateStream(bytes))
  }
  page.node.set(PDFName.of("Contents"), ctx.obj(next))
  return { clean: found.map((f, i) => f && !dirty[i]), spacing }
}
