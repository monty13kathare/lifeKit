"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Eraser, LoaderCircle, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { FileDropzone } from "@/components/common/file-dropzone"
import { Notice } from "@/components/common/notice"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAiStatus } from "@/hooks/use-ai-status"
import { useNotes } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { aiAssist } from "@/lib/ai/client"
import { cn } from "@/lib/utils"
import { ChipGroup } from "@/components/tools/ai-writer/chip-group"
import { errorMessage, fitJsonPayload, isAbort } from "@/components/tools/ai-writer/fit-payload"
import { SummaryOutput } from "./summary-output"
import {
  LENGTH_OPTIONS,
  SUMMARY_FILE_MAX_BYTES,
  SUMMARY_TEXT_LIMIT,
  countWords,
  formatMinutes,
  readingMinutes,
  type Summary,
  type SummaryLength,
} from "./summary-utils"

const FILE_ACCEPT = [".txt", ".md", ".markdown", "text/plain", "text/markdown"]

export interface SummaryResult {
  id: number
  summary: Summary
  inputWords: number
  /** Where the text came from, e.g. a note or file name. */
  source: string | null
}

export function Summarizer() {
  const status = useAiStatus()
  const configured = status?.configured === true
  const hydrated = useHydrated()
  const { notes } = useNotes()

  const [text, setText] = useState("")
  const [source, setSource] = useState<string | null>(null)
  const [noteId, setNoteId] = useState<string | null>(null)
  const [length, setLength] = useState<SummaryLength>("medium")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SummaryResult | null>(null)

  const controller = useRef<AbortController | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => controller.current?.abort(), [])

  const noteItems = useMemo(
    () =>
      [...notes]
        .filter((n) => (n.title + n.content).trim())
        .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt.localeCompare(a.updatedAt))
        .map((n) => ({ value: n.id, label: n.title.trim() || "Untitled note" })),
    [notes]
  )

  const words = countWords(text)
  const tooLong = text.length > SUMMARY_TEXT_LIMIT
  const tooShort = words > 0 && words < 25
  const canSummarize = configured && !busy && words > 0 && !tooLong

  const loadText = (value: string, from: string) => {
    if (value.length > SUMMARY_TEXT_LIMIT) {
      toast.warning(`Only the first ${SUMMARY_TEXT_LIMIT.toLocaleString()} characters were loaded.`)
    }
    setText(value.slice(0, SUMMARY_TEXT_LIMIT))
    setSource(from)
  }

  const onFile = async (files: File[]) => {
    const file = files[0]
    if (!file) return
    try {
      const content = await file.text()
      if (!content.trim()) {
        toast.error(`“${file.name}” is empty.`)
        return
      }
      if (content.includes("\u0000")) {
        toast.error(`“${file.name}” doesn't look like a text file.`)
        return
      }
      setNoteId(null)
      loadText(content, file.name)
      toast.success(`Loaded “${file.name}” — read on your device`)
    } catch {
      toast.error(`Couldn't read “${file.name}”.`)
    }
  }

  const onPickNote = (id: string | null) => {
    setNoteId(id)
    const note = notes.find((n) => n.id === id)
    if (!note) return
    const content = [note.title.trim(), note.content.trim()].filter(Boolean).join("\n\n")
    loadText(content, note.title.trim() || "Untitled note")
  }

  const summarize = async () => {
    if (!canSummarize) return
    controller.current?.abort()
    const ctl = new AbortController()
    controller.current = ctl
    setBusy(true)
    setError(null)
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
    }
    const input = text.trim()
    const { json, trimmed } = fitJsonPayload((t) => ({ text: t, length }), input, SUMMARY_TEXT_LIMIT)
    if (trimmed) toast.info("Your text was trimmed slightly to fit the 40,000-character limit.")
    try {
      const summary = await aiAssist("summarize", json, ctl.signal)
      if (ctl.signal.aborted) return
      setResult({ id: Date.now(), summary, inputWords: countWords(input), source })
    } catch (err) {
      if (isAbort(err) || ctl.signal.aborted) return
      const msg = errorMessage(err)
      setError(msg)
      toast.error(msg)
    } finally {
      if (controller.current === ctl) {
        controller.current = null
        setBusy(false)
      }
    }
  }

  const cancel = () => {
    controller.current?.abort()
    controller.current = null
    setBusy(false)
    toast("Summary cancelled")
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      {/* ------------------------------------------------------------ Input */}
      <section aria-label="Text to summarize" className="min-w-0 space-y-5">
        {status && !configured ? (
          <Notice tone="warning" title="Summarizer needs Google Gemini">
            Add <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">GEMINI_API_KEY</code> to <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">.env</code> and restart the app to enable summaries.
          </Notice>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-end justify-between gap-2">
            <Label htmlFor="summary-input">Text to summarize</Label>
            {text ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setText("")
                  setSource(null)
                  setNoteId(null)
                }}
              >
                <Eraser aria-hidden /> Clear
              </Button>
            ) : null}
          </div>
          <Textarea
            id="summary-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                void summarize()
              }
            }}
            placeholder="Paste an article, email thread, meeting notes, report…"
            aria-describedby="summary-stats"
            aria-invalid={tooLong || undefined}
            className="min-h-56 resize-y text-base sm:text-sm"
          />
          <p id="summary-stats" className={cn("flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs tabular-nums", tooLong ? "text-destructive" : "text-muted-foreground")}>
            <span>
              {words.toLocaleString()} words · {words ? `${formatMinutes(readingMinutes(words))} read` : "0 min read"}
              {source ? ` · from ${source}` : ""}
            </span>
            <span>
              {text.length.toLocaleString()} / {SUMMARY_TEXT_LIMIT.toLocaleString()}
            </span>
          </p>
          {tooLong ? (
            <p className="text-xs text-destructive" role="alert">
              Too long — remove {(text.length - SUMMARY_TEXT_LIMIT).toLocaleString()} characters, or summarize it in parts.
            </p>
          ) : tooShort ? (
            <p className="text-xs text-muted-foreground">Short texts don&apos;t need much summarizing — longer input gives better results.</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">Or upload a file</p>
            <FileDropzone
              compact
              accept={FILE_ACCEPT}
              maxBytes={SUMMARY_FILE_MAX_BYTES}
              hint=".txt or .md, up to 2 MB"
              title="Choose a text file"
              disabled={busy}
              onFiles={(f) => void onFile(f)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="summary-note">Or summarize a note</Label>
            <Select items={noteItems} value={noteId} onValueChange={(v) => onPickNote(v as string | null)} disabled={!hydrated || !noteItems.length || busy}>
              <SelectTrigger id="summary-note" className="w-full">
                <SelectValue placeholder={hydrated && !noteItems.length ? "No notes yet" : "Pick a note"} />
              </SelectTrigger>
              <SelectContent>
                {noteItems.map((n) => (
                  <SelectItem key={n.value} value={n.value}>
                    {n.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-soft">
          <ChipGroup label="Summary length" options={LENGTH_OPTIONS} value={length} onChange={setLength} />
        </div>

        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:-mx-6 sm:px-6 lg:bottom-0 lg:mx-0 lg:rounded-t-2xl lg:px-0">
          <div className="flex gap-2">
            {busy ? (
              <Button type="button" size="lg" variant="outline" onClick={cancel}>
                <X aria-hidden /> Cancel
              </Button>
            ) : null}
            <Button type="button" size="lg" className="flex-1" disabled={!canSummarize} onClick={() => void summarize()}>
              {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
              {busy ? "Summarizing…" : "Summarize"}
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">Text is sent to Google Gemini. Summaries can miss details — check important facts.</p>
        </div>
      </section>

      {/* ----------------------------------------------------------- Output */}
      <div ref={outputRef} className="min-w-0 scroll-mt-4">
        <SummaryOutput busy={busy} error={error} result={result} />
      </div>
    </div>
  )
}
