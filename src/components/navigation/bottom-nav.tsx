"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { activeNavHref, MOBILE_NAV } from "./nav-config"

export function BottomNav() {
  const pathname = usePathname()
  const active = activeNavHref(pathname)

  return (
    <nav
      aria-label="Main Navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-background/90 pb-safe backdrop-blur-xl supports-backdrop-filter:bg-background/80 shadow-lg lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4 items-center px-1">
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
                      "flex size-14 items-center justify-center rounded-full text-white shadow-lg transition-all group-hover:scale-105 ring-[6px] ring-background",
                      "bg-[#6D4AFF] shadow-[#6D4AFF]/40"
                    )}
                  >
                    <Icon className="size-6" aria-hidden />
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
                  isActive ? "text-[#6D4AFF]" : "text-slate-400 hover:text-slate-600"
                )}
              >
                {/* Active Indicator Background */}
                <div className="flex h-7 items-center justify-center transition-all">
                  <Icon className="size-5 transition-transform group-hover:scale-110" strokeWidth={isActive ? 2.5 : 2} aria-hidden />
                </div>

                <span
                  className={cn(
                    "text-[9px] sm:text-[10px] tracking-tight transition-all",
                    isActive ? "font-bold text-[#6D4AFF]" : "font-medium text-slate-500"
                  )}
                >
                  {label}
                </span>

                {isActive && (
                  <motion.span
                    layoutId="active-nav-dot"
                    className="absolute -bottom-1 size-1 rounded-full bg-[#6D4AFF]"
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
