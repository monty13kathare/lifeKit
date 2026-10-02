"use client"

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { detectEncodableFormats, type ImageMime } from "@/lib/image/formats"

/**
 * Create object URLs from event handlers and have every one revoked when the
 * component unmounts. Call `revoke` when an individual URL is no longer shown.
 */
export function useObjectUrls() {
  const urls = useRef(new Set<string>())
  useEffect(() => {
    const set = urls.current
    return () => {
      set.forEach((u) => URL.revokeObjectURL(u))
      set.clear()
    }
  }, [])
  const create = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob)
    urls.current.add(url)
    return url
  }, [])
  const revoke = useCallback((url: string | null | undefined) => {
    if (!url) return
    URL.revokeObjectURL(url)
    urls.current.delete(url)
  }, [])
  return useMemo(() => ({ create, revoke }), [create, revoke])
}

let encodableCache: ImageMime[] | null = null
const SERVER_FORMATS: ImageMime[] = ["image/jpeg", "image/png"]
const noopSubscribe = () => () => {}

/** Output formats this browser can encode (JPG/PNG always; WebP/AVIF when supported). */
export function useEncodableFormats(): ImageMime[] {
  return useSyncExternalStore(
    noopSubscribe,
    () => (encodableCache ??= detectEncodableFormats()),
    () => SERVER_FORMATS
  )
}

let idCounter = 0
export function nextId(prefix = "img") {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`
}
