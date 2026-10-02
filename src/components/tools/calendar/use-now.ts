"use client"

import { useMemo, useSyncExternalStore } from "react"

/*
 * A shared, low-frequency "current time" clock. Components re-render every
 * TICK ms (and when the tab becomes visible) instead of each running a timer.
 */

const TICK = 30_000
const listeners = new Set<() => void>()
let current = 0
let timer: number | undefined

function tick() {
  current = Date.now()
  listeners.forEach((l) => l())
}

function onVisible() {
  if (document.visibilityState === "visible") tick()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  if (listeners.size === 1) {
    current = Date.now()
    timer = window.setInterval(tick, TICK)
    document.addEventListener("visibilitychange", onVisible)
  }
  return () => {
    listeners.delete(cb)
    if (listeners.size === 0) {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }
}

function getSnapshot() {
  if (!current) current = Date.now()
  return current
}

const getServerSnapshot = () => 0

/** Current time, refreshed every 30 seconds. Returns the epoch during SSR — gate on `useHydrated()`. */
export function useNow(): Date {
  const ms = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return useMemo(() => new Date(ms), [ms])
}
