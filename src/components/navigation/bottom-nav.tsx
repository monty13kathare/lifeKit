"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { activeNavHref, MOBILE_NAV } from "./nav-config"

export function BottomNav() {
  const pathname = usePathname()
  // Learn has no bottom-bar slot on mobile; it lives under More.
  const active = activeNavHref(pathname) === "/learn" ? "/more" : activeNavHref(pathname)

  return (
    <nav
      aria-label="Main Navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-background/90 pb-safe backdrop-blur-xl supports-backdrop-filter:bg-background/80 shadow-lg lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 items-center px-1">
        {MOBILE_NAV.map(({ href, label, icon: Icon, isFab }) => {
          const isActive = href === "/tools/todo"
            ? pathname === "/tools/todo"
            : active === href

          if (isFab) {
            return (
              <li key={href} className="flex justify-center">
                <Link
                  href={href}
                  aria-label="Go to Tasks"
                  className="group relative -translate-y-2 flex flex-col items-center justify-center active:scale-95 transition-transform"
                >
                  <span
                    className={cn(
                      "flex size-12 items-center justify-center rounded-2xl text-white shadow-md transition-all group-hover:scale-105 group-hover:shadow-lg ring-4 ring-background",
                      isActive
                        ? "bg-gradient-to-tr from-emerald-500 via-teal-500 to-emerald-600 shadow-emerald-500/40 group-hover:shadow-emerald-500/50"
                        : "bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-500 shadow-emerald-500/35 group-hover:shadow-emerald-500/45"
                    )}
                  >
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <span
                    className={cn(
                      "mt-1 text-[10px] font-semibold transition-colors",
                      isActive ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/80 group-hover:text-emerald-500"
                    )}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            )
          }

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative flex h-14 flex-col items-center justify-center gap-1 transition-all active:scale-95",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {/* Active Indicator Background */}
                <div
                  className={cn(
                    "flex h-7 w-11 items-center justify-center rounded-xl transition-all",
                    isActive ? "bg-primary/15 text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  <Icon className="size-4.5 transition-transform group-hover:scale-110" aria-hidden />
                </div>

                <span
                  className={cn(
                    "text-[10px] tracking-tight transition-all",
                    isActive ? "font-bold text-primary" : "font-medium text-muted-foreground"
                  )}
                >
                  {label}
                </span>

                {/* Subtle active pip */}
                {isActive && (
                  <motion.span
                    layoutId="active-nav-dot"
                    className="absolute -bottom-0.5 size-1 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
