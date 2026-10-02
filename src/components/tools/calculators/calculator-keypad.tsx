"use client"

import { Delete } from "lucide-react"
import type { AngleMode } from "@/lib/math/expression"
import { cn } from "@/lib/utils"

/** Commands the keypad emits besides plain text insertions. */
export type KeypadCommand = "=" | "AC" | "DEL" | "PAREN"

export interface KeypadKey {
  label: React.ReactNode
  /** Text inserted into the expression, or a command. */
  value: string
  command?: KeypadCommand
  aria?: string
  tone?: "digit" | "op" | "fn" | "accent" | "danger"
  span?: number
}

const BASIC: KeypadKey[] = [
  { label: "AC", value: "", command: "AC", tone: "danger", aria: "All clear" },
  { label: <Delete className="size-5" aria-hidden />, value: "", command: "DEL", tone: "fn", aria: "Delete" },
  { label: "%", value: "%", tone: "fn", aria: "Percent" },
  { label: "÷", value: "÷", tone: "op", aria: "Divide" },
  { label: "7", value: "7" },
  { label: "8", value: "8" },
  { label: "9", value: "9" },
  { label: "×", value: "×", tone: "op", aria: "Multiply" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
  { label: "6", value: "6" },
  { label: "−", value: "−", tone: "op", aria: "Minus" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "+", value: "+", tone: "op", aria: "Plus" },
  { label: "( )", value: "", command: "PAREN", tone: "fn", aria: "Parenthesis" },
  { label: "0", value: "0" },
  { label: ".", value: ".", aria: "Decimal point" },
  { label: "=", value: "", command: "=", tone: "accent", aria: "Equals" },
]

const SCIENTIFIC: KeypadKey[] = [
  { label: "sin", value: "sin(", tone: "fn", aria: "Sine" },
  { label: "cos", value: "cos(", tone: "fn", aria: "Cosine" },
  { label: "tan", value: "tan(", tone: "fn", aria: "Tangent" },
  { label: "π", value: "π", tone: "fn", aria: "Pi" },
  { label: "e", value: "e", tone: "fn", aria: "Euler's number" },
  { label: "sin⁻¹", value: "asin(", tone: "fn", aria: "Inverse sine" },
  { label: "cos⁻¹", value: "acos(", tone: "fn", aria: "Inverse cosine" },
  { label: "tan⁻¹", value: "atan(", tone: "fn", aria: "Inverse tangent" },
  { label: "ln", value: "ln(", tone: "fn", aria: "Natural log" },
  { label: "log", value: "log(", tone: "fn", aria: "Log base 10" },
  { label: "x²", value: "^2", tone: "fn", aria: "Square" },
  { label: "xʸ", value: "^", tone: "fn", aria: "Power" },
  { label: "√", value: "√(", tone: "fn", aria: "Square root" },
  { label: "∛", value: "cbrt(", tone: "fn", aria: "Cube root" },
  { label: "n!", value: "!", tone: "fn", aria: "Factorial" },
  { label: "(", value: "(", tone: "fn", aria: "Open parenthesis" },
  { label: ")", value: ")", tone: "fn", aria: "Close parenthesis" },
  { label: "|x|", value: "abs(", tone: "fn", aria: "Absolute value" },
  { label: "round", value: "round(", tone: "fn", aria: "Round" },
  { label: "of", value: " of ", tone: "fn", aria: "of" },
]

const toneClass: Record<NonNullable<KeypadKey["tone"]>, string> = {
  digit: "bg-surface hover:bg-muted text-foreground border",
  op: "bg-primary/10 text-primary hover:bg-primary/15 text-2xl",
  fn: "bg-surface-muted text-foreground hover:bg-muted",
  accent: "bg-primary text-primary-foreground hover:bg-primary/85 text-2xl",
  danger: "bg-destructive/10 text-destructive hover:bg-destructive/15",
}

interface CalculatorKeypadProps {
  onKey: (key: KeypadKey) => void
  scientific: boolean
  angle: AngleMode
  onAngleChange: (angle: AngleMode) => void
  onScientificChange: (scientific: boolean) => void
  className?: string
}

/** Big touch-friendly keypad with a collapsible scientific panel. */
export function CalculatorKeypad({ onKey, scientific, angle, onAngleChange, onScientificChange, className }: CalculatorKeypadProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-pressed={scientific}
          onClick={() => onScientificChange(!scientific)}
          className={cn(
            "h-9 rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            scientific ? "bg-primary/10 text-primary" : "bg-muted text-foreground/70 hover:text-foreground"
          )}
        >
          Scientific
        </button>
        <div role="group" aria-label="Angle unit" className="inline-flex rounded-lg bg-muted p-[3px]">
          {(["deg", "rad"] as const).map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={angle === a}
              onClick={() => onAngleChange(a)}
              className={cn(
                "h-8 rounded-md px-3 text-xs font-semibold uppercase outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                angle === a ? "bg-background text-foreground shadow-sm dark:bg-input/40" : "text-foreground/60"
              )}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {scientific ? (
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {SCIENTIFIC.map((k) => (
            <KeyButton key={k.aria} k={k} onKey={onKey} small />
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {BASIC.map((k, i) => (
          <KeyButton key={i} k={k} onKey={onKey} />
        ))}
      </div>
    </div>
  )
}

function KeyButton({ k, onKey, small }: { k: KeypadKey; onKey: (k: KeypadKey) => void; small?: boolean }) {
  return (
    <button
      type="button"
      aria-label={k.aria}
      // Keep focus (and the mobile keyboard) away from the expression input.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onKey(k)}
      className={cn(
        "flex items-center justify-center rounded-xl font-medium select-none transition-[background-color,transform] outline-none active:scale-[0.96] focus-visible:ring-3 focus-visible:ring-ring/50",
        small ? "h-11 text-sm" : "h-14 text-xl sm:h-16",
        toneClass[k.tone ?? "digit"],
        k.span === 2 && "col-span-2"
      )}
    >
      {k.label}
    </button>
  )
}
