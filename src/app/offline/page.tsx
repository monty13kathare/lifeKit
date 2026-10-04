import type { Metadata } from "next"
import Link from "next/link"
import { Calculator, GraduationCap, ListTodo, NotebookPen, WifiOff } from "lucide-react"
import { RetryButton } from "./retry-button"

export const metadata: Metadata = { title: "Offline" }

const OFFLINE_LINKS = [
  { href: "/tools/todo", label: "Tasks", icon: ListTodo },
  { href: "/tools/notes", label: "Notes", icon: NotebookPen },
  { href: "/tools/calculators/smart", label: "Calculator", icon: Calculator },
  { href: "/learn", label: "Learn", icon: GraduationCap },
]

/** Served by the service worker when a page that was never opened is requested offline. */
export default function OfflinePage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-10 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <WifiOff className="size-8" aria-hidden />
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">You&apos;re offline</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page hasn&apos;t been opened on this device yet. Pages you&apos;ve used before still work offline, and your data stays saved
        here. AI features need a connection.
      </p>
      <RetryButton />
      <ul className="mt-8 grid w-full grid-cols-2 gap-3">
        {OFFLINE_LINKS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-4 font-medium transition-colors hover:bg-muted/60">
              <Icon className="size-5 text-primary" aria-hidden /> {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
