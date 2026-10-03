"use client"

import { addDays, addHours, format, parseISO, subDays } from "date-fns"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useState } from "react"
import Link from "next/link"
import { BellRing, Copy, Repeat, Trash2 } from "lucide-react"
import { Notice } from "@/components/common/notice"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useHydrated } from "@/hooks/use-store"
import { combineDateTime, toDateString } from "@/lib/dates"
import { notificationSupport } from "@/lib/reminders"
import type { CalendarEvent, EventColor, Recurrence } from "@/types"
import { ALERT_ITEMS, alertLabel, hasAlert, RECURRENCE_ITEMS } from "./calendar-utils"
import { EVENT_COLOR_KEYS, EVENT_COLORS } from "./event-colors"
import { FormField, SwatchPicker } from "./form-field"

const schema = z
  .object({
    title: z.string().trim().min(1, "Give your event a title").max(120, "Keep the title under 120 characters"),
    allDay: z.boolean(),
    startDate: z.string().min(1, "Pick a start date"),
    startTime: z.string(),
    endDate: z.string().min(1, "Pick an end date"),
    endTime: z.string(),
    color: z.enum(EVENT_COLOR_KEYS as [EventColor, ...EventColor[]]),
    location: z.string().max(200, "Keep the location under 200 characters"),
    notes: z.string().max(2000, "Notes are limited to 2000 characters"),
    recurrence: z.enum(["none", "daily", "weekly", "monthly", "yearly"]),
    recurrenceUntil: z.string(),
    alert: z.string().regex(/^(none|d{1,5})$/),
  })
  .superRefine((v, ctx) => {
    if (!v.allDay) {
      if (!v.startTime) ctx.addIssue({ code: "custom", path: ["startTime"], message: "Pick a start time" })
      if (!v.endTime) ctx.addIssue({ code: "custom", path: ["endTime"], message: "Pick an end time" })
    }
    if (v.startDate && v.endDate) {
      if (v.endDate < v.startDate) {
        ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date can't be before the start date" })
      } else if (!v.allDay && v.startTime && v.endTime && v.endDate === v.startDate && v.endTime < v.startTime) {
        ctx.addIssue({ code: "custom", path: ["endTime"], message: "End time must be after the start time" })
      }
    }
    if (v.recurrence !== "none" && v.recurrenceUntil && v.startDate && v.recurrenceUntil < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["recurrenceUntil"], message: "“Repeat until” must be on or after the start date" })
    }
  })

type FormValues = z.infer<typeof schema>
export type EventDraft = Omit<CalendarEvent, "id">

/** Prefill for a new event. */
export interface EventPrefill {
  start: Date
  end?: Date
  allDay?: boolean
}

interface EventFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event?: CalendarEvent
  prefill?: EventPrefill
  onSubmit: (draft: EventDraft) => void
  onDelete?: (event: CalendarEvent) => void
  /** Open a copy of `event` in the form. */
  onDuplicate?: (event: CalendarEvent) => void
  /** Prefill a new event with full details (duplicate, AI suggestion). Ignored when `event` is set. */
  initial?: EventDraft
  /** Sheet title override for new events. */
  heading?: string
  /** Changes force the form to reset (e.g. switching from edit to a copy). */
  formKey?: string
}

const FORM_ID = "event-form"

export function EventFormSheet(props: EventFormSheetProps) {
  const { open, onOpenChange, event, onDelete, onDuplicate, heading } = props
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={event ? "Edit event" : (heading ?? "New event")}
      footer={
        <div className="flex w-full items-center gap-2">
          {event && onDelete ? (
            <Button type="button" variant="destructive" size="lg" className="sm:h-10" onClick={() => onDelete(event)}>
              <Trash2 aria-hidden /> <span className="sr-only sm:not-sr-only">{event.recurrence !== "none" ? "Delete series" : "Delete"}</span>
            </Button>
          ) : null}
          {event && onDuplicate ? (
            <Button type="button" variant="outline" size="lg" className="sm:h-10" onClick={() => onDuplicate(event)} aria-label="Duplicate event">
              <Copy aria-hidden /> <span className="hidden sm:inline">Duplicate</span>
            </Button>
          ) : null}
          <div className="flex flex-1 justify-end gap-2">
            <Button type="button" variant="outline" size="lg" className="flex-1 sm:h-10 sm:flex-none" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" form={FORM_ID} size="lg" className="flex-1 sm:h-10 sm:flex-none">
              {event ? "Save" : "Create event"}
            </Button>
          </div>
        </div>
      }
    >
      <EventForm key={open ? (props.formKey ?? event?.id ?? `new-${props.prefill?.start.getTime() ?? ""}`) : "closed"} {...props} />
    </ResponsiveSheet>
  )
}

const alertValue = (m: number | null | undefined) => (hasAlert(m) ? String(Math.round(m)) : "none")

function initialValues(event?: CalendarEvent | EventDraft, prefill?: EventPrefill): FormValues {
  if (event) {
    const s = parseISO(event.start)
    let e = parseISO(event.end)
    if (event.allDay) {
      // Stored end is exclusive midnight; AI-created events may end at 23:59 the same day.
      if (e.getHours() === 0 && e.getMinutes() === 0) e = subDays(e, 1)
      if (e < s) e = s
    }
    return {
      title: event.title,
      allDay: event.allDay,
      startDate: toDateString(s),
      startTime: event.allDay ? "09:00" : format(s, "HH:mm"),
      endDate: toDateString(e),
      endTime: event.allDay ? "10:00" : format(e, "HH:mm"),
      color: event.color,
      location: event.location ?? "",
      notes: event.notes ?? "",
      recurrence: event.recurrence,
      recurrenceUntil: event.recurrenceUntil ?? "",
      alert: alertValue(event.alertMinutes),
    }
  }
  const s = prefill?.start ?? new Date()
  const e = prefill?.end ?? addHours(s, 1)
  return {
    title: "",
    allDay: prefill?.allDay ?? false,
    startDate: toDateString(s),
    startTime: format(s, "HH:mm"),
    endDate: toDateString(e),
    endTime: format(e, "HH:mm"),
    color: "indigo",
    location: "",
    notes: "",
    recurrence: "none",
    recurrenceUntil: "",
    alert: "none",
  }
}

function EventForm({ event, prefill, initial, onSubmit }: EventFormSheetProps) {
  const hydrated = useHydrated()
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: initialValues(event ?? initial, prefill) })

  const allDay = useWatch({ control, name: "allDay" })
  const recurrence = useWatch({ control, name: "recurrence" })
  const alert = useWatch({ control, name: "alert" })
  const permission = hydrated ? notificationSupport() : "granted"
  // Keep a non-standard lead time (e.g. from AI: "2 hours before") selectable.
  const [alertItems] = useState(() => {
    const v = getValues("alert")
    return ALERT_ITEMS.some((a) => a.value === v) ? ALERT_ITEMS : [...ALERT_ITEMS, { value: v, label: alertLabel(Number(v)) }]
  })

  const startDateField = register("startDate", {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value
      if (v && getValues("endDate") < v) setValue("endDate", v)
    },
  })
  const startTimeField = register("startTime", {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value
      const { startDate, endDate, endTime } = getValues()
      if (v && startDate === endDate && endTime <= v) {
        const end = addHours(combineDateTime(startDate, v), 1)
        setValue("endDate", toDateString(end))
        setValue("endTime", format(end, "HH:mm"))
      }
    },
  })

  const submit = (v: FormValues) => {
    const start = v.allDay ? combineDateTime(v.startDate) : combineDateTime(v.startDate, v.startTime)
    // All-day events store an exclusive end (midnight after the last day).
    const end = v.allDay ? addDays(combineDateTime(v.endDate), 1) : combineDateTime(v.endDate, v.endTime)
    onSubmit({
      title: v.title,
      allDay: v.allDay,
      start: start.toISOString(),
      end: end.toISOString(),
      color: v.color,
      location: v.location.trim() || undefined,
      notes: v.notes.trim() || undefined,
      recurrence: v.recurrence as Recurrence,
      recurrenceUntil: v.recurrence !== "none" && v.recurrenceUntil ? v.recurrenceUntil : undefined,
      alertMinutes: v.alert === "none" ? null : Number(v.alert),
    })
  }

  return (
    <form id={FORM_ID} noValidate className="space-y-4" onSubmit={handleSubmit(submit)}>
      {event && event.recurrence !== "none" ? (
        <Notice icon={Repeat} title="Recurring event">
          Changes apply to the whole series. Dates below are for the first occurrence.
        </Notice>
      ) : null}

      <FormField label="Title" error={errors.title?.message}>
        {(p) => <Input {...p} {...register("title")} placeholder="e.g. Lunch with Priya" autoComplete="off" className="h-11" />}
      </FormField>

      <Controller
        control={control}
        name="allDay"
        render={({ field }) => (
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border bg-surface px-3">
            <span className="text-sm font-medium">All day</span>
            <Switch checked={field.value} onCheckedChange={(c) => field.onChange(!!c)} />
          </label>
        )}
      />

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Starts" error={errors.startDate?.message}>
          {(p) => <Input {...p} type="date" {...startDateField} className="h-11" />}
        </FormField>
        {!allDay ? (
          <FormField label="Start time" error={errors.startTime?.message}>
            {(p) => <Input {...p} type="time" {...startTimeField} className="h-11" />}
          </FormField>
        ) : (
          <div />
        )}
        <FormField label="Ends" error={errors.endDate?.message}>
          {(p) => <Input {...p} type="date" {...register("endDate")} className="h-11" />}
        </FormField>
        {!allDay ? (
          <FormField label="End time" error={errors.endTime?.message}>
            {(p) => <Input {...p} type="time" {...register("endTime")} className="h-11" />}
          </FormField>
        ) : null}
      </div>

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

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Repeat">
          {(p) => (
            <Controller
              control={control}
              name="recurrence"
              render={({ field }) => (
                <Select items={RECURRENCE_ITEMS} value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                  <SelectTrigger id={p.id} className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_ITEMS.map((r) => (
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
        {recurrence !== "none" ? (
          <FormField label="Repeat until" error={errors.recurrenceUntil?.message} hint="Optional — leave empty to repeat forever">
            {(p) => <Input {...p} type="date" {...register("recurrenceUntil")} className="h-11" />}
          </FormField>
        ) : null}
      </div>

      <FormField label="Alert">
        {(p) => (
          <Controller
            control={control}
            name="alert"
            render={({ field }) => (
              <Select items={alertItems} value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                <SelectTrigger id={p.id} className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {alertItems.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </FormField>
      {alert !== "none" && permission !== "granted" ? (
        <p className="-mt-2 flex items-start gap-2 text-xs text-muted-foreground" role="status">
          <BellRing className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {permission === "unsupported" ? (
            <span>Alerts appear in LifeKit while it&apos;s open. This browser doesn&apos;t support system notifications.</span>
          ) : (
            <span>
              Alerts appear in LifeKit while it&apos;s open, and as notifications if you allow them.{" "}
              <Link href="/tools/reminders" className="font-medium text-primary underline-offset-2 hover:underline">
                {permission === "denied" ? "Notifications are blocked — see Reminders" : "Enable notifications in Reminders"}
              </Link>
            </span>
          )}
        </p>
      ) : null}

      <FormField label="Location" error={errors.location?.message}>
        {(p) => <Input {...p} {...register("location")} placeholder="Optional" autoComplete="off" className="h-11" />}
      </FormField>

      <FormField label="Notes" error={errors.notes?.message}>
        {(p) => <Textarea {...p} {...register("notes")} rows={3} placeholder="Optional" />}
      </FormField>
    </form>
  )
}
