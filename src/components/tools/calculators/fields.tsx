"use client"

import { useId } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSettings } from "@/hooks/use-lifekit-data"
import { formatMoney, localeForCurrency, parseNumberInput } from "@/lib/math/format"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------ NumberField */

interface NumberFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  /** Shown inside the input on the left (e.g. "₹"). */
  prefix?: string
  /** Shown inside the input on the right (e.g. "%"). */
  suffix?: string
  error?: string | null
  hint?: string
  placeholder?: string
  className?: string
  id?: string
  autoFocus?: boolean
}

/** Labelled numeric input with inline validation message. */
export function NumberField({ label, value, onChange, prefix, suffix, error, hint, placeholder, className, id, autoFocus }: NumberFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const msgId = `${inputId}-msg`
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">{prefix}</span>
        ) : null}
        <Input
          id={inputId}
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          value={value}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? msgId : undefined}
          className={cn("h-11 text-base tabular-nums", prefix && "pl-8", suffix && "pr-12")}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{suffix}</span>
        ) : null}
      </div>
      {error ? (
        <p id={msgId} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------- Segmented */

interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: React.ReactNode }[]
  label: string
  className?: string
  size?: "sm" | "default"
}

/** Compact single-choice toggle (aria-pressed buttons). */
export function Segmented<T extends string>({ value, onChange, options, label, className, size = "default" }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex rounded-lg bg-muted p-[3px]", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-md px-3 text-sm font-medium whitespace-nowrap text-foreground/60 transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            size === "sm" ? "h-10 text-xs" : "h-10",
            value === o.value && "bg-background text-foreground shadow-sm dark:bg-input/40"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ Stat */

export function Stat({ label, value, emphasis, className, sub }: { label: string; value: React.ReactNode; emphasis?: boolean; className?: string; sub?: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border bg-surface p-3.5", emphasis && "border-primary/30 bg-primary/5", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-semibold tabular-nums break-words", emphasis ? "text-2xl text-primary sm:text-3xl" : "text-lg")}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  )
}

/** Explanation line ("Formula: …"). */
export function FormulaLine({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-surface-muted px-3 py-2 font-mono text-xs break-words text-muted-foreground sm:text-sm">{children}</p>
}

/* ---------------------------------------------------------------- Helpers */

/**
 * Validate a typed number. Returns `{ n, error }`; `n` is null when empty or invalid.
 */
export function readNumber(
  raw: string,
  opts: { min?: number; max?: number; positive?: boolean; integer?: boolean; required?: boolean; name?: string } = {}
): { n: number | null; error: string | null } {
  const parsed = parseNumberInput(raw)
  if (parsed === null) return { n: null, error: null }
  if (Number.isNaN(parsed)) return { n: null, error: "Enter a valid number" }
  if (opts.positive && parsed <= 0) return { n: null, error: "Must be greater than 0" }
  if (opts.min !== undefined && parsed < opts.min) return { n: null, error: `Must be at least ${opts.min}` }
  if (opts.max !== undefined && parsed > opts.max) return { n: null, error: `Must be at most ${opts.max.toLocaleString("en-US")}` }
  if (opts.integer && !Number.isInteger(parsed)) return { n: null, error: "Use a whole number" }
  return { n: parsed, error: null }
}

/** Currency symbol and money formatter from settings. */
export function useCurrency() {
  const { settings } = useSettings()
  const currency = settings.currency || "₹"
  return {
    currency,
    locale: localeForCurrency(currency),
    money: (n: number, decimals = 2) => formatMoney(n, currency, { decimals }),
  }
}
