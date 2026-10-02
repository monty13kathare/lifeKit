"use client"

import { useSyncExternalStore } from "react"

/**
 * Calculation history that lives only for the current browser session
 * (sessionStorage, cleared when the tab closes). Never written to localStorage.
 */
export interface HistoryEntry {
  id: string
  expression: string
  result: string
  /** Raw numeric result to re-use in a new expression. */
  raw: string
}

const KEY = "lifekit-session:calc-history"
const MAX = 50
const EMPTY: HistoryEntry[] = []
const listeners = new Set<() => void>()
let cache: HistoryEntry[] | null = null

function read(): HistoryEntry[] {
  if (cache) return cache
  try {
    const raw = window.sessionStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as HistoryEntry[]) : EMPTY
  } catch {
    cache = EMPTY
  }
  return cache
}

function write(next: HistoryEntry[]) {
  cache = next
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable – keep it in memory */
  }
  listeners.forEach((l) => l())
}

export function useSessionHistory() {
  const entries = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    read,
    () => EMPTY
  )
  return {
    entries,
    push(entry: Omit<HistoryEntry, "id">) {
      const prev = read()
      if (prev[0]?.expression === entry.expression) return
      write([{ ...entry, id: Math.random().toString(36).slice(2) }, ...prev].slice(0, MAX))
    },
    clear() {
      write(EMPTY)
    },
  }
}
