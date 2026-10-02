"use client"

import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Trash2 } from "lucide-react"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EVENT_COLOR_KEYS, EVENT_COLORS } from "@/components/tools/calendar/event-colors"
import { FormField, SwatchPicker } from "@/components/tools/calendar/form-field"
import { cn } from "@/lib/utils"
import type { EventColor, RoutineItem } from "@/types"
import { DAY_LETTERS, DAY_NAMES, DAY_PRESETS, formatDuration } from "./routine-utils"

const schema = z.object({
  title: z.string().trim().min(1, "Give this block a name").max(80, "Keep it under 80 characters"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a start time"),
  durationMinutes: z
    .number({ error: "Enter a duration in minutes" })
    .int("Use whole minutes")
    .min(5, "At least 5 minutes")
    .max(1440, "At most 24 hours (1440 minutes)"),
  repeatDays: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one day"),
  color: z.enum(EVENT_COLOR_KEYS as [EventColor, ...EventColor[]]),
})

type FormValues = z.infer<typeof schema>
export type RoutineDraft = FormValues

const DURATIONS = [15, 30, 45, 60, 90, 120]
const FORM_ID = "routine-form"

interface RoutineFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: RoutineItem
  defaults?: Partial<RoutineDraft>
  onSubmit: (draft: RoutineDraft) => void
  onDelete?: (item: RoutineItem) => void
}

export function RoutineFormSheet(props: RoutineFormSheetProps) {
  const { open, onOpenChange, item, onDelete } = props
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={item ? "Edit routine block" : "New routine block"}
      footer={
        <div className="flex w-full items-center gap-2">
          {item && onDelete ? (
            <Button type="button" variant="destructive" size="lg" className="sm:h-10" onClick={() => onDelete(item)}>
              <Trash2 aria-hidden /> <span className="sr-only sm:not-sr-only">Delete</span>
            </Button>
          ) : null}
          <div className="flex flex-1 justify-end gap-2">
            <Button type="button" variant="outline" size="lg" className="flex-1 sm:h-10 sm:flex-none" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" form={FORM_ID} size="lg" className="flex-1 sm:h-10 sm:flex-none">
              {item ? "Save" : "Add to routine"}
            </Button>
          </div>
        </div>
      }
    >
      <RoutineForm key={open ? (item?.id ?? "new") : "closed"} {...props} />
    </ResponsiveSheet>
  )
}

function RoutineForm({ item, defaults, onSubmit }: RoutineFormSheetProps) {
  const init = item ?? defaults
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: init?.title ?? "",
      time: init?.time ?? "08:00",
      durationMinutes: init?.durationMinutes ?? 30,
      repeatDays: init?.repeatDays ?? [0, 1, 2, 3, 4, 5, 6],
      color: init?.color ?? "indigo",
    },
  })
  const duration = useWatch({ control, name: "durationMinutes" })
  const repeatDays = useWatch({ control, name: "repeatDays" })

  return (
    <form id={FORM_ID} noValidate className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <FormField label="Title" error={errors.title?.message}>
        {(p) => <Input {...p} {...register("title")} placeholder="e.g. Morning walk" autoComplete="off" className="h-11" />}
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Start time" error={errors.time?.message}>
          {(p) => <Input {...p} type="time" {...register("time")} className="h-11" />}
        </FormField>
        <FormField
          label="Duration (min)"
          error={errors.durationMinutes?.message}
          hint={Number.isFinite(duration) && duration > 0 ? formatDuration(duration) : undefined}
        >
          {(p) => (
            <Input {...p} type="number" inputMode="numeric" min={5} max={1440} step={5} {...register("durationMinutes", { valueAsNumber: true })} className="h-11" />
          )}
        </FormField>
      </div>
      <div className="-mt-1 flex flex-wrap gap-1.5" aria-label="Quick durations">
        {DURATIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setValue("durationMinutes", d, { shouldValidate: true })}
            className={cn(
              "h-9 rounded-full border px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              duration === d ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
            )}
          >
            {formatDuration(d)}
          </button>
        ))}
      </div>

      <fieldset aria-describedby={errors.repeatDays ? "repeat-error" : undefined}>
        <legend className="mb-1.5 text-sm font-medium">Repeat on</legend>
        <div className="flex justify-between gap-1">
          {DAY_LETTERS.map((letter, d) => {
            const on = repeatDays.includes(d)
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={DAY_NAMES[d]}
                onClick={() =>
                  setValue("repeatDays", on ? repeatDays.filter((x) => x !== d) : [...repeatDays, d].sort((a, b) => a - b), {
                    shouldValidate: true,
                  })
                }
                className={cn(
                  "flex size-10 items-center justify-center rounded-full border text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:size-11",
                  on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                )}
              >
                {letter}
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DAY_PRESETS.map((p) => (
            <Button key={p.label} type="button" variant="outline" size="sm" onClick={() => setValue("repeatDays", p.days, { shouldValidate: true })}>
              {p.label}
            </Button>
          ))}
        </div>
        {errors.repeatDays ? (
          <p id="repeat-error" className="mt-1.5 text-xs font-medium text-destructive">
            {errors.repeatDays.message}
          </p>
        ) : null}
      </fieldset>

      <Controller
        control={control}
        name="color"
        render={({ field }) => (
          <SwatchPicker
            label="Colour"
            value={field.value}
            onChange={field.onChange}
            options={EVENT_COLOR_KEYS.map((k) => ({ value: k, label: EVENT_COLORS[k].label, className: EVENT_COLORS[k].swatch }))}
          />
        )}
      />
    </form>
  )
}
