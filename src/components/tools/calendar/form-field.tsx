"use client"

import { useId } from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export interface FieldControlProps {
  id: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

interface FormFieldProps {
  label: string
  error?: string
  hint?: string
  className?: string
  /** Visually hide the label (still read by screen readers). */
  hideLabel?: boolean
  children: (props: FieldControlProps) => React.ReactNode
}

/** Label + control + hint/error, wiring `aria-invalid`/`aria-describedby` for the control. */
export function FormField({ label, error, hint, className, hideLabel, children }: FormFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className={cn(hideLabel && "sr-only")}>
        {label}
      </Label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Accessible colour swatch radio group for EventColor-like values. */
export function SwatchPicker<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; className: string }[]
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const selected = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={o.label}
              title={o.label}
              onClick={() => onChange(o.value)}
              className={cn(
                "flex size-10 items-center justify-center rounded-full border-2 transition-transform outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                selected ? "scale-105 border-foreground" : "border-transparent hover:scale-105"
              )}
            >
              <span className={cn("size-7 rounded-full", o.className)} />
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
