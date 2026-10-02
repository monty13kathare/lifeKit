"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { Logo } from "@/components/common/logo"
import { cn } from "@/lib/utils"
import { activeNavHref, DESKTOP_NAV } from "./nav-config"

export function Sidebar() {
  const pathname = usePathname()
  const active = activeNavHref(pathname)
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar lg:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/" className="rounded-lg" aria-label="LifeKit home">
          <Logo />
        </Link>
      </div>
      <nav aria-label="Main" className="flex-1 space-y-1 px-3 py-4">
        {DESKTOP_NAV.map(({ href, label, icon: Icon }) => {
          const isActive = active === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className={cn("size-5", isActive && "text-primary")} aria-hidden />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="m-3 rounded-xl bg-surface-muted p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="size-4 text-success" aria-hidden /> Private by design
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Files are processed in your browser. Your data is stored only on this device.
        </p>
      </div>
    </aside>
  )
}
