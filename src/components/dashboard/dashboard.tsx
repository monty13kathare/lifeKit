"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Scan,
  RefreshCw,
  LayoutGrid,
  Shrink,
  MoreHorizontal,
  MoreVertical,
  Repeat,
  ListTodo,
  Bookmark
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useNotes, useTasks, useBookmarks } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"

const COLOR_STYLES = {
  rose: { icon: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10", glow: "bg-rose-500" },
  blue: { icon: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", glow: "bg-blue-500" },
  emerald: { icon: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", glow: "bg-emerald-500" },
  purple: { icon: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10", glow: "bg-purple-500" },
  orange: { icon: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10", glow: "bg-orange-500" },
  pink: { icon: "text-pink-600 dark:text-pink-400", bg: "bg-pink-500/10", glow: "bg-pink-500" },
  indigo: { icon: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10", glow: "bg-indigo-500" },
  slate: { icon: "text-slate-600 dark:text-slate-400", bg: "bg-slate-500/10", glow: "bg-slate-500" },
  sky: { icon: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", glow: "bg-sky-500" },
  violet: { icon: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10", glow: "bg-violet-500" },
  amber: { icon: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", glow: "bg-amber-500" },
}

function ToolCard({
  icon: Icon,
  color,
  title,
  desc,
  href,
}: {
  icon: React.ElementType
  color: keyof typeof COLOR_STYLES
  title: string
  desc: string
  href: string
}) {
  const styles = COLOR_STYLES[color]

  return (
    <Link href={href} className="group relative flex flex-col items-center justify-center rounded-[1.25rem] bg-card p-2 sm:p-3 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-95 border border-border/40 overflow-hidden aspect-square sm:aspect-auto sm:min-h-[110px]">
      
      {/* LIGHT MODE: Soft large pastel background block */}
      <div className={cn("absolute inset-x-2 top-2 bottom-12 rounded-[1rem] opacity-100 dark:opacity-0 transition-opacity", styles.bg)} />

      {/* DARK MODE: Top ambient glow */}
      <div className={cn("absolute inset-x-0 -top-4 h-16 blur-xl opacity-0 dark:opacity-[0.15] transition-opacity group-hover:dark:opacity-[0.2]", styles.glow)} />
      
      <div className="relative mb-1 sm:mb-2 flex flex-col items-center justify-center">
        {/* DARK MODE: Glow behind icon container */}
        <div className={cn("absolute inset-0 blur-md opacity-0 dark:opacity-30", styles.glow)} />
        
        {/* Icon container */}
        <div className={cn("relative flex size-10 items-center justify-center rounded-xl sm:size-[42px] sm:rounded-2xl", styles.bg)}>
          <Icon className={cn("size-5 sm:size-[22px]", styles.icon)} strokeWidth={2} />
        </div>
      </div>
      
      <span className="relative text-center text-[10px] font-bold text-foreground sm:text-[11.5px] tracking-tight leading-tight z-10 px-0.5">
        {title}
      </span>
      <span className="relative mt-0.5 text-center text-[8px] font-medium text-muted-foreground sm:text-[9.5px] z-10 hidden sm:block">
        {desc}
      </span>
    </Link>
  )
}

function FilterChip({
  label,
  active,
  icon: Icon,
  onClick,
}: {
  label: string
  active?: boolean
  icon?: React.ElementType
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-bold transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-card text-muted-foreground shadow-soft border border-border/50 hover:bg-muted"
      )}
    >
      {Icon && <Icon className="size-3.5" strokeWidth={2.5} />}
      {label}
    </button>
  )
}

function FileItem({
  name,
  size,
  date,
  icon: Icon,
  color,
  image,
  href = "#",
}: {
  name: string
  size: string
  date: string
  icon: React.ElementType
  color: string
  image?: string
  href?: string
}) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft sm:p-4 border border-border/50 hover:bg-muted/50 transition-colors">
      <div
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-xl overflow-hidden",
          color,
          image ? "bg-transparent p-0" : ""
        )}
      >
        {image ? (
          <img src={image} alt={name} className="size-full object-cover" />
        ) : (
          <Icon className="size-6" strokeWidth={2.5} />
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center min-w-0">
        <h4 className="truncate text-xs font-bold text-foreground sm:text-sm">{name}</h4>
        <p className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground sm:text-xs">
          {size} • {date}
        </p>
      </div>
      <button className="flex size-8 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground">
        <MoreVertical className="size-5" />
      </button>
    </Link>
  )
}

export function Dashboard() {
  const [activeFilter, setActiveFilter] = useState("All")
  const hydrated = useHydrated()
  const { notes } = useNotes()
  const { tasks } = useTasks()
  const { bookmarks } = useBookmarks()

  const recentItems = hydrated
    ? [
        ...notes.map((n) => ({ ...n, type: "Note", icon: FileText, color: "bg-rose-500/10 text-rose-600 dark:text-rose-400", href: "/tools/notes" })),
        ...tasks.map((t) => ({ ...t, type: "Task", icon: ListTodo, color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400", href: "/tools/todo" })),
        ...bookmarks.map((b) => ({ ...b, type: "Bookmark", icon: Bookmark, color: "bg-teal-500/10 text-teal-600 dark:text-teal-400", href: "/tools/bookmarks" })),
      ]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : []

  const filteredItems = recentItems
    .filter((item) => {
      if (activeFilter === "All") return true
      if (activeFilter === "Notes") return item.type === "Note"
      if (activeFilter === "Tasks") return item.type === "Task"
      if (activeFilter === "Links") return item.type === "Bookmark"
      return true
    })
    .slice(0, 5)

  return (
    <div className="min-h-screen pb-32 font-sans">
      <div className="mx-auto max-w-4xl">


        {/* Banner */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#215DF1] via-[#6159FF] to-[#FFA0D9] p-6 text-white shadow-xl sm:p-8">
          {/* Decorative floating elements */}
          <div className="absolute -right-4 -top-8 size-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-16 right-16 size-48 rounded-full bg-pink-400/30 blur-2xl" />

          {/* Abstract 3D blocks (simplified with CSS for exact vibe) */}
          <div className="absolute -right-2 top-2 h-full w-1/2 pointer-events-none opacity-90 hidden sm:block">
            {/* These simulate the 3D items in the image */}
            <div className="absolute right-4 top-4 rotate-12 rounded-xl bg-white/20 p-4 backdrop-blur-md border border-white/30 shadow-lg">
              <FileText className="size-10 text-white" />
            </div>
            <div className="absolute right-24 top-20 -rotate-6 rounded-xl bg-blue-400/40 p-3 backdrop-blur-md border border-white/20 shadow-lg">
              <ImageIcon className="size-8 text-white" />
            </div>
          </div>

          <div className="relative z-10 w-full sm:w-2/3">
            <h2 className="text-[22px] font-bold leading-tight drop-shadow-md sm:text-3xl md:text-4xl tracking-tight">
              Edit. Convert. Scan.<br />Manage. Share.
            </h2>
            <p className="mt-2 text-xs font-medium text-blue-50 opacity-90 sm:text-sm drop-shadow">
              All your files, in one place.
            </p>
            <Link href="/" className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-xs font-bold text-blue-700 shadow-lg hover:bg-blue-50 transition-colors sm:text-sm">
              Explore Tools <ArrowRight className="size-[14px]" strokeWidth={2.5} />
            </Link>
          </div>
        </div>

        {/* Popular Tools */}
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between px-1">
            <h3 className="text-lg font-bold text-foreground tracking-tight">Popular Tools</h3>
            <Link href="/tools" className="flex min-h-10 items-center gap-0.5 rounded-full bg-card px-3.5 text-xs font-bold text-muted-foreground shadow-soft hover:text-foreground transition-colors border border-border/50">
              View All <ChevronRight className="size-3" strokeWidth={3} />
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
            <ToolCard
              icon={FileText}
              color="rose"
              title="Text to PDF"
              desc="Notes to PDF"
              href="/tools/text-to-pdf"
            />
            <ToolCard
              icon={ImageIcon}
              color="blue"
              title="Image to PDF"
              desc="Convert Images"
              href="/tools/image-to-pdf"
            />
            <ToolCard
              icon={Scan}
              color="emerald"
              title="OCR"
              desc="Extract Text"
              href="/tools/ocr"
            />
            <ToolCard
              icon={Repeat}
              color="sky"
              title="Resize Image"
              desc="Dimensions"
              href="/tools/image-resizer"
            />
            <ToolCard
              icon={RefreshCw}
              color="violet"
              title="AI Writer"
              desc="Draft & Edit"
              href="/tools/ai-writer"
            />
            <ToolCard
              icon={LayoutGrid}
              color="pink"
              title="Summarizer"
              desc="TL;DR Text"
              href="/tools/summarizer"
            />
            <ToolCard
              icon={Shrink}
              color="amber"
              title="SecureShare"
              desc="Private Links"
              href="/tools/secure-share"
            />
            <ToolCard
              icon={MoreHorizontal}
              color="slate"
              title="More Tools"
              desc="Find More"
              href="/tools"
            />
          </div>
        </div>

        {/* Recent Files */}
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between px-1">
            <h3 className="text-lg font-bold text-foreground tracking-tight">Recent Activity</h3>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar px-1 -mx-1">
            <FilterChip label="All" active={activeFilter === "All"} onClick={() => setActiveFilter("All")} />
            <FilterChip label="Notes" active={activeFilter === "Notes"} onClick={() => setActiveFilter("Notes")} />
            <FilterChip label="Tasks" active={activeFilter === "Tasks"} onClick={() => setActiveFilter("Tasks")} />
            <FilterChip label="Links" active={activeFilter === "Links"} onClick={() => setActiveFilter("Links")} />
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {!hydrated ? (
              <div className="p-4 text-center text-sm text-muted-foreground animate-pulse">Loading recent activity...</div>
            ) : filteredItems.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No recent activity yet.</div>
            ) : (
              filteredItems.map((item) => (
                <FileItem
                  key={item.id}
                  name={item.title}
                  size={item.type}
                  date={new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(item.createdAt))}
                  icon={item.icon}
                  color={item.color}
                  href={item.href}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
