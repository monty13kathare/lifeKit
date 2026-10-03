"use client"

import { useEffect, useRef, useState } from "react"
import { Check, RotateCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { QuizQuestion } from "@/data/learn/english"
import { normalizeWord } from "./english-utils"

interface QuizRunnerProps {
  questions: QuizQuestion[]
  /** Called once when the last question is answered and "See results" pressed. */
  onFinish?: (correct: number, total: number) => void
  onRetry?: () => void
  onExit?: () => void
  exitLabel?: string
  /** Extra content under the results (e.g. lesson-complete note). */
  resultExtra?: (correct: number, total: number) => React.ReactNode
}

const normalizeAnswer = (s: string) => s.trim().split(/\s+/).map(normalizeWord).join(" ")

/**
 * Generic quiz UI: multiple choice (keys 1–4) or fill-the-blank, with instant
 * feedback after each answer and a results screen.
 */
export function QuizRunner({ questions, onFinish, onRetry, onExit, exitLabel = "Back", resultExtra }: QuizRunnerProps) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [typed, setTyped] = useState("")
  const [answered, setAnswered] = useState<boolean | null>(null)
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)
  const nextRef = useRef<HTMLButtonElement>(null)

  const q = questions[index]
  const last = index === questions.length - 1

  const answerMcq = (i: number) => {
    if (answered !== null || q.kind !== "mcq") return
    const ok = i === q.answerIndex
    setPicked(i)
    setAnswered(ok)
    if (ok) setCorrect((c) => c + 1)
  }

  const answerBlank = (e: React.FormEvent) => {
    e.preventDefault()
    if (answered !== null || q.kind !== "blank" || !typed.trim()) return
    const ok = q.answers.some((a) => normalizeAnswer(a) === normalizeAnswer(typed))
    setAnswered(ok)
    if (ok) setCorrect((c) => c + 1)
  }

  const next = () => {
    if (last) {
      setDone(true)
      onFinish?.(correct, questions.length)
      return
    }
    setIndex((i) => i + 1)
    setPicked(null)
    setTyped("")
    setAnswered(null)
  }

  useEffect(() => {
    if (answered !== null) nextRef.current?.focus()
  }, [answered])

  // Keys 1–4 pick an option in multiple-choice questions.
  useEffect(() => {
    if (done || q?.kind !== "mcq" || answered !== null) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest("input, textarea, [contenteditable=true]")) return
      const n = Number(e.key)
      if (n >= 1 && n <= q.options.length) {
        e.preventDefault()
        answerMcq(n - 1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  if (!questions.length) return null

  if (done) {
    const pct = Math.round((correct / questions.length) * 100)
    return (
      <div className="space-y-4 rounded-2xl border bg-card p-5 text-center" aria-live="polite">
        <p className="text-4xl font-semibold tabular-nums">{pct}%</p>
        <p className="text-muted-foreground">
          {correct} of {questions.length} correct
        </p>
        {resultExtra?.(correct, questions.length)}
        <div className="flex flex-wrap justify-center gap-2">
          {onRetry ? (
            <Button variant="outline" onClick={onRetry}>
              <RotateCcw /> Try again
            </Button>
          ) : null}
          {onExit ? <Button onClick={onExit}>{exitLabel}</Button> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Question {index + 1} of {questions.length}
        </span>
        <span className="tabular-nums">{correct} correct</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(index / questions.length) * 100}%` }} />
      </div>
      <p className="text-base font-medium text-pretty sm:text-lg">{q.question}</p>

      {q.kind === "mcq" ? (
        <div className="grid gap-2" role="group" aria-label="Answer options">
          {q.options.map((opt, i) => {
            const isAnswer = i === q.answerIndex
            const state = answered === null ? "idle" : isAnswer ? "right" : picked === i ? "wrong" : "idle"
            return (
              <button
                key={i}
                type="button"
                onClick={() => answerMcq(i)}
                disabled={answered !== null}
                aria-pressed={picked === i}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                  answered === null && "hover:bg-surface-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  state === "right" && "border-success/50 bg-success/10",
                  state === "wrong" && "border-destructive/50 bg-destructive/10"
                )}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold" aria-hidden>
                  {state === "right" ? <Check className="size-3.5 text-success" /> : state === "wrong" ? <X className="size-3.5 text-destructive" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">{opt}</span>
              </button>
            )
          })}
          <p className="hidden text-xs text-muted-foreground sm:block">Tip: press 1–{q.options.length} to answer.</p>
        </div>
      ) : (
        <form onSubmit={answerBlank} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor={`blank-${index}`} className="sr-only">
            Your answer
          </label>
          <Input
            id={`blank-${index}`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={answered !== null}
            placeholder="Type the missing word(s)"
            autoComplete="off"
            autoCapitalize="off"
            className="h-10"
            aria-invalid={answered === false || undefined}
          />
          <Button type="submit" disabled={answered !== null || !typed.trim()}>
            Check
          </Button>
        </form>
      )}

      <div aria-live="polite">
        {answered !== null ? (
          <div className={cn("rounded-xl border p-3 text-sm", answered ? "border-success/30 bg-success/8" : "border-destructive/30 bg-destructive/8")}>
            <p className={cn("font-medium", answered ? "text-success" : "text-destructive")}>
              {answered ? "Correct!" : q.kind === "blank" ? `Not quite — answer: ${q.answers[0]}` : `Not quite — answer: ${q.options[q.answerIndex]}`}
            </p>
            {q.explanation ? <p className="mt-1 text-muted-foreground">{q.explanation}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="flex justify-between gap-2">
        {onExit ? (
          <Button variant="ghost" onClick={onExit}>
            Quit
          </Button>
        ) : (
          <span />
        )}
        <Button ref={nextRef} onClick={next} disabled={answered === null}>
          {last ? "See results" : "Next"}
        </Button>
      </div>
    </div>
  )
}
