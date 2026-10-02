/**
 * Session-only helpers for scan tools. Uses sessionStorage (cleared when the
 * tab closes) and never persists scans to long-term storage.
 */
import { useSyncExternalStore } from "react"

export const OCR_HANDOFF_KEY = "lifekit:ocr-handoff"
const HISTORY_KEY = "lifekit:scan-history"
const MAX_HISTORY = 50

export interface ScanHistoryItem {
  id: string
  value: string
  format: string
  source: "camera" | "image"
  at: string
}

type Listener = () => void
const listeners = new Set<Listener>()
let cache: ScanHistoryItem[] | null = null
const EMPTY: ScanHistoryItem[] = []

function read(): ScanHistoryItem[] {
  if (cache) return cache
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY)
    cache = raw ? (JSON.parse(raw) as ScanHistoryItem[]) : []
  } catch {
    cache = []
  }
  return cache
}

function write(items: ScanHistoryItem[]) {
  cache = items
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(items))
  } catch {
    /* in-memory only */
  }
  listeners.forEach((l) => l())
}

export const scanHistory = {
  get: read,
  add(item: Omit<ScanHistoryItem, "id" | "at">) {
    const items = read()
    // Collapse immediate duplicates (same code scanned twice in a row).
    if (items[0]?.value === item.value && items[0]?.format === item.format) return
    const next: ScanHistoryItem = { ...item, id: Math.random().toString(36).slice(2), at: new Date().toISOString() }
    write([next, ...items].slice(0, MAX_HISTORY))
  },
  remove(id: string) {
    write(read().filter((i) => i.id !== id))
  },
  clear() {
    write([])
  },
  subscribe(l: Listener) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

export function useScanHistory(): ScanHistoryItem[] {
  return useSyncExternalStore(scanHistory.subscribe, read, () => EMPTY)
}

/** Hand an image (data URL) to the OCR page. Returns false if storage is full/blocked. */
export function setOcrHandoff(dataUrl: string): boolean {
  try {
    sessionStorage.setItem(OCR_HANDOFF_KEY, dataUrl)
    return true
  } catch {
    return false
  }
}

export function takeOcrHandoff(): string | null {
  try {
    const v = sessionStorage.getItem(OCR_HANDOFF_KEY)
    if (v) sessionStorage.removeItem(OCR_HANDOFF_KEY)
    return v && v.startsWith("data:image/") ? v : null
  } catch {
    return null
  }
}
