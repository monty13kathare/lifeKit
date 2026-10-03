"use client"

import { cn } from "@/lib/utils"

interface ChipGroupProps<T extends string> {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
}

/** Single-select chips (toggle buttons) with a visible group label. */
export function ChipGroup<T extends string>({ label, options, value, onChange, disabled, className }: ChipGroupProps<T>) {
  return (
    <fieldset className={cn("min-w-0 space-y-2", className)} disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "inline-flex h-10 items-center rounded-full border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "bg-card text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
