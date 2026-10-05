"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowRight, CalendarCheck, Gamepad2, HeartPulse, LayoutGrid, Search, ShieldCheck, Sparkles, X } from "lucide-react"
import { CATEGORY_META, LIFE_CATEGORY_ORDER, TOOL_CATEGORY_ORDER, TOOLS, type Tool, type ToolCategory } from "@/data/tools"
import { cn } from "@/lib/utils"

/** Registry entries whose pages don't exist yet (kept out of the directory). */
const HIDDEN = new Set(["learn-english", "learn-logic"])

type Filter = "all" | ToolCategory

/** Everything browsable here: utility tools first, then My Day tools, then Learn. */
const ORDER: ToolCategory[] = [...TOOL_CATEGORY_ORDER, ...LIFE_CATEGORY_ORDER, "learn"]
const visible = (cat: ToolCategory) => TOOLS.filter((t) => t.category === cat && !HIDDEN.has(t.id))

const SPOTLIGHT = [
  { href: "/my-life", title: "My Day", text: "Tasks, routine & calendar", icon: CalendarCheck, tone: "from-indigo-500/15 text-indigo-600 dark:text-indigo-300" },
  { href: "/learn", title: "Learn", text: "Quizzes & AI lessons", icon: Gamepad2, tone: "from-violet-500/15 text-violet-600 dark:text-violet-300" },
  { href: "/tools/wellness", title: "Wellness", text: "AI diet & workout plan", icon: HeartPulse, tone: "from-rose-500/15 text-rose-600 dark:text-rose-300" },
]

export function ToolsDirectory() {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const total = ORDER.reduce((n, c) => n + visible(c).length, 0)

  const q = query.trim().toLowerCase()
  const sections = useMemo(
    () =>
      ORDER.filter((c) => filter === "all" || c === filter)
        .map((c) => ({ cat: c, tools: visible(c).filter((t) => !q || `${t.name} ${t.description} ${CATEGORY_META[c].label}`.toLowerCase().includes(q)) }))
        .filter((s) => s.tools.length > 0),
    [filter, q]
  )
  const shown = sections.reduce((n, s) => n + s.tools.length, 0)

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tools</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden /> Private — most tools run right in your browser.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary tabular-nums">{total} tools</span>
      </header>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${total} tools…`}
          aria-label="Search tools"
          className="h-12 w-full rounded-2xl border bg-card pr-11 pl-10 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {/* Category filter — the fade on the right shows the row scrolls */}
      <div className="relative -mx-4 sm:mx-0">
        <nav aria-label="Tool categories" className="no-scrollbar overflow-x-auto px-4 sm:px-0">
          <ul className="flex gap-2 pb-1 sm:flex-wrap">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={total} icon={LayoutGrid} />
            {ORDER.map((c) => (
              <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)} label={CATEGORY_META[c].label} count={visible(c).length} />
            ))}
          </ul>
        </nav>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-background to-transparent sm:hidden" aria-hidden />
      </div>

      {/* Spotlight on the bigger app sections */}
      {filter === "all" && !q && (
        <section aria-label="More in LifeKit">
          <ul className="grid grid-cols-3 gap-2 sm:gap-3">
            {SPOTLIGHT.map(({ href, title, text, icon: Icon, tone }) => (
              <li key={href}>
                <Link href={href} className={cn("flex h-full flex-col gap-2 rounded-2xl border bg-linear-to-br to-card p-3 transition-all hover:-translate-y-0.5 hover:shadow-soft active:scale-[0.98]", tone)}>
                  <Icon className="size-5" aria-hidden />
                  <span className="text-sm leading-tight font-semibold text-foreground">{title}</span>
                  <span className="hidden text-xs text-muted-foreground min-[400px]:block">{text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Results */}
      {shown === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <p className="font-medium">No tools match “{query.trim()}”</p>
          <button type="button" onClick={() => { setQuery(""); setFilter("all") }} className="mt-2 min-h-10 text-sm font-medium text-primary">
            Show all tools
          </button>
        </div>
      ) : (
        <div className="space-y-7">
          {sections.map(({ cat, tools }) => (
            <section key={cat} aria-labelledby={`${cat}-title`} className="scroll-mt-24">
              <div className="mb-2.5 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <h2 id={`${cat}-title`} className="flex items-center gap-2 text-lg font-semibold">
                    {CATEGORY_META[cat].label}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">{tools.length}</span>
                  </h2>
                  <p className="text-sm text-muted-foreground">{CATEGORY_META[cat].description}</p>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
                {tools.map((t) => (
                  <li key={t.id}>
                    <ToolTile tool={t} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {filter !== "all" && !q && (
        <button type="button" onClick={() => setFilter("all")} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed text-sm font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground">
          <Sparkles className="size-4" aria-hidden /> See all {total} tools <ArrowRight className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )
}

function FilterChip({ active, onClick, label, count, icon: Icon }: { active: boolean; onClick: () => void; label: string; count: number; icon?: typeof LayoutGrid }) {
  return (
    <li className="shrink-0">
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
          active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
        )}
      >
        {Icon && <Icon className="size-4" aria-hidden />}
        {label}
        <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-primary-foreground/20" : "bg-muted")}>{count}</span>
      </button>
    </li>
  )
}

function ToolTile({ tool }: { tool: Tool }) {
  const Icon = tool.icon
  return (
    <Link href={tool.href} className="group flex h-full flex-col gap-2.5 rounded-2xl border bg-card p-3 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft active:scale-[0.98] sm:p-4">
      <span className={cn("flex size-10 items-center justify-center rounded-xl", tool.accent)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm leading-tight font-semibold">{tool.name}</span>
        <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{tool.description}</span>
      </span>
    </Link>
  )
}
