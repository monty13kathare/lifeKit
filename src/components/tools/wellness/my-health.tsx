"use client"

import { useWellness } from "@/hooks/use-lifekit-data"
import { HealthNumbers } from "./health-numbers"
import { HealthProfileForm } from "./health-profile-form"
import type { HeightUnit, WeightUnit } from "./health-utils"
import { WeightLog } from "./weight-log"

interface MyHealthProps {
  heightUnit: HeightUnit
  weightUnit: WeightUnit
  onHeightUnitChange: (u: HeightUnit) => void
  onWeightUnitChange: (u: WeightUnit) => void
}

/** "My health" tab: profile, weight log and formula-based numbers. Fully offline. */
export function MyHealth({ heightUnit, weightUnit, onHeightUnitChange, onWeightUnitChange }: MyHealthProps) {
  const { profile, setProfile, goals, setGoals } = useWellness()

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
      <HealthProfileForm
        profile={profile}
        setProfile={setProfile}
        heightUnit={heightUnit}
        weightUnit={weightUnit}
        onHeightUnitChange={onHeightUnitChange}
        onWeightUnitChange={onWeightUnitChange}
      />
      <div className="space-y-5">
        <WeightLog profile={profile} setProfile={setProfile} unit={weightUnit} />
      </div>
      <div className="lg:col-span-2">
        <HealthNumbers profile={profile} goals={goals} setGoals={setGoals} unit={weightUnit} />
      </div>
    </div>
  )
}
