/** Form schemas and payload builders for the QR generator. */
import { z } from "zod"
import { buildVcf } from "./payload"

export type QrContentType = "url" | "text" | "contact" | "wifi" | "email" | "phone" | "sms" | "location" | "file"

export type FormValues = Record<string, string | boolean>

const phoneRe = /^\+?[\d\s().-]{3,32}$/

function isHttpUrl(v: string) {
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`)
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".")
  } catch {
    return false
  }
}

export function normalizeUrl(v: string) {
  const t = v.trim()
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`
}

const optionalEmail = z
  .string()
  .trim()
  .refine((v) => !v || z.email().safeParse(v).success, "Enter a valid email address")
const optionalPhone = z
  .string()
  .trim()
  .refine((v) => !v || phoneRe.test(v), "Enter a valid phone number")

export const schemas = {
  url: z.object({
    url: z.string().trim().min(1, "Enter a link").refine(isHttpUrl, "Enter a valid web address, e.g. https://example.com"),
  }),
  text: z.object({
    text: z.string().min(1, "Enter some text").max(2900, "Text is too long for a QR code"),
  }),
  contact: z
    .object({
      firstName: z.string().trim().max(80),
      lastName: z.string().trim().max(80),
      phone: optionalPhone,
      email: optionalEmail,
      org: z.string().trim().max(120),
      title: z.string().trim().max(120),
      website: z
        .string()
        .trim()
        .refine((v) => !v || isHttpUrl(v), "Enter a valid web address"),
      address: z.string().trim().max(200),
      note: z.string().trim().max(300),
    })
    .refine((v) => v.firstName || v.lastName || v.org, { message: "Enter a name or organisation", path: ["firstName"] }),
  wifi: z
    .object({
      ssid: z.string().min(1, "Enter the network name").max(32, "Network names are at most 32 characters"),
      encryption: z.enum(["WPA", "WEP", "nopass"]),
      password: z.string().max(63, "Wi-Fi passwords are at most 63 characters"),
      hidden: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (v.encryption === "nopass") return
      if (!v.password) ctx.addIssue({ code: "custom", message: "Enter the password", path: ["password"] })
      else if (v.encryption === "WPA" && v.password.length < 8)
        ctx.addIssue({ code: "custom", message: "WPA passwords are at least 8 characters", path: ["password"] })
    }),
  email: z.object({
    to: z.email("Enter a valid email address"),
    subject: z.string().max(200),
    body: z.string().max(1500),
  }),
  phone: z.object({
    phone: z.string().trim().regex(phoneRe, "Enter a valid phone number"),
  }),
  sms: z.object({
    phone: z.string().trim().regex(phoneRe, "Enter a valid phone number"),
    message: z.string().max(1000),
  }),
  location: z.object({
    lat: z
      .string()
      .trim()
      .min(1, "Enter a latitude")
      .transform(Number).pipe(z.number({ error: "Latitude must be a number" }).min(-90, "Latitude is between -90 and 90").max(90, "Latitude is between -90 and 90")),
    lng: z
      .string()
      .trim()
      .min(1, "Enter a longitude")
      .transform(Number).pipe(z.number({ error: "Longitude must be a number" }).min(-180, "Longitude is between -180 and 180").max(180, "Longitude is between -180 and 180")),
  }),
} as const

export const DEFAULTS: Record<Exclude<QrContentType, "file">, FormValues> = {
  url: { url: "" },
  text: { text: "" },
  contact: { firstName: "", lastName: "", phone: "", email: "", org: "", title: "", website: "", address: "", note: "" },
  wifi: { ssid: "", encryption: "WPA", password: "", hidden: false },
  email: { to: "", subject: "", body: "" },
  phone: { phone: "" },
  sms: { phone: "", message: "" },
  location: { lat: "", lng: "" },
}

function wifiEscape(v: string) {
  return v.replace(/([\\;,:"])/g, "\\$1")
}

export interface BuildResult {
  payload: string | null
  errors: Record<string, string>
}

export function buildPayload(type: Exclude<QrContentType, "file">, values: FormValues): BuildResult {
  const parsed = schemas[type].safeParse(values)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_")
      if (!errors[key]) errors[key] = issue.message
    }
    return { payload: null, errors }
  }
  const v = parsed.data as Record<string, string | number | boolean>
  const s = (k: string) => String(v[k] ?? "").trim()
  let payload = ""
  switch (type) {
    case "url":
      payload = normalizeUrl(s("url"))
      break
    case "text":
      payload = String(v.text)
      break
    case "contact": {
      const name = [s("firstName"), s("lastName")].filter(Boolean).join(" ")
      const vcf = buildVcf({
        name: name || s("org"),
        org: s("org") || undefined,
        title: s("title") || undefined,
        phones: s("phone") ? [s("phone")] : [],
        emails: s("email") ? [s("email")] : [],
        urls: s("website") ? [normalizeUrl(s("website"))] : [],
        address: s("address") || undefined,
        note: s("note") || undefined,
      })
      // Use the structured N field properly (last;first).
      payload = vcf.replace(/^N:.*$/m, `N:${s("lastName").replace(/[;,]/g, " ")};${s("firstName").replace(/[;,]/g, " ")};;;`)
      break
    }
    case "wifi":
      payload = `WIFI:T:${v.encryption};S:${wifiEscape(String(v.ssid))};${v.encryption === "nopass" ? "" : `P:${wifiEscape(String(v.password))};`}${v.hidden ? "H:true;" : ""};`
      break
    case "email": {
      const params: string[] = []
      if (s("subject")) params.push(`subject=${encodeURIComponent(s("subject"))}`)
      if (String(v.body ?? "")) params.push(`body=${encodeURIComponent(String(v.body))}`)
      payload = `mailto:${s("to")}${params.length ? `?${params.join("&")}` : ""}`
      break
    }
    case "phone":
      payload = `tel:${s("phone").replace(/[\s().-]/g, "")}`
      break
    case "sms":
      payload = `SMSTO:${s("phone").replace(/[\s().-]/g, "")}:${String(v.message ?? "")}`
      break
    case "location":
      payload = `geo:${Number(v.lat).toFixed(6).replace(/\.?0+$/, "")},${Number(v.lng).toFixed(6).replace(/\.?0+$/, "")}`
      break
  }
  return { payload, errors: {} }
}

// ---- File types --------------------------------------------------------------
export type FileKind = "pdf" | "image" | "video" | "audio"
export type FileMode = "hosted" | "embed" | "local"

export const FILE_KINDS: Record<FileKind, { label: string; accept: string[]; extensions: string[]; hint: string }> = {
  pdf: { label: "PDF", accept: ["application/pdf"], extensions: ["pdf"], hint: "PDF" },
  image: {
    label: "Image",
    accept: ["image/*"],
    extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp", "heic"],
    hint: "PNG, JPG, GIF, WebP, SVG",
  },
  video: { label: "Video", accept: ["video/*"], extensions: ["mp4", "webm", "mov", "m4v", "ogv", "mkv"], hint: "MP4, WebM, MOV" },
  audio: { label: "Audio", accept: ["audio/*"], extensions: ["mp3", "wav", "ogg", "m4a", "aac", "flac", "opus", "oga"], hint: "MP3, WAV, OGG, M4A" },
}

export interface HostedCheck {
  error?: string
  warning?: string
  url?: string
}

/** Validate a pasted link to a hosted file against the chosen file type. */
export function checkHostedUrl(raw: string, kind: FileKind): HostedCheck {
  const t = raw.trim()
  if (!t) return { error: "Paste a link to your file" }
  if (!isHttpUrl(t)) return { error: "Enter a valid https:// link" }
  const url = new URL(normalizeUrl(t))
  const ext = url.pathname.split(".").pop()?.toLowerCase() ?? ""
  const hasExt = url.pathname.includes(".") && ext.length <= 5
  const matches = FILE_KINDS[kind].extensions.includes(ext)
  if (hasExt && !matches) {
    const other = (Object.keys(FILE_KINDS) as FileKind[]).find((k) => FILE_KINDS[k].extensions.includes(ext))
    if (other) return { error: `This link ends in .${ext}, which is ${FILE_KINDS[other].label.toLowerCase() === "image" ? "an image" : `a ${FILE_KINDS[other].label.toLowerCase()}`}, not ${kind === "image" ? "an image" : `a ${FILE_KINDS[kind].label}`}.` }
  }
  const warning = !matches
    ? "We can't confirm the file type from this link. Make sure it opens the file directly and is shared publicly."
    : url.protocol === "http:"
      ? "This link isn't https — some phones will warn before opening it."
      : undefined
  return { url: url.href, warning }
}
