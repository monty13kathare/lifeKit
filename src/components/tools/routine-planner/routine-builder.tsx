"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, LayoutTemplate, LoaderCircle, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { Notice } from "@/components/common/notice"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { aiAssist } from "@/lib/ai/client"
import { cn } from "@/lib/utils"
import { ROUTINE_EXAMPLES, ROUTINE_TEMPLATES, type RoutinePreviewItem } from "./routine-templates"
import { DAY_LETTERS, DAY_NAMES, formatClock, formatDuration, repeatLabel, toMinutes } from "./routine-utils"

export type BuilderMode = "ai" | "templates"
export type ApplyMode = "append" | "replace"

type Row = RoutinePreviewItem & { key: string }

const INPUT_MAX = 2000
let rowSeq = 0
const withKeys = (items: RoutinePreviewItem[]): Row[] =>
  [...items].sort((a, b) => a.time.localeCompare(b.time)).map((i) => ({ ...i, repeatDays: [...i.repeatDays], key: `row-${++rowSeq}` }))

function rowError(r: Row): string | null {
  if (!r.title.trim()) return "Add a title"
  if (r.title.trim().length > 80) return "Keep the title under 80 characters"
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)) return "Pick a start time"
  if (!Number.isInteger(r.durationMinutes) || r.durationMinutes < 5 || r.durationMinutes > 1440) return "Duration must be 5–1440 minutes"
  if (!r.repeatDays.length) return "Pick at least one day"
  return null
}

interface RoutineBuilderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMode: BuilderMode
  aiConfigured: boolean
  /** Number of blocks currently in the routine (for the replace confirmation). */
  existingCount: number
  onApply: (items: RoutinePreviewItem[], mode: ApplyMode) => void
}

/**
 * Build routine blocks from a template or from a plain-language description
 * (Google Gemini), review/edit them, then append to or replace the routine.
 * Remount (via `key`) for each new session.
 */
export function RoutineBuilder({ open, onOpenChange, initialMode, aiConfigured, existingCount, onApply }: RoutineBuilderProps) {
  const [mode, setMode] = useState<BuilderMode>(aiConfigured ? initialMode : "templates")
  const [step, setStep] = useState<"input" | "preview">("input")
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [source, setSource] = useState("")
  const [confirmReplace, setConfirmReplace] = useState(false)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => controller.current?.abort(), [])

  const close = (o: boolean) => {
    if (!o) {
      controller.current?.abort()
      setBusy(false)
    }
    onOpenChange(o)
  }

  const generate = async () => {
    const input = text.trim()
    if (!input || busy) return
    controller.current?.abort()
    const ctl = new AbortController()
    controller.current = ctl
    setBusy(true)
    setError(null)
    try {
      const out = await aiAssist("routine", input, ctl.signal)
      if (ctl.signal.aborted) return
      if (!out.items?.length) throw new Error("Gemini didn't suggest any blocks. Try adding a few more details.")
      setRows(withKeys(out.items))
      setSource("Suggested by Google Gemini — review and adjust before adding.")
      setConfirmReplace(false)
      setStep("preview")
    } catch (err) {
      if (ctl.signal.aborted || (err as Error)?.name === "AbortError") return
      const msg = err instanceof Error ? err.message : "Couldn't generate a routine."
      setError(msg)
      toast.error("Couldn't generate a routine", { description: msg })
    } finally {
      if (!ctl.signal.aborted) setBusy(false)
    }
  }

  const pickTemplate = (id: string) => {
    const t = ROUTINE_TEMPLATES.find((x) => x.id === id)
    if (!t) return
    setRows(withKeys(t.items))
    setSource(`Template: ${t.name}. Edit anything before adding.`)
    setConfirmReplace(false)
    setStep("preview")
  }

  const patchRow = (key: string, patch: Partial<RoutinePreviewItem>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const errors = rows.map(rowError)
  const valid = rows.length > 0 && errors.every((e) => !e)

  const apply = (applyMode: ApplyMode) => {
    if (!valid) return
    onApply(
      rows.map((r) => ({
        title: r.title.trim(),
        time: r.time,
        durationMinutes: r.durationMinutes,
        repeatDays: r.repeatDays,
        color: r.color,
      })),
      applyMode
    )
    close(false)
  }

  const title =
    step === "preview" ? "Review your routine" : mode === "ai" ? "Generate my routine" : "Start from a template"

  const footer =
    step === "input" ? (
      <div className="flex w-full justify-end gap-2">
        <Button type="button" variant="outline" size="lg" className="flex-1 sm:h-10 sm:flex-none" onClick={() => close(false)}>
          Cancel
        </Button>
        {mode === "ai" ? (
          <Button type="submit" form="routine-ai-form" size="lg" className="flex-1 sm:h-10 sm:flex-none" disabled={!text.trim() || busy}>
            {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
            {busy ? "Generating…" : "Generate"}
          </Button>
        ) : null}
      </div>
    ) : confirmReplace ? (
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm font-medium" role="alert">
          Replace all {existingCount} existing {existingCount === 1 ? "block" : "blocks"}? Completion history for them is removed too.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="lg" className="flex-1 sm:h-10 sm:flex-none" onClick={() => setConfirmReplace(false)}>
            Keep current
          </Button>
          <Button type="button" variant="destructive" size="lg" className="flex-1 sm:h-10 sm:flex-none" onClick={() => apply("replace")}>
            Replace
          </Button>
        </div>
      </div>
    ) : (
      <div className="flex w-full flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="lg" className="sm:h-10" onClick={() => setStep("input")}>
          <ArrowLeft aria-hidden /> Back
        </Button>
        <div className="flex flex-1 flex-wrap justify-end gap-2">
          {existingCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1 sm:h-10 sm:flex-none"
              disabled={!valid}
              onClick={() => setConfirmReplace(true)}
            >
              Replace my routine
            </Button>
          ) : null}
          <Button type="button" size="lg" className="flex-1 sm:h-10 sm:flex-none" disabled={!valid} onClick={() => apply("append")}>
            Add to routine
          </Button>
        </div>
      </div>
    )

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={close}
      title={title}
      description={step === "preview" ? source : undefined}
      size="lg"
      footer={footer}
    >
      {step === "input" ? (
        <div className="space-y-4">
          {aiConfigured ? (
            <div role="radiogroup" aria-label="How to start" className="inline-flex rounded-lg bg-muted p-0.75">
              {(
                [
                  { id: "ai", label: "Describe my day", icon: Sparkles },
                  { id: "templates", label: "Templates", icon: LayoutTemplate },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.id}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    mode === m.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <m.icon className="size-3.5" aria-hidden /> {m.label}
                </button>
              ))}
            </div>
          ) : null}

          {mode === "ai" ? (
            <form
              id="routine-ai-form"
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                void generate()
              }}
            >
              <label htmlFor="routine-ai-input" className="text-sm font-medium">
                Describe your day
              </label>
              <Textarea
                id="routine-ai-input"
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, INPUT_MAX))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    void generate()
                  }
                }}
                rows={4}
                maxLength={INPUT_MAX}
                disabled={busy}
                aria-describedby="routine-ai-hint"
                placeholder="Describe your day — e.g. I wake at 6:30, work 9–5 on weekdays, gym Mon/Wed/Fri evenings, sleep by 11"
              />
              <div className="flex flex-wrap gap-1.5" aria-label="Examples">
                {ROUTINE_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    disabled={busy}
                    onClick={() => setText(ex)}
                    className="min-h-9 rounded-full border bg-card px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <p id="routine-ai-hint" className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="size-3.5" aria-hidden /> Sent to Google Gemini to suggest blocks. Nothing is saved until you confirm.
              </p>
              <div aria-live="polite">
                {busy ? (
                  <div className="flex items-center gap-3 rounded-xl bg-surface-muted p-3 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" aria-hidden /> Asking Gemini to plan your day…
                  </div>
                ) : error ? (
                  <Notice tone="danger" title="Couldn't generate a routine">
                    {error}
                  </Notice>
                ) : null}
              </div>
            </form>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {ROUTINE_TEMPLATES.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => pickTemplate(t.id)}
                    className="flex h-full w-full flex-col items-start gap-1 rounded-xl border bg-card p-3 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs text-muted-foreground">{t.description}</span>
                    <span className="mt-1 text-xs font-medium text-primary">{t.items.length} blocks</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div aria-live="polite" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? "block" : "blocks"}
            {existingCount > 0 ? ` · you have ${existingCount} already` : ""}
          </p>
          {rows.length === 0 ? (
            <Notice tone="info" title="No blocks left">
              Go back to pick a template or describe your day again.
            </Notice>
          ) : (
            <ul className="space-y-2">
              {rows.map((r, idx) => {
                const err = errors[idx]
                const name = r.title.trim() || `block ${idx + 1}`
                const validTime = /^\d{2}:\d{2}$/.test(r.time) && Number.isFinite(r.durationMinutes)
                return (
                  <li key={r.key} className={cn("space-y-2 rounded-xl border bg-card p-3", err && "border-destructive/50")}>
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={r.time}
                        onChange={(e) => patchRow(r.key, { time: e.target.value })}
                        aria-label={`Start time for ${name}`}
                        className="h-10 w-30 shrink-0"
                      />
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={5}
                        max={1440}
                        step={5}
                        value={Number.isFinite(r.durationMinutes) ? r.durationMinutes : ""}
                        onChange={(e) => patchRow(r.key, { durationMinutes: e.target.value === "" ? NaN : Number(e.target.value) })}
                        aria-label={`Duration in minutes for ${name}`}
                        className="h-10 w-20 shrink-0"
                      />
                      <span className="text-xs text-muted-foreground">min</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-auto shrink-0 text-muted-foreground"
                        aria-label={`Remove ${name}`}
                        onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                      >
                        <X aria-hidden />
                      </Button>
                    </div>
                    <Input
                      value={r.title}
                      maxLength={80}
                      onChange={(e) => patchRow(r.key, { title: e.target.value })}
                      aria-label={`Title for block ${idx + 1}`}
                      placeholder="Block title"
                      className="h-10"
                    />
                    <div className="flex gap-1" role="group" aria-label={`Days for ${name}`}>
                      {DAY_LETTERS.map((letter, d) => {
                        const on = r.repeatDays.includes(d)
                        return (
                          <button
                            key={d}
                            type="button"
                            aria-pressed={on}
                            aria-label={DAY_NAMES[d]}
                            onClick={() =>
                              patchRow(r.key, {
                                repeatDays: on ? r.repeatDays.filter((x) => x !== d) : [...r.repeatDays, d].sort((a, b) => a - b),
                              })
                            }
                            className={cn(
                              "h-10 min-w-0 flex-1 rounded-lg border text-xs font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                              on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                            )}
                          >
                            {letter}
                          </button>
                        )
                      })}
                    </div>
                    <p className={cn("text-xs", err ? "font-medium text-destructive" : "text-muted-foreground")}>
                      {err ??
                        `${validTime ? `${formatClock(toMinutes(r.time))} – ${formatClock(toMinutes(r.time) + r.durationMinutes)} · ${formatDuration(r.durationMinutes)} · ` : ""}${repeatLabel(r.repeatDays)}`}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </ResponsiveSheet>
  )
}
