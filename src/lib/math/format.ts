/** Number formatting helpers shared by the calculators. */

/** `en-IN` grouping (1,50,000) when the currency is ₹, otherwise `en-US`. */
export function localeForCurrency(currency: string): string {
  return currency.trim() === "₹" ? "en-IN" : "en-US"
}

/**
 * Format a calculated number for display: removes floating-point noise
 * (0.1 + 0.2 → 0.3), groups thousands, and switches to scientific notation
 * for very large or very small magnitudes.
 */
export function formatNumber(n: number, locale = "en-IN", maxFractionDigits = 10): string {
  if (!Number.isFinite(n)) return n > 0 ? "∞" : n < 0 ? "−∞" : "—"
  if (n === 0) return "0"
  const abs = Math.abs(n)
  if (abs >= 1e15 || abs < 1e-9) {
    return n.toExponential(8).replace(/\.?0+e/, "e").replace("e+", "e")
  }
  const cleaned = Number(n.toPrecision(12))
  return cleaned.toLocaleString(locale, { maximumFractionDigits: maxFractionDigits })
}

/** Money with currency symbol, 2 decimals max (0 when whole and `compactWhole`). */
export function formatMoney(n: number, currency: string, opts: { decimals?: number } = {}): string {
  if (!Number.isFinite(n)) return "—"
  const decimals = opts.decimals ?? 2
  const locale = localeForCurrency(currency)
  const sign = n < 0 ? "−" : ""
  const body = Math.abs(n).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: decimals })
  return `${sign}${currency}${body}`
}

/** Percent with up to `digits` decimals. */
export function formatPercent(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—"
  return `${Number(n.toFixed(digits)).toLocaleString("en-US", { maximumFractionDigits: digits })}%`
}

/**
 * Parse a user-typed number: tolerates thousands separators, spaces and a
 * leading currency symbol. Returns `null` for empty input and `NaN` for junk.
 */
export function parseNumberInput(raw: string): number | null {
  const s = raw.replace(/[\s,₹$€£]/g, "").replace(/[−–]/g, "-")
  if (s === "") return null
  if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return NaN
  return Number(s)
}
