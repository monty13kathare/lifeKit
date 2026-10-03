"use client"

import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { awardXp, completeLesson, learnState, levelInfo } from "@/lib/learn/progress"

function levelUpToast(level: number) {
  toast.success("Level up! 🎉", { description: `You reached level ${level} in Logic & Reasoning.` })
}

/** Award Logic XP and celebrate a level-up. */
export function awardLogicXp(xp: number, label: string) {
  if (xp <= 0) return
  const r = awardXp("logic", xp, label)
  if (r.levelUp) levelUpToast(r.level)
}

/** Complete a Logic lesson/puzzle once (idempotent). Returns true the first time. */
export function completeLogic(id: string, title: string, xp: number): boolean {
  const before = levelInfo(learnState().xp.logic).level
  const label = id.startsWith("puzzle:") ? `Puzzle: ${title}` : id.includes("daily") ? "Daily puzzle bonus" : `Lesson: ${title}`
  const first = completeLesson("logic", id, title, xp, label)
  if (first) {
    const after = levelInfo(learnState().xp.logic).level
    if (after > before) levelUpToast(after)
  }
  return first
}

/** Accessible segmented control (radio group of buttons). */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className,
  disabled,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  className?: string
  disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex gap-1 rounded-xl bg-muted p-1", className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-10 flex-1 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
              active ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function GeminiHint({ className }: { className?: string }) {
  return <p className={cn("text-xs text-muted-foreground", className)}>Sent to Google Gemini. AI can make mistakes.</p>
}

export function isAbort(err: unknown) {
  return (err as Error)?.name === "AbortError"
}
