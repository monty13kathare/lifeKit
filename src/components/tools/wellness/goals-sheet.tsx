"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createId } from "@/lib/storage/core"
import type { Habit, WellnessGoals } from "@/types"

const num = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max}`)

const goalsSchema = z.object({
  waterGlasses: num("Water goal", 1, 30).int("Use a whole number of glasses"),
  steps: num("Steps goal", 100, 100_000).int("Use a whole number"),
  exerciseMinutes: num("Exercise goal", 5, 600).int("Use whole minutes"),
  sleepHours: num("Sleep goal", 1, 14),
  habits: z
    .array(z.object({ id: z.string(), name: z.string().trim().min(1, "Habit names can't be empty").max(60, "Keep habit names under 60 characters") }))
    .max(20, "Up to 20 habits"),
})

type FieldErrors = Partial<Record<"waterGlasses" | "steps" | "exerciseMinutes" | "sleepHours" | "habits", string>>

interface GoalsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goals: WellnessGoals
  onSave: (goals: WellnessGoals) => void
}

export function GoalsSheet({ open, onOpenChange, goals, onSave }: GoalsSheetProps) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Daily goals & habits"
      description="Set targets that suit you. You can change them any time."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="wellness-goals-form">
            Save goals
          </Button>
        </>
      }
    >
      {/* Re-mount the form each time the sheet opens so it starts from saved goals. */}
      {open ? <GoalsForm goals={goals} onSave={(g) => { onSave(g); onOpenChange(false) }} /> : null}
    </ResponsiveSheet>
  )
}

function GoalsForm({ goals, onSave }: { goals: WellnessGoals; onSave: (g: WellnessGoals) => void }) {
  const [values, setValues] = useState({
    waterGlasses: String(goals.waterGlasses),
    steps: String(goals.steps),
    exerciseMinutes: String(goals.exerciseMinutes),
    sleepHours: String(goals.sleepHours),
  })
  const [habits, setHabits] = useState<Habit[]>(goals.habits)
  const [newHabit, setNewHabit] = useState("")
  const [errors, setErrors] = useState<FieldErrors>({})

  const addHabit = () => {
    const name = newHabit.trim()
    if (!name) return
    if (habits.some((h) => h.name.toLowerCase() === name.toLowerCase())) {
      toast.error("You already have that habit")
      return
    }
    setHabits((prev) => [...prev, { id: createId(), name }])
    setNewHabit("")
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = goalsSchema.safeParse({ ...values, habits })
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors
        if (!next[key]) next[key] = issue.message
      }
      setErrors(next)
      return
    }
    onSave(parsed.data)
    toast.success("Goals saved")
  }

  const field = (key: keyof typeof values, label: string, suffix: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`goal-${key}`}>{label}</Label>
      <div className="relative">
        <Input
          id={`goal-${key}`}
          inputMode="decimal"
          value={values[key]}
          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          aria-invalid={errors[key] ? true : undefined}
          aria-describedby={errors[key] ? `goal-${key}-err` : undefined}
          className="h-11 pr-16"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{suffix}</span>
      </div>
      {errors[key] ? (
        <p id={`goal-${key}-err`} className="text-xs text-destructive">
          {errors[key]}
        </p>
      ) : null}
    </div>
  )

  return (
    <form id="wellness-goals-form" onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid grid-cols-2 gap-4">
        {field("waterGlasses", "Water", "glasses")}
        {field("steps", "Steps", "steps")}
        {field("exerciseMinutes", "Exercise", "min")}
        {field("sleepHours", "Sleep", "hours")}
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Habits</legend>
        {habits.length ? (
          <ul className="space-y-2">
            {habits.map((h, i) => (
              <li key={h.id} className="flex items-center gap-2">
                <Input
                  aria-label={`Habit ${i + 1} name`}
                  value={h.name}
                  maxLength={60}
                  onChange={(e) => setHabits((prev) => prev.map((x) => (x.id === h.id ? { ...x, name: e.target.value } : x)))}
                  className="h-11"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${h.name || "habit"}`}
                  onClick={() => setHabits((prev) => prev.filter((x) => x.id !== h.id))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No habits yet. Add one below.</p>
        )}
        <div className="flex gap-2">
          <Input
            aria-label="New habit"
            placeholder="e.g. Stretch for 5 minutes"
            value={newHabit}
            maxLength={60}
            onChange={(e) => setNewHabit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addHabit()
              }
            }}
            className="h-11"
          />
          <Button type="button" variant="outline" className="h-11" onClick={addHabit} disabled={!newHabit.trim()}>
            <Plus aria-hidden /> Add
          </Button>
        </div>
        {errors.habits ? <p className="text-xs text-destructive">{errors.habits}</p> : null}
        <p className="text-xs text-muted-foreground">Removing a habit keeps past check-ins hidden rather than deleting your day logs.</p>
      </fieldset>
    </form>
  )
}
