"use client"

import { useSyncExternalStore } from "react"

export function useMediaQuery(query: string, serverFallback = false): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query)
      mq.addEventListener("change", cb)
      return () => mq.removeEventListener("change", cb)
    },
    () => window.matchMedia(query).matches,
    () => serverFallback
  )
}

/** Tailwind `lg` breakpoint — desktop layout with sidebar. */
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)")
/** Tailwind `sm` breakpoint and up. */
export const useIsTabletUp = () => useMediaQuery("(min-width: 640px)")
