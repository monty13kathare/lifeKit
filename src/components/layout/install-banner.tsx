"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Download, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LogoMark } from "@/components/common/logo"
import { useSettings } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { useInstall } from "./install-context"

/** Non-intrusive "Install LifeKit" card. Dismissal is remembered in this browser. */
export function InstallBanner() {
  const { canInstall, promptInstall } = useInstall()
  const { settings, update } = useSettings()
  const hydrated = useHydrated()
  const [ready, setReady] = useState(false)

  // Give people a moment with the app before suggesting installation.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 8000)
    return () => clearTimeout(t)
  }, [])

  const show = hydrated && ready && canInstall && !settings.installPromptDismissed
  const dismiss = () => update({ installPromptDismissed: true })

  return (
    <AnimatePresence>
      {show && (
        <motion.aside
          role="dialog"
          aria-label="Install LifeKit"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 rounded-2xl border bg-popover p-4 shadow-soft sm:inset-x-auto sm:right-6 sm:w-96 lg:bottom-6"
        >
          <div className="flex gap-3">
            <LogoMark className="size-11 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Install LifeKit</p>
              <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                <li>Faster access from your home screen</li>
                <li>App-like, full-screen experience</li>
              </ul>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Dismiss install suggestion" onClick={dismiss}>
              <X />
            </Button>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              className="flex-1"
              onClick={async () => {
                const outcome = await promptInstall()
                if (outcome !== "accepted") dismiss()
              }}
            >
              <Download /> Install
            </Button>
            <Button variant="outline" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
