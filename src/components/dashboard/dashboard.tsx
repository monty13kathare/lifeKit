"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, Camera, CalendarCheck, ChevronRight, Droplet, Flame, Gamepad2, HeartPulse, LayoutGrid, ListTodo, ScanLine, ShieldCheck, type LucideIcon } from "lucide-react"
import { CATEGORY_META, getTool, TOOL_CATEGORY_ORDER, toolsByCategory, type Tool } from "@/data/tools"
import { useLearnFun, useTasks, useWellness } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { todayString } from "@/lib/dates"
import { levelInfo, liveDayStreak } from "@/lib/learn/fun"
import { cn } from "@/lib/utils"
import { HomeHero } from "./home-hero"

const COLOR_STYLES = {
  rose: { icon: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10", glow: "bg-rose-500" },
  blue: { icon: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", glow: "bg-blue-500" },
  emerald: { icon: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", glow: "bg-emerald-500" },
  purple: { icon: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10", glow: "bg-purple-500" },
  orange: { icon: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10", glow: "bg-orange-500" },
  pink: { icon: "text-pink-600 dark:text-pink-400", bg: "bg-pink-500/10", glow: "bg-pink-500" },
  indigo: { icon: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10", glow: "bg-indigo-500" },
  sky: { icon: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", glow: "bg-sky-500" },
  amber: { icon: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", glow: "bg-amber-500" },
  slate: { icon: "text-slate-600 dark:text-slate-400", bg: "bg-slate-500/10", glow: "bg-slate-500" },
}

/** Popular tools on Home (registry ids) with their tile colour. */
const POPULAR: { id: string; color: keyof typeof COLOR_STYLES }[] = [
  { id: "text-to-pdf", color: "rose" },
  { id: "image-to-pdf", color: "blue" },
  { id: "pdf-editor", color: "pink" },
  { id: "ocr", color: "emerald" },
  { id: "qr-generator", color: "indigo" },
  { id: "image-compressor", color: "sky" },
  { id: "smart-calculator", color: "amber" },
  { id: "ai-writer", color: "purple" },
]

export function Dashboard() {
  return (
    <div className="pb-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <HomeHero />
        <PopularTools />
        <Featured />
        <ExploreTools />
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-success" aria-hidden /> Private by design — your data stays on this device.
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- Popular */

function SectionHeader({ title, subtitle, href, cta = "View all" }: { title: string; subtitle?: string; href?: string; cta?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="inline-flex min-h-10 shrink-0 items-center gap-0.5 rounded-full border bg-card px-3.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground">
          {cta} <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </div>
  )
}

function PopularTools() {
  return (
    <section aria-labelledby="popular-title">
      <div id="popular-title">
        <SectionHeader title="Popular tools" href="/tools" />
      </div>
      <ul className="grid grid-cols-4 gap-2.5 sm:gap-3">
        {POPULAR.map(({ id, color }) => (
          <li key={id}>
            <PopularTile tool={getTool(id)} color={color} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function PopularTile({ tool, color }: { tool: Tool; color: keyof typeof COLOR_STYLES }) {
  const styles = COLOR_STYLES[color]
  const Icon = tool.icon
  return (
    <Link
      href={tool.href}
      className="group relative flex aspect-square flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[1.25rem] border border-border/40 bg-card p-1.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-95 sm:aspect-auto sm:min-h-28 sm:p-3"
    >
      <div className={cn("absolute inset-x-0 -top-4 h-16 opacity-0 blur-xl transition-opacity dark:opacity-15 dark:group-hover:opacity-25", styles.glow)} aria-hidden />
      <span className={cn("relative flex size-10 items-center justify-center rounded-xl sm:size-11 sm:rounded-2xl", styles.bg)}>
        <Icon className={cn("size-5", styles.icon)} aria-hidden />
      </span>
      <span className="relative text-center text-[0.68rem] leading-tight font-bold tracking-tight sm:text-xs">{tool.name}</span>
    </Link>
  )
}

/* ------------------------------------------------------------ Featured */

function Featured() {
  const hydrated = useHydrated()
  const { tasks } = useTasks()
  const { stats } = useLearnFun()
  const { days, goals, plan } = useWellness()
  const today = todayString()
  const due = tasks.filter((t) => !t.completed && t.dueDate && t.dueDate <= today).length
  const lvl = levelInfo(stats.xp)
  const streak = liveDayStreak(stats)
  const water = days.find((d) => d.id === today)?.waterGlasses ?? 0

  const cards: { href: string; title: string; text: string; stat: string; statIcon: LucideIcon; icon: LucideIcon; tile: string; gradient: string }[] = [
    {
      href: "/my-life",
      title: "My Day",
      text: "Tasks, routine, calendar and reminders in one view.",
      stat: due ? `${due} ${due === 1 ? "task" : "tasks"} due today` : "You're all caught up",
      statIcon: ListTodo,
      icon: CalendarCheck,
      tile: "bg-indigo-500/12 text-indigo-600 ring-indigo-500/20 dark:text-indigo-300",
      gradient: "from-indigo-500/15 via-indigo-500/5",
    },
    {
      href: "/learn",
      title: "Learn with Fun",
      text: "Quiz games for logic, English, riddles and stories — English & हिन्दी.",
      stat: stats.games ? `Level ${lvl.level} · ${streak ? `${streak}-day streak` : `${stats.xp} XP`}` : "Play your first quiz",
      statIcon: Flame,
      icon: Gamepad2,
      tile: "bg-violet-500/12 text-violet-600 ring-violet-500/20 dark:text-violet-300",
      gradient: "from-violet-500/15 via-fuchsia-500/5",
    },
    {
      href: "/tools/wellness",
      title: "Wellness & AI Guide",
      text: "Diet, workouts and a daily routine made for your goal.",
      stat: plan ? `Water ${water}/${goals.waterGlasses} · plan ready` : `Water ${water}/${goals.waterGlasses} today`,
      statIcon: Droplet,
      icon: HeartPulse,
      tile: "bg-rose-500/12 text-rose-600 ring-rose-500/20 dark:text-rose-300",
      gradient: "from-rose-500/15 via-rose-500/5",
    },
    {
      href: "/scan",
      title: "Scan Everything",
      text: "QR codes, barcodes and text with one camera.",
      stat: "Camera or photo upload",
      statIcon: Camera,
      icon: ScanLine,
      tile: "bg-emerald-500/12 text-emerald-600 ring-emerald-500/20 dark:text-emerald-300",
      gradient: "from-emerald-500/15 via-emerald-500/5",
    },
  ]

  return (
    <section aria-labelledby="featured-title">
      <h2 id="featured-title" className="mb-3 text-lg font-bold tracking-tight">
        Featured
      </h2>
      <motion.ul
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
        className="grid gap-3 sm:grid-cols-2"
      >
        {cards.map((c) => (
          <motion.li key={c.href} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
            <Link
              href={c.href}
              className={cn(
                "group relative flex h-full items-center gap-4 overflow-hidden rounded-2xl border bg-linear-to-br to-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-soft active:scale-[0.99]",
                c.gradient
              )}
            >
              <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl ring-1 sm:size-14", c.tile)} aria-hidden>
                <c.icon className="size-6 sm:size-7" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{c.title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{c.text}</span>
                <span className={cn("mt-2 inline-flex items-center gap-1.5 rounded-full border bg-card/80 px-2.5 py-0.5 text-xs font-medium", !hydrated && "opacity-0")}>
                  <c.statIcon className="size-3.5 text-muted-foreground" aria-hidden /> {c.stat}
                </span>
              </span>
              <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  )
}

/* ------------------------------------------------------- Explore tools */

function ExploreTools() {
  return (
    <section aria-labelledby="explore-title" className="space-y-6">
      <div id="explore-title">
        <SectionHeader title="Explore all tools" subtitle="Everything LifeKit can do" href="/tools" cta="Browse" />
      </div>
      {TOOL_CATEGORY_ORDER.map((cat) => {
        const tools = toolsByCategory(cat)
        if (!tools.length) return null
        return (
          <div key={cat}>
            <div className="mb-2">
              <h3 className="font-semibold">{CATEGORY_META[cat].label}</h3>
              <p className="text-xs text-muted-foreground">{CATEGORY_META[cat].description}</p>
            </div>
            <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4">
              {tools.map((t) => (
                <li key={t.id} className="w-40 shrink-0 snap-start sm:w-auto">
                  <Link href={t.href} className="flex h-full flex-col gap-2 rounded-2xl border bg-card p-3 transition-colors hover:border-primary/30 hover:bg-muted/40">
                    <span className={cn("flex size-9 items-center justify-center rounded-xl", t.accent)}>
                      <t.icon className="size-4.5" aria-hidden />
                    </span>
                    <span className="text-sm font-semibold">{t.name}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{t.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
      <Link href="/tools" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dashed text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground">
        <LayoutGrid className="size-4" aria-hidden /> See every tool
      </Link>
    </section>
  )
}
