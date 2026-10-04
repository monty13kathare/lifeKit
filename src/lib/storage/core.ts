/**
 * Centralised browser-local persistence for LifeKit.
 *
 * Every persisted domain (tasks, events, bookmarks…) is created through one of
 * the factories below so that localStorage access, JSON parsing, cross-tab
 * syncing and change notification live in exactly one place. UI code never
 * touches localStorage directly – it goes through the hooks in `src/hooks`.
 */

export const STORAGE_PREFIX = "lifekit:"

type Listener = () => void

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined"

function readKey<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key)
    return raw == null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

function writeKey<T>(key: string, value: T) {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
  } catch (err) {
    // Quota exceeded or storage disabled (e.g. private mode). Keep in-memory state.
    console.warn(`[LifeKit] Could not persist "${key}"`, err)
  }
}

export interface ValueStore<T> {
  key: string
  get(): T
  getServerSnapshot(): T
  set(next: T | ((prev: T) => T)): void
  reset(): void
  subscribe(listener: Listener): () => void
}

const registry = new Map<string, ValueStore<unknown>>()

export function createValueStore<T>(key: string, defaultValue: T): ValueStore<T> {
  let cache: T | undefined
  const listeners = new Set<Listener>()

  const load = (): T => {
    if (cache === undefined) cache = readKey(key, defaultValue)
    return cache
  }
  const emit = () => listeners.forEach((l) => l())

  const store: ValueStore<T> = {
    key,
    get: load,
    getServerSnapshot: () => defaultValue,
    set(next) {
      const value = typeof next === "function" ? (next as (prev: T) => T)(load()) : next
      cache = value
      writeKey(key, value)
      emit()
    },
    reset() {
      cache = defaultValue
      if (isBrowser()) window.localStorage.removeItem(STORAGE_PREFIX + key)
      emit()
    },
    subscribe(listener) {
      listeners.add(listener)
      const onStorage = (e: StorageEvent) => {
        if (e.key === STORAGE_PREFIX + key) {
          cache = undefined
          listener()
        }
      }
      if (isBrowser()) window.addEventListener("storage", onStorage)
      return () => {
        listeners.delete(listener)
        if (isBrowser()) window.removeEventListener("storage", onStorage)
      }
    },
  }
  registry.set(key, store as ValueStore<unknown>)
  return store
}

export interface Entity {
  id: string
  /** Seeded demo records are flagged so they can be removed in one go. */
  demo?: boolean
}

export interface CollectionStore<T extends Entity> extends ValueStore<T[]> {
  add(item: Omit<T, "id"> & { id?: string }): T
  update(id: string, patch: Partial<T> | ((prev: T) => T)): void
  remove(id: string): void
  upsert(item: T): void
  removeDemo(): void
}

export function createCollectionStore<T extends Entity>(key: string): CollectionStore<T> {
  const base = createValueStore<T[]>(key, [])
  const collection: CollectionStore<T> = {
    ...base,
    add(item) {
      const created = { ...item, id: item.id ?? createId() } as T
      base.set((prev) => [...prev, created])
      return created
    },
    update(id, patch) {
      base.set((prev) =>
        prev.map((it) =>
          it.id === id ? (typeof patch === "function" ? patch(it) : { ...it, ...patch }) : it
        )
      )
    },
    remove(id) {
      base.set((prev) => prev.filter((it) => it.id !== id))
    },
    upsert(item) {
      base.set((prev) =>
        prev.some((it) => it.id === item.id)
          ? prev.map((it) => (it.id === item.id ? item : it))
          : [...prev, item]
      )
    },
    removeDemo() {
      base.set((prev) => prev.filter((it) => !it.demo))
    },
  }
  registry.set(key, collection as unknown as ValueStore<unknown>)
  return collection
}

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** Every store created through the factories, for reset/demo removal. */
export function allStores(): ValueStore<unknown>[] {
  return [...registry.values()]
}

/** Wipe every `lifekit:` key from this browser and notify subscribers. */
export function resetAllData() {
  if (isBrowser()) {
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => window.localStorage.removeItem(k))
  }
  registry.forEach((store) => store.reset())
}

/* ------------------------------------------------------- Backup/restore */

export interface LifeKitBackup {
  app: "lifekit"
  version: 1
  exportedAt: string
  data: Record<string, unknown>
}

/** Snapshot of every store, for a backup file the user downloads. */
export function exportAllData(): LifeKitBackup {
  const data: Record<string, unknown> = {}
  registry.forEach((store, key) => {
    data[key] = store.get()
  })
  return { app: "lifekit", version: 1, exportedAt: new Date().toISOString(), data }
}

const sameShape = (a: unknown, b: unknown) =>
  Array.isArray(a) === Array.isArray(b) && (a === null || b === null || typeof a === typeof b)

/**
 * Restore a backup made by `exportAllData`. Only known stores are written, and
 * only when the value has the same shape as the store's data (array vs object).
 * Returns how many stores were restored; throws on a file that isn't a backup.
 */
export function importAllData(raw: unknown): number {
  const b = raw as Partial<LifeKitBackup> | null
  if (!b || b.app !== "lifekit" || b.version !== 1 || !b.data || typeof b.data !== "object" || Array.isArray(b.data)) {
    throw new Error("This isn't a LifeKit backup file.")
  }
  let restored = 0
  for (const [key, value] of Object.entries(b.data)) {
    const store = registry.get(key)
    if (!store || value === undefined || !sameShape(store.get(), value)) continue
    store.set(value)
    restored++
  }
  return restored
}
