"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { addDays, format, startOfDay } from "date-fns"
import { motion } from "framer-motion"
import { CalendarDays, ListTodo, Sunrise } from "lucide-react"
import { CATEGORY_META, LIFE_CATEGORY_ORDER, toolsByCategory, type Tool } from "@/data/tools"
import { useAiStatus } from "@/hooks/use-ai-status"
import { useBookmarks, useCalendar, useNotes, useReminders, useWellness } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { expandEvents, greeting } from "@/lib/dates"
import { nextOccurrence } from "@/lib/reminders"
import { cn } from "@/lib/utils"
import { DayPlanner } from "./my-life/day-planner"
import { QuickCapture } from "./my-life/quick-capture"
import { UpNext } from "./my-life/up-next"
import { useToday } from "./my-life/use-today"

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`

/** Re-render every 30s so time-based views (Now, Up next) stay current. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}



export function MyLife() {
  const hydrated = useHydrated()
  const now = useNow()
  const ai = useAiStatus()
  const today = useToday(now)
  const { events } = useCalendar()
  const { reminders } = useReminders()
  const { notes } = useNotes()
  const { bookmarks } = useBookmarks()
  const { days, goals } = useWellness()

  const stats = useMemo<Record<string, string>>(() => {
    const weekEvents = expandEvents(events, now, addDays(startOfDay(now), 7))
    const nextReminder = reminders
      .filter((r) => !r.done)
      .map((r) => nextOccurrence(r, now))
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime())[0]
    const water = days.find((d) => d.id === today.today)?.waterGlasses ?? 0
    const pinned = notes.filter((n) => n.pinned).length
    return {
      todo: today.openTasks.length
        ? `${plural(today.openTasks.length, "open task")}${today.overdue.length ? ` · ${today.overdue.length} overdue` : ""}`
        : "All clear",
      "routine-planner": today.routineToday.length ? `${today.routineDone}/${today.routineToday.length} done today` : "No routine today",
      calendar: weekEvents.length ? `${plural(weekEvents.length, "event")} this week` : "Calendar is clear",
      reminders: nextReminder ? `Next: ${format(nextReminder, "EEE h:mm a")}` : "No upcoming reminders",
      notes: notes.length ? `${plural(notes.length, "note")}${pinned ? ` · ${pinned} pinned` : ""}` : "No notes yet",
      wellness: `${water}/${goals.waterGlasses} glasses of water today`,
      bookmarks: bookmarks.length ? plural(bookmarks.length, "saved link") : "No bookmarks yet",
    }
  }, [events, reminders, days, notes, bookmarks, goals, today, now])

  const strip = [
    {
      label: "Tasks today",
      value: today.dueToday.length ? `${today.tasksDone}/${today.dueToday.length}` : "—",
      pct: today.dueToday.length ? today.tasksDone / today.dueToday.length : 0,
      href: "/tools/todo",
      icon: ListTodo,
      hint: today.overdue.length ? `${today.overdue.length} overdue` : today.dueToday.length ? "due today" : "nothing due",
    },
    {
      label: "Routine",
      value: today.routineToday.length ? `${today.routineDone}/${today.routineToday.length}` : "—",
      pct: today.routineToday.length ? today.routineDone / today.routineToday.length : 0,
      href: "/tools/routine-planner",
      icon: Sunrise,
      hint: "completed",
    },

    {
      label: "Next event",
      value: today.nextEvent ? format(today.nextEvent.start, "h:mm a") : "—",
      pct: -1,
      href: "/tools/calendar",
      icon: CalendarDays,
      hint: today.nextEvent ? today.nextEvent.event.title : "none today",
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-sm text-muted-foreground" suppressHydrationWarning>
          {hydrated ? format(now, "EEEE, d MMMM") : " "}
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight sm:text-3xl" suppressHydrationWarning>
          {hydrated ? greeting(now) : "My Life"}
        </h1>
        <p className="mt-1 text-muted-foreground">Your plans, habits and personal info — stored only on this device.</p>
      </header>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Today at a glance">
        {strip.map(({ label, value, pct, href, icon: Icon, hint }) => (
          <li key={label}>
            <Link
              href={href}
              className="flex h-full flex-col gap-2 rounded-2xl border bg-card p-3.5 transition-colors hover:border-primary/30 sm:p-4"
            >
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Icon className="size-3.5" aria-hidden /> {label}
              </span>
              <span className={cn("text-xl font-semibold tabular-nums transition-opacity", !hydrated && "opacity-0")}>{value}</span>
              {pct >= 0 ? (
                <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className="block h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct * 100}%` }} />
                </span>
              ) : null}
              <span className={cn("truncate text-xs text-muted-foreground", !hydrated && "opacity-0")}>{hint}</span>
            </Link>
          </li>
        ))}
      </ul>

      <QuickCapture />

      <div className={cn("grid grid-cols-1 gap-4", ai?.configured && "lg:grid-cols-2")}>
        <UpNext hydrated={hydrated} now={now} items={today.items} untimedCount={today.untimedTasks.length} today={today.today} />
        {ai?.configured && hydrated && <DayPlanner today={today} />}
      </div>

      <div className="space-y-8 pt-2">
        {LIFE_CATEGORY_ORDER.map((category) => (
          <section key={category} id={category} aria-labelledby={`${category}-title`} className="scroll-mt-24">
            <h2 id={`${category}-title`} className="mb-3 text-lg font-semibold">
              {CATEGORY_META[category].label}
            </h2>
            <motion.ul
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
              className="grid grid-cols-2 gap-3 lg:grid-cols-3"
            >
              {toolsByCategory(category).map((tool) => (
                <motion.li key={tool.id} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                  <LifeTile tool={tool} stat={stats[tool.id]} hydrated={hydrated} />
                </motion.li>
              ))}
            </motion.ul>
          </section>
        ))}
      </div>
    </div>
  )
}

function LifeTile({ tool, stat, hydrated, live }: { tool: Tool; stat?: string; hydrated: boolean; live?: boolean }) {
  const Icon = tool.icon
  return (
    <Link
      href={tool.href}
      className="group flex h-full flex-col justify-between gap-6 rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("flex size-11 items-center justify-center rounded-xl", tool.accent)}>
          <Icon className="size-5" aria-hidden />
        </span>
        {live && (
          <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden /> Live
          </span>
        )}
      </div>
      <div>
        <p className="font-semibold">{tool.name}</p>
        <p className={cn("mt-0.5 text-sm text-muted-foreground transition-opacity", !hydrated && "opacity-0")}>{stat ?? tool.description}</p>
      </div>
    </Link>
  )
}
