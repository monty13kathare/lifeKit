import { Fragment, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Renders the small Markdown subset AI answers use — headings, **bold**,
 * *italic*, `code`, fenced code, bullet/numbered lists, > quotes and pipe
 * tables — as React elements. No HTML is ever injected.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  return <div className={cn("space-y-3 text-sm leading-relaxed", className)}>{parseBlocks(text)}</div>
}

type Block =
  | { kind: "h"; level: number; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "code"; text: string }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "hr" }

const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/
const HEADING = /^(#{1,4})\s+(.*)$/
const TABLE_ROW = /^\s*\|.*\|\s*$/
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim())

function toBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    if (line.trim().startsWith("```")) {
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i++])
      i++
      blocks.push({ kind: "code", text: body.join("\n") })
      continue
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      blocks.push({ kind: "hr" })
      i++
      continue
    }
    const h = line.match(HEADING)
    if (h) {
      blocks.push({ kind: "h", level: h[1].length, text: h[2] })
      i++
      continue
    }
    if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_DIVIDER.test(lines[i + 1])) {
      const head = cells(line)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && TABLE_ROW.test(lines[i])) rows.push(cells(lines[i++]))
      blocks.push({ kind: "table", head, rows })
      continue
    }
    if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = !BULLET.test(line)
      const re = ordered ? NUMBERED : BULLET
      const items: string[] = []
      while (i < lines.length && re.test(lines[i])) {
        let item = lines[i++].match(re)![1]
        // Indented continuation lines belong to the previous item.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !BULLET.test(lines[i]) && !NUMBERED.test(lines[i])) item += " " + lines[i++].trim()
        items.push(item)
      }
      blocks.push({ kind: ordered ? "ol" : "ul", items })
      continue
    }
    if (line.trim().startsWith(">")) {
      const body: string[] = []
      while (i < lines.length && lines[i].trim().startsWith(">")) body.push(lines[i++].trim().replace(/^>\s?/, ""))
      blocks.push({ kind: "quote", text: body.join("\n") })
      continue
    }
    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !HEADING.test(lines[i]) &&
      !BULLET.test(lines[i]) &&
      !NUMBERED.test(lines[i]) &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith(">") &&
      !TABLE_ROW.test(lines[i])
    )
      para.push(lines[i++])
    if (para.length === 0) para.push(lines[i++])
    blocks.push({ kind: "p", text: para.join("\n") })
  }
  return blocks
}

function parseBlocks(text: string): ReactNode {
  return toBlocks(text).map((b, i) => {
    switch (b.kind) {
      case "h":
        return b.level <= 2 ? (
          <h3 key={i} className="pt-1 text-base font-bold tracking-tight text-foreground">
            {inline(b.text)}
          </h3>
        ) : (
          <h4 key={i} className="pt-1 font-semibold text-foreground">
            {inline(b.text)}
          </h4>
        )
      case "p":
        return (
          <p key={i} className="whitespace-pre-line">
            {inline(b.text)}
          </p>
        )
      case "ul":
        return (
          <ul key={i} className="space-y-1.5 pl-1">
            {b.items.map((item, j) => (
              <li key={j} className="flex gap-2.5">
                <span className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
                <span className="min-w-0">{inline(item)}</span>
              </li>
            ))}
          </ul>
        )
      case "ol":
        return (
          <ol key={i} className="space-y-1.5">
            {b.items.map((item, j) => (
              <li key={j} className="flex gap-2.5">
                <span className="flex size-5.5 shrink-0 items-center justify-center rounded-md bg-primary/12 text-[0.7rem] font-semibold text-primary">{j + 1}</span>
                <span className="min-w-0 pt-px">{inline(item)}</span>
              </li>
            ))}
          </ol>
        )
      case "quote":
        return (
          <blockquote key={i} className="rounded-r-xl border-l-4 border-primary/50 bg-primary/5 px-3 py-2 whitespace-pre-line">
            {inline(b.text)}
          </blockquote>
        )
      case "code":
        return (
          <pre key={i} className="overflow-x-auto rounded-xl border bg-surface-muted p-3 font-mono text-xs leading-relaxed">
            <code>{b.text}</code>
          </pre>
        )
      case "table":
        return (
          <div key={i} className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-muted/60 font-semibold">
                <tr>
                  {b.head.map((c, j) => (
                    <th key={j} className="px-3 py-2">
                      {inline(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {b.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((c, j) => (
                      <td key={j} className="px-3 py-2 align-top">
                        {inline(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      case "hr":
        return <hr key={i} className="border-border" />
    }
  })
}

/** One line of light Markdown (`code`, **bold**, *italic*) inside running text — no block elements. */
export function InlineText({ text }: { text: string }) {
  return <>{inline(text)}</>
}

/** `code`, **bold**, *italic* (underscores are left alone so snake_case survives). */
function inline(text: string): ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g)
  return parts.map((part, i) => {
    if (!part) return null
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return (
        <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      )
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      )
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>
    return <Fragment key={i}>{part}</Fragment>
  })
}

/** Plain-text version of an AI answer for copying. */
export const stripMarkdown = (text: string) =>
  text
    .replace(/```/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^#{1,4}\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
