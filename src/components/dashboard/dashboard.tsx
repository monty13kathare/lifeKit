"use client"

import Link from "next/link"
import { useState } from "react"
import { format } from "date-fns"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowUpRight,
  Calculator,
  Calendar,
  ChevronRight,
  FilePen,
  FileText,
  GraduationCap,
  Images,
  LayoutGrid,
  ListChecks,
  ListTodo,
  Moon,
  PenLine,
  Scan,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  UserRound,
  Wand2,
} from "lucide-react"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { getTool } from "@/data/tools"
import { useSettings } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { greeting } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { DashboardPrefs } from "@/types"
import { TodayRoutineWidget, TodayTasksWidget, UpcomingEventsWidget, WellnessWidget } from "./today-widgets"

/* -------------------------------------------------- Spotlight Power Tools */

interface SpotlightTool {
  id: string
  name: string
  badge: string
  description: string
  href: string
  icon: typeof Sparkles
  gradient: string
  iconBg: string
  borderColor: string
  badgeClass: string
}

const SPOTLIGHT_TOOLS: SpotlightTool[] = [
  {
    id: "task-notes",
    name: "AI Task Notes",
    badge: "WhatsApp Ready",
    description: "Convert rough comma thoughts into neat WhatsApp bullet checklists.",
    href: "/tools/task-notes",
    icon: ListChecks,
    gradient: "from-emerald-500/10 via-teal-500/5 to-transparent",
    iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    borderColor: "hover:border-emerald-500/40 border-emerald-500/20",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  {
    id: "image-enhancer",
    name: "AI Image Enhancer",
    badge: "4K & Tear Repair",
    description: "Upscale photos to Ultra HD, deblur & heal scratches or torn pieces.",
    href: "/tools/image-enhancer",
    icon: Sparkles,
    gradient: "from-violet-500/10 via-purple-500/5 to-transparent",
    iconBg: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    borderColor: "hover:border-violet-500/40 border-violet-500/20",
    badgeClass: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20",
  },
  {
    id: "pdf-editor",
    name: "PDF Editor",
    badge: "Exact Font Match",
    description: "Select & replace any text with matching font, sign and watermark.",
    href: "/tools/pdf-editor",
    icon: FilePen,
    gradient: "from-rose-500/10 via-pink-500/5 to-transparent",
    iconBg: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    borderColor: "hover:border-rose-500/40 border-rose-500/20",
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20",
  },
  {
    id: "secure-share",
    name: "SecureShare",
    badge: "Zero-Knowledge",
    description: "Share images, videos & PDFs with encrypted temporary public links.",
    href: "/tools/secure-share",
    icon: ShieldCheck,
    gradient: "from-amber-500/10 via-orange-500/5 to-transparent",
    iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    borderColor: "hover:border-amber-500/40 border-amber-500/20",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
]

/* ------------------------------------------- Useful Tools Filter Categories */

type UsefulCategory = "all" | "ai" | "docs" | "productivity" | "everyday"

interface UsefulToolItem {
  id: string
  name: string
  badge: string
  desc: string
  category: "ai" | "docs" | "productivity" | "everyday"
  featured?: boolean
}

const USEFUL_TOOLS_LIST: UsefulToolItem[] = [
  // AI
  { id: "task-notes", name: "AI Task Notes", badge: "WhatsApp", desc: "Turn rough thoughts into WhatsApp tasks", category: "ai", featured: true },
  { id: "image-enhancer", name: "AI Image Enhancer", badge: "4K Repair", desc: "Super-resolution & tear restoration", category: "ai", featured: true },
  { id: "ai-writer", name: "AI Writer", badge: "Gemini", desc: "Draft emails & polished messages", category: "ai", featured: true },
  { id: "summarizer", name: "Summarizer", badge: "TL;DR", desc: "Extract key points & action items", category: "ai" },
  { id: "goal-planner", name: "Goal Planner", badge: "Planner", desc: "Turn goals into actionable milestones", category: "ai" },
  { id: "decision-helper", name: "Decision Helper", badge: "Matrix", desc: "Pros/cons matrix to pick wisely", category: "ai" },

  // Docs
  { id: "pdf-editor", name: "PDF Editor", badge: "Visual Edit", desc: "In-place font replace & annotate", category: "docs", featured: true },
  { id: "image-to-pdf", name: "Image to PDF", badge: "Fast", desc: "Convert multiple images to PDF", category: "docs", featured: true },
  { id: "ocr", name: "OCR Extractor", badge: "Text", desc: "Extract editable text from images", category: "docs", featured: true },
  { id: "pdf-scanner", name: "PDF Scanner", badge: "Scanner", desc: "Scan physical documents into clean PDF", category: "docs" },

  // Productivity
  { id: "todo", name: "Tasks & To-Dos", badge: "Daily", desc: "Priorities, checklists and subtasks", category: "productivity", featured: true },
  { id: "notes", name: "Quick Notes", badge: "Notes", desc: "Instant offline scratchpad", category: "productivity", featured: true },
  { id: "routine-planner", name: "Daily Routine", badge: "Habits", desc: "Time-blocked daily schedule", category: "productivity", featured: true },
  { id: "calendar", name: "Calendar", badge: "Events", desc: "Interactive monthly agenda", category: "productivity", featured: true },
  { id: "reminders", name: "Reminders", badge: "Alerts", desc: "Never miss scheduled tasks", category: "productivity" },
  { id: "focus", name: "Focus Timer", badge: "Pomodoro", desc: "Timed deep focus sessions", category: "productivity" },

  // Everyday
  { id: "smart-calculator", name: "Smart Calculator", badge: "Natural Math", desc: "Type '20% of 15000' naturally", category: "everyday", featured: true },
  { id: "secure-share", name: "SecureShare", badge: "Encrypted", desc: "Zero-knowledge file link sharing", category: "everyday", featured: true },
  { id: "qr-generator", name: "QR Generator", badge: "Instant", desc: "Generate custom QR codes instantly", category: "everyday", featured: true },
  { id: "password-generator", name: "Password Gen", badge: "Secure", desc: "Strong random cryptographic keys", category: "everyday", featured: true },
  { id: "unit-converter", name: "Unit Converter", badge: "Units", desc: "Length, weight, temperature & more", category: "everyday" },
  { id: "emi-calculator", name: "EMI Calculator", badge: "Finance", desc: "Monthly loan & interest breakdown", category: "everyday" },
  { id: "gst-calculator", name: "GST Calculator", badge: "Tax", desc: "Add/remove GST with CGST/SGST split", category: "everyday" },
  { id: "wellness", name: "Wellness Tracker", badge: "Health", desc: "Water, sleep, steps & mood log", category: "everyday" },
]

const CATEGORY_TABS: { key: UsefulCategory; label: string; icon: typeof Sparkles }[] = [
  { key: "all", label: "All Top", icon: Sparkles },
  { key: "ai", label: "AI Powered", icon: Wand2 },
  { key: "docs", label: "PDF & Docs", icon: FileText },
  { key: "productivity", label: "Productivity", icon: ListTodo },
  { key: "everyday", label: "Everyday", icon: Calculator },
]

const UTILITY_GROUPS = [
  { title: "Productivity", description: "Tasks, routine, focus, reminders", href: "/my-life#productivity", icon: ListTodo, accent: "bg-orange-500/10 text-orange-600 dark:bg-orange-400/15 dark:text-orange-300" },
  { title: "AI Productivity", description: "Task notes, write, summarize, plan", href: "/tools#ai", icon: PenLine, accent: "bg-violet-500/10 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300" },
  { title: "PDF & Docs", description: "Edit, scan, convert to PDF", href: "/tools#documents", icon: FileText, accent: "bg-rose-500/10 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300" },
  { title: "Image Tools", description: "Enhance, resize, compress", href: "/tools#images", icon: Images, accent: "bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300" },
  { title: "Calculators", description: "Smart, EMI, GST, units", href: "/tools#finance", icon: Calculator, accent: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300" },
  { title: "Personal", description: "Wellness, bookmarks, info", href: "/my-life#personal", icon: UserRound, accent: "bg-teal-500/10 text-teal-600 dark:bg-teal-400/15 dark:text-teal-300" },
  { title: "Security", description: "Passwords & encrypted sharing", href: "/tools#security", icon: ShieldCheck, accent: "bg-amber-500/10 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300" },
  { title: "Learn Skills", description: "Prompting, English, logic", href: "/learn", icon: GraduationCap, accent: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300" },
]

function getGreetingVisual(now = new Date()) {
  const h = now.getHours()
  if (h < 5) return { icon: Moon, color: "text-indigo-400" }
  if (h < 12) return { icon: Sunrise, color: "text-amber-500" }
  if (h < 17) return { icon: Sun, color: "text-amber-500" }
  return { icon: Sunset, color: "text-orange-500" }
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } }
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }

export function Dashboard() {
  const hydrated = useHydrated()
  const { settings, update } = useSettings()
  const [customizing, setCustomizing] = useState(false)
  const [activeCategory, setActiveCategory] = useState<UsefulCategory>("all")

  const prefs = settings.dashboard
  const name = hydrated && settings.displayName ? `, ${settings.displayName.split(" ")[0]}` : ""
  const widgets = prefs.todayWidgets
  const anyWidget = widgets.tasks || widgets.routine || widgets.events || widgets.wellness

  const greetingVisual = getGreetingVisual()
  const GreetingIcon = greetingVisual.icon

  // Filter tools based on selected category tab
  const displayedTools = USEFUL_TOOLS_LIST.filter((tool) => {
    if (activeCategory === "all") return tool.featured === true
    return tool.category === activeCategory
  })

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-8 sm:space-y-9">
      {/* ---------------------------------------------------- Hero Header */}
      <header className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground sm:text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-2.5 py-0.5 backdrop-blur-xs">
              <Calendar className="size-3.5 text-primary" aria-hidden />
              <span suppressHydrationWarning>
                {hydrated ? format(new Date(), "EEEE, d MMMM") : "LifeKit"}
              </span>
            </span>
            <span className="text-muted-foreground/50">•</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <GreetingIcon className={cn("size-3.5", greetingVisual.color)} aria-hidden />
              <span>Browser-First</span>
            </span>
          </div>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl" suppressHydrationWarning>
            {hydrated ? greeting() : "Hello"}
            {name} <span className="inline-block animate-pulse" aria-hidden>👋</span>
          </h1>

          <p className="mt-0.5 text-sm text-muted-foreground sm:text-base">
            Your private everyday utility toolbox • 100% on-device & encrypted
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCustomizing(true)}
            aria-label="Customize dashboard"
            className="h-9 rounded-xl border-border/70 bg-card/80 px-3 shadow-xs hover:bg-muted/60"
          >
            <SlidersHorizontal className="size-4" />
            <span className="text-xs font-medium sm:text-sm">Customize</span>
          </Button>
        </div>
      </header>

      {/* --------------------------------- Spotlight Feature Highlights (Top 4) */}
      {prefs.showQuickTools && (
        <section aria-labelledby="spotlight-title" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-3.5" aria-hidden />
              </span>
              <h2 id="spotlight-title" className="text-base font-semibold tracking-tight sm:text-lg">
                Featured Power Tools
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">Most popular utilities</span>
          </div>

          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {SPOTLIGHT_TOOLS.map((tool) => {
              const Icon = tool.icon
              return (
                <motion.div key={tool.id} variants={item}>
                  <Link
                    href={tool.href}
                    className={cn(
                      "group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border bg-gradient-to-br p-4 sm:p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-soft active:scale-[0.98]",
                      tool.gradient,
                      tool.borderColor
                    )}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className={cn("flex size-11 items-center justify-center rounded-xl shadow-xs transition-transform group-hover:scale-105", tool.iconBg)}>
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-tight", tool.badgeClass)}>
                          {tool.badge}
                        </span>
                      </div>

                      <h3 className="mt-3.5 text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                        {tool.name}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                        {tool.description}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between pt-2 border-t border-border/40 text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">
                      <span>Launch tool</span>
                      <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        </section>
      )}

      {/* -------------------- Interactive "Most Useful Tools" Grid with Filter Tabs */}
      {prefs.showQuickTools && (
        <section aria-labelledby="useful-tools-title" className="space-y-3.5">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="useful-tools-title" className="text-base font-semibold tracking-tight sm:text-lg">
              Most Useful Tools
            </h2>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              {CATEGORY_TABS.map((tab) => {
                const isActive = activeCategory === tab.key
                const TabIcon = tab.icon
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveCategory(tab.key)}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 font-medium transition-all active:scale-95",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "border border-border/60 bg-card/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <TabIcon className="size-3.5" aria-hidden />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tools Grid */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              variants={container}
              initial="hidden"
              animate="show"
              exit="hidden"
              className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
            >
              {displayedTools.map((itemConfig) => {
                const toolDef = getTool(itemConfig.id)
                const Icon = toolDef.icon

                return (
                  <motion.div key={itemConfig.id} variants={item}>
                    <Link
                      href={toolDef.href}
                      className="group flex h-full items-center gap-3 rounded-2xl border bg-card/90 p-3.5 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:shadow-soft active:scale-[0.98]"
                    >
                      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105", toolDef.accent)}>
                        <Icon className="size-[18px]" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                          {itemConfig.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground leading-snug">
                          {itemConfig.desc}
                        </span>
                      </div>
                      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/40 transition-all group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                    </Link>
                  </motion.div>
                )
              })}
            </motion.div>
          </AnimatePresence>
        </section>
      )}

      {/* -------------------------------------------------------- Today Section */}
      {prefs.showToday && anyWidget && (
        <section aria-labelledby="today-title" className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <h2 id="today-title" className="text-base font-semibold tracking-tight sm:text-lg">
                Today
              </h2>
              <p className="text-xs text-muted-foreground">Your day at a glance</p>
            </div>
            <Link
              href="/my-life"
              className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
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

      {/* ---------------------------------------------------- All Utilities */}
      {prefs.showCategories && (
        <section aria-labelledby="utilities-title" className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <h2 id="utilities-title" className="text-base font-semibold tracking-tight sm:text-lg">
                Explore Categories
              </h2>
              <p className="text-xs text-muted-foreground">Browse all tools by domain</p>
            </div>
            <Link
              href="/tools"
              className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              All tools <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>

          <motion.ul
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-40px" }}
            className="grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            {UTILITY_GROUPS.map(({ title, description, href, icon: Icon, accent }) => (
              <motion.li key={title} variants={item}>
                <Link
                  href={href}
                  className="group flex h-full items-center gap-3 rounded-2xl border bg-card p-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft sm:p-4"
                >
                  <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105", accent)}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground group-hover:text-primary transition-colors sm:text-base">
                      {title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground sm:text-sm">
                      {description}
                    </span>
                  </span>
                </Link>
              </motion.li>
            ))}
          </motion.ul>
        </section>
      )}

      {/* ------------------------------------------------------- Empty State */}
      {!prefs.showQuickTools && !(prefs.showToday && anyWidget) && !prefs.showCategories && (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <Sparkles className="mx-auto size-8 text-primary" aria-hidden />
          <p className="mt-3 font-medium">Your dashboard is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">Turn sections back on, or browse all tools.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => setCustomizing(true)}>Customize</Button>
            <Button variant="outline" nativeButton={false} render={<Link href="/tools" />}>
              <LayoutGrid /> Tools
            </Button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------- Customize Sheet */}
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
    { key: "showQuickTools", label: "Featured & Quick tools", hint: "AI Task Notes, Enhancer, PDF, Scanner, Calc" },
    { key: "showToday", label: "Today widgets", hint: "Tasks, routine, events and wellness overview" },
    { key: "showCategories", label: "Category shortcuts", hint: "Direct links to tool domains" },
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
