"use client"

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react"
import { useMediaQuery } from "@/hooks/use-media-query"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

interface InstallState {
  /** The browser offered an install prompt we can trigger. */
  canInstall: boolean
  /** Already running as an installed app. */
  isStandalone: boolean
  /** iOS Safari: no prompt API, but "Add to Home Screen" is available. */
  isIOS: boolean
  promptInstall(): Promise<"accepted" | "dismissed" | "unavailable">
}

const InstallContext = createContext<InstallState>({
  canInstall: false,
  isStandalone: false,
  isIOS: false,
  promptInstall: async () => "unavailable",
})

const noopSubscribe = () => () => {}
const detectIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)

export function InstallProvider({ children }: { children: React.ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const displayStandalone = useMediaQuery("(display-mode: standalone)")
  const iosStandalone = useSyncExternalStore(
    noopSubscribe,
    () => (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => false
  )
  const isStandalone = displayStandalone || iosStandalone
  const isIOS = useSyncExternalStore(noopSubscribe, detectIOS, () => false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setDeferred(null)
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferred) return "unavailable" as const
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    setDeferred(null)
    return outcome
  }, [deferred])

  return (
    <InstallContext.Provider value={{ canInstall: !!deferred && !isStandalone, isStandalone, isIOS, promptInstall }}>
      {children}
    </InstallContext.Provider>
  )
}

export const useInstall = () => useContext(InstallContext)
