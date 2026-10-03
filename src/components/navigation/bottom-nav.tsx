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
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
          const isActive = active === href
          const isScan = href === "/scan"

          if (isScan) {
            return (
              <li key={href} className="flex justify-center">
                <Link
                  href={href}
                  aria-label="Scan QR, barcodes and documents"
                  className="group relative -translate-y-2 flex flex-col items-center justify-center active:scale-95 transition-transform"
                >
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary via-indigo-500 to-violet-600 text-white shadow-md shadow-primary/35 transition-all group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-primary/40 ring-4 ring-background">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <span className="mt-1 text-[10px] font-semibold text-foreground/80 group-hover:text-primary">
                    Scan
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

