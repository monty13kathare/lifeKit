"use client"

import Link from "next/link"
import { useMemo } from "react"
import { addDays, format, startOfDay } from "date-fns"
import { motion } from "framer-motion"
import { CATEGORY_META, LIFE_CATEGORY_ORDER, toolsByCategory, type Tool } from "@/data/tools"
import {
  useBookmarks,
  useCalendar,
  useImportantInformation,
  useNotes,
  useReminders,
  useRoutines,
  useTasks,
  useWellness,
} from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { expandEvents, todayString } from "@/lib/dates"
import { nextOccurrence } from "@/lib/reminders"
import { cn } from "@/lib/utils"

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`

/** Live one-line status for each My Life tool. */
function useLifeStats(): Record<string, string> {
  const { tasks } = useTasks()
  const { routines } = useRoutines()
  const { events } = useCalendar()
  const { reminders } = useReminders()
  const { notes } = useNotes()
  const { bookmarks } = useBookmarks()
  const { items } = useImportantInformation()
  const { days, goals } = useWellness()

  return useMemo(() => {
    const today = todayString()
    const now = new Date()
    const open = tasks.filter((t) => !t.completed)
    const dueToday = open.filter((t) => t.dueDate && t.dueDate <= today).length
    const todaysRoutine = routines.filter((r) => r.repeatDays.includes(now.getDay()))
    const routineDone = todaysRoutine.filter((r) => r.completedDates.includes(today)).length
    const weekEvents = expandEvents(events, now, addDays(startOfDay(now), 7))
    const upcomingReminders = reminders
      .filter((r) => !r.done)
      .map((r) => nextOccurrence(r, now))
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime())
    const water = days.find((d) => d.id === today)?.waterGlasses ?? 0

    return {
      todo: open.length ? `${plural(open.length, "open task")}${dueToday ? ` · ${dueToday} due today` : ""}` : "All clear",
      "routine-planner": todaysRoutine.length ? `${routineDone}/${todaysRoutine.length} done today` : "No routine today",
      calendar: weekEvents.length ? `${plural(weekEvents.length, "event")} this week` : "Calendar is clear",
      reminders: upcomingReminders[0] ? `Next: ${format(upcomingReminders[0], "EEE h:mm a")}` : "No upcoming reminders",
      notes: notes.length ? plural(notes.length, "note") : "No notes yet",
      wellness: `${water}/${goals.waterGlasses} glasses of water today`,
      bookmarks: bookmarks.length ? plural(bookmarks.length, "saved link") : "No bookmarks yet",
      "important-information": items.length ? plural(items.length, "entry", "entries") : "Nothing saved yet",
    }
  }, [tasks, routines, events, reminders, notes, bookmarks, items, days, goals])
}

function LifeTile({ tool, stat, hydrated }: { tool: Tool; stat?: string; hydrated: boolean }) {
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
      </div>
      <div>
        <p className="font-semibold">{tool.name}</p>
        <p className={cn("mt-0.5 text-sm text-muted-foreground transition-opacity", !hydrated && "opacity-0")}>
          {stat ?? tool.description}
        </p>
      </div>
    </Link>
  )
}

export function MyLife() {
  const hydrated = useHydrated()
  const stats = useLifeStats()

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My Life</h1>
        <p className="mt-1 text-muted-foreground">Your plans, habits and personal info — stored only on this device.</p>
      </header>
      <div className="space-y-9">
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
