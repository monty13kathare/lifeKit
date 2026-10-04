/**
 * Parse decoded QR/barcode text into structured payloads for display, and
 * build the files (vCard / iCalendar) that the result actions download.
 * Everything is treated as untrusted text — never rendered as HTML.
 */
import { analyzeUrl, looksLikeUrl, type UrlAnalysis } from "./url-safety"

export interface WifiPayload {
  type: "wifi"
  ssid: string
  password: string
  encryption: string
  hidden: boolean
}

export interface ContactPayload {
  type: "contact"
  name: string
  org?: string
  title?: string
  phones: string[]
  emails: string[]
  urls: string[]
  address?: string
  note?: string
  vcf: string
}

/** A calendar date/time from an iCalendar property. */
export interface IcsDate {
  /** Raw iCalendar value, e.g. 20261010T090000, 20261010T090000Z or 20261010. */
  raw: string
  date: Date
  allDay: boolean
  /** True when the value ended in Z (UTC); false for floating local time. */
  utc: boolean
}

export interface EventPayload {
  type: "event"
  summary: string
  start?: IcsDate
  end?: IcsDate
  location?: string
  description?: string
  ics: string
}

export interface UpiPayload {
  type: "upi"
  /** Payee VPA, e.g. name@bank. */
  vpa: string
  name?: string
  amount?: string
  currency?: string
  note?: string
  /** The original upi:// link, used for "Open in UPI app". */
  url: string
}

export interface WhatsAppPayload {
  type: "whatsapp"
  /** International number (digits only) or empty when the link lets you pick a chat. */
  number: string
  text?: string
  url: string
  analysis: UrlAnalysis
}

export type Payload =
  | { type: "url"; url: string; analysis: UrlAnalysis }
  | WifiPayload
  | ContactPayload
  | EventPayload
  | UpiPayload
  | WhatsAppPayload
  | { type: "email"; to: string; subject?: string; body?: string }
  | { type: "phone"; number: string }
  | { type: "sms"; number: string; body?: string }
  | { type: "geo"; lat: number; lng: number; query?: string }
  | { type: "text"; text: string }

export const PAYLOAD_LABELS: Record<Payload["type"], string> = {
  url: "Link",
  wifi: "Wi-Fi network",
  contact: "Contact",
  event: "Calendar event",
  upi: "UPI payment",
  whatsapp: "WhatsApp chat",
  email: "Email",
  phone: "Phone number",
  sms: "Text message",
  geo: "Location",
  text: "Text",
}

// ---- Escaped key:value lists (WIFI / MECARD / MATMSG) -------------------------

/** Split on separators that aren't escaped with a backslash; keeps escapes intact. */
function splitUnescaped(body: string, sep: string): string[] {
  const out: string[] = []
  let cur = ""
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (ch === "\\" && i + 1 < body.length) {
      cur += ch + body[++i]
      continue
    }
    if (ch === sep) {
      out.push(cur)
      cur = ""
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

// Escaping inside the WIFI/MECARD payload must be preserved for the key split,
// so we split on unescaped ';' first, then unescape values.
function splitEscaped(body: string): Array<[string, string]> {
  const out: Array<[string, string]> = []
  for (const seg of splitUnescaped(body, ";")) {
    const idx = seg.indexOf(":")
    if (idx <= 0) continue
    out.push([seg.slice(0, idx).trim().toUpperCase(), seg.slice(idx + 1).replace(/\\(.)/g, "$1")])
  }
  return out
}

function parseWifi(text: string): WifiPayload {
  const fields = splitEscaped(text.replace(/^WIFI:/i, ""))
  const get = (k: string) => fields.find(([key]) => key === k)?.[1] ?? ""
  const t = get("T").toUpperCase()
  return {
    type: "wifi",
    ssid: get("S"),
    password: get("P"),
    encryption: t === "NOPASS" || !t ? (get("P") ? "WPA/WPA2" : "None (open)") : t === "WEP" ? "WEP" : t.includes("SAE") ? "WPA3" : "WPA/WPA2",
    hidden: /^true$/i.test(get("H")),
  }
}

// ---- vCard ---------------------------------------------------------------------

/** vCard 3.0 / iCalendar TEXT escaping: backslash, comma, semicolon, newline. */
export function escapeText(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;")
}

function unescapeText(v: string) {
  return v.replace(/\\(n|N|,|;|\\|:)/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c))
}

export interface VcfInput extends Omit<ContactPayload, "type" | "vcf"> {
  /** Structured name parts; when omitted they are guessed from `name`. */
  firstName?: string
  lastName?: string
}

export function buildVcf(c: VcfInput): string {
  const fn = c.name || c.org || "Unnamed"
  let first = c.firstName
  let last = c.lastName
  if (first === undefined && last === undefined) {
    const parts = (c.name || "").trim().split(/\s+/).filter(Boolean)
    first = parts.length > 1 ? parts.slice(0, -1).join(" ") : (parts[0] ?? "")
    last = parts.length > 1 ? parts[parts.length - 1] : ""
  }
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${escapeText(last ?? "")};${escapeText(first ?? "")};;;`, `FN:${escapeText(fn)}`]
  if (c.org) lines.push(`ORG:${escapeText(c.org)}`)
  if (c.title) lines.push(`TITLE:${escapeText(c.title)}`)
  c.phones.forEach((p) => lines.push(`TEL;TYPE=CELL:${escapeText(p)}`))
  c.emails.forEach((e) => lines.push(`EMAIL:${escapeText(e)}`))
  c.urls.forEach((u) => lines.push(`URL:${escapeText(u)}`))
  if (c.address) lines.push(`ADR:;;${escapeText(c.address)};;;;`)
  if (c.note) lines.push(`NOTE:${escapeText(c.note)}`)
  lines.push("END:VCARD")
  return lines.join("\r\n")
}

function parseMecard(text: string): ContactPayload {
  const fields = splitEscaped(text.replace(/^MECARD:/i, ""))
  const all = (k: string) => fields.filter(([key]) => key === k).map(([, v]) => v).filter(Boolean)
  const rawName = all("N")[0] ?? ""
  // MECARD names are "Last,First".
  const [last = "", first = ""] = rawName.split(",").map((s) => s.trim())
  const name = rawName.includes(",") ? [first, last].filter(Boolean).join(" ") : rawName
  const c: Omit<ContactPayload, "type" | "vcf"> = {
    name,
    org: all("ORG")[0],
    title: all("TITLE")[0],
    phones: all("TEL"),
    emails: all("EMAIL"),
    urls: all("URL"),
    address: all("ADR")[0],
    note: [all("NOTE")[0], all("BDAY")[0] ? `Birthday: ${all("BDAY")[0]}` : ""].filter(Boolean).join("\n") || undefined,
  }
  const names = rawName.includes(",") ? { firstName: first, lastName: last } : {}
  return { type: "contact", ...c, vcf: buildVcf({ ...c, ...names }) }
}

/** Unfold RFC 5545 / 6350 continuation lines and split into lines. */
function unfold(text: string): string[] {
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n|\r/)
}

/** Parse "KEY;PARAM=X:value" — the value starts after the first ':' outside quotes. */
function contentLine(line: string): { key: string; params: string; value: string } | null {
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') inQuote = !inQuote
    else if (ch === ":" && !inQuote) {
      const head = line.slice(0, i)
      const [key, ...params] = head.split(";")
      return { key: key.toUpperCase().replace(/^ITEM\d+\./, ""), params: params.join(";").toUpperCase(), value: line.slice(i + 1) }
    }
  }
  return null
}

function parseVcard(text: string): ContactPayload {
  const c: Omit<ContactPayload, "type" | "vcf"> = { name: "", phones: [], emails: [], urls: [] }
  let structuredName = ""
  for (const line of unfold(text)) {
    const cl = contentLine(line)
    if (!cl || !cl.value.trim()) continue
    const raw = cl.value.trim()
    const parts = () => splitUnescaped(raw, ";").map((p) => unescapeText(p).trim())
    const value = unescapeText(raw)
    switch (cl.key) {
      case "FN":
        c.name = value
        break
      case "N": {
        // Family;Given;Additional;Prefix;Suffix → "Prefix Given Additional Family Suffix"
        const [family = "", given = "", additional = "", prefix = "", suffix = ""] = parts()
        structuredName = [prefix, given, additional, family, suffix].filter(Boolean).join(" ")
        break
      }
      case "ORG":
        c.org = parts().filter(Boolean).join(" · ")
        break
      case "TITLE":
        c.title = value
        break
      case "TEL":
        c.phones.push(value.replace(/^tel:/i, ""))
        break
      case "EMAIL":
        c.emails.push(value)
        break
      case "URL":
        c.urls.push(value)
        break
      case "ADR":
        c.address = parts().filter(Boolean).join(", ")
        break
      case "NOTE":
        c.note = value
        break
    }
  }
  if (!c.name) c.name = structuredName
  return { type: "contact", ...c, vcf: text.includes("\r\n") ? text : text.replace(/\r?\n/g, "\r\n") }
}

// ---- iCalendar event -------------------------------------------------------------

export function parseIcsDate(value: string, params = ""): IcsDate | undefined {
  const v = value.trim()
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v)
  if (!m) return undefined
  const [, y, mo, d, h, mi, s, z] = m
  const allDay = !h || (params.includes("VALUE=DATE") && !params.includes("VALUE=DATE-TIME"))
  const date = allDay
    ? new Date(Number(y), Number(mo) - 1, Number(d))
    : z
      ? new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0)))
      : new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0))
  if (Number.isNaN(date.getTime())) return undefined
  return { raw: v, date, allDay, utc: !!z }
}

/** Wrap a bare VEVENT in a VCALENDAR (with UID/DTSTAMP) so calendar apps import it. */
export function buildIcsFile(vevent: string): string {
  const lines = unfold(vevent).filter((l) => l.trim() && !/^(BEGIN|END):VCALENDAR$/i.test(l) && !/^(VERSION|PRODID|CALSCALE|METHOD):/i.test(l))
  const start = lines.findIndex((l) => /^BEGIN:VEVENT$/i.test(l))
  const end = lines.findIndex((l) => /^END:VEVENT$/i.test(l))
  const body = start >= 0 && end > start ? lines.slice(start + 1, end) : lines
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  if (!body.some((l) => /^UID[:;]/i.test(l))) body.unshift(`UID:${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}@lifekit`)
  if (!body.some((l) => /^DTSTAMP[:;]/i.test(l))) body.unshift(`DTSTAMP:${stamp}`)
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LifeKit//Scan//EN", "BEGIN:VEVENT", ...body, "END:VEVENT", "END:VCALENDAR", ""].join("\r\n")
}

function parseEvent(text: string): EventPayload {
  const e: Omit<EventPayload, "type" | "ics"> = { summary: "" }
  let inEvent = !/BEGIN:VEVENT/i.test(text)
  for (const line of unfold(text)) {
    if (/^BEGIN:VEVENT$/i.test(line.trim())) {
      inEvent = true
      continue
    }
    if (/^END:VEVENT$/i.test(line.trim())) break
    if (!inEvent) continue
    const cl = contentLine(line)
    if (!cl) continue
    const value = unescapeText(cl.value.trim())
    switch (cl.key) {
      case "SUMMARY":
        e.summary = value
        break
      case "DTSTART":
        e.start = parseIcsDate(cl.value, cl.params)
        break
      case "DTEND":
        e.end = parseIcsDate(cl.value, cl.params)
        break
      case "LOCATION":
        e.location = value || undefined
        break
      case "DESCRIPTION":
        e.description = value || undefined
        break
    }
  }
  return { type: "event", ...e, ics: buildIcsFile(text) }
}

// ---- URL-like payloads -------------------------------------------------------------

function safeDecode(v: string, plusIsSpace = true) {
  try {
    return decodeURIComponent(plusIsSpace ? v.replace(/\+/g, " ") : v)
  } catch {
    return v
  }
}

function parseQuery(q: string, plusIsSpace = true): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of q.split("&")) {
    const [k, ...v] = part.split("=")
    if (k) out[k.toLowerCase()] = safeDecode(v.join("="), plusIsSpace)
  }
  return out
}

function parseUpi(text: string): UpiPayload | null {
  const q = text.replace(/^upi:\/\/pay\/?\??/i, "")
  // UPI links encode spaces as %20; a literal '+' can be part of a note, so keep it.
  const p = parseQuery(q, false)
  if (!p.pa) return null
  return { type: "upi", vpa: p.pa, name: p.pn || undefined, amount: p.am || undefined, currency: p.cu || undefined, note: p.tn || undefined, url: text }
}

function parseWhatsApp(text: string): WhatsAppPayload | null {
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "")
  let number = ""
  if (host === "wa.me") number = u.pathname.replace(/^\/+|\/+$/g, "")
  else if (host === "api.whatsapp.com" || host === "whatsapp.com") {
    if (!/^\/send\/?$/.test(u.pathname)) return null
    number = u.searchParams.get("phone") ?? ""
  } else return null
  if (number && !/^\+?\d{6,15}$/.test(number)) return null
  return { type: "whatsapp", number: number.replace(/^\+/, ""), text: u.searchParams.get("text") || undefined, url: text, analysis: analyzeUrl(text) }
}

export function parsePayload(raw: string): Payload {
  const text = raw.trim()
  if (/^WIFI:/i.test(text)) return parseWifi(text)
  if (/^MECARD:/i.test(text)) return parseMecard(text)
  if (/^BEGIN:VCARD/i.test(text)) return parseVcard(text)
  if (/^BEGIN:(VEVENT|VCALENDAR)/i.test(text) && /BEGIN:VEVENT/i.test(text)) return parseEvent(text)
  if (/^upi:\/\/pay/i.test(text)) {
    const upi = parseUpi(text)
    if (upi) return upi
  }
  if (/^mailto:/i.test(text)) {
    const [addr, q = ""] = text.slice(7).split("?")
    const params = parseQuery(q, false)
    return { type: "email", to: safeDecode(addr, false), subject: params.subject, body: params.body }
  }
  if (/^MATMSG:/i.test(text)) {
    const f = splitEscaped(text.slice(7))
    const get = (k: string) => f.find(([key]) => key === k)?.[1]
    return { type: "email", to: get("TO") ?? "", subject: get("SUB"), body: get("BODY") }
  }
  if (/^MEBKM:/i.test(text)) {
    const f = splitEscaped(text.slice(6))
    const url = f.find(([key]) => key === "URL")?.[1]
    if (url && looksLikeUrl(url)) return { type: "url", url, analysis: analyzeUrl(url) }
  }
  if (/^tel:/i.test(text)) return { type: "phone", number: safeDecode(text.slice(4), false) }
  if (/^SMSTO:/i.test(text)) {
    const [, number = "", ...body] = text.split(":")
    return { type: "sms", number, body: body.join(":") || undefined }
  }
  if (/^sms:/i.test(text)) {
    const rest = text.slice(4)
    // Either RFC 5724 "sms:+123?body=hi" or the older "SMS:+123:hi".
    if (rest.includes("?")) {
      const [num, q = ""] = rest.split("?")
      return { type: "sms", number: safeDecode(num, false), body: parseQuery(q, false).body }
    }
    const [num = "", ...body] = rest.split(":")
    return { type: "sms", number: safeDecode(num, false), body: body.join(":") || undefined }
  }
  if (/^geo:/i.test(text)) {
    const [coords, q = ""] = text.slice(4).split("?")
    const [lat, lng] = coords.split(";")[0].split(",").map(Number)
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180)
      return { type: "geo", lat, lng, query: parseQuery(q).q }
  }
  if (looksLikeUrl(text)) {
    const wa = parseWhatsApp(text)
    if (wa) return wa
    return { type: "url", url: text, analysis: analyzeUrl(text) }
  }
  return { type: "text", text: raw }
}
