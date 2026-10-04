"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, CircleHelp, Download, FileText, ListChecks, ListPlus, NotebookPen, Plus, Sparkles, Timer } from "lucide-react"
import { toast } from "sonner"
import { CopyButton } from "@/components/common/copy-button"
import { EmptyState } from "@/components/common/empty-state"
import { Notice } from "@/components/common/notice"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useTasks } from "@/hooks/use-lifekit-data"
import { downloadText } from "@/lib/files"
import { saveNote } from "@/lib/storage/notes"
import type { SummaryResult } from "./summarizer"
import { actionItemToTask, formatMinutes, formatSummary, readingMinutes, safeFilename, summaryWords } from "./summary-utils"

interface SummaryOutputProps {
  busy: boolean
  error: string | null
  result: SummaryResult | null
}

export function SummaryOutput({ busy, error, result }: SummaryOutputProps) {
  return (
    <section aria-label="Summary" className="space-y-4">
      <div aria-live="polite" className="sr-only">
        {busy ? "Summarizing with Gemini…" : result ? `Summary ready: ${result.summary.title}` : ""}
      </div>

      {busy ? (
        <div aria-busy="true" className="space-y-4">
          <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-soft">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
          <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-soft">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <p className="text-sm text-muted-foreground">Reading your text with Gemini…</p>
        </div>
      ) : error ? (
        <Notice tone="danger" title="Couldn't summarize">
          {error}
        </Notice>
      ) : null}

      {!busy && result ? <SummaryCards key={result.id} result={result} /> : null}

      {!busy && !result && !error ? (
        <EmptyState
          icon={FileText}
          title="Your summary appears here"
          description="Paste text, upload a .txt/.md file or pick a note, then tap Summarize. You'll get a TL;DR, key points, action items and open questions."
        />
      ) : null}
    </section>
  )
}

function SummaryCards({ result }: { result: SummaryResult }) {
  const router = useRouter()
  const { add } = useTasks()
  const { summary } = result
  const [added, setAdded] = useState<Set<number>>(() => new Set())

  const formatted = formatSummary(summary)
  const saved = readingMinutes(result.inputWords) - readingMinutes(summaryWords(summary))

  const addTask = (index: number) => {
    if (added.has(index)) return
    add(actionItemToTask(summary.actionItems[index], summary.title))
    setAdded((s) => new Set(s).add(index))
  }

  const addAll = () => {
    const pending = summary.actionItems.map((_, i) => i).filter((i) => !added.has(i))
    if (!pending.length) return
    for (const i of pending) add(actionItemToTask(summary.actionItems[i], summary.title))
    setAdded(new Set(summary.actionItems.map((_, i) => i)))
    toast.success(`Added ${pending.length} task${pending.length === 1 ? "" : "s"} for today`, {
      action: { label: "Open To-Do", onClick: () => router.push("/tools/todo") },
    })
  }

  const save = () => {
    const title = result.source ? `Summary: ${result.source}` : summary.title || "Summary"
    saveNote(formatted, "manual", title.slice(0, 120))
    toast.success("Saved to notes", { action: { label: "Open notes", onClick: () => router.push("/tools/notes") } })
  }

  return (
    <div className="space-y-4">
      <article className="space-y-3 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-balance" dir="auto">
              {summary.title || "Summary"}
            </h2>
            {saved > 0 ? (
              <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                <Timer className="size-3.5" aria-hidden /> Saved {saved < 1 ? "under a minute" : `${formatMinutes(saved)}`} of reading
              </p>
            ) : null}
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">TL;DR</h3>
          <p className="mt-1 text-sm leading-relaxed sm:text-base" dir="auto">
            {summary.tldr}
          </p>
        </div>
      </article>

      {summary.keyPoints.length ? (
        <article className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <ListChecks className="size-4.5 text-primary" aria-hidden /> Key points
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed" dir="auto">
            {summary.keyPoints.map((p, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <span className="min-w-0">{p}</span>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      <article className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold">
            <ListPlus className="size-4.5 text-primary" aria-hidden /> Action items
          </h3>
          {summary.actionItems.length > 1 ? (
            <Button variant="outline" size="sm" onClick={addAll} disabled={added.size === summary.actionItems.length}>
              <Plus aria-hidden /> {added.size === summary.actionItems.length ? "All added" : "Add all to Tasks"}
            </Button>
          ) : null}
        </div>
        {summary.actionItems.length ? (
          <>
            <ul className="mt-3 space-y-2">
              {summary.actionItems.map((item, i) => {
                const done = added.has(i)
                return (
                  <li key={i} className="flex items-center gap-3 rounded-xl bg-surface-muted p-2.5 pl-3">
                    <span className="min-w-0 flex-1 text-sm" dir="auto">
                      {item}
                    </span>
                    <Button
                      variant={done ? "ghost" : "outline"}
                      size="sm"
                      className="h-10 shrink-0"
                      disabled={done}
                      onClick={() => {
                        addTask(i)
                        toast.success("Added to Tasks for today", { action: { label: "Open To-Do", onClick: () => router.push("/tools/todo") } })
                      }}
                      aria-label={done ? `Added: ${item}` : `Add to Tasks: ${item}`}
                    >
                      {done ? <Check className="text-success" aria-hidden /> : <Plus aria-hidden />}
                      {done ? "Added" : "Add to Tasks"}
                    </Button>
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">Added as medium-priority Work tasks due today — edit them in To-Do.</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No action items found in this text.</p>
        )}
      </article>

      {summary.questions.length ? (
        <article className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <CircleHelp className="size-4.5 text-primary" aria-hidden /> Open questions
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed" dir="auto">
            {summary.questions.map((q, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="text-muted-foreground" aria-hidden>
                  ?
                </span>
                <span className="min-w-0">{q}</span>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <CopyButton value={formatted} label="Copy all" />
        <Button variant="outline" onClick={save}>
          <NotebookPen aria-hidden /> Save to notes
        </Button>
        <Button variant="outline" onClick={() => downloadText(formatted, `${safeFilename(summary.title)}.txt`)}>
          <Download aria-hidden /> Download .txt
        </Button>
        <Button variant="outline" onClick={() => {
            try {
              sessionStorage.setItem("lifekit:text-to-pdf-handoff", summary.title + "\n\n" + formatted)
              router.push("/tools/text-to-pdf")
            } catch {
              toast.error("Failed to export.")
            }
        }}>
          <FileText aria-hidden /> Export PDF
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Generated by Google Gemini — summaries can miss or misread details.</p>
    </div>
  )
}
