import { FileText, Mic, ScanText } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Note } from "@/types"

export const SOURCE_META: Record<Note["source"], { label: string; icon: typeof FileText; className: string }> = {
  manual: { label: "Manual", icon: FileText, className: "bg-surface-muted text-muted-foreground" },
  ocr: { label: "OCR", icon: ScanText, className: "bg-sky-500/12 text-sky-700 dark:bg-sky-400/20 dark:text-sky-300" },
  voice: { label: "Voice", icon: Mic, className: "bg-violet-500/12 text-violet-700 dark:bg-violet-400/20 dark:text-violet-300" },
}

export function SourceBadge({ source, className }: { source: Note["source"]; className?: string }) {
  const meta = SOURCE_META[source] ?? SOURCE_META.manual
  const Icon = meta.icon
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium", meta.className, className)}>
      <Icon className="size-3.5" aria-hidden />
      {meta.label}
    </span>
  )
}

export const noteDisplayTitle = (n: Pick<Note, "title" | "content">) =>
  n.title.trim() || n.content.trim().split("\n")[0]?.slice(0, 80) || "Untitled note"

export const noteText = (n: Pick<Note, "title" | "content">) => (n.title.trim() ? `${n.title.trim()}\n\n${n.content}` : n.content)

export function noteFileName(n: Pick<Note, "title" | "content">) {
  const base = noteDisplayTitle(n)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return `${base || "note"}.txt`
}

export const isBlank = (n: Pick<Note, "title" | "content">) => !n.title.trim() && !n.content.trim()
