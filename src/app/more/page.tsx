import type { Metadata } from "next"
import Link from "next/link"
import { Bell, ChevronRight, GraduationCap, Info, NotebookPen, Settings, ShieldCheck } from "lucide-react"
import { InstallCard } from "@/components/layout/install-card"

export const metadata: Metadata = { title: "More" }

const LINKS = [
  { href: "/learn", label: "Learn Skills", description: "AI prompting, English and logic practice", icon: GraduationCap },
  { href: "/settings", label: "Settings", description: "Theme, profile, dashboard and data", icon: Settings },
  { href: "/tools/reminders", label: "Reminders", description: "Local reminders and notifications", icon: Bell },
  { href: "/tools/notes", label: "Notes", description: "Saved notes and extracted text", icon: NotebookPen },
  { href: "/settings#privacy", label: "Privacy", description: "How LifeKit handles your data", icon: ShieldCheck },
]

export default function MorePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">More</h1>
      <InstallCard />
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {LINKS.map(({ href, label, description, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60">
              <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-foreground">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block truncate text-sm text-muted-foreground">{description}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Info className="size-3.5" aria-hidden /> LifeKit v0.1 · Frontend-only · Your data stays on this device
      </p>
    </div>
  )
}
