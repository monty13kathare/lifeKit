"use client"

import { useEffect, useId, useRef, useState } from "react"
import { motion } from "framer-motion"
import { CircleCheck, Eye, Lightbulb, Loader2, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Notice } from "@/components/common/notice"
import { DIFFICULTIES, HINT_PENALTY, PUZZLE_CATEGORIES, puzzleXp, type Difficulty, type PuzzleCategory } from "@/data/learn/logic"
import { checkAnswer } from "./generators"
import { GeminiHint, isAbort } from "./shared"

export interface SolverPuzzle {
  id: string
  title: string
  puzzle: string
  hint: string
  answer: string
  accept?: string[]
  explanation: string
  difficulty: Difficulty
  category?: PuzzleCategory
}

interface PuzzleSolverProps {
  puzzle: SolverPuzzle
  /** Already solved before → no XP this time. */
  solvedBefore?: boolean
  /** Called once when solved; returns XP actually awarded. */
  onSolve: (hintUsed: boolean) => number
  /** Enables the reasoning box + "Ask AI to check my reasoning". */
  aiCheck?: (userAnswer: string, reasoning: string, signal: AbortSignal) => Promise<{ correct: boolean; feedback: string }>
  badge?: React.ReactNode
  footer?: React.ReactNode
}

type Status = "idle" | "wrong" | "correct" | "revealed"

/**
 * Read → optional hint → answer → local check → feedback + explanation → XP.
 * Remount with a new `key` for each puzzle.
 */
export function PuzzleSolver({ puzzle, solvedBefore, onSolve, aiCheck, badge, footer }: PuzzleSolverProps) {
  const id = useId()
  const [answer, setAnswer] = useState("")
  const [reasoning, setReasoning] = useState("")
  const [hintUsed, setHintUsed] = useState(false)
  const [status, setStatus] = useState<Status>("idle")
  const [attempts, setAttempts] = useState(0)
  const [earned, setEarned] = useState<number | null>(null)
  const [aiFeedback, setAiFeedback] = useState<{ correct: boolean; feedback: string } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const done = status === "correct" || status === "revealed"
  const xpValue = puzzleXp(puzzle.difficulty, hintUsed)

  function solve() {
    setStatus("correct")
    setEarned(onSolve(hintUsed))
  }

  function check(e?: React.FormEvent) {
    e?.preventDefault()
    if (done || aiLoading) return
    if (!answer.trim()) {
      toast.error("Type an answer first.")
      return
    }
    setAiFeedback(null)
    setAttempts((a) => a + 1)
    if (checkAnswer(answer, puzzle.answer, puzzle.accept)) solve()
    else setStatus("wrong")
  }

  async function askAi() {
    if (!aiCheck || aiLoading) return
    const controller = new AbortController()
    abortRef.current = controller
    setAiLoading(true)
    try {
      const res = await aiCheck(answer, reasoning, controller.signal)
      setAiFeedback(res)
      if (res.correct) solve()
    } catch (err) {
      if (!isAbort(err)) toast.error((err as Error).message || "The AI check failed. Try again.")
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setAiLoading(false)
    }
  }

  return (
    <article className="rounded-2xl border bg-card p-4 shadow-soft sm:p-6" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-center gap-1.5">
        {badge}
        {puzzle.category ? <Badge variant="secondary">{PUZZLE_CATEGORIES[puzzle.category].label}</Badge> : null}
        <Badge variant="outline">{DIFFICULTIES[puzzle.difficulty].label}</Badge>
        <Badge variant="outline" className="tabular-nums">
          {solvedBefore ? "Solved before" : `${xpValue} XP`}
        </Badge>
      </div>
      <h2 id={`${id}-title`} className="mt-3 text-lg font-semibold sm:text-xl">
        {puzzle.title}
      </h2>
      <p className="mt-2 text-base leading-relaxed whitespace-pre-line">{puzzle.puzzle}</p>

      {hintUsed ? (
        <Notice tone="warning" icon={Lightbulb} title="Hint" className="mt-4">
          {puzzle.hint}
        </Notice>
      ) : !done && puzzle.hint ? (
        <Button variant="ghost" size="sm" className="mt-3 -ml-2" onClick={() => setHintUsed(true)}>
          <Lightbulb aria-hidden /> Show hint {solvedBefore ? "" : `(−${Math.round(HINT_PENALTY * 100)}% XP)`}
        </Button>
      ) : null}

      {!done ? (
        <form onSubmit={check} className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-answer`}>Your answer</Label>
            <Input
              id={`${id}-answer`}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={120}
              className="h-12 text-base"
              placeholder="Type your answer"
              aria-invalid={status === "wrong" || undefined}
            />
          </div>
          {aiCheck ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-reasoning`}>Your reasoning (optional)</Label>
              <Textarea
                id={`${id}-reasoning`}
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Explain how you got there — the AI can check it if your answer is worded differently."
              />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="lg" className="flex-1 sm:flex-none" disabled={aiLoading}>
              Check answer
            </Button>
            {attempts > 0 ? (
              <Button type="button" variant="outline" size="lg" onClick={() => setStatus("revealed")} disabled={aiLoading}>
                <Eye aria-hidden /> Reveal
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}

      <div aria-live="polite" className="mt-4 empty:hidden">
        {status === "wrong" ? (
          <motion.div key={attempts} initial={{ x: -6 }} animate={{ x: 0 }} transition={{ type: "spring", stiffness: 600, damping: 15 }}>
            <Notice tone="danger" title="Not quite — try again.">
              {aiFeedback && !aiFeedback.correct ? aiFeedback.feedback : `Attempt ${attempts}. Check the wording carefully${hintUsed ? "" : " or take the hint"}.`}
            </Notice>
            {aiCheck && reasoning.trim() ? (
              <div className="mt-3 space-y-1.5">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={askAi} disabled={aiLoading}>
                    {aiLoading ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
                    {aiLoading ? "Checking…" : "Ask AI to check my reasoning"}
                  </Button>
                  {aiLoading ? (
                    <Button type="button" variant="ghost" onClick={() => abortRef.current?.abort()}>
                      <X aria-hidden /> Cancel
                    </Button>
                  ) : null}
                </div>
                <GeminiHint />
              </div>
            ) : null}
          </motion.div>
        ) : null}

        {done ? (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {status === "correct" ? (
              <Notice tone="success" icon={CircleCheck} title={earned ? `Correct! +${earned} XP` : solvedBefore ? "Correct! (already solved — no extra XP)" : "Correct!"}>
                {aiFeedback?.correct ? <p className="mb-1">{aiFeedback.feedback}</p> : null}
                <p>
                  Answer: <span className="font-medium text-foreground">{puzzle.answer}</span>
                </p>
              </Notice>
            ) : (
              <Notice tone="info" icon={Eye} title="Answer revealed (no XP)">
                <p>
                  Answer: <span className="font-medium text-foreground">{puzzle.answer}</span>
                </p>
              </Notice>
            )}
            <div className="rounded-xl bg-surface-muted p-4 text-sm leading-relaxed">
              <p className="mb-1 font-medium">Why</p>
              <p className="text-muted-foreground">{puzzle.explanation}</p>
            </div>
          </motion.div>
        ) : null}
      </div>

      {footer ? <div className="mt-4 flex flex-wrap gap-2">{footer}</div> : null}
    </article>
  )
}
