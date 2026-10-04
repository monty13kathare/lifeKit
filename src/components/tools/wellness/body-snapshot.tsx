"use client"

import { ArrowRight, Target, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { bmi, bmiCategory, BMI_META, GOAL_META, macros, weeksToTarget } from "@/lib/wellness/health"
import { cn } from "@/lib/utils"
import type { HealthProfile } from "@/types"
import { fmtWeight, sortedLog, type WeightUnit } from "./health-utils"

const TONE = {
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning-foreground dark:text-warning",
  danger: "bg-destructive/12 text-destructive",
} as const

/** Compact "where you are → where you're going" card shown above the tabs. */
export function BodySnapshot({ profile: p, unit, onEditProfile }: { profile: HealthProfile; unit: WeightUnit; onEditProfile: () => void }) {
  const b = bmi(p.heightCm, p.weightKg)
  const adult = !p.age || p.age >= 18
  const cat = b !== null && adult ? bmiCategory(b) : null
  const m = macros(p)
  const eta = weeksToTarget(p)

  if (!p.heightCm || !p.weightKg) {
    return (
      <section className="flex items-center gap-3 rounded-2xl border bg-linear-to-br from-primary/10 to-card p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <UserRound className="size-5.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Set up your body profile</p>
          <p className="text-sm text-muted-foreground">Height, weight and goal — takes a minute and unlocks your numbers and AI plan.</p>
        </div>
        <Button onClick={onEditProfile} aria-label="Set up profile">
          <ArrowRight aria-hidden />
        </Button>
      </section>
    )
  }

  // Progress from the first logged weight toward the target.
  const first = sortedLog(p.weightLog)[0]?.kg ?? p.weightKg
  const total = p.targetWeightKg !== undefined ? Math.abs(p.targetWeightKg - first) : 0
  const covered = p.targetWeightKg !== undefined ? Math.abs(first - p.weightKg) : 0
  const towardTarget = p.targetWeightKg !== undefined && Math.abs(p.targetWeightKg - p.weightKg) <= Math.abs(p.targetWeightKg - first)
  const pct = total > 0 && towardTarget ? Math.min(100, Math.round((covered / total) * 100)) : 0

  return (
    <section className="rounded-2xl border bg-linear-to-br from-primary/10 via-card to-card p-4" aria-label="Body snapshot">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Target className="size-3.5" aria-hidden /> {GOAL_META[p.goal].label}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {fmtWeight(p.weightKg, unit)}
            {eta && p.targetWeightKg !== undefined && (
              <span className="text-base font-normal text-muted-foreground"> → {fmtWeight(p.targetWeightKg, unit)}</span>
            )}
          </p>
        </div>
        {b !== null && (
          <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums", cat ? TONE[BMI_META[cat].tone] : "bg-muted")}>
            BMI {b}
            {cat ? ` · ${BMI_META[cat].label.replace(" range", "")}` : ""}
          </span>
        )}
      </div>

      {eta && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Progress to target weight" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {Math.abs(eta.deltaKg) > 0 ? `${fmtWeight(Math.abs(eta.deltaKg), unit)} to go` : "Target reached"} · about {eta.weeks} weeks at a safe {fmtWeight(eta.kgPerWeek, unit)}/week
          </p>
        </div>
      )}

      {m && (
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <Macro label="kcal/day" value={m.kcal.toLocaleString("en-US")} />
          <Macro label="Protein" value={`${m.protein}g`} />
          <Macro label="Carbs" value={`${m.carbs}g`} />
          <Macro label="Fat" value={`${m.fat}g`} />
        </div>
      )}
      {!m && <p className="mt-3 text-xs text-muted-foreground">Add your age in Body to see daily calories and macros.</p>}
    </section>
  )
}

function Macro({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card/80 px-1 py-2">
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      <p className="text-[0.7rem] text-muted-foreground">{label}</p>
    </div>
  )
}
