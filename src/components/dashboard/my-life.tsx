"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { addDays, format, startOfDay } from "date-fns"
import { motion } from "framer-motion"
import { Bell, CalendarDays, ChevronRight, Droplet, Dumbbell, Footprints, HeartPulse, ListTodo, Moon, Plus, Sparkles, Sunrise, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getTool, type Tool } from "@/data/tools"
import { useBookmarks, useCalendar, useGoals, useNotes, useReminders, useSettings, useWellness } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { expandEvents, greeting } from "@/lib/dates"
import { nextOccurrence } from "@/lib/reminders"
import { emptyWellnessDay } from "@/lib/storage/wellness"
import { bmi, bmiCategory, BMI_META, GOAL_META } from "@/lib/wellness/health"
import { cn } from "@/lib/utils"
import { useToday } from "./my-life/use-today"

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`

/** Tools shown on My Day, in order. Wellness has its own card at the top. */
const DAY_TOOLS = ["todo", "routine-planner", "calendar", "reminders", "goal-planner", "notes", "bookmarks"]

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
  const today = useToday(now)
  const { settings } = useSettings()
  const { events } = useCalendar()
  const { reminders } = useReminders()
  const { notes } = useNotes()
  const { bookmarks } = useBookmarks()
  const { goals } = useGoals()

  const nextReminder = useMemo(
    () =>
      reminders
        .filter((r) => !r.done)
        .map((r) => ({ r, at: nextOccurrence(r, now) }))
        .filter((x): x is { r: (typeof reminders)[number]; at: Date } => !!x.at)
        .sort((a, b) => a.at.getTime() - b.at.getTime())[0],
    [reminders, now]
  )

  const stats = useMemo<Record<string, string>>(() => {
    const weekEvents = expandEvents(events, now, addDays(startOfDay(now), 7))
    const pinned = notes.filter((n) => n.pinned).length
    const activeGoals = goals.filter((g) => g.status === "active").length
    return {
      todo: today.openTasks.length
        ? `${plural(today.openTasks.length, "open task")}${today.overdue.length ? ` · ${today.overdue.length} overdue` : ""}`
        : "All clear",
      "routine-planner": today.routineToday.length ? `${today.routineDone}/${today.routineToday.length} done today` : "No routine today",
      calendar: weekEvents.length ? `${plural(weekEvents.length, "event")} this week` : "Calendar is clear",
      reminders: nextReminder ? `Next: ${format(nextReminder.at, "EEE h:mm a")}` : "Nothing upcoming",
      "goal-planner": activeGoals ? `${plural(activeGoals, "active goal")}` : "Plan a goal",
      notes: notes.length ? `${plural(notes.length, "note")}${pinned ? ` · ${pinned} pinned` : ""}` : "No notes yet",
      bookmarks: bookmarks.length ? plural(bookmarks.length, "saved link") : "No bookmarks yet",
    }
  }, [events, notes, bookmarks, goals, today, now, nextReminder])

  const glance = [
    {
      label: "Tasks today",
      value: today.dueToday.length ? `${today.tasksDone}/${today.dueToday.length}` : "—",
      pct: today.dueToday.length ? today.tasksDone / today.dueToday.length : -1,
      href: "/tools/todo",
      icon: ListTodo,
      hint: today.overdue.length ? `${today.overdue.length} overdue` : today.dueToday.length ? "due today" : "nothing due",
      warn: today.overdue.length > 0,
    },
    {
      label: "Routine",
      value: today.routineToday.length ? `${today.routineDone}/${today.routineToday.length}` : "—",
      pct: today.routineToday.length ? today.routineDone / today.routineToday.length : -1,
      href: "/tools/routine-planner",
      icon: Sunrise,
      hint: today.routineToday.length ? "completed" : "no routine today",
    },
    {
      label: "Next event",
      value: today.nextEvent ? format(today.nextEvent.start, "h:mm a") : "—",
      pct: -1,
      href: "/tools/calendar",
      icon: CalendarDays,
      hint: today.nextEvent ? today.nextEvent.event.title : "none today",
    },
    {
      label: "Reminder",
      value: nextReminder ? format(nextReminder.at, "h:mm a") : "—",
      pct: -1,
      href: "/tools/reminders",
      icon: Bell,
      hint: nextReminder ? nextReminder.r.title : "nothing upcoming",
    },
  ]

  const name = hydrated ? settings.displayName.trim().split(/\s+/)[0] : ""

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-sm text-muted-foreground" suppressHydrationWarning>
          {hydrated ? format(now, "EEEE, d MMMM") : " "}
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight sm:text-3xl" suppressHydrationWarning>
          {hydrated ? `${greeting(now)}${name ? `, ${name}` : ""}` : "My Day"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Your health, plans and schedule — stored only on this device.</p>
      </header>

      <WellnessCard hydrated={hydrated} todayId={today.today} />

      <section aria-labelledby="glance-title">
        <h2 id="glance-title" className="mb-3 text-lg font-semibold">
          Today at a glance
        </h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {glance.map(({ label, value, pct, href, icon: Icon, hint, warn }) => (
            <li key={label}>
              <Link href={href} className="flex h-full flex-col gap-2 rounded-2xl border bg-card p-3.5 transition-colors hover:border-primary/30">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Icon className="size-3.5" aria-hidden /> {label}
                </span>
                <span className={cn("text-xl font-semibold tabular-nums transition-opacity", !hydrated && "opacity-0")}>{value}</span>
                {pct >= 0 && (
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span className="block h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct * 100}%` }} />
                  </span>
                )}
                <span className={cn("truncate text-xs", warn ? "font-medium text-destructive" : "text-muted-foreground", !hydrated && "opacity-0")}>{hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tools-title">
        <h2 id="tools-title" className="mb-3 text-lg font-semibold">
          Plan &amp; organise
        </h2>
        <motion.ul
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          {DAY_TOOLS.map((id) => {
            const tool = getTool(id)
            return (
              <motion.li key={id} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}>
                <DayTile tool={tool} stat={stats[id]} hydrated={hydrated} />
              </motion.li>
            )
          })}
        </motion.ul>
      </section>
    </div>
  )
}

/* -------------------------------------------------------------- Wellness */

const RINGS: { key: "waterGlasses" | "steps" | "exerciseMinutes" | "sleepHours"; label: string; icon: LucideIcon; color: string }[] = [
  { key: "waterGlasses", label: "Water", icon: Droplet, color: "var(--chart-2)" },
  { key: "steps", label: "Steps", icon: Footprints, color: "var(--chart-3)" },
  { key: "exerciseMinutes", label: "Exercise", icon: Dumbbell, color: "var(--chart-5)" },
  { key: "sleepHours", label: "Sleep", icon: Moon, color: "var(--chart-1)" },
]

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
const short = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString("en-US", { maximumFractionDigits: 1 }))

function WellnessCard({ hydrated, todayId }: { hydrated: boolean; todayId: string }) {
  const { days, goals, profile, plan, upsertDay } = useWellness()
  const day = days.find((d) => d.id === todayId) ?? emptyWellnessDay(todayId)
  const b = bmi(profile.heightCm, profile.weightKg)
  const cat = b !== null && (!profile.age || profile.age >= 18) ? bmiCategory(b) : null

  const planItems = plan ? plan.data.meals.length + (plan.data.workouts.some((w) => w.day === WEEKDAY[new Date().getDay()]) ? 1 : 0) : 0
  const planDone = plan ? Object.entries(day.habits ?? {}).filter(([k, v]) => v && k.startsWith("plan:")).length : 0

  return (
    <section className="overflow-hidden rounded-3xl border bg-linear-to-br from-rose-500/10 via-card to-card p-4 sm:p-5" aria-labelledby="wellness-title">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/12 text-rose-600 dark:text-rose-300">
          <HeartPulse className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="wellness-title" className="font-semibold">
            Wellness
          </h2>
          <p className={cn("truncate text-xs text-muted-foreground", !hydrated && "opacity-0")}>
            {GOAL_META[profile.goal].label}
            {profile.weightKg ? ` · ${profile.weightKg} kg` : ""}
            {b !== null ? ` · BMI ${b}${cat ? ` (${BMI_META[cat].label.replace(" range", "").toLowerCase()})` : ""}` : ""}
          </p>
        </div>
        <Link
          href="/tools/wellness"
          aria-label="Open Wellness"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      </div>

      <ul className="mt-4 grid grid-cols-4 gap-2">
        {RINGS.map(({ key, label, icon: Icon, color }) => {
          const value = day[key]
          const goal = goals[key]
          const pct = goal > 0 ? Math.min(1, value / goal) : 0
          const c = 2 * Math.PI * 22
          return (
            <li key={key} className="flex flex-col items-center gap-1 text-center">
              <div className="relative size-14">
                <svg viewBox="0 0 52 52" className="size-full -rotate-90" aria-hidden>
                  <circle cx="26" cy="26" r="22" fill="none" strokeWidth="5" className="stroke-muted" />
                  <circle
                    cx="26"
                    cy="26"
                    r="22"
                    fill="none"
                    strokeWidth="5"
                    strokeLinecap="round"
                    stroke={color}
                    strokeDasharray={c}
                    strokeDashoffset={hydrated ? c * (1 - pct) : c}
                    className="transition-[stroke-dashoffset] duration-700"
                  />
                </svg>
                <Icon className="absolute inset-0 m-auto size-4.5" style={{ color }} aria-hidden />
              </div>
              <span className={cn("text-sm font-semibold tabular-nums", !hydrated && "opacity-0")}>
                {short(value)}
                {key === "sleepHours" ? "h" : ""}
              </span>
              <span className="text-[0.7rem] text-muted-foreground">{label}</span>
            </li>
          )
        })}
      </ul>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          className="min-w-0"
          aria-label="Add a glass of water"
          onClick={() => upsertDay({ ...day, waterGlasses: Math.min(40, day.waterGlasses + 1), id: todayId })}
          disabled={!hydrated}
        >
          <Plus aria-hidden /> Water
        </Button>
        <Button variant="outline" className="min-w-0" render={<Link href="/tools/wellness" />} nativeButton={false}>
          <Sparkles aria-hidden />
          <span className="truncate">{plan ? `Plan ${planDone}/${planItems}` : "AI plan"}</span>
        </Button>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------- Tiles */

function DayTile({ tool, stat, hydrated }: { tool: Tool; stat?: string; hydrated: boolean }) {
  const Icon = tool.icon
  return (
    <Link
      href={tool.href}
      className="flex h-full flex-col gap-3 rounded-2xl border bg-card p-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft"
    >
      <span className={cn("flex size-10 items-center justify-center rounded-xl", tool.accent)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{tool.name}</span>
        <span className={cn("mt-0.5 block text-xs text-muted-foreground transition-opacity", !hydrated && "opacity-0")}>{stat ?? tool.description}</span>
      </span>
    </Link>
  )
}
