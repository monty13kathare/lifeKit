"use client"

import { useSyncExternalStore } from "react"
import type { ValueStore } from "@/lib/storage/core"

/** Subscribe a component to a LifeKit store. SSR/hydration render the default value. */
export function useStore<T>(store: ValueStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.getServerSnapshot)
}

const noopSubscribe = () => () => {}

/** `false` during SSR and hydration, `true` once running in the browser. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )
}
