import { downloadBlob } from "@/lib/files"

/**
 * Helpers for Text to PDF: turn AI-produced (untrusted) HTML or plain text
 * into safe DOM nodes, and export those nodes to a real PDF file.
 *
 * AI output is never injected as raw HTML. It is parsed in an inert document
 * (scripts and event handlers never run there) and rebuilt from an allowlist
 * of formatting tags with only a filtered inline `style` attribute.
 */

const ALLOWED_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "ul", "ol", "li",
  "strong", "b", "em", "i", "u", "s", "small", "mark", "sub", "sup", "code", "pre",
  "blockquote", "span", "div", "section", "header", "footer", "article",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
])

/** Containers whose contents are dropped entirely. */
const DROP_TAGS = new Set(["script", "style", "iframe", "object", "embed", "template", "noscript", "svg", "math", "link", "meta", "title", "head"])

function safeStyle(style: string | null): string | null {
  if (!style) return null
  const lower = style.toLowerCase()
  // No external resources, no legacy script hooks.
  if (/url\s*\(|expression\s*\(|@import|javascript:|behavior\s*:/.test(lower)) return null
  return style
}

function copyNode(source: Node, doc: Document): Node | null {
  if (source.nodeType === Node.TEXT_NODE) return doc.createTextNode(source.textContent ?? "")
  if (source.nodeType !== Node.ELEMENT_NODE) return null
  const el = source as Element
  const tag = el.tagName.toLowerCase()
  if (DROP_TAGS.has(tag)) return null

  const children = Array.from(el.childNodes)
  if (!ALLOWED_TAGS.has(tag)) {
    // Unknown wrapper (e.g. <html>, <body>, <a>): keep its text/children only.
    const frag = doc.createDocumentFragment()
    for (const child of children) {
      const copy = copyNode(child, doc)
      if (copy) frag.appendChild(copy)
    }
    return frag
  }

  const out = doc.createElement(tag)
  const style = safeStyle(el.getAttribute("style"))
  if (style) out.setAttribute("style", style)
  if ((tag === "td" || tag === "th") && el.getAttribute("colspan")) {
    const span = Number(el.getAttribute("colspan"))
    if (Number.isInteger(span) && span > 0 && span < 50) out.setAttribute("colspan", String(span))
  }
  for (const child of children) {
    const copy = copyNode(child, doc)
    if (copy) out.appendChild(copy)
  }
  return out
}

/** Parse untrusted HTML into a sanitized fragment owned by `doc`. */
export function sanitizeToFragment(html: string, doc: Document = document): DocumentFragment {
  const parsed = new DOMParser().parseFromString(html, "text/html")
  const frag = doc.createDocumentFragment()
  for (const child of Array.from(parsed.body.childNodes)) {
    const copy = copyNode(child, doc)
    if (copy) frag.appendChild(copy)
  }
  return frag
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function inline(s: string): string {
  // **bold** and *italic* — applied after escaping, so no markup can sneak in.
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>")
}

/**
 * Simple, offline layout for plain text: `#` headings, `-`/`*`/`1.` lists,
 * `>` quotes and blank-line separated paragraphs. Accent colour per theme.
 */
export function plainTextToHtml(text: string, accent: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  const out: string[] = []
  let para: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null

  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join("<br>")}</p>`)
    para = []
  }
  const flushList = () => {
    if (list) {
      const tag = list.ordered ? "ol" : "ul"
      out.push(`<${tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${tag}>`)
    }
    list = null
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    const quote = /^>\s?(.*)$/.exec(line)

    if (!line.trim()) {
      flushPara()
      flushList()
    } else if (heading) {
      flushPara()
      flushList()
      const level = heading[1].length
      out.push(`<h${level} style="color: ${accent};">${inline(heading[2])}</h${level}>`)
    } else if (bullet || numbered) {
      flushPara()
      const ordered = !bullet
      if (list && list.ordered !== ordered) flushList()
      if (!list) list = { ordered, items: [] }
      list.items.push((bullet ?? numbered)![1])
    } else if (quote) {
      flushPara()
      flushList()
      out.push(`<blockquote style="border-left: 4px solid ${accent};">${inline(quote[1])}</blockquote>`)
    } else {
      flushList()
      para.push(line)
    }
  }
  flushPara()
  flushList()

  // First line becomes the title when the text has no heading of its own.
  if (out.length && !out.some((b) => b.startsWith("<h")) && out[0].startsWith("<p>")) {
    const first = out[0]
    const br = first.indexOf("<br>")
    if (br > 0 && br < 120) {
      out[0] = `<h1 style="color: ${accent};">${first.slice(3, br)}</h1><p>${first.slice(br + 4)}`
    }
  }
  return out.join("\n")
}

/**
 * Document CSS for the preview and the export. Hex colours only: html2canvas
 * can't parse oklch/lab, and the export container otherwise inherits the app's theme colours.
 */
const EXPORT_CSS = `
.html2pdf__overlay, .html2pdf__container { color: #0f172a; background-color: #ffffff; border-color: #0f172a; outline-color: transparent; text-decoration-color: #0f172a; }
.lk-pdf-doc, .lk-pdf-doc * { box-sizing: border-box; border-color: currentColor; outline-color: transparent; text-decoration-color: currentColor; overflow-wrap: break-word; }
.lk-pdf-doc * { max-width: 100%; }
.lk-pdf-doc { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #0f172a; background: #ffffff; line-height: 1.6; font-size: 12pt; padding: 0; }
.lk-pdf-doc h1 { font-size: 22pt; font-weight: 700; margin: 0 0 12pt; line-height: 1.2; }
.lk-pdf-doc h2 { font-size: 16pt; font-weight: 700; margin: 16pt 0 8pt; line-height: 1.3; }
.lk-pdf-doc h3 { font-size: 13pt; font-weight: 700; margin: 12pt 0 6pt; }
.lk-pdf-doc p { margin: 0 0 9pt; }
.lk-pdf-doc ul { list-style: disc; padding-left: 18pt; margin: 0 0 9pt; }
.lk-pdf-doc ol { list-style: decimal; padding-left: 18pt; margin: 0 0 9pt; }
.lk-pdf-doc li { margin-bottom: 3pt; }
.lk-pdf-doc strong, .lk-pdf-doc b { font-weight: 700; }
.lk-pdf-doc em, .lk-pdf-doc i { font-style: italic; }
.lk-pdf-doc blockquote { border-left: 4px solid #6366f1; padding: 4pt 10pt; font-style: italic; color: #475569; background: #f8fafc; margin: 0 0 9pt; }
.lk-pdf-doc table { border-collapse: collapse; width: 100%; margin-bottom: 9pt; }
.lk-pdf-doc th, .lk-pdf-doc td { border: 1px solid #cbd5e1; padding: 4pt 6pt; text-align: left; }
.lk-pdf-doc pre, .lk-pdf-doc code { white-space: pre-wrap; font-family: ui-monospace, monospace; }
.lk-pdf-doc h1, .lk-pdf-doc h2, .lk-pdf-doc h3, .lk-pdf-doc li, .lk-pdf-doc blockquote, .lk-pdf-doc tr { break-inside: avoid; page-break-inside: avoid; }
`

/** Build a sanitized, self-styled document element (for the preview or export). */
export function buildDocumentElement(html: string, width?: number): HTMLElement {
  const root = document.createElement("div")
  root.className = "lk-pdf-doc"
  if (width) root.style.width = width + "px"
  const style = document.createElement("style")
  style.textContent = EXPORT_CSS
  root.appendChild(style)
  root.appendChild(sanitizeToFragment(html))
  return root
}

/** Render the document to a real A4 PDF and download it. */
export async function exportDocumentPdf(html: string, filename: string): Promise<void> {
  const { default: html2pdf } = await import("html2pdf.js")
  // Detached elements have no layout width, so give the document an explicit one.
  const el = buildDocumentElement(html, 700)
  const worker = html2pdf()
  // `pagebreak` is supported at runtime but missing from the bundled types.
  const options = {
    margin: 12,
    // A4 text width: 210 mm - 2 x 12 mm, laid out at 700 CSS px.
    width: 186,
    windowWidth: 700,
    filename,
    image: { type: "jpeg", quality: 0.85 },
    html2canvas: {
      backgroundColor: "#ffffff",
      logging: false,
      // html2canvas reads the page/body background, which the app theme sets in oklch/lab.
      onclone: (doc: Document) => {
        const style = doc.createElement("style")
        style.textContent = "html, body { background-color: #ffffff !important; color: #0f172a !important; }"
        doc.head.appendChild(style)
      },
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"] },
  } as Parameters<typeof worker.set>[0]
  const blob = (await worker.set(options).from(el).outputPdf("blob")) as Blob
  downloadBlob(blob, filename)
}
