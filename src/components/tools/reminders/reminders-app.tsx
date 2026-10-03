"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { addHours, addMinutes, differenceInCalendarDays, format, formatDistanceStrict } from "date-fns"
import { AlarmClock, Bell, Check, Clock, MoreVertical, Pencil, Plus, Repeat, RotateCcw, Search, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/common/empty-state"
import { ToolPage } from "@/components/common/tool-page"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useNow } from "@/components/tools/calendar/use-now"
import { useReminders } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import type { AiReminder } from "@/lib/ai/assist-schemas"
import { aiReminderToReminder } from "@/lib/ai/convert"
import { combineDateTime, toDateString } from "@/lib/dates"
import { latestOccurrence, nextOccurrence, reminderState, type ReminderState } from "@/lib/reminders"
import { cn } from "@/lib/utils"
import type { Reminder } from "@/types"
import { NotificationCard } from "./notification-card"
import { ReminderFormSheet, type ReminderDraft } from "./reminder-form"
import { ReminderNlBar } from "./reminder-nl-bar"
import { describeRepeat } from "./reminder-utils"

type SheetState = { open: boolean; reminder?: Reminder; defaults?: ReminderDraft }

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
  const { reminders, add, update, remove, upsert, set } = useReminders()
  const now = useNow()
  const [sheet, setSheet] = useState<SheetState>({ open: false })
  const [query, setQuery] = useState("")
  const [confirmClear, setConfirmClear] = useState(false)

  const q = query.trim().toLowerCase()
  const visible = useMemo(
    () => (q ? reminders.filter((r) => r.title.toLowerCase().includes(q) || (r.notes ?? "").toLowerCase().includes(q)) : reminders),
    [reminders, q]
  )
  const doneCount = reminders.filter((r) => r.done).length

  const groups = useMemo(() => {
    const rows: Row[] = visible.map((r) => {
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
  }, [visible, now])

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
    const current = new Date()
    const at = minutes >= 60 ? addHours(current, minutes / 60) : addMinutes(current, minutes)
    if (r.repeat !== "none") {
      // Keep the series: add a one-off copy at the snoozed time and mark this occurrence handled.
      const occ = latestOccurrence(r, current)
      const next = nextOccurrence(r, current)
      const copy = add({
        title: `Snoozed: ${r.title}`.slice(0, 120),
        date: toDateString(at),
        time: format(at, "HH:mm"),
        repeat: "none",
        notes: r.notes,
        done: false,
        createdAt: current.toISOString(),
      })
      update(r.id, {
        ...(occ ? { lastFiredFor: occ.toISOString() } : {}),
        // Move the anchor to the next occurrence (same cadence) so this one no longer shows as due.
        ...(next ? { date: toDateString(next) } : {}),
      })
      toast(`Snoozed until ${format(at, "h:mm a")}`, {
        description: next ? `${r.title} · series continues ${formatWhen(next, current)}` : r.title,
        action: {
          label: "Undo",
          onClick: () => {
            remove(copy.id)
            upsert(r)
          },
        },
      })
      return
    }
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

  const clearDone = () => {
    const removed = reminders.filter((r) => r.done)
    if (!removed.length) return
    const ids = new Set(removed.map((r) => r.id))
    set((prev) => prev.filter((r) => !ids.has(r.id)))
    setConfirmClear(false)
    toast(`Cleared ${removed.length} done ${removed.length === 1 ? "reminder" : "reminders"}`, {
      action: { label: "Undo", onClick: () => set((prev) => [...prev.filter((r) => !ids.has(r.id)), ...removed]) },
    })
  }

  const saveParsed = (parsed: AiReminder) => {
    const r = aiReminderToReminder(parsed)
    add(r)
    toast.success("Reminder set", {
      description: `${r.title} · ${formatWhen(combineDateTime(r.date, r.time), new Date())}`,
      action: { label: "Undo", onClick: () => remove(r.id) },
    })
  }

  const editParsed = (parsed: AiReminder) => {
    const r = aiReminderToReminder(parsed)
    setSheet({ open: true, defaults: { title: r.title, date: r.date, time: r.time, repeat: r.repeat, notes: r.notes } })
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
          <ReminderNlBar onSave={saveParsed} onEdit={editParsed} />
          {hydrated && reminders.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1 basis-48">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  type="text"
                  inputMode="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape" && query) {
                      e.preventDefault()
                      setQuery("")
                    }
                  }}
                  placeholder="Search reminders"
                  aria-label="Search reminders"
                  className="h-10 pr-9 pl-9"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                ) : null}
              </div>
              {doneCount > 0 ? (
                <Button variant="outline" onClick={() => setConfirmClear(true)}>
                  <Trash2 aria-hidden /> Clear done ({doneCount})
                </Button>
              ) : null}
            </div>
          ) : null}
          {q ? (
            <p className="sr-only" role="status">
              {visible.length} {visible.length === 1 ? "reminder matches" : "reminders match"} “{query.trim()}”
            </p>
          ) : null}
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
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No reminders match your search."
              description={`Nothing found for “${query.trim()}”.`}
              action={
                <Button variant="outline" onClick={() => setQuery("")}>
                  Clear search
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
        defaults={sheet.defaults}
        onSubmit={submit}
        onDelete={deleteReminder}
      />

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear done reminders?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {doneCount} completed {doneCount === 1 ? "reminder" : "reminders"}. You can undo right after.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={clearDone}>
              Clear done
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const canSnooze = state === "due" || (r.repeat === "none" && state === "missed")
  const repeatText = describeRepeat(r)
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
        {repeatText ? (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Repeat className="size-3 shrink-0" aria-hidden /> {repeatText}
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
          {(r.repeat === "none" && state !== "done") || (r.repeat !== "none" && state === "due") ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>{r.repeat === "none" ? "Snooze from now" : "Snooze this time"}</DropdownMenuLabel>
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
