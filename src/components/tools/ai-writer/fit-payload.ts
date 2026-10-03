/**
 * Build a JSON payload whose serialized length fits `limit`, trimming `text`
 * if needed. `aiAssist` hard-slices its input string, which would otherwise cut
 * a long JSON payload mid-way (escaping makes JSON longer than the raw text).
 */
export function fitJsonPayload(build: (text: string) => unknown, text: string, limit: number): { json: string; trimmed: boolean } {
  let json = JSON.stringify(build(text))
  if (json.length <= limit) return { json, trimmed: false }
  let lo = 0
  let hi = text.length
  // Binary search the longest prefix that fits.
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (JSON.stringify(build(text.slice(0, mid))).length <= limit) lo = mid
    else hi = mid - 1
  }
  json = JSON.stringify(build(text.slice(0, lo)))
  return { json, trimmed: true }
}

/** Is this an abort from our own AbortController? */
export const isAbort = (err: unknown) => (err as Error)?.name === "AbortError"

export const errorMessage = (err: unknown, fallback = "Something went wrong. Please try again.") =>
  err instanceof Error && err.message ? err.message : fallback
