import type { AiTextActionId } from "./actions"
import { settingsStore } from "@/lib/storage/settings"
import { assistInputLimit, type AssistContext, type AssistKind, type AssistOutput } from "./assist-schemas"

/**
 * Browser-side access to LifeKit's AI routes. The browser never sees the
 * Gemini API key — it only talks to this app's own /api routes.
 */

export interface AiStatus {
  configured: boolean
  provider: string
  model: string | null
}

let statusPromise: Promise<AiStatus> | null = null

/** Whether the server has a Gemini key. Cached for the page session. */
export function fetchAiStatus(): Promise<AiStatus> {
  if (!statusPromise) {
    statusPromise = fetch("/api/ai/status", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<AiStatus>) : Promise.reject(new Error(String(res.status)))))
      // Static hosting without the API routes, offline, etc. → treat as "not configured".
      .catch(() => ({ configured: false, provider: "Google Gemini", model: null }))
  }
  return statusPromise
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err
    throw new Error("Couldn't reach the AI service. Check your connection.")
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T
  if (!res.ok) throw new Error(data.error || `The AI service responded with an error (${res.status}).`)
  return data
}

export async function runAiTextAction(action: AiTextActionId, text: string, signal?: AbortSignal): Promise<string> {
  const data = await postJson<{ text: string }>("/api/ai/text", { action, text }, signal)
  return data.text
}

/** The user's local clock for resolving relative dates on the server. */
export function assistContext(now = new Date()): AssistContext {
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    now: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`,
    weekday: now.toLocaleDateString("en-US", { weekday: "long" }),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: settingsStore.get().aiLanguage === "hi" ? "hi" : "en",
  }
}

/**
 * Run a structured AI job (see `assist-schemas.ts`). Throws an Error with a
 * user-friendly message on failure. Only call when `useAiStatus()?.configured`.
 */
export async function aiAssist<K extends AssistKind>(kind: K, input: string, signal?: AbortSignal): Promise<AssistOutput<K>> {
  // Never truncate: cutting a JSON payload would corrupt it. Callers keep input within the limit.
  if (input.length > assistInputLimit(kind)) {
    throw new Error(`That's too long for this tool (max ${assistInputLimit(kind).toLocaleString()} characters). Please shorten it.`)
  }
  return postJson<AssistOutput<K>>("/api/ai/assist", { kind, input, context: assistContext() }, signal)
}
