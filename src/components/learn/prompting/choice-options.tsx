"use client"

import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChoiceOptionsProps {
  name: string
  options: string[]
  /** Correct option index. */
  answer: number
  /** Chosen index, or null while unanswered. */
  picked: number | null
  onPick: (index: number) => void
}

/**
 * Multiple-choice options with instant feedback. Once answered, the options
 * lock and the correct one is highlighted.
 */
export function ChoiceOptions({ name, options, answer, picked, onPick }: ChoiceOptionsProps) {
  const answered = picked !== null
  return (
    <div role="group" aria-label={name} className="grid gap-2">
      {options.map((opt, i) => {
        const isAnswer = i === answer
        const isPicked = i === picked
        return (
          <button
            key={i}
            type="button"
            aria-pressed={isPicked}
            disabled={answered}
            onClick={() => onPick(i)}
            className={cn(
              "flex min-h-11 w-full items-start gap-3 rounded-xl border bg-card px-3.5 py-2.5 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default",
              !answered && "hover:border-primary/50 hover:bg-surface-muted",
              answered && isAnswer && "border-success/50 bg-success/10",
              answered && isPicked && !isAnswer && "border-destructive/50 bg-destructive/10",
              answered && !isAnswer && !isPicked && "opacity-60"
            )}
          >
            <span
              className={cn(
                "mt-px flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                answered && isAnswer && "border-success bg-success text-success-foreground",
                answered && isPicked && !isAnswer && "border-destructive bg-destructive text-white"
              )}
              aria-hidden
            >
              {answered && isAnswer ? <Check className="size-3" /> : answered && isPicked ? <X className="size-3" /> : String.fromCharCode(65 + i)}
            </span>
            <span className="min-w-0 flex-1">
              {opt}
              {answered && isAnswer ? <span className="sr-only"> (correct answer)</span> : null}
              {answered && isPicked && !isAnswer ? <span className="sr-only"> (your answer)</span> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function AnswerFeedback({ correct, explanation }: { correct: boolean; explanation: string }) {
  return (
    <p className={cn("rounded-xl px-3.5 py-2.5 text-sm", correct ? "bg-success/10" : "bg-destructive/8")}>
      <span className={cn("font-semibold", correct ? "text-success" : "text-destructive")}>{correct ? "Correct! " : "Not quite. "}</span>
      <span className="text-muted-foreground">{explanation}</span>
    </p>
  )
}
