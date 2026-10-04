"use client"

import Link from "next/link"
import { Logo } from "@/components/common/logo"
import { ProfileMenu } from "./profile-menu"
import { ThemeToggle } from "./theme-toggle"
import { usePathname } from "next/navigation"

export function Header() {
  const pathname = usePathname()
  if (pathname === "/") return null

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 pt-safe backdrop-blur-lg supports-backdrop-filter:bg-background/70">
      <div className="flex h-14 items-center gap-2 px-4 sm:px-6 lg:h-16 lg:px-8">
        <Link href="/" className="rounded-lg lg:hidden" aria-label="LifeKit home">
          <Logo />
        </Link>
        <div className="flex-1" />
        <ThemeToggle />
        <ProfileMenu />
      </div>
    </header>
  )
}
