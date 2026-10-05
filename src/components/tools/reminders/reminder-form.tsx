"use client"

import { addHours, format, startOfHour } from "date-fns"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Repeat, Trash2, Zap } from "lucide-react"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/tools/calendar/form-field"
import { combineDateTime, toDateString } from "@/lib/dates"
import type { Reminder } from "@/types"
import { describeRepeat, TIME_PRESETS } from "./reminder-utils"

const schema = z.object({
  title: z.string().trim().min(1, "What should we remind you about?").max(120, "Keep it under 120 characters"),
  date: z.string().min(1, "Pick a date"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time"),
  repeat: z.enum(["none", "minutely", "15_min", "30_min", "hourly", "90_min", "daily", "weekly", "monthly"]),
  notes: z.string().max(1000, "Notes are limited to 1000 characters"),
})

type FormValues = z.infer<typeof schema>
export type ReminderDraft = Pick<Reminder, "title" | "date" | "time" | "repeat" | "notes">

export const REPEAT_ITEMS: { value: Reminder["repeat"]; label: string }[] = [
  { value: "none", label: "Doesn't repeat" },
  { value: "minutely", label: "Every minute" },
  { value: "15_min", label: "Every 15 min" },
  { value: "30_min", label: "Every 30 min" },
  { value: "hourly", label: "Every hour" },
  { value: "90_min", label: "Every 1.5 hours" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
]

const FORM_ID = "reminder-form"

interface ReminderFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reminder?: Reminder
  /** Prefill for a new reminder (e.g. from the natural-language bar). */
  defaults?: ReminderDraft
  onSubmit: (draft: ReminderDraft) => void
  onDelete?: (r: Reminder) => void
}

export function ReminderFormSheet(props: ReminderFormSheetProps) {
  const { open, onOpenChange, reminder, onDelete } = props
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={reminder ? "Edit reminder" : "New reminder"}
      footer={
        <div className="flex w-full items-center gap-2">
          {reminder && onDelete ? (
            <Button type="button" variant="destructive" size="lg" className="sm:h-10" onClick={() => onDelete(reminder)}>
              <Trash2 aria-hidden /> <span className="sr-only sm:not-sr-only">Delete</span>
            </Button>
          ) : null}
          <div className="flex flex-1 justify-end gap-2">
            <Button type="button" variant="outline" size="lg" className="flex-1 sm:h-10 sm:flex-none" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" form={FORM_ID} size="lg" className="flex-1 sm:h-10 sm:flex-none">
              {reminder ? "Save" : "Create reminder"}
            </Button>
          </div>
        </div>
      }
    >
      <ReminderForm key={open ? (reminder?.id ?? "new") : "closed"} {...props} />
    </ResponsiveSheet>
  )
}

function ReminderForm({ reminder, defaults, onSubmit }: ReminderFormSheetProps) {
  const init = reminder ?? defaults
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: init
      ? { title: init.title, date: init.date, time: init.time, repeat: init.repeat, notes: init.notes ?? "" }
      : (() => {
          const next = addHours(startOfHour(new Date()), 1)
          return { title: "", date: toDateString(next), time: format(next, "HH:mm"), repeat: "none" as const, notes: "" }
        })(),
  })

  const [watchDate, watchTime, watchRepeat] = useWatch({ control, name: ["date", "time", "repeat"] })
  const repeatText =
    watchDate && /^\d{2}:\d{2}$/.test(watchTime) ? describeRepeat({ date: watchDate, time: watchTime, repeat: watchRepeat }) : null

  const applyPreset = (compute: (now: Date) => Date) => {
    const d = compute(new Date())
    setValue("date", toDateString(d), { shouldDirty: true })
    setValue("time", format(d, "HH:mm"), { shouldDirty: true })
    clearErrors(["date", "time"])
  }

  return (
    <form
      id={FORM_ID}
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit((v) => {
        const timeChanged = !reminder || reminder.date !== v.date || reminder.time !== v.time || reminder.repeat !== v.repeat
        if (timeChanged && v.repeat === "none" && combineDateTime(v.date, v.time) <= new Date()) {
          setError("time", { message: "This time has already passed — pick a future time or make it repeat" })
          return
        }
        onSubmit({ title: v.title, date: v.date, time: v.time, repeat: v.repeat, notes: v.notes.trim() || undefined })
      })}
    >
      <FormField label="Remind me to" error={errors.title?.message}>
        {(p) => <Input {...p} {...register("title")} placeholder="e.g. Take vitamins" autoComplete="off" className="h-11" />}
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Date" error={errors.date?.message}>
          {(p) => <Input {...p} type="date" {...register("date")} className="h-11" />}
        </FormField>
        <FormField label="Time" error={errors.time?.message}>
          {(p) => <Input {...p} type="time" {...register("time")} className="h-11" />}
        </FormField>
      </div>
      <div className="-mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Quick times">
        {TIME_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyPreset(p.compute)}
            className="inline-flex h-9 items-center gap-1 rounded-full border bg-card px-3 text-xs font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Zap className="size-3 text-primary" aria-hidden /> {p.label}
          </button>
        ))}
      </div>
      <FormField label="Repeat" hint="Repeating reminders start from the date above.">
        {(p) => (
          <Controller
            control={control}
            name="repeat"
            render={({ field }) => (
              <Select items={REPEAT_ITEMS} value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                <SelectTrigger id={p.id} aria-describedby={p["aria-describedby"]} className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPEAT_ITEMS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </FormField>
      {repeatText ? (
        <p className="-mt-2 flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          <Repeat className="size-3.5" aria-hidden /> {repeatText}
        </p>
      ) : null}
      <FormField label="Notes" error={errors.notes?.message}>
        {(p) => <Textarea {...p} {...register("notes")} rows={3} placeholder="Optional — shown in the notification" />}
      </FormField>
    </form>
  )
}
