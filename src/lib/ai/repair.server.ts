import "server-only"
import type { z } from "zod"

/**
 * Make structured Gemini output usable instead of all-or-nothing:
 *  - parseLenientJson: recover JSON cut off by the output-token limit
 *  - salvage: drop the individual list items that break the schema, and give
 *    missing lists/strings an empty value, so one bad quiz question doesn't
 *    throw away a whole lesson
 *  - missingKeys: which top-level fields still fail, so the route can ask
 *    Gemini for just those
 */

/** Parse JSON; if it was truncated mid-way, close open strings/arrays/objects and parse what's there. */
export function parseLenientJson(raw: string): unknown {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  try {
    return JSON.parse(text)
  } catch {
    // fall through to repair
  }
  const stack: string[] = []
  let inString = false
  let escaped = false
  // Index just after the last point where the JSON was "complete enough" to cut.
  let lastSafe = -1
  let safeStack: string[] = []
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === "\\") escaped = true
      else if (c === '"') {
        inString = false
        lastSafe = i + 1
        safeStack = [...stack]
      }
      continue
    }
    if (c === '"') inString = true
    else if (c === "{" || c === "[") stack.push(c === "{" ? "}" : "]")
    else if (c === "}" || c === "]") {
      stack.pop()
      lastSafe = i + 1
      safeStack = [...stack]
    } else if (/[0-9el]/.test(c) && /[\s,\]}]/.test(text[i + 1] ?? " ")) {
      // end of a number / true / false / null
      lastSafe = i + 1
      safeStack = [...stack]
    }
  }
  if (lastSafe < 0) throw new SyntaxError("Unrecoverable JSON")
  // Cut at the last complete value and close everything that's still open. If the
  // cut lands right after an object key (`{"a": 1, "b"`), drop that dangling key too.
  const cut = text.slice(0, lastSafe).replace(/[,:\s]+$/, "")
  const withoutKey = cut.replace(/([{,])\s*"(?:[^"\\]|\\.)*"\s*$/, "$1").replace(/,\s*$/, "")
  const closers = safeStack.reverse().join("")
  for (const attempt of [cut + closers, withoutKey + closers]) {
    try {
      return JSON.parse(attempt)
    } catch {
      // try the next shape
    }
  }
  throw new SyntaxError("Unrecoverable JSON")
}

type Path = PropertyKey[]

const getAt = (root: unknown, path: Path): unknown =>
  path.reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<PropertyKey, unknown>)[k] : undefined), root)

function setAt(root: unknown, path: Path, value: unknown) {
  const parent = getAt(root, path.slice(0, -1))
  if (parent && typeof parent === "object") (parent as Record<PropertyKey, unknown>)[path[path.length - 1]] = value
}

/**
 * Repair `value` in place against `schema` for up to `rounds` passes:
 * an invalid element inside a list is removed; a missing list becomes [] and
 * a missing string "". Returns the (possibly still invalid) value.
 */
export function salvage<S extends z.ZodType>(schema: S, value: unknown, rounds = 40): unknown {
  const data = structuredClone(value)
  for (let round = 0; round < rounds; round++) {
    const res = schema.safeParse(data)
    if (res.success) return res.data
    let changed = false
    for (const issue of res.error.issues) {
      const path = issue.path as Path
      // Deepest list index on the path: drop that element.
      let idx = -1
      for (let i = path.length - 1; i >= 0; i--) {
        if (typeof path[i] === "number" && Array.isArray(getAt(data, path.slice(0, i)))) {
          idx = i
          break
        }
      }
      if (idx >= 0) {
        const list = getAt(data, path.slice(0, idx)) as unknown[]
        const at = path[idx] as number
        if (at < list.length) {
          list.splice(at, 1)
          changed = true
          break // indexes shifted: re-validate before touching more
        }
      }
      if (issue.code === "invalid_type" && getAt(data, path) === undefined) {
        const expected = (issue as { expected?: string }).expected
        if (expected === "array") setAt(data, path, [])
        else if (expected === "string") setAt(data, path, "")
        else continue
        changed = true
      }
    }
    if (!changed) return data
  }
  return data
}

/** Top-level fields of an object schema that still fail validation. */
export function failingKeys(schema: z.ZodType, value: unknown): string[] {
  const res = schema.safeParse(value)
  if (res.success) return []
  return [...new Set(res.error.issues.map((i) => String(i.path[0] ?? "")).filter(Boolean))]
}
