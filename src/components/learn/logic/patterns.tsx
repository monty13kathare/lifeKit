"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"
import { motion } from "framer-motion"
import { ArrowRight, Flame, Play, Square, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Notice } from "@/components/common/notice"
import { useLearn } from "@/hooks/use-lifekit-data"
import { recordBest } from "@/lib/learn/progress"
import { cn } from "@/lib/utils"
import { checkAnswer, patternQuestion, type PatternLevel, type PatternQuestion } from "./generators"
import { awardLogicXp, Segmented } from "./shared"

const XP_PER_CORRECT = 3
/** Flush batched XP after this many correct answers in a row. */
const FLUSH_EVERY = 10
const BEST_KEY = "logic:patterns:streak"

const LEVELS: { value: PatternLevel; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
]
type AnswerMode = "choices" | "typed"
const MODES: { value: AnswerMode; label: string }[] = [
  { value: "choices", label: "4 choices" },
  { value: "typed", label: "Type it" },
]

export function Patterns() {
  const { bests } = useLearn()
  const [level, setLevel] = useState<PatternLevel>("easy")
  const [answerMode, setAnswerMode] = useState<AnswerMode>("choices")
  const [question, setQuestion] = useState<PatternQuestion | null>(null)
  const [typed, setTyped] = useState("")
  const [picked, setPicked] = useState<string | null>(null)
  const [verdict, setVerdict] = useState<boolean | null>(null)
  const [streak, setStreak] = useState(0)
  const [session, setSession] = useState({ correct: 0, total: 0 })
  const [newBest, setNewBest] = useState(false)

  const pendingRef = useRef(0)
  const nextRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function flush() {
    const n = pendingRef.current
    if (!n) return
    pendingRef.current = 0
    awardLogicXp(n * XP_PER_CORRECT, `Patterns: ${n} correct`)
  }

  // Award any batched XP when leaving the tab.
  const flushOnUnmount = useEffectEvent(() => flush())
  useEffect(() => () => flushOnUnmount(), [])

  useEffect(() => {
    if (verdict !== null) nextRef.current?.focus()
    else if (question && answerMode === "typed") inputRef.current?.focus()
  }, [verdict, question, answerMode])

  function next() {
    setQuestion(patternQuestion(level))
    setTyped("")
    setPicked(null)
    setVerdict(null)
  }

  function start() {
    setStreak(0)
    setSession({ correct: 0, total: 0 })
    setNewBest(false)
    next()
  }

  function stop() {
    flush()
    setQuestion(null)
  }

  function answer(value: string) {
    if (!question || verdict !== null) return
    const ok = answerMode === "choices" ? value === question.answer : checkAnswer(value, question.answer)
    setPicked(value)
    setVerdict(ok)
    setSession((s) => ({ correct: s.correct + (ok ? 1 : 0), total: s.total + 1 }))
    if (ok) {
      const nextStreak = streak + 1
      setStreak(nextStreak)
      pendingRef.current += 1
      if (pendingRef.current >= FLUSH_EVERY) flush()
      if (recordBest(BEST_KEY, nextStreak) && nextStreak > 1) setNewBest(true)
    } else {
      setStreak(0)
      setNewBest(false)
      flush()
    }
  }

  const best = bests[BEST_KEY] ?? 0

  if (!question) {
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <div className="rounded-2xl border bg-card p-5">
          <p className="font-semibold">What comes next?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Endless sequences — arithmetic, geometric, squares, Fibonacci-like, alternating and letter patterns. Build a streak; {XP_PER_CORRECT} XP per correct answer.
          </p>
          {session.total > 0 ? (
            <p className="mt-3 text-sm" aria-live="polite">
              Last session: <span className="font-semibold tabular-nums">{session.correct}/{session.total}</span> correct
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label>Difficulty</Label>
          <Segmented label="Difficulty" value={level} options={LEVELS} onChange={setLevel} />
        </div>
        <div className="space-y-1.5">
          <Label>Answer style</Label>
          <Segmented label="Answer style" value={answerMode} options={MODES} onChange={setAnswerMode} />
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Trophy className="size-4 text-warning" aria-hidden /> Best streak: <span className="font-semibold text-foreground tabular-nums">{best}</span>
        </p>
        <Button size="lg" className="w-full" onClick={start}>
          <Play aria-hidden /> Start
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-2" aria-live="polite">
          <Flame className={streak ? "size-5 text-orange-500" : "size-5 text-muted-foreground"} aria-hidden />
          <span className="text-sm font-semibold tabular-nums">Streak {streak}</span>
          <span className="text-xs text-muted-foreground">· best {Math.max(best, streak)}</span>
        </div>
        <Button variant="ghost" onClick={stop}>
          <Square aria-hidden /> End
        </Button>
      </div>

      <section className="rounded-2xl border bg-card p-5 shadow-soft" aria-label="Sequence">
        <p className="text-sm text-muted-foreground">What comes next?</p>
        <ol className="mt-3 flex flex-wrap items-center gap-2" aria-label={`Sequence: ${question.terms.join(", ")}, then what?`}>
          {question.terms.map((t, i) => (
            <li key={i} className="flex h-12 min-w-12 items-center justify-center rounded-xl bg-surface-muted px-3 text-xl font-semibold tabular-nums">
              {t}
            </li>
          ))}
          <li className="flex h-12 min-w-12 items-center justify-center rounded-xl border-2 border-dashed border-primary/50 px-3 text-xl font-semibold text-primary">
            {verdict !== null ? question.answer : "?"}
          </li>
        </ol>
      </section>

      {answerMode === "choices" ? (
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Choices">
          {question.choices.map((c) => {
            const isAnswer = c === question.answer
            const state = verdict === null ? "idle" : isAnswer ? "right" : c === picked ? "wrong" : "dim"
            return (
              <button
                key={c}
                type="button"
                disabled={verdict !== null}
                onClick={() => answer(c)}
                className={cn(
                  "h-14 rounded-xl border text-xl font-semibold tabular-nums transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  state === "idle" && "bg-card hover:bg-surface-muted active:scale-[0.98]",
                  state === "right" && "border-success bg-success/15 text-success",
                  state === "wrong" && "border-destructive bg-destructive/10 text-destructive",
                  state === "dim" && "opacity-50"
                )}
              >
                {c}
              </button>
            )
          })}
        </div>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (typed.trim()) answer(typed)
          }}
        >
          <Label htmlFor="pattern-answer" className="sr-only">
            Next term
          </Label>
          <Input
            id="pattern-answer"
            ref={inputRef}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={verdict !== null}
            autoComplete="off"
            autoCapitalize="characters"
            inputMode={/^[A-Z]$/.test(question.answer) ? "text" : "numeric"}
            maxLength={12}
            className="h-12 flex-1 text-lg"
            placeholder="Next term"
          />
          <Button type="submit" size="lg" disabled={verdict !== null || !typed.trim()}>
            Check
          </Button>
        </form>
      )}

      <div aria-live="polite">
        {verdict !== null ? (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <Notice
              tone={verdict ? "success" : "danger"}
              title={verdict ? `Correct! +${XP_PER_CORRECT} XP${newBest && streak > 1 ? " · New best streak!" : ""}` : `Not quite — the answer is ${question.answer}.`}
            >
              <span className="font-medium text-foreground">{question.kind}.</span> {question.rule}
            </Notice>
            <Button ref={nextRef} size="lg" className="w-full" onClick={next}>
              Next <ArrowRight aria-hidden />
            </Button>
          </motion.div>
        ) : null}
      </div>
    </div>
  )
}
