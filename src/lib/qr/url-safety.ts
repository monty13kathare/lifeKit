/** Heuristic checks for links decoded from QR codes. Pure, no network. */

export interface UrlWarning {
  id: string
  message: string
  severity: "caution" | "danger"
}

export interface UrlAnalysis {
  url: URL | null
  /** Safe to offer an "Open" button (http/https only). */
  openable: boolean
  /** Scheme that must never be opened (javascript:, data:, …). */
  blocked: boolean
  warnings: UrlWarning[]
  hostname: string
  /** Display parts so the hostname can be highlighted. */
  parts: { before: string; host: string; after: string } | null
}

const SHORTENERS = new Set([
  "bit.ly", "bitly.com", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly",
  "shorturl.at", "rb.gy", "t.ly", "tiny.cc", "lnkd.in", "s.id", "v.gd", "qr.ae", "trib.al", "bl.ink", "short.io",
  "soo.gd", "clck.ru", "u.to", "x.co", "youtu.be", "amzn.to", "shorturl.com", "qrco.de", "qr.net", "linktr.ee",
])

const RISKY_TLDS = new Set(["zip", "mov", "top", "xyz", "click", "country", "gq", "tk", "ml", "cf", "ga", "work", "loan", "rest"])
const LOOKALIKE_TLDS = new Set(["zip", "mov"])
const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "vbscript:", "file:", "blob:", "about:", "chrome:", "intent:"])

export function looksLikeUrl(text: string): boolean {
  const t = text.trim()
  if (/\s/.test(t)) return false
  if (/^www\.[^\s]+\.[a-z]{2,}/i.test(t)) return true
  if (/^(mailto|tel|sms|smsto|geo|wifi|mecard|begin|matmsg|bitcoin):/i.test(t)) return false
  return /^[a-z][a-z0-9+.-]*:/i.test(t)
}

export function analyzeUrl(raw: string): UrlAnalysis {
  const text = raw.trim()
  const warnings: UrlWarning[] = []
  const scheme = /^www\./i.test(text) ? "" : (/^([a-z][a-z0-9+.-]*:)/i.exec(text)?.[1] ?? "").toLowerCase()

  if (BLOCKED_SCHEMES.has(scheme)) {
    return {
      url: null,
      openable: false,
      blocked: true,
      hostname: "",
      parts: null,
      warnings: [
        {
          id: "scheme",
          severity: "danger",
          message: `This code contains a “${scheme}” link. These can run code or hide content, so LifeKit will never open it.`,
        },
      ],
    }
  }

  let url: URL | null = null
  try {
    url = new URL(scheme ? text : `https://${text}`)
  } catch {
    return { url: null, openable: false, blocked: false, hostname: "", parts: null, warnings: [] }
  }

  const protocol = url.protocol
  const openable = protocol === "https:" || protocol === "http:"
  const host = url.hostname.toLowerCase()

  if (!openable) {
    warnings.push({ id: "scheme", severity: "caution", message: `Uses the “${protocol}” scheme, which may open another app.` })
  }
  if (protocol === "http:") {
    warnings.push({ id: "http", severity: "caution", message: "Not encrypted (http, not https). Don't enter passwords or payment details." })
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) {
    warnings.push({ id: "ip", severity: "danger", message: "Points to a raw IP address instead of a domain name — common in phishing." })
  }
  if (host.split(".").some((l) => l.startsWith("xn--")) || /[^ -~]/.test(text)) {
    warnings.push({ id: "punycode", severity: "danger", message: "Uses international characters (punycode) that can imitate a familiar site's name." })
  }
  if (url.username || url.password || /^[a-z]+:\/\/[^/]*@/i.test(text)) {
    warnings.push({ id: "at", severity: "danger", message: "Contains “@” before the domain — the real destination is the part after it." })
  }
  if (SHORTENERS.has(host) || SHORTENERS.has(host.replace(/^www\./, ""))) {
    warnings.push({ id: "shortener", severity: "caution", message: "This is a link shortener. The final destination is hidden until you open it." })
  }
  const tld = host.split(".").pop() ?? ""
  if (LOOKALIKE_TLDS.has(tld)) {
    warnings.push({ id: "tld", severity: "danger", message: `The “.${tld}” domain ending looks like a file name and is often used to trick people.` })
  } else if (RISKY_TLDS.has(tld)) {
    warnings.push({ id: "tld", severity: "caution", message: `The “.${tld}” domain ending is frequently used by spam and scam sites.` })
  }
  const labels = host.split(".").filter(Boolean)
  if (labels.length >= 5) {
    warnings.push({ id: "subdomains", severity: "caution", message: "Has many subdomains — check the real domain at the end of the hostname." })
  }
  if (text.length > 200) {
    warnings.push({ id: "long", severity: "caution", message: `Very long link (${text.length} characters), which can hide where it really goes.` })
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    warnings.push({ id: "port", severity: "caution", message: `Uses an unusual port (${url.port}).` })
  }

  const href = url.href
  const idx = href.indexOf(url.host)
  const parts = idx >= 0 ? { before: href.slice(0, idx), host: url.host, after: href.slice(idx + url.host.length) } : null

  return { url, openable, blocked: false, warnings, hostname: host, parts }
}

/** Open a link in a new tab with no opener/referrer. Only http(s). */
export function openExternal(url: URL | string) {
  const u = typeof url === "string" ? new URL(url) : url
  if (u.protocol !== "https:" && u.protocol !== "http:") return
  window.open(u.href, "_blank", "noopener,noreferrer")
}
