"use client"

import Link from "next/link"
import { CalendarCheck, Download, Ellipsis, GraduationCap, HeartPulse, Pencil, Settings, ShieldCheck, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useInstall } from "@/components/layout/install-context"
import { useLearnFun, useSettings } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { levelInfo, liveDayStreak } from "@/lib/learn/fun"

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
}

const ITEM = "min-h-10 gap-3 rounded-lg px-2.5"

export function ProfileMenu() {
  const { settings } = useSettings()
  const { stats } = useLearnFun()
  const { canInstall, promptInstall } = useInstall()
  const hydrated = useHydrated()
  const name = hydrated ? settings.displayName.trim() : ""
  const level = levelInfo(hydrated ? stats.xp : 0)
  const streak = hydrated ? liveDayStreak(stats) : 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" aria-label="Profile menu" />}>
        <span className="flex size-8 items-center justify-center rounded-full bg-linear-to-br from-primary to-fuchsia-500 text-sm font-semibold text-white shadow-sm ring-2 ring-background">
          {name ? initials(name).slice(0, 1) : <UserRound className="size-4.5" aria-hidden />}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(18rem,calc(100vw-1.5rem))] p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0">
            <div className="flex items-center gap-3 rounded-xl bg-linear-to-br from-primary/15 to-fuchsia-500/10 p-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-fuchsia-500 text-lg font-semibold text-white">
                {name ? initials(name).slice(0, 1) : <UserRound className="size-5" aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{name || "Welcome!"}</span>
                <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-success" aria-hidden /> Data stays on this device
                </span>
              </span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-center">
              <span className="rounded-lg bg-muted px-2 py-1.5">
                <span className="block text-sm font-semibold text-foreground tabular-nums">Lv {level.level}</span>
                <span className="block text-[0.7rem] font-normal text-muted-foreground tabular-nums">{hydrated ? stats.xp : 0} XP</span>
              </span>
              <span className="rounded-lg bg-muted px-2 py-1.5">
                <span className="block text-sm font-semibold text-foreground tabular-nums">🔥 {streak}</span>
                <span className="block text-[0.7rem] font-normal text-muted-foreground">day streak</span>
              </span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        {!name && (
          <DropdownMenuItem className={`${ITEM} mt-1 text-primary`} render={<Link href="/settings" />}>
            <Pencil className="size-4" aria-hidden /> Add your name
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className={ITEM} render={<Link href="/my-life" />}>
          <CalendarCheck className="size-4" aria-hidden /> My Day
        </DropdownMenuItem>
        <DropdownMenuItem className={ITEM} render={<Link href="/learn" />}>
          <GraduationCap className="size-4" aria-hidden /> Learn with Fun
        </DropdownMenuItem>
        <DropdownMenuItem className={ITEM} render={<Link href="/tools/wellness" />}>
          <HeartPulse className="size-4" aria-hidden /> Wellness
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={ITEM} render={<Link href="/settings" />}>
          <Settings className="size-4" aria-hidden /> Settings
        </DropdownMenuItem>
        {canInstall && (
          <DropdownMenuItem className={ITEM} onClick={() => void promptInstall()}>
            <Download className="size-4" aria-hidden /> Install app
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className={ITEM} render={<Link href="/settings#privacy" />}>
          <ShieldCheck className="size-4" aria-hidden /> Privacy
        </DropdownMenuItem>
        <DropdownMenuItem className={ITEM} render={<Link href="/more" />}>
          <Ellipsis className="size-4" aria-hidden /> More
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
