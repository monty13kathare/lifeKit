"use client"

import { useState } from "react"
import { Pencil, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWellness } from "@/hooks/use-lifekit-data"
import { formatTime12 } from "@/lib/dates"
import { ACTIVITY_META, GOAL_META } from "@/lib/wellness/health"
import type { HealthProfile } from "@/types"
import { HealthNumbers } from "./health-numbers"
import { HealthProfileForm } from "./health-profile-form"
import { DIET_LABELS, fmtHeight, fmtWeight, WORK_LABELS, type HeightUnit, type WeightUnit } from "./health-utils"
import { WeeklyTrends } from "./weekly-trends"
import { WeightLog } from "./weight-log"

interface MyHealthProps {
  heightUnit: HeightUnit
  weightUnit: WeightUnit
  onHeightUnitChange: (u: HeightUnit) => void
  onWeightUnitChange: (u: WeightUnit) => void
}

/**
 * "Body" tab. New users see the profile form; once it's filled in, the form
 * folds into a one-line summary and their results lead. Fully offline.
 */
export function MyHealth({ heightUnit, weightUnit, onHeightUnitChange, onWeightUnitChange }: MyHealthProps) {
  const { profile, setProfile, goals, setGoals } = useWellness()
  const complete = !!profile.heightCm && !!profile.weightKg && !!profile.age
  const [editing, setEditing] = useState(!complete)

  if (editing || !complete) {
    return (
      <div className="space-y-3">
        <HealthProfileForm
          profile={profile}
          setProfile={setProfile}
          heightUnit={heightUnit}
          weightUnit={weightUnit}
          onHeightUnitChange={onHeightUnitChange}
          onWeightUnitChange={onWeightUnitChange}
          onSaved={() => {
            setEditing(false)
            window.scrollTo({ top: 0, behavior: "smooth" })
          }}
        />
        {complete && (
          <Button variant="ghost" className="w-full" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      <div className="lg:col-span-2">
        <ProfileSummary profile={profile} heightUnit={heightUnit} weightUnit={weightUnit} onEdit={() => setEditing(true)} />
      </div>
      <div className="lg:col-span-2">
        <HealthNumbers profile={profile} goals={goals} setGoals={setGoals} unit={weightUnit} />
      </div>
      <WeeklyTrends />
      <WeightLog profile={profile} setProfile={setProfile} unit={weightUnit} />
    </div>
  )
}

function ProfileSummary({ profile: p, heightUnit, weightUnit, onEdit }: { profile: HealthProfile; heightUnit: HeightUnit; weightUnit: WeightUnit; onEdit: () => void }) {
  const facts = [
    p.age ? `${p.age} yrs` : null,
    p.sex === "male" ? "Male" : p.sex === "female" ? "Female" : null,
    p.heightCm ? fmtHeight(p.heightCm, heightUnit) : null,
    p.weightKg ? fmtWeight(p.weightKg, weightUnit) : null,
    ACTIVITY_META[p.activity].label,
    GOAL_META[p.goal].label,
    p.diet ? DIET_LABELS[p.diet] : null,
    p.work ? WORK_LABELS[p.work] : null,
    p.wakeTime && p.bedTime ? `Sleep ${formatTime12(p.bedTime)}–${formatTime12(p.wakeTime)}` : null,
  ].filter(Boolean) as string[]

  return (
    <section className="flex items-start gap-3 rounded-2xl border bg-card p-4" aria-label="Your profile">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <UserRound className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Your profile</p>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {facts.map((f) => (
            <li key={f} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
              {f}
            </li>
          ))}
        </ul>
      </div>
      <Button variant="outline" size="icon" onClick={onEdit} aria-label="Edit profile">
        <Pencil aria-hidden />
      </Button>
    </section>
  )
}
