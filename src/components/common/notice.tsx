import { CircleAlert, Info, TriangleAlert, CircleCheck, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type Tone = "info" | "warning" | "danger" | "success"

const tones: Record<Tone, { icon: LucideIcon; className: string }> = {
  info: { icon: Info, className: "border-info/25 bg-info/8 [&_svg]:text-info" },
  warning: { icon: TriangleAlert, className: "border-warning/35 bg-warning/10 [&_svg]:text-warning-foreground dark:[&_svg]:text-warning" },
  danger: { icon: CircleAlert, className: "border-destructive/30 bg-destructive/8 [&_svg]:text-destructive" },
  success: { icon: CircleCheck, className: "border-success/30 bg-success/8 [&_svg]:text-success" },
}

interface NoticeProps {
  tone?: Tone
  title?: string
  children?: React.ReactNode
  icon?: LucideIcon
  action?: React.ReactNode
  className?: string
}

/** Inline callout for status, limitations and disclaimers. */
export function Notice({ tone = "info", title, children, icon, action, className }: NoticeProps) {
  const Icon = icon ?? tones[tone].icon
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-xl border p-3.5 text-sm sm:p-4", tones[tone].className, className)}
    >
      <Icon className="mt-0.5 size-4.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="text-muted-foreground [&_a]:underline">{children}</div> : null}
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </div>
  )
}

/**
 * Standard "your browser can't do this" message with an alternative workflow,
 * e.g. <UnsupportedNotice feature="camera access" alternative="Please upload an image instead." />
 */
export function UnsupportedNotice({
  feature,
  alternative,
  action,
  className,
}: {
  feature: string
  alternative?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <Notice tone="warning" title={`This browser does not support ${feature}.`} action={action} className={className}>
      {alternative}
    </Notice>
  )
}
