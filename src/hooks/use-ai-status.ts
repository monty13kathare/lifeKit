"use client"

import { useEffect, useState } from "react"
import { fetchAiStatus, type AiStatus } from "@/lib/ai/client"

/** `null` while checking; then whether Gemini is configured on the server. */
export function useAiStatus(): AiStatus | null {
  const [status, setStatus] = useState<AiStatus | null>(null)
  useEffect(() => {
    let alive = true
    void fetchAiStatus().then((s) => alive && setStatus(s))
    return () => {
      alive = false
    }
  }, [])
  return status
}
