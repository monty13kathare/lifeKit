/**
 * Parse decoded QR/barcode text into structured payloads for display.
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

export type Payload =
  | { type: "url"; url: string; analysis: UrlAnalysis }
  | WifiPayload
  | ContactPayload
  | { type: "email"; to: string; subject?: string; body?: string }
  | { type: "phone"; number: string }
  | { type: "sms"; number: string; body?: string }
  | { type: "geo"; lat: number; lng: number; query?: string }
  | { type: "text"; text: string }

export const PAYLOAD_LABELS: Record<Payload["type"], string> = {
  url: "Link",
  wifi: "Wi-Fi network",
  contact: "Contact",
  email: "Email",
  phone: "Phone number",
  sms: "Text message",
  geo: "Location",
  text: "Text",
}

// Escaping inside the WIFI/MECARD payload must be preserved for the key split,
// so we split on unescaped ';' first, then unescape values.
function splitEscaped(body: string): Array<[string, string]> {
  const segments: string[] = []
  let cur = ""
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (ch === "\\" && i + 1 < body.length) {
      cur += ch + body[++i]
      continue
    }
    if (ch === ";") {
      segments.push(cur)
      cur = ""
      continue
    }
    cur += ch
  }
  segments.push(cur)
  const out: Array<[string, string]> = []
  for (const seg of segments) {
    const idx = seg.indexOf(":")
    if (idx <= 0) continue
    out.push([seg.slice(0, idx).toUpperCase(), seg.slice(idx + 1).replace(/\\(.)/g, "$1")])
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

function vcardEscape(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;")
}

export function buildVcf(c: Omit<ContactPayload, "type" | "vcf">): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${vcardEscape(c.name || "Unnamed")}`]
  const [first, ...rest] = (c.name || "").split(" ")
  lines.push(`N:${vcardEscape(rest.join(" "))};${vcardEscape(first ?? "")};;;`)
  if (c.org) lines.push(`ORG:${vcardEscape(c.org)}`)
  if (c.title) lines.push(`TITLE:${vcardEscape(c.title)}`)
  c.phones.forEach((p) => lines.push(`TEL;TYPE=CELL:${vcardEscape(p)}`))
  c.emails.forEach((e) => lines.push(`EMAIL:${vcardEscape(e)}`))
  c.urls.forEach((u) => lines.push(`URL:${vcardEscape(u)}`))
  if (c.address) lines.push(`ADR:;;${vcardEscape(c.address)};;;;`)
  if (c.note) lines.push(`NOTE:${vcardEscape(c.note)}`)
  lines.push("END:VCARD")
  return lines.join("\r\n")
}

function parseMecard(text: string): ContactPayload {
  const fields = splitEscaped(text.replace(/^MECARD:/i, ""))
  const all = (k: string) => fields.filter(([key]) => key === k).map(([, v]) => v).filter(Boolean)
  const rawName = all("N")[0] ?? ""
  const name = rawName.includes(",") ? rawName.split(",").reverse().join(" ").trim() : rawName
  const c = {
    name,
    org: all("ORG")[0],
    title: all("TITLE")[0],
    phones: all("TEL"),
    emails: all("EMAIL"),
    urls: all("URL"),
    address: all("ADR")[0],
    note: all("NOTE")[0],
  }
  return { type: "contact", ...c, vcf: buildVcf(c) }
}

function unescapeVcard(v: string) {
  return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1")
}

function parseVcard(text: string): ContactPayload {
  // Unfold continuation lines (RFC 6350 §3.2).
  const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/)
  const c: Omit<ContactPayload, "type" | "vcf"> = { name: "", phones: [], emails: [], urls: [] }
  let structuredName = ""
  for (const line of lines) {
    const idx = line.indexOf(":")
    if (idx <= 0) continue
    const key = line.slice(0, idx).split(";")[0].toUpperCase().replace(/^ITEM\d+\./, "")
    const value = unescapeVcard(line.slice(idx + 1).trim())
    if (!value) continue
    switch (key) {
      case "FN":
        c.name = value
        break
      case "N":
        structuredName = value.split(";").slice(0, 3).reverse().filter(Boolean).join(" ")
        break
      case "ORG":
        c.org = value.replace(/;/g, " ").trim()
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
        c.address = value.split(";").filter(Boolean).join(", ")
        break
      case "NOTE":
        c.note = value
        break
    }
  }
  if (!c.name) c.name = structuredName
  return { type: "contact", ...c, vcf: text.includes("\r\n") ? text : text.replace(/\n/g, "\r\n") }
}

function safeDecode(v: string, plusIsSpace = true) {
  try {
    return decodeURIComponent(plusIsSpace ? v.replace(/\+/g, " ") : v)
  } catch {
    return v
  }
}

function parseQuery(q: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of q.split("&")) {
    const [k, ...v] = part.split("=")
    if (k) out[k.toLowerCase()] = safeDecode(v.join("="))
  }
  return out
}

export function parsePayload(raw: string): Payload {
  const text = raw.trim()
  if (/^WIFI:/i.test(text)) return parseWifi(text)
  if (/^MECARD:/i.test(text)) return parseMecard(text)
  if (/^BEGIN:VCARD/i.test(text)) return parseVcard(text)
  if (/^mailto:/i.test(text)) {
    const [addr, q = ""] = text.slice(7).split("?")
    const params = parseQuery(q)
    return { type: "email", to: safeDecode(addr, false), subject: params.subject, body: params.body }
  }
  if (/^MATMSG:/i.test(text)) {
    const f = splitEscaped(text.slice(7))
    const get = (k: string) => f.find(([key]) => key === k)?.[1]
    return { type: "email", to: get("TO") ?? "", subject: get("SUB"), body: get("BODY") }
  }
  if (/^tel:/i.test(text)) return { type: "phone", number: safeDecode(text.slice(4), false) }
  if (/^SMSTO:/i.test(text)) {
    const [, number = "", ...body] = text.split(":")
    return { type: "sms", number, body: body.join(":") || undefined }
  }
  if (/^sms:/i.test(text)) {
    const [num, q = ""] = text.slice(4).split("?")
    return { type: "sms", number: safeDecode(num, false), body: parseQuery(q).body }
  }
  if (/^geo:/i.test(text)) {
    const [coords, q = ""] = text.slice(4).split("?")
    const [lat, lng] = coords.split(",").map(Number)
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { type: "geo", lat, lng, query: parseQuery(q).q }
  }
  if (looksLikeUrl(text)) return { type: "url", url: text, analysis: analyzeUrl(text) }
  return { type: "text", text: raw }
}
