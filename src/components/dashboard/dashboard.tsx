"use client"

import Link from "next/link"
import { useState } from "react"
import { format } from "date-fns"
import { motion } from "framer-motion"
import { ChevronRight, FileText, Images, LayoutGrid, ListTodo, Calculator, Scan, SlidersHorizontal, Sparkles, UserRound } from "lucide-react"
import { ToolCard } from "@/components/cards/tool-card"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { getTool } from "@/data/tools"
import { useSettings } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { greeting } from "@/lib/dates"
import type { DashboardPrefs } from "@/types"
import { TodayRoutineWidget, TodayTasksWidget, UpcomingEventsWidget, WellnessWidget } from "./today-widgets"

const QUICK_TOOLS = ["scan", "image-to-pdf", "ocr", "qr-generator", "smart-calculator", "reminders"] as const
const QUICK_LABELS: Record<(typeof QUICK_TOOLS)[number], string> = {
  scan: "Scan",
  "image-to-pdf": "PDF",
  ocr: "OCR",
  "qr-generator": "QR",
  "smart-calculator": "Calculator",
  reminders: "Reminder",
}

const UTILITY_GROUPS = [
  { title: "Image Tools", description: "Resize, compress, convert", href: "/tools#images", icon: Images, accent: "bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300" },
  { title: "PDF Tools", description: "Create, edit, scan", href: "/tools#documents", icon: FileText, accent: "bg-rose-500/10 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300" },
  { title: "Scan Tools", description: "QR, barcode, OCR", href: "/tools#scan", icon: Scan, accent: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300" },
  { title: "Calculators", description: "EMI, GST, percentage", href: "/tools#finance", icon: Calculator, accent: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300" },
  { title: "Productivity", description: "Tasks, routine, calendar", href: "/my-life#productivity", icon: ListTodo, accent: "bg-orange-500/10 text-orange-600 dark:bg-orange-400/15 dark:text-orange-300" },
  { title: "Personal", description: "Wellness, bookmarks, info", href: "/my-life#personal", icon: UserRound, accent: "bg-teal-500/10 text-teal-600 dark:bg-teal-400/15 dark:text-teal-300" },
]

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }

export function Dashboard() {
  const hydrated = useHydrated()
  const { settings, update } = useSettings()
  const [customizing, setCustomizing] = useState(false)
  const prefs = settings.dashboard
  const name = hydrated && settings.displayName ? `, ${settings.displayName.split(" ")[0]}` : ""
  const widgets = prefs.todayWidgets
  const anyWidget = widgets.tasks || widgets.routine || widgets.events || widgets.wellness

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground" suppressHydrationWarning>
            {hydrated ? format(new Date(), "EEEE, d MMMM") : " "}
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight sm:text-3xl" suppressHydrationWarning>
            {hydrated ? greeting() : "Hello"}
            {name} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-muted-foreground">Your everyday utility toolbox</p>
        </div>
        <Button variant="outline" onClick={() => setCustomizing(true)} aria-label="Customize dashboard">
          <SlidersHorizontal /> <span className="hidden sm:inline">Customize</span>
        </Button>
      </header>

      {prefs.showQuickTools && (
        <section aria-labelledby="quick-tools">
          <h2 id="quick-tools" className="sr-only">
            Quick tools
          </h2>
          <motion.ul
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-3 gap-1 rounded-3xl border bg-card p-2 sm:grid-cols-6 sm:p-3"
          >
            {QUICK_TOOLS.map((id) => (
              <motion.li key={id} variants={item}>
                <ToolCard tool={{ ...getTool(id), name: QUICK_LABELS[id] }} variant="quick" />
              </motion.li>
            ))}
          </motion.ul>
        </section>
      )}

      {prefs.showToday && anyWidget && (
        <section aria-labelledby="today-title">
          <div className="mb-3 flex items-end justify-between">
            <h2 id="today-title" className="text-lg font-semibold">
              Today
            </h2>
            <Link href="/my-life" className="inline-flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground">
              My Life <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {widgets.tasks && <TodayTasksWidget />}
            {widgets.routine && <TodayRoutineWidget />}
            {widgets.events && <UpcomingEventsWidget />}
            {widgets.wellness && <WellnessWidget />}
          </div>
        </section>
      )}

      {prefs.showCategories && (
        <section aria-labelledby="utilities-title">
          <div className="mb-3 flex items-end justify-between">
            <h2 id="utilities-title" className="text-lg font-semibold">
              Utilities
            </h2>
            <Link href="/tools" className="inline-flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground">
              All tools <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
          <motion.ul
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-40px" }}
            className="grid grid-cols-2 gap-3 lg:grid-cols-3"
          >
            {UTILITY_GROUPS.map(({ title, description, href, icon: Icon, accent }) => (
              <motion.li key={title} variants={item}>
                <Link
                  href={href}
                  className="group flex h-full items-center gap-3 rounded-2xl border bg-card p-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft sm:p-4"
                >
                  <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${accent}`}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium sm:text-base">{title}</span>
                    <span className="block truncate text-xs text-muted-foreground sm:text-sm">{description}</span>
                  </span>
                </Link>
              </motion.li>
            ))}
          </motion.ul>
        </section>
      )}

      {!prefs.showQuickTools && !(prefs.showToday && anyWidget) && !prefs.showCategories && (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <Sparkles className="mx-auto size-8 text-primary" aria-hidden />
          <p className="mt-3 font-medium">Your dashboard is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">Turn sections back on, or browse all tools.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => setCustomizing(true)}>Customize</Button>
            <Button variant="outline" render={<Link href="/tools" />}>
              <LayoutGrid /> Tools
            </Button>
          </div>
        </div>
      )}

      <CustomizeSheet
        open={customizing}
        onOpenChange={setCustomizing}
        prefs={prefs}
        onChange={(dashboard) => update({ dashboard })}
      />
    </div>
  )
}

function CustomizeSheet({
  open,
  onOpenChange,
  prefs,
  onChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  prefs: DashboardPrefs
  onChange: (p: DashboardPrefs) => void
}) {
  const sections: { key: "showQuickTools" | "showToday" | "showCategories"; label: string; hint: string }[] = [
    { key: "showQuickTools", label: "Quick tools", hint: "Scan, PDF, OCR, QR, Calculator, Reminder" },
    { key: "showToday", label: "Today", hint: "Tasks, routine, events and wellness" },
    { key: "showCategories", label: "Utilities", hint: "Shortcuts to tool groups" },
  ]
  const widgets: { key: keyof DashboardPrefs["todayWidgets"]; label: string }[] = [
    { key: "tasks", label: "Today's tasks" },
    { key: "routine", label: "Today's routine" },
    { key: "events", label: "Upcoming events" },
    { key: "wellness", label: "Wellness progress" },
  ]
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Customize dashboard"
      description="Choose what appears on your home screen."
      footer={<Button onClick={() => onOpenChange(false)}>Done</Button>}
    >
      <div className="space-y-5">
        <fieldset className="space-y-1">
          <legend className="mb-2 text-sm font-medium text-muted-foreground">Sections</legend>
          {sections.map(({ key, label, hint }) => (
            <div key={key} className="flex min-h-14 items-center justify-between gap-4 rounded-xl px-1">
              <Label htmlFor={`dash-${key}`} className="flex-col items-start gap-0.5">
                <span>{label}</span>
                <span className="text-xs font-normal text-muted-foreground">{hint}</span>
              </Label>
              <Switch id={`dash-${key}`} checked={prefs[key]} onCheckedChange={(v) => onChange({ ...prefs, [key]: v })} />
            </div>
          ))}
        </fieldset>
        <fieldset className="space-y-1" disabled={!prefs.showToday}>
          <legend className="mb-2 text-sm font-medium text-muted-foreground">Today widgets</legend>
          {widgets.map(({ key, label }) => (
            <div key={key} className="flex min-h-12 items-center justify-between gap-4 rounded-xl px-1">
              <Label htmlFor={`widget-${key}`}>{label}</Label>
              <Switch
                id={`widget-${key}`}
                disabled={!prefs.showToday}
                checked={prefs.todayWidgets[key]}
                onCheckedChange={(v) => onChange({ ...prefs, todayWidgets: { ...prefs.todayWidgets, [key]: v } })}
              />
            </div>
          ))}
        </fieldset>
      </div>
    </ResponsiveSheet>
  )
}
