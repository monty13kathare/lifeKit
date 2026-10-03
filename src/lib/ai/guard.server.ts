import "server-only"
import { AiError } from "./gemini.server"

/**
 * Lightweight protection for the AI route handlers, which spend your Gemini
 * quota: only same-origin browser requests are accepted, and each client IP
 * gets a small per-minute budget. The limiter is in-memory, so it is
 * per-server-instance — add a shared store (e.g. Redis) if you deploy to
 * many instances.
 */

const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 20
const hits = new Map<string, number[]>()

export function assertSameOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site")
  if (fetchSite && fetchSite !== "same-origin") throw new AiError("Cross-site requests aren't allowed.", 403)
  const origin = request.headers.get("origin")
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  if (!origin || !host) throw new AiError("Missing request origin.", 403)
  try {
    if (new URL(origin).host !== host) throw new Error()
  } catch {
    throw new AiError("Cross-site requests aren't allowed.", 403)
  }
}

export function assertRateLimit(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local"
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    throw new AiError("Too many AI requests. Please wait a minute and try again.", 429)
  }
  recent.push(now)
  hits.set(ip, recent)
  // Keep the map from growing without bound.
  if (hits.size > 5000) for (const [key, times] of hits) if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key)
}

/** Standard JSON error response for route handlers. */
export function errorResponse(err: unknown): Response {
  const e = err instanceof AiError ? err : new AiError("Something went wrong.", 500)
  return Response.json({ error: e.message }, { status: e.status })
}

export async function readJson(request: Request, maxBytes = 64_000): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? 0)
  if (length > maxBytes) throw new AiError("The request is too large.", 413)
  const raw = await request.text()
  if (raw.length > maxBytes) throw new AiError("The request is too large.", 413)
  try {
    return JSON.parse(raw)
  } catch {
    throw new AiError("Invalid JSON body.", 400)
  }
}
