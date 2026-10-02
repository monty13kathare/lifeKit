"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { addHours, addMinutes, differenceInCalendarDays, format, formatDistanceStrict } from "date-fns"
import { AlarmClock, Bell, Check, Clock, MoreVertical, Pencil, Plus, Repeat, RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/common/empty-state"
import { ToolPage } from "@/components/common/tool-page"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useNow } from "@/components/tools/calendar/use-now"
import { useReminders } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { combineDateTime, toDateString } from "@/lib/dates"
import { latestOccurrence, nextOccurrence, reminderState, type ReminderState } from "@/lib/reminders"
import { cn } from "@/lib/utils"
import type { Reminder } from "@/types"
import { NotificationCard } from "./notification-card"
import { REPEAT_ITEMS, ReminderFormSheet, type ReminderDraft } from "./reminder-form"

type SheetState = { open: boolean; reminder?: Reminder }

interface Row {
  reminder: Reminder
  state: ReminderState
  /** The occurrence to show: latest for due/missed/done, next for upcoming. */
  when: Date
}

const GROUPS: { state: ReminderState; title: string }[] = [
  { state: "due", title: "Due now" },
  { state: "upcoming", title: "Upcoming" },
  { state: "missed", title: "Missed" },
  { state: "done", title: "Done" },
]

const REPEAT_LABEL = Object.fromEntries(REPEAT_ITEMS.map((r) => [r.value, r.label])) as Record<Reminder["repeat"], string>

/** "Today 9:00 AM", "Tomorrow 9:00 AM", "Monday 9:00 AM", "Oct 20, 9:00 AM". */
export function formatWhen(d: Date, now: Date): string {
  const days = differenceInCalendarDays(d, now)
  const time = format(d, "h:mm a")
  if (days === 0) return `Today ${time}`
  if (days === 1) return `Tomorrow ${time}`
  if (days === -1) return `Yesterday ${time}`
  if (days > 1 && days < 7) return `${format(d, "EEEE")} ${time}`
  return `${format(d, d.getFullYear() === now.getFullYear() ? "MMM d" : "MMM d, yyyy")}, ${time}`
}

export function relativeWhen(d: Date, now: Date): string {
  if (Math.abs(d.getTime() - now.getTime()) < 60_000) return "now"
  return formatDistanceStrict(d, now, { addSuffix: true })
}

export function RemindersApp() {
  const hydrated = useHydrated()
  const { reminders, add, update, remove, upsert } = useReminders()
  const now = useNow()
  const [sheet, setSheet] = useState<SheetState>({ open: false })

  const groups = useMemo(() => {
    const rows: Row[] = reminders.map((r) => {
      const state = reminderState(r, now)
      const when =
        state === "upcoming"
          ? (nextOccurrence(r, now) ?? combineDateTime(r.date, r.time))
          : (latestOccurrence(r, now) ?? combineDateTime(r.date, r.time))
      return { reminder: r, state, when }
    })
    return GROUPS.map((g) => {
      const list = rows.filter((r) => r.state === g.state)
      list.sort((a, b) =>
        g.state === "missed" || g.state === "done" ? b.when.getTime() - a.when.getTime() : a.when.getTime() - b.when.getTime()
      )
      return { ...g, rows: list }
    }).filter((g) => g.rows.length)
  }, [reminders, now])

  /* --------------------------------------------------------- actions */

  const markDone = (r: Reminder) => {
    if (r.repeat === "none") {
      update(r.id, { done: true })
      toast.success("Reminder done", { description: r.title, action: { label: "Undo", onClick: () => update(r.id, { done: false }) } })
      return
    }
    // Recurring: move the anchor to the next occurrence so this one is handled.
    const current = new Date()
    const next = nextOccurrence(r, current)
    if (!next) return
    update(r.id, { date: toDateString(next), lastFiredFor: undefined })
    toast.success(`Next reminder ${formatWhen(next, current)}`, {
      description: r.title,
      action: { label: "Undo", onClick: () => upsert(r) },
    })
  }

  const snooze = (r: Reminder, minutes: number) => {
    const at = minutes >= 60 ? addHours(new Date(), minutes / 60) : addMinutes(new Date(), minutes)
    update(r.id, { date: toDateString(at), time: format(at, "HH:mm"), done: false, lastFiredFor: undefined })
    toast(`Snoozed until ${format(at, "h:mm a")}`, { description: r.title, action: { label: "Undo", onClick: () => upsert(r) } })
  }

  const reopen = (r: Reminder) => {
    update(r.id, { done: false })
    toast("Reminder reopened", { description: r.title })
  }

  const deleteReminder = (r: Reminder) => {
    remove(r.id)
    setSheet({ open: false })
    toast("Reminder deleted", { description: r.title, action: { label: "Undo", onClick: () => upsert(r) } })
  }

  const submit = (draft: ReminderDraft) => {
    const r = sheet.reminder
    if (r) {
      const timeChanged = r.date !== draft.date || r.time !== draft.time || r.repeat !== draft.repeat
      update(r.id, { ...draft, ...(timeChanged ? { done: false, lastFiredFor: undefined } : {}) })
      toast.success("Reminder updated")
    } else {
      add({ ...draft, done: false, createdAt: new Date().toISOString() })
      const at = combineDateTime(draft.date, draft.time)
      toast.success("Reminder set", { description: `${draft.title} · ${formatWhen(at, new Date())}` })
    }
    setSheet({ open: false })
  }

  /* --------------------------------------------------------- render */

  return (
    <ToolPage
      toolId="reminders"
      actions={
        <Button className="hidden sm:inline-flex" onClick={() => setSheet({ open: true })}>
          <Plus aria-hidden /> New reminder
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {!hydrated ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading reminders">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-2xl" />
              ))}
            </div>
          ) : reminders.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No reminders yet."
              description="Set a one-off nudge or a repeating reminder — LifeKit alerts you while it's open."
              action={
                <Button size="lg" onClick={() => setSheet({ open: true })}>
                  <Plus aria-hidden /> Create Reminder
                </Button>
              }
            />
          ) : (
            groups.map((g) => (
              <section key={g.state} aria-labelledby={`group-${g.state}`}>
                <h2
                  id={`group-${g.state}`}
                  className={cn(
                    "mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase",
                    g.state === "due" ? "text-primary" : g.state === "missed" ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {g.title}
                  <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground">{g.rows.length}</span>
                </h2>
                <ul className="space-y-2.5">
                  <AnimatePresence initial={false}>
                    {g.rows.map((row) => (
                      <motion.li
                        key={row.reminder.id}
                        layout="position"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      >
                        <ReminderRow
                          row={row}
                          now={now}
                          onDone={markDone}
                          onSnooze={snooze}
                          onReopen={reopen}
                          onEdit={(r) => setSheet({ open: true, reminder: r })}
                          onDelete={deleteReminder}
                        />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            ))
          )}
        </div>

        <aside className="order-first lg:order-none">
          <div className="lg:sticky lg:top-6">
            <NotificationCard />
          </div>
        </aside>
      </div>

      <Button
        size="icon-lg"
        aria-label="New reminder"
        onClick={() => setSheet({ open: true })}
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 rounded-full shadow-lg sm:hidden lg:bottom-8"
      >
        <Plus className="size-6" aria-hidden />
      </Button>

      <ReminderFormSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        reminder={sheet.reminder}
        onSubmit={submit}
        onDelete={deleteReminder}
      />
    </ToolPage>
  )
}

function ReminderRow({
  row,
  now,
  onDone,
  onSnooze,
  onReopen,
  onEdit,
  onDelete,
}: {
  row: Row
  now: Date
  onDone: (r: Reminder) => void
  onSnooze: (r: Reminder, minutes: number) => void
  onReopen: (r: Reminder) => void
  onEdit: (r: Reminder) => void
  onDelete: (r: Reminder) => void
}) {
  const { reminder: r, state, when } = row
  const canSnooze = r.repeat === "none" && (state === "due" || state === "missed")
  const whenText =
    state === "upcoming"
      ? `${formatWhen(when, now)} · ${relativeWhen(when, now)}`
      : state === "due"
        ? `Due ${relativeWhen(when, now)} · ${format(when, "h:mm a")}`
        : state === "missed"
          ? `Missed · ${formatWhen(when, now)}`
          : `Done · was due ${formatWhen(when, now)}`

  return (
    <article
      className={cn(
        "flex items-start gap-3 rounded-2xl border bg-card p-3 shadow-soft sm:p-3.5",
        state === "due" && "border-primary/40 ring-1 ring-primary/30",
        state === "missed" && "border-destructive/30",
        state === "done" && "opacity-70"
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          state === "due"
            ? "bg-primary text-primary-foreground"
            : state === "missed"
              ? "bg-destructive/12 text-destructive"
              : state === "done"
                ? "bg-success/12 text-success"
                : "bg-surface-muted text-muted-foreground"
        )}
        aria-hidden
      >
        {state === "done" ? <Check className="size-5" /> : state === "due" ? <AlarmClock className="size-5 animate-pulse" /> : <Clock className="size-5" />}
      </div>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onEdit(r)}
          className="block w-full rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className={cn("block font-medium wrap-break-word", state === "done" && "line-through")}>{r.title}</span>
          <span
            className={cn(
              "mt-0.5 block text-sm",
              state === "due" ? "font-medium text-primary" : state === "missed" ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {whenText}
          </span>
          {r.notes ? <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{r.notes}</span> : null}
        </button>
        {r.repeat !== "none" ? (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Repeat className="size-3" aria-hidden /> {REPEAT_LABEL[r.repeat]}
          </span>
        ) : null}

        {state !== "done" && (state !== "upcoming" || r.repeat === "none") ? (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {state === "due" || state === "missed" || r.repeat === "none" ? (
              <Button size="sm" variant={state === "due" ? "default" : "outline"} onClick={() => onDone(r)}>
                <Check aria-hidden /> {r.repeat === "none" ? "Mark done" : "Done"}
              </Button>
            ) : null}
            {canSnooze ? (
              <>
                <Button size="sm" variant="outline" onClick={() => onSnooze(r, 10)}>
                  +10 min
                </Button>
                <Button size="sm" variant="outline" onClick={() => onSnooze(r, 60)}>
                  +1 hour
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="-mt-1 -mr-1.5 text-muted-foreground" aria-label={`Actions for "${r.title}"`} />}>
          <MoreVertical aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => onEdit(r)}>
            <Pencil aria-hidden /> Edit
          </DropdownMenuItem>
          {state === "done" ? (
            <DropdownMenuItem onClick={() => onReopen(r)}>
              <RotateCcw aria-hidden /> Mark not done
            </DropdownMenuItem>
          ) : null}
          {r.repeat === "none" && state !== "done" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Snooze from now</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onSnooze(r, 10)}>
                  <AlarmClock aria-hidden /> 10 minutes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSnooze(r, 60)}>
                  <AlarmClock aria-hidden /> 1 hour
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(r)}>
            <Trash2 aria-hidden /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </article>
  )
}
