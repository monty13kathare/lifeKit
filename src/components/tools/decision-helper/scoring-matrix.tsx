"use client"

import { useRef } from "react"
import { cn } from "@/lib/utils"
import type { Decision } from "@/types"
import { criterionLabel, getScore, optionLabel } from "./decision-utils"

const VALUES = [1, 2, 3, 4, 5]

/** Segmented 1–5 radio group. Clicking the selected value clears it. */
export function ScorePicker({
  value,
  onChange,
  label,
  compact,
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  label: string
  compact?: boolean
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const focusIndex = value ? value - 1 : 0

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    let next = i
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(4, i + 1)
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(0, i - 1)
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = 4
    else return
    e.preventDefault()
    onChange(next + 1)
    refs.current[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex gap-1 rounded-xl bg-surface-muted p-1", compact && "gap-0.5 rounded-lg p-0.5")}>
      {VALUES.map((v, i) => {
        const selected = value === v
        return (
          <button
            key={v}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${v} of 5`}
            tabIndex={i === focusIndex ? 0 : -1}
            onClick={() => onChange(selected ? undefined : v)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "flex items-center justify-center rounded-lg text-sm font-semibold tabular-nums outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
              compact ? "h-8 w-7 rounded-md text-xs" : "size-10",
              selected
                ? "bg-primary text-primary-foreground shadow-soft"
                : value !== undefined && v < value
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-card hover:text-foreground"
            )}
          >
            {v}
          </button>
        )
      })}
    </div>
  )
}

interface ScoringMatrixProps {
  decision: Decision
  onScore: (optionId: string, criterionId: string, value: number | undefined) => void
  leaderId?: string
}

export function ScoringMatrix({ decision, onScore, leaderId }: ScoringMatrixProps) {
  const { options, criteria } = decision
  if (!criteria.length) {
    return <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Add a criterion to start scoring.</p>
  }
  return (
    <>
      {/* Mobile / tablet: one card per option */}
      <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {options.map((o, oi) => {
          const name = optionLabel(o.name, oi)
          return (
            <section
              key={o.id}
              aria-label={`Scores for ${name}`}
              className={cn("rounded-xl border bg-card p-3 shadow-soft", leaderId === o.id && "border-primary/50")}
            >
              <h4 className="mb-2 truncate font-medium">{name}</h4>
              <ul className="space-y-2.5">
                {criteria.map((c, ci) => {
                  const cname = criterionLabel(c.name, ci)
                  return (
                    <li key={c.id} className="space-y-1">
                      <p className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">{cname}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">weight {c.weight}</span>
                      </p>
                      <ScorePicker
                        label={`Score for ${name} on ${cname}`}
                        value={getScore(decision, o.id, c.id)}
                        onChange={(v) => onScore(o.id, c.id, v)}
                      />
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>

      {/* Desktop: table, criteria as rows */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card shadow-soft lg:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Score each option from 1 (poor) to 5 (excellent) on each criterion</caption>
          <thead>
            <tr className="border-b bg-surface">
              <th scope="col" className="px-3 py-2.5 text-left font-medium">
                Criterion
              </th>
              {options.map((o, oi) => (
                <th
                  key={o.id}
                  scope="col"
                  className={cn("max-w-48 px-2 py-2.5 text-center font-medium", leaderId === o.id && "text-primary")}
                >
                  <span className="line-clamp-2 wrap-break-word">{optionLabel(o.name, oi)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {criteria.map((c, ci) => {
              const cname = criterionLabel(c.name, ci)
              return (
                <tr key={c.id} className="border-b last:border-b-0">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <span className="block max-w-48 truncate">{cname}</span>
                    <span className="text-xs text-muted-foreground">weight {c.weight}</span>
                  </th>
                  {options.map((o, oi) => (
                    <td key={o.id} className={cn("px-2 py-2 text-center", leaderId === o.id && "bg-primary/5")}>
                      <ScorePicker
                        compact
                        label={`Score for ${optionLabel(o.name, oi)} on ${cname}`}
                        value={getScore(decision, o.id, c.id)}
                        onChange={(v) => onScore(o.id, c.id, v)}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
