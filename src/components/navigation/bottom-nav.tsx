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
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-safe backdrop-blur-lg supports-backdrop-filter:bg-background/75 lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
          const isActive = active === href
          const isScan = href === "/scan"
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {isScan ? (
                  <span className="flex size-11 -translate-y-1 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
                    <Icon className="size-5.5" aria-hidden />
                  </span>
                ) : (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="bottom-nav-pill"
                        className="absolute top-1.5 h-8 w-14 rounded-full bg-primary/10"
                        transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      />
                    )}
                    <Icon className="relative size-5.5" aria-hidden />
                  </>
                )}
                <span className={cn("relative", isScan && "-mt-1.5")}>{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
