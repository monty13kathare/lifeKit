"use client"

import { useEffect } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Save, UserRound } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/tools/calendar/form-field"
import { Segmented } from "@/components/tools/calculators/fields"
import { todayString } from "@/lib/dates"
import { ACTIVITY_META, GOAL_META, plannedSleepHours, profileCompleteness } from "@/lib/wellness/health"
import { cn } from "@/lib/utils"
import type { ActivityLevel, DietType, HealthGoal, HealthProfile, WorkType } from "@/types"
import {
  cmToFtIn,
  DIET_LABELS,
  ftInToCm,
  kgToLb,
  lbToKg,
  withWeightLogged,
  WORK_LABELS,
  type HeightUnit,
  type WeightUnit,
} from "./health-utils"

const NONE = "none"

const SEX_ITEMS = [
  { value: NONE, label: "Prefer not to say" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
]
const ACTIVITY_ITEMS = (Object.keys(ACTIVITY_META) as ActivityLevel[]).map((k) => ({ value: k, label: ACTIVITY_META[k].label }))
const GOAL_ITEMS = (Object.keys(GOAL_META) as HealthGoal[]).map((k) => ({ value: k, label: GOAL_META[k].label }))
const DIET_ITEMS = [{ value: NONE, label: "Not set" }, ...(Object.keys(DIET_LABELS) as DietType[]).map((k) => ({ value: k, label: DIET_LABELS[k] }))]
const WORK_ITEMS = [{ value: NONE, label: "Not set" }, ...(Object.keys(WORK_LABELS) as WorkType[]).map((k) => ({ value: k, label: WORK_LABELS[k] }))]

/* ---------------------------------------------------------------- Schema */

const num = (s: string) => (s.trim() === "" ? undefined : Number(s.trim().replace(",", ".")))
const isNum = (s: string) => s.trim() === "" || Number.isFinite(num(s))

const schema = z
  .object({
    age: z.string(),
    sex: z.string(),
    heightUnit: z.enum(["cm", "ft"]),
    heightCm: z.string(),
    heightFt: z.string(),
    heightIn: z.string(),
    weightUnit: z.enum(["kg", "lb"]),
    weight: z.string(),
    targetWeight: z.string(),
    activity: z.enum(Object.keys(ACTIVITY_META) as [ActivityLevel, ...ActivityLevel[]]),
    goal: z.enum(Object.keys(GOAL_META) as [HealthGoal, ...HealthGoal[]]),
    diet: z.string(),
    work: z.string(),
    wakeTime: z.string(),
    bedTime: z.string(),
    notes: z.string().max(500, "Keep notes under 500 characters"),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message })
    const range = (path: keyof typeof v, label: string, min: number, max: number, int = false) => {
      const raw = v[path] as string
      if (!isNum(raw)) return issue(path, `${label} must be a number`)
      const n = num(raw)
      if (n === undefined) return
      if (int && !Number.isInteger(n)) return issue(path, `Use a whole number for ${label.toLowerCase()}`)
      if (n < min || n > max) issue(path, `${label} should be between ${min} and ${max}`)
    }
    range("age", "Age", 10, 100, true)
    if (v.heightUnit === "cm") range("heightCm", "Height", 90, 250)
    else {
      range("heightFt", "Feet", 3, 8, true)
      range("heightIn", "Inches", 0, 11.9)
      if (v.heightFt.trim() === "" && v.heightIn.trim() !== "") issue("heightFt", "Add feet too")
    }
    const [wMin, wMax] = v.weightUnit === "kg" ? [25, 300] : [55, 660]
    range("weight", "Weight", wMin, wMax)
    if (v.goal === "lose-weight" || v.goal === "gain-weight") range("targetWeight", "Target weight", wMin, wMax)
    const t = /^\d{2}:\d{2}$/
    if (v.wakeTime && !t.test(v.wakeTime)) issue("wakeTime", "Pick a time")
    if (v.bedTime && !t.test(v.bedTime)) issue("bedTime", "Pick a time")
  })

type FormInput = z.infer<typeof schema>

function toPatch(v: FormInput): Partial<HealthProfile> {
  const heightCm =
    v.heightUnit === "cm"
      ? num(v.heightCm)
      : v.heightFt.trim()
        ? ftInToCm(num(v.heightFt) ?? 0, num(v.heightIn) ?? 0)
        : undefined
  const toKg = (s: string) => {
    const n = num(s)
    return n === undefined ? undefined : v.weightUnit === "lb" ? lbToKg(n) : Math.round(n * 10) / 10
  }
  const weighsGoal = v.goal === "lose-weight" || v.goal === "gain-weight"
  return {
    age: num(v.age),
    sex: v.sex === NONE ? undefined : (v.sex as HealthProfile["sex"]),
    heightCm: heightCm === undefined ? undefined : Math.round(heightCm * 10) / 10,
    weightKg: toKg(v.weight),
    targetWeightKg: weighsGoal ? toKg(v.targetWeight) : undefined,
    activity: v.activity,
    goal: v.goal,
    diet: v.diet === NONE ? undefined : (v.diet as DietType),
    work: v.work === NONE ? undefined : (v.work as WorkType),
    wakeTime: v.wakeTime || undefined,
    bedTime: v.bedTime || undefined,
    notes: v.notes.trim() || undefined,
  }
}

const weightStr = (kg: number | undefined, unit: WeightUnit) => (kg === undefined ? "" : String(unit === "lb" ? kgToLb(kg) : kg))

function toForm(p: HealthProfile, heightUnit: HeightUnit, weightUnit: WeightUnit): FormInput {
  const ftIn = p.heightCm ? cmToFtIn(p.heightCm) : null
  return {
    age: p.age ? String(p.age) : "",
    sex: p.sex ?? NONE,
    heightUnit,
    heightCm: p.heightCm ? String(p.heightCm) : "",
    heightFt: ftIn ? String(ftIn.ft) : "",
    heightIn: ftIn ? String(ftIn.inches) : "",
    weightUnit,
    weight: weightStr(p.weightKg, weightUnit),
    targetWeight: weightStr(p.targetWeightKg, weightUnit),
    activity: p.activity,
    goal: p.goal,
    diet: p.diet ?? NONE,
    work: p.work ?? NONE,
    wakeTime: p.wakeTime ?? "",
    bedTime: p.bedTime ?? "",
    notes: p.notes ?? "",
  }
}

/* ------------------------------------------------------------------ Form */

interface HealthProfileFormProps {
  profile: HealthProfile
  setProfile: (patch: Partial<HealthProfile>) => void
  heightUnit: HeightUnit
  weightUnit: WeightUnit
  onHeightUnitChange: (u: HeightUnit) => void
  onWeightUnitChange: (u: WeightUnit) => void
}

export function HealthProfileForm({ profile, setProfile, heightUnit, weightUnit, onHeightUnitChange, onWeightUnitChange }: HealthProfileFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    reset,
    resetField,
    formState: { errors, isDirty },
  } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: toForm(profile, heightUnit, weightUnit),
    mode: "onTouched",
  })

  // Weight logged from the quick input → refresh the weight field (other unsaved edits are kept).
  useEffect(() => {
    resetField("weight", { defaultValue: weightStr(profile.weightKg, getValues("weightUnit")) })
  }, [profile.weightKg, resetField, getValues])

  const goal = useWatch({ control, name: "goal" })
  const wakeTime = useWatch({ control, name: "wakeTime" })
  const bedTime = useWatch({ control, name: "bedTime" })
  const activity = useWatch({ control, name: "activity" })
  const hUnit = useWatch({ control, name: "heightUnit" })
  const wUnit = useWatch({ control, name: "weightUnit" })
  const planned = plannedSleepHours(bedTime || undefined, wakeTime || undefined)
  const showTarget = goal === "lose-weight" || goal === "gain-weight"
  const completeness = profileCompleteness(profile)

  const switchHeight = (u: HeightUnit) => {
    if (u === hUnit) return
    const v = getValues()
    if (u === "ft") {
      const cm = num(v.heightCm)
      if (cm && Number.isFinite(cm)) {
        const { ft, inches } = cmToFtIn(cm)
        setValue("heightFt", String(ft))
        setValue("heightIn", String(inches))
      }
    } else {
      const ft = num(v.heightFt)
      if (ft !== undefined && Number.isFinite(ft)) setValue("heightCm", String(Math.round(ftInToCm(ft, num(v.heightIn) ?? 0))))
    }
    setValue("heightUnit", u, { shouldDirty: false })
    onHeightUnitChange(u)
  }

  const switchWeight = (u: WeightUnit) => {
    if (u === wUnit) return
    const convert = (s: string) => {
      const n = num(s)
      if (n === undefined || !Number.isFinite(n)) return s
      return String(u === "lb" ? kgToLb(n) : lbToKg(n))
    }
    const v = getValues()
    setValue("weight", convert(v.weight))
    setValue("targetWeight", convert(v.targetWeight))
    setValue("weightUnit", u, { shouldDirty: false })
    onWeightUnitChange(u)
  }

  const onSubmit = (values: FormInput) => {
    const patch = toPatch(values)
    if (patch.weightKg !== undefined) patch.weightLog = withWeightLogged(profile.weightLog, patch.weightKg, todayString())
    setProfile(patch)
    reset(values)
    toast.success("Health profile saved", { description: "Your numbers below have been updated." })
  }

  const selectField = (
    name: "sex" | "activity" | "goal" | "diet" | "work",
    label: string,
    items: { value: string; label: string }[],
    opts?: { hint?: string; describe?: (v: string) => string | undefined }
  ) => (
    <FormField label={label} hint={opts?.hint} error={errors[name]?.message}>
      {(p) => (
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <Select items={items} value={field.value} onValueChange={(v) => v && field.onChange(v)}>
              <SelectTrigger id={p.id} aria-describedby={p["aria-describedby"]} onBlur={field.onBlur} className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((it) => (
                  <SelectItem key={it.value} value={it.value}>
                    <span className="flex flex-col">
                      <span>{it.label}</span>
                      {opts?.describe?.(it.value) ? <span className="text-xs text-muted-foreground">{opts.describe(it.value)}</span> : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      )}
    </FormField>
  )

  return (
    <section aria-labelledby="profile-heading" className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="profile-heading" className="flex items-center gap-2 text-sm font-semibold">
            <UserRound className="size-4 text-muted-foreground" aria-hidden /> Health profile
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Saved only in this browser. Everything is optional.</p>
        </div>
        <Completeness done={completeness.done} total={completeness.total} missing={completeness.missing} />
      </div>

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Age" error={errors.age?.message}>
            {(p) => <Input {...p} inputMode="numeric" placeholder="e.g. 32" autoComplete="off" {...register("age")} className="h-11" />}
          </FormField>
          {selectField("sex", "Sex", SEX_ITEMS, { hint: "Used for calorie estimates" })}
        </div>

        {/* Height */}
        <fieldset className="space-y-1.5">
          <legend className="sr-only">Height</legend>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium" aria-hidden>Height</span>
            <Segmented
              label="Height unit"
              value={hUnit}
              onChange={switchHeight}
              options={[
                { value: "cm", label: "cm" },
                { value: "ft", label: "ft + in" },
              ]}
            />
          </div>
          {hUnit === "cm" ? (
            <FormField label="Height in centimetres" hideLabel error={errors.heightCm?.message}>
              {(p) => <UnitInput {...p} unit="cm" placeholder="e.g. 165" {...register("heightCm")} />}
            </FormField>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Feet" hideLabel error={errors.heightFt?.message}>
                {(p) => <UnitInput {...p} unit="ft" placeholder="5" {...register("heightFt")} />}
              </FormField>
              <FormField label="Inches" hideLabel error={errors.heightIn?.message}>
                {(p) => <UnitInput {...p} unit="in" placeholder="6" {...register("heightIn")} />}
              </FormField>
            </div>
          )}
        </fieldset>

        {/* Weight */}
        <fieldset className="space-y-1.5">
          <legend className="sr-only">Weight</legend>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium" aria-hidden>Weight</span>
            <Segmented
              label="Weight unit"
              value={wUnit}
              onChange={switchWeight}
              options={[
                { value: "kg", label: "kg" },
                { value: "lb", label: "lb" },
              ]}
            />
          </div>
          <FormField label={`Weight in ${wUnit === "kg" ? "kilograms" : "pounds"}`} hideLabel hint="Saving a new weight also adds it to your weight log." error={errors.weight?.message}>
            {(p) => <UnitInput {...p} unit={wUnit} placeholder={wUnit === "kg" ? "e.g. 62.5" : "e.g. 138"} {...register("weight")} />}
          </FormField>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          {selectField("activity", "Activity level", ACTIVITY_ITEMS, {
            hint: ACTIVITY_META[activity]?.description,
            describe: (v) => ACTIVITY_META[v as ActivityLevel]?.description,
          })}
          {selectField("goal", "Main goal", GOAL_ITEMS)}
        </div>

        {showTarget ? (
          <FormField label={`Target weight (${wUnit})`} hint="Optional — a gentle milestone, not a must." error={errors.targetWeight?.message}>
            {(p) => <UnitInput {...p} unit={wUnit} placeholder="Optional" {...register("targetWeight")} />}
          </FormField>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {selectField("diet", "Diet", DIET_ITEMS)}
          {selectField("work", "Work / daily routine", WORK_ITEMS)}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Usual wake time" error={errors.wakeTime?.message}>
            {(p) => <Input {...p} type="time" {...register("wakeTime")} className="h-11" />}
          </FormField>
          <FormField label="Usual bed time" error={errors.bedTime?.message}>
            {(p) => <Input {...p} type="time" {...register("bedTime")} className="h-11" />}
          </FormField>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground" aria-live="polite">
          {planned !== null ? `That's about ${planned} hours of planned sleep.` : "Add both times to see your planned sleep."}
        </p>

        <FormField label="Notes for the coach" hint="Anything you'd like the coach to consider — e.g. desk job, mild back pain. Optional." error={errors.notes?.message}>
          {(p) => <Textarea {...p} rows={3} maxLength={500} {...register("notes")} />}
        </FormField>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
          <p className={cn("text-center text-xs sm:text-right", isDirty ? "text-warning-foreground dark:text-warning" : "text-muted-foreground")} aria-live="polite">
            {isDirty ? "You have unsaved changes" : profile.updatedAt ? "All changes saved" : "Not saved yet"}
          </p>
          <Button type="submit" size="lg" className="sm:h-10">
            <Save aria-hidden /> Save profile
          </Button>
        </div>
      </form>
    </section>
  )
}

function UnitInput({ unit, className, ...props }: React.ComponentProps<typeof Input> & { unit: string }) {
  return (
    <div className="relative">
      <Input inputMode="decimal" autoComplete="off" className={cn("h-11 pr-12", className)} {...props} />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{unit}</span>
    </div>
  )
}

function Completeness({ done, total, missing }: { done: number; total: number; missing: string[] }) {
  const pct = Math.round((done / total) * 100)
  return (
    <div className="w-full min-[420px]:w-48">
      <div className="flex items-baseline justify-between text-xs">
        <span id="completeness-label" className="font-medium">
          Profile {pct}% complete
        </span>
        <span className="text-muted-foreground tabular-nums">
          {done}/{total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-labelledby="completeness-label"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className={cn("h-full rounded-full transition-all", done === total ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>
      {missing.length ? <p className="mt-1 text-xs text-muted-foreground">Missing: {missing.join(", ")}</p> : null}
    </div>
  )
}
