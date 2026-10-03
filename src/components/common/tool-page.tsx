import Link from "next/link"
import { ChevronLeft, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { getTool } from "@/data/tools"

interface ToolPageProps {
  /** Registry id from `src/data/tools.ts`; supplies the title, description and icon. */
  toolId: string
  /** Override the registry description. */
  description?: string
  /** Show the "processed in your browser" privacy badge. */
  privacy?: boolean | string
  /** Header-right actions (e.g. a "New task" button). */
  actions?: React.ReactNode
  /** Content width: narrow for forms/calculators, wide for workspaces/editors. */
  width?: "narrow" | "default" | "wide" | "full"
  backHref?: string
  className?: string
  children: React.ReactNode
}

const widths = {
  narrow: "max-w-2xl",
  default: "max-w-5xl",
  wide: "max-w-7xl",
  full: "max-w-none",
}

/**
 * Standard tool layout: header → description → content. Tool content follows
 * the input → controls → preview → result → actions order inside `children`.
 */
export function ToolPage({
  toolId,
  description,
  privacy,
  actions,
  width = "default",
  backHref,
  className,
  children,
}: ToolPageProps) {
  const tool = getTool(toolId)
  const Icon = tool.icon
  const back = backHref ?? (tool.section === "life" ? "/my-life" : tool.section === "learn" ? "/learn" : "/tools")
  return (
    <div className={cn("mx-auto w-full", widths[width], className)}>
      <header className="mb-5 flex items-start gap-3 sm:mb-6 sm:gap-4">
        <Link
          href={back}
          aria-label="Back"
          className="-ml-2 mt-1.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className={cn("hidden size-12 shrink-0 items-center justify-center rounded-2xl lg:flex", tool.accent)}>
          <Icon className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-[1.75rem]">{tool.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">{description ?? tool.description}</p>
          {privacy ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
              <ShieldCheck className="size-3.5" aria-hidden />
              {typeof privacy === "string" ? privacy : "Your files are processed in your browser"}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2 pt-1">{actions}</div> : null}
      </header>
      {children}
    </div>
  )
}
