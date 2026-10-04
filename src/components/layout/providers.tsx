"use client"

import { useEffect } from "react"
import { ThemeProvider } from "next-themes"
import { MotionConfig } from "framer-motion"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ReminderScheduler } from "@/components/reminders/reminder-scheduler"
import { seedDemoDataIfNeeded } from "@/lib/storage/demo"
import { InstallProvider } from "./install-context"

function Bootstrap() {
  useEffect(() => {
    seedDemoDataIfNeeded()
    // Service worker only in production: dev chunks aren't content-hashed.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {})
    }
  }, [])
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          <InstallProvider>
            <Bootstrap />
            <ReminderScheduler />
            {children}
            <Toaster position="top-center" richColors closeButton />
          </InstallProvider>
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  )
}
