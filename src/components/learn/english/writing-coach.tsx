"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ClipboardCheck, History, Lightbulb, Loader2, PenLine, Sparkles, WandSparkles } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Notice } from "@/components/common/notice"
import { CopyButton } from "@/components/common/copy-button"
import { useLearn } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { useAiStatus } from "@/hooks/use-ai-status"
import { aiAssist } from "@/lib/ai/client"
import { recordBest } from "@/lib/learn/progress"
import { cn } from "@/lib/utils"
import { ENGLISH_LEVELS, WRITING_PROMPTS, type EnglishLevel } from "@/data/learn/english"
import { countWords, diffWords, errorMessage, grantXp, isAbort, offlineCheck, type OfflineIssue } from "./english-utils"
import { SimpleSelect } from "./simple-select"

const MIN_WORDS = 20
const MAX_CHARS = 5000
const FREE = "free"

interface Feedback {
  score: number
  correctedText: string
  mistakes: { original: string; correction: string; type: string; explanation: string }[]
  vocabularyTips: string[]
  encouragement: string
}

export function WritingCoach() {
  const hydrated = useHydrated()
  const ai = useAiStatus()
  const { history } = useLearn()
  const [level, setLevel] = useState<EnglishLevel>("beginner")
  const [promptId, setPromptId] = useState<string>(WRITING_PROMPTS.find((p) => p.level === "beginner")!.id)
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ feedback: Feedback; original: string } | null>(null)
  const [offline, setOffline] = useState<OfflineIssue[] | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const promptItems = useMemo(
    () => [{ value: FREE, label: "Free writing (any topic)" }, ...WRITING_PROMPTS.filter((p) => p.level === level).map((p) => ({ value: p.id, label: p.title }))],
    [level]
  )
  const prompt = WRITING_PROMPTS.find((p) => p.id === promptId)
  const words = countWords(text)
  const tooShort = words < MIN_WORDS
  const recent = history.filter((h) => h.track === "english" && h.label.startsWith("Writing:")).slice(0, 10)

  const changeLevel = (l: EnglishLevel) => {
    setLevel(l)
    if (promptId !== FREE) setPromptId(WRITING_PROMPTS.find((p) => p.level === l)?.id ?? FREE)
  }

  const check = async () => {
    if (tooShort) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setOffline(null)
    const task = prompt ? `${prompt.title}. ${prompt.hint}` : "Free writing on any topic"
    const original = text.trim()
    try {
      const feedback = await aiAssist("english-feedback", JSON.stringify({ task, text: original, level }), controller.signal)
      setResult({ feedback, original })
      const xp = Math.round(feedback.score / 10) + 5
      const best = recordBest("english:writing", feedback.score)
      grantXp(xp, `Writing: ${feedback.score}/100 · ${prompt?.title ?? "Free writing"}`)
      if (best) toast.success("New personal best!", { description: `Writing score ${feedback.score}/100` })
    } catch (err) {
      if (!isAbort(err)) toast.error("Couldn't check your writing", { description: errorMessage(err) })
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setLoading(false)
      }
    }
  }

  const runOffline = () => {
    setResult(null)
    setOffline(offlineCheck(text))
  }

  if (!hydrated) return <Skeleton className="h-96 rounded-2xl" />

  const aiReady = ai?.configured === true

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-labelledby="wc-title" className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
        <h2 id="wc-title" className="flex items-center gap-2 font-semibold">
          <PenLine className="size-4.5 text-primary" aria-hidden /> Your writing
        </h2>
        {ai && !aiReady ? (
          <Notice tone="info" title="The AI writing coach needs Google Gemini">
            It isn&apos;t configured on this server. You can still use the basic offline checker below — it runs in your browser and catches common
            slips, but it&apos;s not a full grammar check.
          </Notice>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <SimpleSelect id="wc-level" label="Level" value={level} items={ENGLISH_LEVELS} onChange={changeLevel} />
          <SimpleSelect id="wc-task" label="Task" value={promptId} items={promptItems} onChange={setPromptId} />
        </div>
        {prompt ? (
          <p className="rounded-xl bg-surface-muted p-3 text-sm">
            <span className="font-medium">{prompt.title}.</span> <span className="text-muted-foreground">{prompt.hint}</span>
          </p>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="wc-text">Write at least {MIN_WORDS} words</Label>
          <Textarea
            id="wc-text"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
            placeholder={prompt ? `${prompt.title}…` : "Write about anything you like…"}
            className="min-h-48"
            aria-describedby="wc-count"
            spellCheck
          />
          <p id="wc-count" className={cn("text-xs tabular-nums", tooShort ? "text-muted-foreground" : "text-success")}>
            {words} word{words === 1 ? "" : "s"}
            {tooShort ? ` · ${MIN_WORDS - words} more to go` : " · ready to check"}
            {text.length >= MAX_CHARS ? " · character limit reached" : ""}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {aiReady ? (
            loading ? (
              <>
                <Button size="lg" disabled className="flex-1">
                  <Loader2 className="animate-spin" /> Checking…
                </Button>
                <Button size="lg" variant="ghost" onClick={() => abortRef.current?.abort()}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="lg" className="flex-1" disabled={tooShort} onClick={check}>
                <WandSparkles /> Check my writing
              </Button>
            )
          ) : ai === null ? (
            <Skeleton className="h-12 flex-1 rounded-xl" />
          ) : null}
          <Button size="lg" variant={aiReady ? "outline" : "default"} className={aiReady ? "" : "flex-1"} disabled={!text.trim() || loading} onClick={runOffline}>
            <ClipboardCheck /> {aiReady ? "Quick offline check" : "Basic offline check"}
          </Button>
        </div>
        {aiReady ? <p className="text-xs text-muted-foreground">“Check my writing” sends your text to Google Gemini. Don&apos;t include private details.</p> : null}
      </section>

      <div className="space-y-4" aria-live="polite">
        {loading ? <Skeleton className="h-72 rounded-2xl" /> : null}
        {!loading && result ? <FeedbackView feedback={result.feedback} original={result.original} /> : null}
        {!loading && offline ? <OfflineView issues={offline} /> : null}
        {!loading && !result && !offline ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-surface/50 p-8 text-center">
            <Sparkles className="size-8 text-primary" aria-hidden />
            <p className="font-medium">Feedback appears here</p>
            <p className="max-w-sm text-sm text-muted-foreground">Pick a task, write at least {MIN_WORDS} words and check it.</p>
          </div>
        ) : null}
        {recent.length ? (
          <section aria-labelledby="wc-history" className="rounded-2xl border bg-card p-4">
            <h3 id="wc-history" className="flex items-center gap-2 text-sm font-semibold">
              <History className="size-4" aria-hidden /> Recent checks
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {recent.map((h) => (
                <li key={h.at} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{h.label.replace(/^Writing: /, "")}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(h.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}

function ScoreRing({ score }: { score: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score))
  const tone = pct >= 80 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive"
  return (
    <div className="relative size-24 shrink-0" role="img" aria-label={`Score ${pct} out of 100`}>
      <svg viewBox="0 0 80 80" className="size-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" className="stroke-muted" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className={cn("transition-[stroke-dashoffset] duration-700", tone)}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums">{pct}</span>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </span>
    </div>
  )
}

function FeedbackView({ feedback, original }: { feedback: Feedback; original: string }) {
  const diff = useMemo(() => diffWords(original, feedback.correctedText), [original, feedback.correctedText])
  const groups = useMemo(() => {
    const map = new Map<string, Feedback["mistakes"]>()
    for (const m of feedback.mistakes) {
      const key = m.type.trim() ? m.type.trim()[0].toUpperCase() + m.type.trim().slice(1) : "Other"
      map.set(key, [...(map.get(key) ?? []), m])
    }
    return [...map.entries()]
  }, [feedback.mistakes])
  const unchanged = original.trim() === feedback.correctedText.trim()

  return (
    <section aria-label="Writing feedback" className="space-y-4">
      <div className="flex items-center gap-4 rounded-2xl border bg-card p-4 sm:p-5">
        <ScoreRing score={feedback.score} />
        <div className="min-w-0">
          <p className="font-semibold">Your score</p>
          <p className="text-sm text-muted-foreground">{feedback.encouragement}</p>
          <p className="mt-1 text-xs text-muted-foreground">+{Math.round(feedback.score / 10) + 5} XP</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">Corrected text</h3>
          <CopyButton value={feedback.correctedText} />
        </div>
        {unchanged ? (
          <p className="mt-2 text-sm text-success">No corrections needed — great job!</p>
        ) : diff ? (
          <>
            <p className="mt-2 leading-relaxed whitespace-pre-wrap">
              {diff.map((part, i) => (
                <span key={i}>
                  {part.type === "same" ? (
                    part.text
                  ) : part.type === "removed" ? (
                    <del className="rounded bg-destructive/10 px-0.5 text-destructive decoration-destructive/70">{part.text}</del>
                  ) : (
                    <ins className="rounded bg-success/12 px-0.5 text-success no-underline">{part.text}</ins>
                  )}{" "}
                </span>
              ))}
            </p>
            <p className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>
                <del className="text-destructive">removed</del>
              </span>
              <span>
                <ins className="text-success no-underline">added</ins>
              </span>
            </p>
          </>
        ) : (
          <p className="mt-2 leading-relaxed whitespace-pre-wrap">{feedback.correctedText}</p>
        )}
      </div>

      {groups.length ? (
        <div className="rounded-2xl border bg-card p-4 sm:p-5">
          <h3 className="font-semibold">Mistakes ({feedback.mistakes.length})</h3>
          <div className="mt-2 space-y-3">
            {groups.map(([type, items]) => (
              <div key={type}>
                <Badge variant="secondary">
                  {type} · {items.length}
                </Badge>
                <ul className="mt-2 space-y-2">
                  {items.map((m, i) => (
                    <li key={i} className="rounded-xl bg-surface-muted p-3 text-sm">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <del className="text-destructive">{m.original}</del>
                        <span aria-hidden>→</span>
                        <span className="sr-only">should be</span>
                        <ins className="font-medium text-success no-underline">{m.correction}</ins>
                      </p>
                      {m.explanation ? <p className="mt-1 text-muted-foreground">{m.explanation}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {feedback.vocabularyTips.length ? (
        <div className="rounded-2xl border bg-card p-4 sm:p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <Lightbulb className="size-4 text-warning" aria-hidden /> Vocabulary tips
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {feedback.vocabularyTips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">Feedback by Google Gemini — AI can make mistakes, so double-check anything that looks odd.</p>
    </section>
  )
}

function OfflineView({ issues }: { issues: OfflineIssue[] }) {
  return (
    <section aria-labelledby="off-title" className="rounded-2xl border bg-card p-4 sm:p-5">
      <h3 id="off-title" className="flex flex-wrap items-center gap-2 font-semibold">
        Basic offline check <Badge variant="outline">Not AI · runs in your browser</Badge>
      </h3>
      {issues.length ? (
        <ul className="mt-3 space-y-2">
          {issues.map((it, i) => (
            <li key={i} className="rounded-xl bg-surface-muted p-3 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{it.type}</Badge>
                <span className="font-medium break-all">“{it.excerpt}”</span>
              </p>
              <p className="mt-1 text-muted-foreground">
                {it.message}
                {it.suggestion ? (
                  <>
                    {" "}
                    Try: <span className="font-medium text-foreground">{it.suggestion}</span>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-success">No common issues found. This basic check can&apos;t catch everything — grammar and word choice may still need work.</p>
      )}
    </section>
  )
}
