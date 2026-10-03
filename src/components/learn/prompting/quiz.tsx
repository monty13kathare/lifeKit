"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { ArrowRight, ListChecks, RotateCcw, Trophy } from "lucide-react"
import { ProgressRing } from "@/components/common/progress-ring"
import { Button } from "@/components/ui/button"
import { useLearn } from "@/hooks/use-lifekit-data"
import { recordBest } from "@/lib/learn/progress"
import { PROMPT_QUIZ, type QuizQuestion } from "@/data/learn/prompting"
import { AnswerFeedback, ChoiceOptions } from "./choice-options"
import { rewardXp, shuffle } from "./rewards"

const ROUND_SIZE = 10
const BEST_KEY = "prompting:quiz"

interface RoundQuestion extends QuizQuestion {
  /** Shuffled options with the answer index remapped. */
  options: string[]
  answer: number
}

function buildRound(): RoundQuestion[] {
  return shuffle(PROMPT_QUIZ)
    .slice(0, ROUND_SIZE)
    .map((q) => {
      const order = shuffle(q.options.map((_, i) => i))
      return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) }
    })
}

export function Quiz() {
  const { bests } = useLearn()
  const best = bests[BEST_KEY]
  const [round, setRound] = useState<RoundQuestion[] | null>(null)
  const [index, setIndex] = useState(0)
  const [picks, setPicks] = useState<(number | null)[]>([])
  const [result, setResult] = useState<{ score: number; xp: number; newBest: boolean; prevBest?: number } | null>(null)

  const start = () => {
    const r = buildRound()
    setRound(r)
    setPicks(r.map(() => null))
    setIndex(0)
    setResult(null)
  }

  if (!round) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border bg-card px-6 py-10 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ListChecks className="size-7" aria-hidden />
        </div>
        <h2 className="text-lg font-semibold">Prompting quiz</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {ROUND_SIZE} random questions from a bank of {PROMPT_QUIZ.length}. Instant feedback with explanations · 2 XP per correct answer.
        </p>
        {best !== undefined ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm">
            <Trophy className="size-4 text-warning" aria-hidden /> Best score: {best}/{ROUND_SIZE}
          </p>
        ) : null}
        <Button size="lg" className="mt-5" onClick={start}>
          Start quiz
        </Button>
      </div>
    )
  }

  if (result) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border bg-card px-6 py-10 text-center" aria-live="polite">
        <ProgressRing value={result.score / ROUND_SIZE} size={112} stroke={9} label="Quiz score" color={result.score >= 7 ? "var(--success)" : "var(--primary)"}>
          <span className="text-2xl font-semibold tabular-nums">
            {result.score}/{ROUND_SIZE}
          </span>
        </ProgressRing>
        <h2 className="mt-4 text-lg font-semibold">
          {result.score === ROUND_SIZE ? "Perfect round!" : result.score >= 7 ? "Great job!" : result.score >= 4 ? "Good effort!" : "Keep practising!"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">+{result.xp} XP</p>
        {result.newBest ? (
          <p className="mt-2 rounded-full bg-success/12 px-3 py-1 text-sm font-medium text-success">
            New best!{result.prevBest !== undefined ? ` (was ${result.prevBest}/${ROUND_SIZE})` : ""}
          </p>
        ) : result.prevBest !== undefined ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Your best: {result.prevBest}/{ROUND_SIZE}
          </p>
        ) : null}
        <Button size="lg" className="mt-5" onClick={start}>
          <RotateCcw aria-hidden /> Play again
        </Button>
      </div>
    )
  }

  const q = round[index]
  const picked = picks[index]
  const isLast = index === round.length - 1
  const correctSoFar = picks.filter((p, i) => p !== null && p === round[i].answer).length

  const finish = () => {
    const score = picks.filter((p, i) => p === round[i].answer).length
    const prevBest = best
    const xp = score * 2
    const newBest = recordBest(BEST_KEY, score)
    if (xp > 0) rewardXp(xp, `Quiz: ${score}/${ROUND_SIZE}`)
    setResult({ score, xp, newBest, prevBest })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          Question {index + 1} of {round.length}
        </span>
        <span className="tabular-nums">{correctSoFar} correct</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Quiz progress"
        aria-valuemin={0}
        aria-valuemax={round.length}
        aria-valuenow={index + (picked !== null ? 1 : 0)}
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${((index + (picked !== null ? 1 : 0)) / round.length) * 100}%` }} />
      </div>
      <motion.div
        key={q.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5"
      >
        <h2 className="font-medium">{q.question}</h2>
        <ChoiceOptions
          name={`Question ${index + 1}`}
          options={q.options}
          answer={q.answer}
          picked={picked}
          onPick={(i) => setPicks((p) => p.map((v, j) => (j === index ? i : v)))}
        />
        <div aria-live="polite">{picked !== null ? <AnswerFeedback correct={picked === q.answer} explanation={q.explanation} /> : null}</div>
      </motion.div>
      <div className="flex justify-end">
        <Button size="lg" disabled={picked === null} onClick={isLast ? finish : () => setIndex(index + 1)} className="w-full sm:w-auto">
          {isLast ? "See results" : "Next question"} <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  )
}
