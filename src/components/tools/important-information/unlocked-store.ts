"use client"

import { useSyncExternalStore } from "react"

/**
 * Decrypted secrets for sensitive entries, held ONLY in memory for this page
 * session (cleared on reload or "Lock again"). Never persisted anywhere.
 */
export interface UnlockedSecret {
  details: string
  notes: string
  /** Kept in memory so edits can be re-encrypted without asking again. */
  passphrase: string
}

let state = new Map<string, UnlockedSecret>()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const EMPTY = new Map<string, UnlockedSecret>()

export const unlockedStore = {
  set(id: string, secret: UnlockedSecret) {
    state = new Map(state).set(id, secret)
    emit()
  },
  lock(id: string) {
    if (!state.has(id)) return
    const next = new Map(state)
    next.delete(id)
    state = next
    emit()
  },
  lockAll() {
    state = new Map()
    emit()
  },
}

export function useUnlocked(): Map<string, UnlockedSecret> {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
    () => EMPTY
  )
}
