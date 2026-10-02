"use client"

import { addHours, format, startOfHour } from "date-fns"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Trash2 } from "lucide-react"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/tools/calendar/form-field"
import { combineDateTime, toDateString } from "@/lib/dates"
import type { Reminder } from "@/types"

const schema = z.object({
  title: z.string().trim().min(1, "What should we remind you about?").max(120, "Keep it under 120 characters"),
  date: z.string().min(1, "Pick a date"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time"),
  repeat: z.enum(["none", "daily", "weekly", "monthly"]),
  notes: z.string().max(1000, "Notes are limited to 1000 characters"),
})

type FormValues = z.infer<typeof schema>
export type ReminderDraft = Pick<Reminder, "title" | "date" | "time" | "repeat" | "notes">

export const REPEAT_ITEMS: { value: Reminder["repeat"]; label: string }[] = [
  { value: "none", label: "Doesn't repeat" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
]

const FORM_ID = "reminder-form"

interface ReminderFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reminder?: Reminder
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

function ReminderForm({ reminder, onSubmit }: ReminderFormSheetProps) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: reminder
      ? { title: reminder.title, date: reminder.date, time: reminder.time, repeat: reminder.repeat, notes: reminder.notes ?? "" }
      : (() => {
          const next = addHours(startOfHour(new Date()), 1)
          return { title: "", date: toDateString(next), time: format(next, "HH:mm"), repeat: "none" as const, notes: "" }
        })(),
  })

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
      <FormField label="Notes" error={errors.notes?.message}>
        {(p) => <Textarea {...p} {...register("notes")} rows={3} placeholder="Optional — shown in the notification" />}
      </FormField>
    </form>
  )
}
