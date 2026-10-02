"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  Contact,
  Download,
  Eye,
  EyeOff,
  Info,
  Link as LinkIcon,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  TriangleAlert,
  Type,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/common/copy-button"
import { downloadText } from "@/lib/files"
import type { DetectedCode } from "@/lib/qr/detect"
import { formatLabel, is2D, productHints } from "@/lib/qr/formats"
import { PAYLOAD_LABELS, parsePayload, type Payload } from "@/lib/qr/payload"
import { cn } from "@/lib/utils"
import { ShareButton } from "./share-button"
import { UrlPreview } from "./url-preview"

const ICONS: Record<Payload["type"], LucideIcon> = {
  url: LinkIcon,
  wifi: Wifi,
  contact: Contact,
  email: Mail,
  phone: Phone,
  sms: MessageSquare,
  geo: MapPin,
  text: Type,
}

function Field({ label, value, copy, mono }: { label: string; value?: string; copy?: boolean; mono?: boolean }) {
  if (!value) return null
  return (
    <div className="flex items-start justify-between gap-3 border-b py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-sm wrap-break-word whitespace-pre-wrap", mono && "font-mono")}>{value}</p>
      </div>
      {copy ? <CopyButton value={value} iconOnly size="icon-sm" variant="ghost" label={`Copy ${label.toLowerCase()}`} /> : null}
    </div>
  )
}

function PasswordField({ value }: { value: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex items-start justify-between gap-2 border-b py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Password</p>
        <p className="font-mono text-sm break-all">{show ? value : "•".repeat(Math.min(value.length, 16))}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="icon-sm" variant="ghost" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow((s) => !s)}>
          {show ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
        <CopyButton value={value} iconOnly size="icon-sm" variant="ghost" label="Copy password" />
      </div>
    </div>
  )
}

const linkBtn =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3.5 text-sm font-medium hover:bg-muted dark:border-input dark:bg-input/30 [&_svg]:size-4"

function mailtoHref(to: string, subject?: string, body?: string) {
  const params: string[] = []
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`)
  if (body) params.push(`body=${encodeURIComponent(body)}`)
  return `mailto:${to.replace(/[^\w.@+,-]/g, "")}${params.length ? `?${params.join("&")}` : ""}`
}

/** Structured, text-only rendering of a decoded payload. */
export function PayloadView({ payload, raw }: { payload: Payload; raw: string }) {
  switch (payload.type) {
    case "url":
      return <UrlPreview raw={payload.url} analysis={payload.analysis} />
    case "wifi":
      return (
        <div className="space-y-3">
          <div className="rounded-xl border bg-surface px-3">
            <Field label="Network name (SSID)" value={payload.ssid || "(hidden name)"} copy={!!payload.ssid} />
            {payload.password ? <PasswordField value={payload.password} /> : null}
            <Field label="Security" value={payload.encryption} />
            {payload.hidden ? <Field label="Visibility" value="Hidden network" /> : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Browsers can&apos;t join Wi-Fi networks directly. Copy the password and pick “{payload.ssid}” in your device&apos;s Wi-Fi settings.
          </p>
        </div>
      )
    case "contact":
      return (
        <div className="space-y-3">
          <div className="rounded-xl border bg-surface px-3">
            <Field label="Name" value={payload.name} copy />
            <Field label="Organisation" value={[payload.title, payload.org].filter(Boolean).join(" · ")} />
            {payload.phones.map((p, i) => (
              <Field key={`p${i}`} label="Phone" value={p} copy />
            ))}
            {payload.emails.map((e, i) => (
              <Field key={`e${i}`} label="Email" value={e} copy />
            ))}
            {payload.urls.map((u, i) => (
              <Field key={`u${i}`} label="Website" value={u} copy />
            ))}
            <Field label="Address" value={payload.address} copy />
            <Field label="Note" value={payload.note} />
          </div>
          <Button
            variant="outline"
            onClick={() => downloadText(payload.vcf, `${(payload.name || "contact").replace(/[^\w.-]+/g, "_")}.vcf`, "text/vcard;charset=utf-8")}
          >
            <Download aria-hidden /> Download contact .vcf
          </Button>
        </div>
      )
    case "email":
      return (
        <div className="space-y-3">
          <div className="rounded-xl border bg-surface px-3">
            <Field label="To" value={payload.to} copy />
            <Field label="Subject" value={payload.subject} copy />
            <Field label="Message" value={payload.body} copy />
          </div>
          {payload.to ? (
            <a className={linkBtn} href={mailtoHref(payload.to, payload.subject, payload.body)}>
              <Mail aria-hidden /> Compose email
            </a>
          ) : null}
        </div>
      )
    case "phone":
      return (
        <div className="space-y-3">
          <div className="rounded-xl border bg-surface px-3">
            <Field label="Phone number" value={payload.number} copy mono />
          </div>
          <a className={linkBtn} href={`tel:${payload.number.replace(/[^\d+*#,;]/g, "")}`}>
            <Phone aria-hidden /> Call
          </a>
        </div>
      )
    case "sms":
      return (
        <div className="space-y-3">
          <div className="rounded-xl border bg-surface px-3">
            <Field label="To" value={payload.number} copy mono />
            <Field label="Message" value={payload.body} copy />
          </div>
          <a
            className={linkBtn}
            href={`sms:${payload.number.replace(/[^\d+]/g, "")}${payload.body ? `?body=${encodeURIComponent(payload.body)}` : ""}`}
          >
            <MessageSquare aria-hidden /> Open messages
          </a>
        </div>
      )
    case "geo":
      return (
        <div className="space-y-3">
          <div className="rounded-xl border bg-surface px-3">
            <Field label="Coordinates" value={`${payload.lat}, ${payload.lng}`} copy mono />
            <Field label="Label" value={payload.query} />
          </div>
          <a
            className={linkBtn}
            target="_blank"
            rel="noopener noreferrer"
            href={`https://www.openstreetmap.org/?mlat=${payload.lat}&mlon=${payload.lng}#map=16/${payload.lat}/${payload.lng}`}
          >
            <MapPin aria-hidden /> Open in OpenStreetMap
          </a>
        </div>
      )
    default:
      return (
        <p className="max-h-72 overflow-y-auto rounded-xl border bg-surface p-3 text-sm wrap-break-word whitespace-pre-wrap">{raw}</p>
      )
  }
}

interface ScanResultCardProps {
  code: DetectedCode
  source?: "camera" | "image"
  onDismiss?: () => void
  className?: string
}

/** Result card shared by the scanners: format, structured view, copy/share. */
export function ScanResultCard({ code, source, onDismiss, className }: ScanResultCardProps) {
  const twoD = is2D(code.format)
  const payload = useMemo(() => parsePayload(code.value), [code.value])
  const hints = useMemo(() => productHints(code.format, code.value), [code.format, code.value])
  // Linear barcodes are almost always product/shipping numbers; still detect URLs.
  const showPayload = twoD || payload.type !== "text"
  const Icon = showPayload ? ICONS[payload.type] : Type

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      aria-label="Scan result"
      className={cn("rounded-2xl border bg-card p-4 shadow-soft sm:p-5", className)}
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{showPayload ? PAYLOAD_LABELS[payload.type] : "Barcode value"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{formatLabel(code.format)}</Badge>
            {source ? <Badge variant="outline">{source === "camera" ? "Camera" : "Image"}</Badge> : null}
          </div>
        </div>
        {onDismiss ? (
          <Button size="icon-sm" variant="ghost" aria-label="Dismiss result" onClick={onDismiss}>
            <X aria-hidden />
          </Button>
        ) : null}
      </div>

      {showPayload ? (
        <PayloadView payload={payload} raw={code.value} />
      ) : (
        <p className="rounded-xl border bg-surface p-3 font-mono text-lg tracking-wider break-all">{code.value}</p>
      )}

      {hints.length ? (
        <ul className="mt-3 space-y-1.5">
          {hints.map((h) => (
            <li key={h.label} className="flex gap-2 text-sm">
              {h.tone === "warning" ? (
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground dark:text-warning" aria-hidden />
              ) : (
                <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
              )}
              <span>
                <span className="font-medium">{h.label}</span>
                {h.detail ? <span className="block text-xs text-muted-foreground">{h.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
        <CopyButton value={code.value} label={payload.type === "url" ? "Copy link" : "Copy"} />
        <ShareButton text={code.value} />
      </div>
    </motion.section>
  )
}
