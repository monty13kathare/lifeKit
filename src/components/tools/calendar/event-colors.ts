import type { EventColor } from "@/types"

export interface ColorClasses {
  label: string
  /** Solid swatch / dot. */
  swatch: string
  /** Soft tinted surface with readable text (light + dark). */
  soft: string
  /** Hover state for `soft` surfaces. */
  softHover: string
  /** Left accent border colour. */
  border: string
  /** Text colour only. */
  text: string
  /** Focus/selection ring colour. */
  ring: string
}

/** Token-safe Tailwind classes for each EventColor (literal strings so Tailwind picks them up). */
export const EVENT_COLORS: Record<EventColor, ColorClasses> = {
  indigo: {
    label: "Indigo",
    swatch: "bg-indigo-500",
    soft: "bg-indigo-500/15 text-indigo-800 dark:bg-indigo-400/20 dark:text-indigo-200",
    softHover: "hover:bg-indigo-500/25 dark:hover:bg-indigo-400/30",
    border: "border-indigo-500",
    text: "text-indigo-700 dark:text-indigo-300",
    ring: "ring-indigo-500",
  },
  sky: {
    label: "Sky",
    swatch: "bg-sky-500",
    soft: "bg-sky-500/15 text-sky-800 dark:bg-sky-400/20 dark:text-sky-200",
    softHover: "hover:bg-sky-500/25 dark:hover:bg-sky-400/30",
    border: "border-sky-500",
    text: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-500",
  },
  emerald: {
    label: "Emerald",
    swatch: "bg-emerald-500",
    soft: "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-200",
    softHover: "hover:bg-emerald-500/25 dark:hover:bg-emerald-400/30",
    border: "border-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-500",
  },
  amber: {
    label: "Amber",
    swatch: "bg-amber-500",
    soft: "bg-amber-500/15 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200",
    softHover: "hover:bg-amber-500/25 dark:hover:bg-amber-400/30",
    border: "border-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-500",
  },
  rose: {
    label: "Rose",
    swatch: "bg-rose-500",
    soft: "bg-rose-500/15 text-rose-800 dark:bg-rose-400/20 dark:text-rose-200",
    softHover: "hover:bg-rose-500/25 dark:hover:bg-rose-400/30",
    border: "border-rose-500",
    text: "text-rose-700 dark:text-rose-300",
    ring: "ring-rose-500",
  },
  violet: {
    label: "Violet",
    swatch: "bg-violet-500",
    soft: "bg-violet-500/15 text-violet-800 dark:bg-violet-400/20 dark:text-violet-200",
    softHover: "hover:bg-violet-500/25 dark:hover:bg-violet-400/30",
    border: "border-violet-500",
    text: "text-violet-700 dark:text-violet-300",
    ring: "ring-violet-500",
  },
  slate: {
    label: "Slate",
    swatch: "bg-slate-500",
    soft: "bg-slate-500/15 text-slate-800 dark:bg-slate-400/20 dark:text-slate-200",
    softHover: "hover:bg-slate-500/25 dark:hover:bg-slate-400/30",
    border: "border-slate-500",
    text: "text-slate-700 dark:text-slate-300",
    ring: "ring-slate-500",
  },
}

export const EVENT_COLOR_KEYS = Object.keys(EVENT_COLORS) as EventColor[]

export const colorClasses = (c: EventColor | undefined) => EVENT_COLORS[c ?? "indigo"] ?? EVENT_COLORS.indigo
