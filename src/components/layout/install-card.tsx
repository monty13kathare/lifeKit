"use client"

import { Download, Share, SquarePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LogoMark } from "@/components/common/logo"
import { useHydrated } from "@/hooks/use-store"
import { useInstall } from "./install-context"

/** Permanent install entry point for Settings/More (unaffected by banner dismissal). */
export function InstallCard() {
  const { canInstall, isStandalone, isIOS, promptInstall } = useInstall()
  const hydrated = useHydrated()
  if (!hydrated || isStandalone || (!canInstall && !isIOS)) return null

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center">
      <LogoMark className="size-12 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Install LifeKit</p>
        {canInstall ? (
          <p className="text-sm text-muted-foreground">Faster access, app-like experience and a home-screen shortcut.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            In Safari, tap <Share className="inline size-3.5 align-[-2px]" aria-label="Share" /> then{" "}
            <span className="whitespace-nowrap">
              <SquarePlus className="inline size-3.5 align-[-2px]" aria-hidden /> Add to Home Screen
            </span>
            .
          </p>
        )}
      </div>
      {canInstall && (
        <Button onClick={() => void promptInstall()}>
          <Download /> Install
        </Button>
      )}
    </div>
  )
}
