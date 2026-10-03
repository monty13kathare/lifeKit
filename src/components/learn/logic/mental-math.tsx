"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Check, Delete, Play, RotateCcw, SkipForward, Timer, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ProgressRing } from "@/components/common/progress-ring"
import { useLearn } from "@/hooks/use-lifekit-data"
import { recordBest } from "@/lib/learn/progress"
import { cn } from "@/lib/utils"
import { MATH_LEVELS, MATH_MODES, mathQuestion, type MathLevel, type MathMode, type MathQuestion } from "./generators"
import { awardLogicXp, Segmented } from "./shared"

const DURATION = 60
const MAX_DIGITS = 6

type Phase = "idle" | "running" | "done"

interface Result {
  correct: number
  attempted: number
  avgSeconds: number
  newBest: boolean
  previousBest: number | null
}

export function MentalMath() {
  const { bests } = useLearn()
  const [mode, setMode] = useState<MathMode>("mixed")
  const [level, setLevel] = useState<MathLevel>(1)
  const [phase, setPhase] = useState<Phase>("idle")
  const [question, setQuestion] = useState<MathQuestion | null>(null)
  const [input, setInput] = useState("")
  const [remaining, setRemaining] = useState(DURATION)
  const [score, setScore] = useState({ correct: 0, attempted: 0 })
  const [flash, setFlash] = useState<{ ok: boolean; n: number } | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const endAtRef = useRef(0)
  const qStartRef = useRef(0)
  const statsRef = useRef({ correct: 0, attempted: 0, totalMs: 0 })

  const bestKey = `logic:math:${mode}:${level}`
  const best = bests[bestKey]

  function nextQuestion(prev?: MathQuestion | null) {
    let q = mathQuestion(mode, level)
    for (let i = 0; i < 5 && prev && q.text === prev.text; i++) q = mathQuestion(mode, level)
    setQuestion(q)
    setInput("")
    qStartRef.current = performance.now()
  }

  function start() {
    statsRef.current = { correct: 0, attempted: 0, totalMs: 0 }
    setScore({ correct: 0, attempted: 0 })
    setResult(null)
    setFlash(null)
    setRemaining(DURATION)
    endAtRef.current = Date.now() + DURATION * 1000
    setPhase("running")
    nextQuestion(null)
  }

  function finish() {
    const s = statsRef.current
    const previousBest = bests[bestKey] ?? null
    const newBest = s.correct > 0 && recordBest(bestKey, s.correct)
    if (s.correct > 0) {
      const modeLabel = MATH_MODES.find((m) => m.value === mode)?.label ?? mode
      awardLogicXp(s.correct, `Mental maths (${modeLabel}): ${s.correct} correct`)
    }
    setResult({
      correct: s.correct,
      attempted: s.attempted,
      avgSeconds: s.attempted ? s.totalMs / s.attempted / 1000 : 0,
      newBest,
      previousBest,
    })
    setPhase("done")
    setQuestion(null)
  }

  function record(ok: boolean) {
    const s = statsRef.current
    s.attempted += 1
    s.totalMs += performance.now() - qStartRef.current
    if (ok) s.correct += 1
    setScore({ correct: s.correct, attempted: s.attempted })
    setFlash({ ok, n: s.attempted })
    nextQuestion(question)
  }

  function type(digit: string) {
    if (phase !== "running" || !question) return
    const next = (input + digit).replace(/^0+(?=\d)/, "").slice(0, MAX_DIGITS)
    if (Number(next) === question.answer) record(true)
    else setInput(next)
  }

  function submit() {
    if (phase !== "running" || !question || !input) return
    record(Number(input) === question.answer)
  }

  function skip() {
    if (phase !== "running" || !question) return
    record(false)
  }

  // Countdown — interval cleaned up when the run ends or the tab unmounts.
  const onTick = useEffectEvent(() => {
    const left = endAtRef.current - Date.now()
    setRemaining(Math.max(0, Math.ceil(left / 1000)))
    if (left <= 0) finish()
  })
  useEffect(() => {
    if (phase !== "running") return
    const id = window.setInterval(() => onTick(), 200)
    return () => window.clearInterval(id)
  }, [phase])

  // Physical keyboard input while running.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (/^\d$/.test(e.key)) {
      e.preventDefault()
      type(e.key)
    } else if (e.key === "Backspace") {
      e.preventDefault()
      setInput((v) => v.slice(0, -1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      submit()
    } else if (e.key === "Escape") {
      skip()
    }
  })
  useEffect(() => {
    if (phase !== "running") return
    const handler = (e: KeyboardEvent) => onKey(e)
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [phase])

  if (phase === "running" && question) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex items-center justify-between gap-3">
          <ProgressRing value={remaining / DURATION} size={56} label="Time remaining" color={remaining <= 10 ? "var(--destructive)" : "var(--primary)"}>
            <span className="text-sm font-semibold tabular-nums" aria-hidden>
              {remaining}
            </span>
          </ProgressRing>
          <p className="sr-only" aria-live="polite">
            {remaining === 30 || remaining === 10 || remaining <= 5 ? `${remaining} seconds left` : ""}
          </p>
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums">{score.correct}</p>
            <p className="text-xs text-muted-foreground">correct of {score.attempted}</p>
          </div>
        </div>

        <div className="relative rounded-2xl border bg-card p-5 text-center shadow-soft">
          {flash ? (
            <motion.span
              key={flash.n}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className={cn("pointer-events-none absolute inset-0 rounded-2xl", flash.ok ? "bg-success/15" : "bg-destructive/15")}
              aria-hidden
            />
          ) : null}
          <p className="text-sm text-muted-foreground" id="mm-q-label">
            What is…
          </p>
          <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl" aria-live="polite">
            {question.text}
          </p>
          <div
            className="mx-auto mt-4 flex h-14 max-w-56 items-center justify-center rounded-xl border-2 border-primary/40 bg-surface-muted text-3xl font-semibold tabular-nums"
            role="textbox"
            aria-readonly
            aria-label="Your answer"
          >
            {input || <span className="text-muted-foreground/50">?</span>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Number keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <KeyButton key={d} onClick={() => type(d)}>
              {d}
            </KeyButton>
          ))}
          <KeyButton onClick={() => setInput((v) => v.slice(0, -1))} label="Delete" muted>
            <Delete className="size-6" aria-hidden />
          </KeyButton>
          <KeyButton onClick={() => type("0")}>0</KeyButton>
          <KeyButton onClick={submit} label="Submit answer" primary>
            <Check className="size-6" aria-hidden />
          </KeyButton>
        </div>
        <div className="flex justify-between gap-2">
          <Button variant="ghost" onClick={skip}>
            <SkipForward aria-hidden /> Skip
          </Button>
          <Button variant="ghost" onClick={finish}>
            End now
          </Button>
        </div>
        <p className="hidden text-center text-xs text-muted-foreground sm:block">Type digits on your keyboard · Enter submits · Esc skips</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {result ? (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border bg-card p-5 text-center shadow-soft"
          aria-live="polite"
        >
          {result.newBest ? (
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-sm font-semibold">
              <Trophy className="size-4 text-warning" aria-hidden /> New best!
            </p>
          ) : null}
          <p className="text-5xl font-semibold tabular-nums">{result.correct}</p>
          <p className="text-sm text-muted-foreground">correct in {DURATION} seconds</p>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <Stat label="Accuracy" value={result.attempted ? `${Math.round((result.correct / result.attempted) * 100)}%` : "—"} />
            <Stat label="Avg time" value={result.attempted ? `${result.avgSeconds.toFixed(1)}s` : "—"} />
            <Stat label="XP" value={`+${result.correct}`} />
          </dl>
          {result.previousBest != null && !result.newBest ? (
            <p className="mt-3 text-xs text-muted-foreground">Your best here is {result.previousBest}.</p>
          ) : null}
          {result.attempted === 0 ? <p className="mt-3 text-sm text-muted-foreground">No answers this time — give it another go!</p> : null}
        </motion.section>
      ) : (
        <div className="rounded-2xl border bg-card p-5">
          <p className="flex items-center gap-2 font-semibold">
            <Timer className="size-4.5 text-primary" aria-hidden /> 60-second sprint
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Answer as many as you can. Correct answers move on instantly; press ✓ to submit a wrong one. 1 XP per correct answer.
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label id="mm-mode">Mode</Label>
          <div role="radiogroup" aria-labelledby="mm-mode" className="grid grid-cols-2 gap-2">
            {MATH_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={mode === m.value}
                onClick={() => setMode(m.value)}
                className={cn(
                  "min-h-14 rounded-xl border p-3 text-left transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  mode === m.value ? "border-primary bg-primary/8" : "bg-card hover:bg-surface-muted"
                )}
              >
                <span className="block text-sm font-medium">{m.label}</span>
                <span className="block text-xs text-muted-foreground">{m.description}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label id="mm-level">Level</Label>
          <Segmented label="Level" value={level} options={MATH_LEVELS} onChange={setLevel} />
        </div>
        <p className="text-sm text-muted-foreground">
          Best for this mode &amp; level: <span className="font-semibold text-foreground tabular-nums">{best ?? "—"}</span>
        </p>
        <Button size="lg" className="w-full" onClick={start}>
          {result ? <RotateCcw aria-hidden /> : <Play aria-hidden />}
          {result ? "Play again" : "Start sprint"}
        </Button>
      </div>
    </div>
  )
}

function KeyButton({
  children,
  onClick,
  label,
  primary,
  muted,
}: {
  children: React.ReactNode
  onClick: () => void
  label?: string
  primary?: boolean
  muted?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex h-14 items-center justify-center rounded-xl text-2xl font-semibold tabular-nums transition-[transform,background-color] select-none active:scale-95 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:h-16",
        primary ? "bg-primary text-primary-foreground hover:bg-primary/90" : muted ? "bg-muted text-foreground hover:bg-muted/80" : "border bg-card hover:bg-surface-muted"
      )}
    >
      {children}
    </button>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-muted p-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
