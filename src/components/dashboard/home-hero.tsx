"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useId, useMemo, useState } from "react"
import { ArrowRight, CalendarCheck, FileImage, Flame, GraduationCap, HeartPulse, Scan, Search, Sparkles } from "lucide-react"
import { TOOLS } from "@/data/tools"
import { useLearnFun, useSettings, useTasks } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { greeting, todayString } from "@/lib/dates"
import { liveDayStreak } from "@/lib/learn/fun"
import { cn } from "@/lib/utils"

const QUICK = [
  { href: "/scan", label: "Scan", icon: Scan },
  { href: "/tools/image-to-pdf", label: "Image → PDF", icon: FileImage },
  { href: "/my-life", label: "My Day", icon: CalendarCheck },
  { href: "/learn", label: "Learn", icon: GraduationCap },
  { href: "/tools/wellness", label: "Wellness", icon: HeartPulse },
]

/** Home hero: personal greeting, tool search and quick actions. */
export function HomeHero() {
  const hydrated = useHydrated()
  const router = useRouter()
  const { settings } = useSettings()
  const { tasks } = useTasks()
  const { stats } = useLearnFun()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const listId = useId()

  const name = hydrated ? settings.displayName.trim().split(/\s+/)[0] : ""
  const today = todayString()
  const dueToday = hydrated ? tasks.filter((t) => !t.completed && t.dueDate && t.dueDate <= today).length : 0
  const streak = hydrated ? liveDayStreak(stats) : 0

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return TOOLS.filter((t) => `${t.name} ${t.description}`.toLowerCase().includes(q)).slice(0, 6)
  }, [query])

  return (
    <section className="relative isolate overflow-visible rounded-[2rem] border bg-card p-5 text-foreground shadow-soft sm:p-8">
      {/* Soft moving light */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[2rem]" aria-hidden>
        <div className="absolute inset-0 bg-linear-to-br from-primary/15 via-primary/5 to-transparent" />
        <div className="animate-lk-glow absolute -top-20 -right-12 size-64 rounded-full bg-primary/25 blur-3xl" />
        <div className="animate-lk-glow absolute -bottom-24 left-6 size-56 rounded-full bg-fuchsia-500/15 blur-3xl" style={{ animationDelay: "1.2s" }} />
        {/* Subtle dot texture */}
        <div className="absolute inset-0 bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] bg-size-[18px_18px] opacity-40 mask-[linear-gradient(to_bottom,black,transparent_70%)]" />
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-center lg:gap-10">
        <div className="min-w-0">
          <p className="text-xs font-medium text-primary sm:text-sm" suppressHydrationWarning>
            {hydrated ? new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : " "}
          </p>
          <h1 className="mt-1 text-[1.6rem] leading-tight font-bold tracking-tight text-balance sm:text-4xl" suppressHydrationWarning>
            {hydrated ? `${greeting(new Date())}${name ? `, ${name}` : ""}` : "Welcome to LifeKit"}
          </h1>
          <p className="mt-1.5 max-w-md text-sm text-muted-foreground">PDFs, scans, health and learning — one private app, right on your phone.</p>

          {/* Status pills */}
          {hydrated && (dueToday > 0 || streak > 0) && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
              {dueToday > 0 && (
                <Link href="/tools/todo" className="inline-flex min-h-8 items-center gap-1.5 rounded-full border bg-background/70 px-3 backdrop-blur transition-colors hover:bg-muted">
                  <CalendarCheck className="size-3.5 text-primary" aria-hidden /> {dueToday} {dueToday === 1 ? "task" : "tasks"} due
                </Link>
              )}
              {streak > 0 && (
                <Link href="/learn" className="inline-flex min-h-8 items-center gap-1.5 rounded-full border bg-background/70 px-3 backdrop-blur transition-colors hover:bg-muted">
                  <Flame className="size-3.5 text-orange-500" aria-hidden /> {streak}-day learning streak
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="min-w-0">
          {/* Tool search */}
          <form
            role="search"
            className="relative mt-5 lg:mt-0"
            onSubmit={(e) => {
              e.preventDefault()
              if (results[0]) router.push(results[0].href)
            }}
          >
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => window.setTimeout(() => setOpen(false), 150)}
              placeholder="Search tools…"
              aria-label="Search tools"
              aria-controls={listId}
              aria-expanded={open && results.length > 0}
              role="combobox"
              aria-autocomplete="list"
              className="h-12 w-full rounded-2xl border bg-background pr-4 pl-12 text-base text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20"
            />
            {open && query.trim() && (
              <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-xl">
                {results.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-muted-foreground">No tool matches “{query.trim()}”.</li>
                ) : (
                  results.map((t) => {
                    const Icon = t.icon
                    return (
                      <li key={t.id} role="option" aria-selected={false}>
                        <Link href={t.href} className="flex min-h-12 items-center gap-3 px-3 py-2 hover:bg-muted">
                          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", t.accent)}>
                            <Icon className="size-4.5" aria-hidden />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{t.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{t.description}</span>
                          </span>
                        </Link>
                      </li>
                    )
                  })
                )}
              </ul>
            )}
          </form>

          {/* Quick actions: a grid, so nothing is ever cut off */}
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3">
            {QUICK.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex h-full min-h-16 flex-col items-center justify-center gap-1.5 rounded-2xl border bg-background/70 px-1.5 py-2 text-center text-xs leading-tight font-medium backdrop-blur transition-colors hover:border-primary/40 hover:bg-primary/8 active:scale-95"
                >
                  <Icon className="size-5 text-primary" aria-hidden /> {label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/tools"
                className="flex h-full min-h-16 flex-col items-center justify-center gap-1.5 rounded-2xl bg-primary px-1.5 py-2 text-center text-xs leading-tight font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/85 active:scale-95"
              >
                <Sparkles className="size-5" aria-hidden />
                <span className="inline-flex items-center gap-0.5">
                  All tools <ArrowRight className="size-3.5" aria-hidden />
                </span>
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}
