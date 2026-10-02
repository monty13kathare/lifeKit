"use client"

import { useId } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { FORMAT_INFO, type ImageMime, type OutputChoice } from "@/lib/image/formats"
import { cn } from "@/lib/utils"

export interface Option<T extends string> {
  value: T
  label: string
}

/** Radio-based segmented control: native keyboard support, big touch targets. */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  columns,
  disabled,
  className,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: readonly Option<T>[]
  columns?: number
  disabled?: boolean
  className?: string
}) {
  const name = useId()
  return (
    <fieldset className={cn("min-w-0 space-y-2", className)} disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div
        className="grid gap-1 rounded-xl bg-surface-muted p-1"
        style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex min-h-10 cursor-pointer items-center justify-center rounded-lg px-1.5 text-center text-sm font-medium text-muted-foreground transition-colors select-none hover:text-foreground",
              "has-checked:bg-card has-checked:text-foreground has-checked:shadow-soft has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            <span className="truncate">{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
  className,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: readonly Option<T>[]
  disabled?: boolean
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <Label id={id}>{label}</Label>
      <Select
        items={options as Option<T>[]}
        value={value}
        onValueChange={(v) => {
          if (v) onChange(v as T)
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-full" aria-labelledby={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function QualityField({
  value,
  onChange,
  disabled,
  label = "Quality",
  hint,
}: {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  label?: string
  hint?: string
}) {
  const id = useId()
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label id={id}>{label}</Label>
        <span className="text-sm font-medium tabular-nums text-muted-foreground" aria-hidden>
          {value}%
        </span>
      </div>
      <Slider
        value={value}
        min={10}
        max={100}
        step={1}
        disabled={disabled}
        onValueChange={(v) => onChange(v as number)}
        aria-labelledby={id}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/** Output format picker limited to formats this browser can encode. */
export function formatOptions(encodable: readonly ImageMime[], includeKeep: boolean): Option<OutputChoice>[] {
  const opts: Option<OutputChoice>[] = includeKeep ? [{ value: "keep", label: "Keep" }] : []
  for (const m of encodable) opts.push({ value: m, label: FORMAT_INFO[m].label })
  return opts
}

/**
 * Two-column workspace on desktop (main left, controls right); stacked on
 * mobile with the action bar sticky above the bottom nav.
 */
export function Workspace({
  main,
  controls,
  actions,
}: {
  main: React.ReactNode
  controls?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6">
      <div className="min-w-0 space-y-5">{main}</div>
      <aside className="contents lg:sticky lg:top-6 lg:flex lg:flex-col lg:gap-4">
        {controls ? <div className="min-w-0 space-y-5 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">{controls}</div> : null}
        {actions ? <ActionBar>{actions}</ActionBar> : null}
      </aside>
    </div>
  )
}

export function ActionBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:-mx-6 sm:px-6",
        "lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none",
        className
      )}
    >
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}
