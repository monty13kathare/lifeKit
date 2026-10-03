"use client"

import { Crown, Lightbulb, Scale } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Sensitivity, OptionResult } from "./decision-utils"

export function DecisionResults({ results, sensitivity, chosenId }: { results: OptionResult[]; sensitivity: Sensitivity | null; chosenId?: string }) {
  const anyScored = results.some((r) => r.scored > 0)
  if (!anyScored) {
    return <p className="text-sm text-muted-foreground">Score the options to see weighted results.</p>
  }
  const [first, second] = results
  const tooClose = second && second.scored > 0 && first.percent - second.percent < 5
  return (
    <div className="space-y-3">
      <ol className="space-y-2.5" aria-label="Weighted results, best first">
        {results.map((r) => {
          const leader = r.rank === 1 && r.scored > 0
          const pct = Math.round(r.percent)
          return (
            <li key={r.id}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className={cn("flex min-w-0 items-center gap-1.5", leader && "font-semibold")}>
                  {leader ? <Crown className="size-4 shrink-0 text-warning" aria-label="Leader" /> : <span className="w-4 shrink-0 text-center text-xs text-muted-foreground">{r.rank}</span>}
                  <span className="truncate">{r.name}</span>
                  {chosenId === r.id ? <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[0.7rem] font-medium text-success">Chosen</span> : null}
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className={cn("font-semibold", leader && "text-primary")}>{pct}%</span>
                  {r.scored < r.total ? <span className="ml-1 text-xs text-muted-foreground">({r.scored}/{r.total} scored)</span> : null}
                </span>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-surface-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label={`${r.name} weighted score`}
              >
                <div
                  className={cn("h-full rounded-full transition-[width] duration-500", leader ? "bg-primary" : "bg-muted-foreground/40")}
                  style={{ width: `${Math.max(2, r.percent)}%` }}
                />
              </div>
            </li>
          )
        })}
      </ol>

      {tooClose ? (
        <p className="flex gap-2 rounded-lg bg-warning/10 p-2.5 text-sm">
          <Scale className="mt-0.5 size-4 shrink-0 text-warning-foreground dark:text-warning" aria-hidden />
          <span>
            Too close to call — {first.name} and {second.name} are within 5 points. Revisit your weights or go with your gut.
          </span>
        </p>
      ) : null}
      {sensitivity ? (
        <p className="flex gap-2 rounded-lg bg-surface-muted p-2.5 text-sm text-muted-foreground">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>{sensitivity.message}</span>
        </p>
      ) : null}
    </div>
  )
}
