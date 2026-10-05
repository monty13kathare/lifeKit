import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { Tool } from "@/data/tools"
import { cn } from "@/lib/utils"

interface ToolCardProps {
  tool: Tool
  /** `row` = compact list row (mobile lists), `tile` = card with description. */
  variant?: "tile" | "row" | "quick"
  className?: string
}

export function ToolCard({ tool, variant = "tile", className }: ToolCardProps) {
  const Icon = tool.icon

  if (variant === "quick") {
    return (
      <Link
        href={tool.href}
        className={cn(
          "group flex flex-col items-center gap-2 rounded-2xl p-2 text-center transition-transform active:scale-95",
          className
        )}
      >
        <span
          className={cn(
            "flex size-14 items-center justify-center rounded-2xl transition-shadow group-hover:shadow-soft sm:size-16",
            tool.accent
          )}
        >
          <Icon className="size-6 sm:size-7" aria-hidden />
        </span>
        <span className="text-xs font-medium sm:text-sm">{tool.name}</span>
      </Link>
    )
  }

  if (variant === "row") {
    return (
      <Link
        href={tool.href}
        className={cn(
          "flex min-h-16 items-center gap-3 rounded-2xl border bg-card p-3 transition-colors hover:bg-muted/60 active:bg-muted",
          className
        )}
      >
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", tool.accent)}>
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{tool.name}</span>
          <span className="block truncate text-sm text-muted-foreground">{tool.description}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    )
  }

  return (
    <Link
      href={tool.href}
      className={cn(
        "group flex h-full flex-col gap-2.5 rounded-2xl border bg-card p-3 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft sm:gap-3 sm:p-5",
        className
      )}
    >
      <span className={cn("flex size-10 items-center justify-center rounded-xl sm:size-11", tool.accent)}>
        <Icon className="size-4.5 sm:size-5" aria-hidden />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold sm:text-base sm:font-medium">{tool.name}</span>
        <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:line-clamp-none sm:mt-0.5 sm:text-sm sm:leading-snug">{tool.description}</span>
      </span>
    </Link>
  )
}
