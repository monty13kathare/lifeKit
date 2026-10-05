"use client";

import { useMemo, useState } from "react";
import { format as formatDate } from "date-fns";
import { motion } from "framer-motion";
import {
  CalendarPlus,
  Contact,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  IndianRupee,
  Info,
  Link as LinkIcon,
  Mail,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  TriangleAlert,
  Type,
  Wifi,
  X,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/common/copy-button";
import { downloadText } from "@/lib/files";
import type { DetectedCode } from "@/lib/qr/detect";
import { formatLabel, is2D, productHints } from "@/lib/qr/formats";
import { UPI_VPA_RE } from "@/lib/qr/generator";
import {
  PAYLOAD_LABELS,
  parsePayload,
  type EventPayload,
  type IcsDate,
  type Payload,
} from "@/lib/qr/payload";
import { openExternal } from "@/lib/qr/url-safety";
import { cn } from "@/lib/utils";
import { ShareButton } from "./share-button";
import { UrlPreview } from "./url-preview";

const ICONS: Record<Payload["type"], LucideIcon> = {
  url: LinkIcon,
  wifi: Wifi,
  contact: Contact,
  event: CalendarPlus,
  upi: IndianRupee,
  whatsapp: MessageCircle,
  email: Mail,
  phone: Phone,
  sms: MessageSquare,
  geo: MapPin,
  text: Type,
};

function Field({
  label,
  value,
  copy,
  mono,
}: {
  label: string;
  value?: string;
  copy?: boolean;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="group flex items-start justify-between gap-3 border-b border-border/50 py-3 transition-colors hover:bg-muted/20 first:pt-2 last:border-b-0 last:pb-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {label}
        </p>
        <p
          className={cn(
            "mt-1.5 text-sm font-medium leading-relaxed wrap-break-word whitespace-pre-wrap text-foreground/90",
            mono && "font-mono tracking-tight",
          )}
        >
          {value}
        </p>
      </div>
      {copy ? (
        <div className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 md:opacity-0 max-md:opacity-100">
          <CopyButton
            value={value}
            iconOnly
            variant="ghost"
            label={`Copy ${label.toLowerCase()}`}
          />
        </div>
      ) : null}
    </div>
  );
}

function PasswordField({ value }: { value: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-3 transition-colors hover:bg-muted/20 first:pt-2 last:border-b-0 last:pb-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          Password
        </p>
        <p className="mt-1.5 font-mono text-sm font-medium tracking-tight break-all text-foreground/90">
          {show ? value : "•".repeat(Math.min(value.length, 16))}
        </p>
      </div>
      <Button
        size="icon"
        variant="ghost"
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        onClick={() => setShow((s) => !s)}
      >
        {show ? (
          <EyeOff aria-hidden className="text-muted-foreground" />
        ) : (
          <Eye aria-hidden className="text-muted-foreground" />
        )}
      </Button>
    </div>
  );
}

/** Big, thumb-friendly action row: full width on phones, inline on larger screens. */
function Actions({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:flex sm:flex-wrap *:w-full sm:*:w-auto">
      {children}
    </div>
  );
}

const linkBtn =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 text-sm font-medium shadow-sm transition-all hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring dark:border-input dark:bg-input/30 [&_svg]:size-4";
const primaryLinkBtn =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4";

function mailtoHref(to: string, subject?: string, body?: string) {
  const params: string[] = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${to.replace(/[^\w.@+,-]/g, "")}${params.length ? `?${params.join("&")}` : ""}`;
}

const telHref = (n: string) => `tel:${n.replace(/[^\d+*#,;]/g, "")}`;

function fmtIcs(d: IcsDate, withDate = true) {
  if (d.allDay) return formatDate(d.date, "EEE, d MMM yyyy");
  return formatDate(d.date, withDate ? "EEE, d MMM yyyy, h:mm a" : "h:mm a");
}

function eventWhen(e: EventPayload): string | undefined {
  const { start, end } = e;
  if (!start) return undefined;
  if (start.allDay) {
    // DTEND for all-day events is exclusive.
    const last = end
      ? new Date(
          end.date.getFullYear(),
          end.date.getMonth(),
          end.date.getDate() - 1,
        )
      : start.date;
    const sameDay =
      last.toDateString() === start.date.toDateString() || last < start.date;
    return sameDay
      ? `${fmtIcs(start)} · all day`
      : `${fmtIcs(start)} – ${formatDate(last, "EEE, d MMM yyyy")} · all day`;
  }
  const tz = start.utc ? " (your time)" : "";
  if (!end) return fmtIcs(start) + tz;
  const sameDay = end.date.toDateString() === start.date.toDateString();
  return `${fmtIcs(start)} – ${fmtIcs(end, !sameDay)}${tz}`;
}

const fileName = (s: string, ext: string) =>
  `${
    (s || "scan")
      .trim()
      .replace(/[^\w.-]+/g, "_")
      .slice(0, 60) || "scan"
  }.${ext}`;

/** Structured, text-only rendering of a decoded payload. */
export function PayloadView({
  payload,
  raw,
}: {
  payload: Payload;
  raw: string;
}) {
  switch (payload.type) {
    case "url":
      return <UrlPreview raw={payload.url} analysis={payload.analysis} />;
    case "wifi":
      return (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-surface/50 px-4 shadow-sm backdrop-blur-sm">
            <Field
              label="Network name (SSID)"
              value={payload.ssid || "(hidden name)"}
              copy={!!payload.ssid}
            />
            {payload.password ? (
              <PasswordField value={payload.password} />
            ) : null}
            <Field label="Security" value={payload.encryption} />
            {payload.hidden ? (
              <Field label="Visibility" value="Hidden network" />
            ) : null}
          </div>
          <Actions>
            {payload.password ? (
              <CopyButton
                value={payload.password}
                label="Copy password"
                size="lg"
                variant="default"
              />
            ) : null}
            {payload.ssid ? (
              <CopyButton
                value={payload.ssid}
                label="Copy network name"
                size="lg"
              />
            ) : null}
          </Actions>
          <p className="text-xs text-muted-foreground">
            Websites can&apos;t join Wi-Fi for you. Copy the password, then pick
            “{payload.ssid}” in your device&apos;s Wi-Fi settings. (Your
            phone&apos;s own camera app can join directly from this code.)
          </p>
        </div>
      );
    case "contact":
      return (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-surface/50 px-4 shadow-sm backdrop-blur-sm">
            <Field label="Name" value={payload.name} copy />
            <Field
              label="Organisation"
              value={[payload.title, payload.org].filter(Boolean).join(" · ")}
            />
            {payload.phones.map((p, i) => (
              <Field key={`p${i}`} label="Phone" value={p} copy mono />
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
          <Actions>
            <Button
              size="lg"
              onClick={() =>
                downloadText(
                  payload.vcf,
                  fileName(payload.name || "contact", "vcf"),
                  "text/vcard;charset=utf-8",
                )
              }
            >
              <Download aria-hidden /> Save contact (.vcf)
            </Button>
            {payload.phones[0] ? (
              <a className={linkBtn} href={telHref(payload.phones[0])}>
                <Phone aria-hidden /> Call
              </a>
            ) : null}
            {payload.emails[0] ? (
              <a className={linkBtn} href={mailtoHref(payload.emails[0])}>
                <Mail aria-hidden /> Email
              </a>
            ) : null}
          </Actions>
        </div>
      );
    case "event": {
      const when = eventWhen(payload);
      return (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-surface/50 px-4 shadow-sm backdrop-blur-sm">
            <Field
              label="Event"
              value={payload.summary || "(untitled)"}
              copy={!!payload.summary}
            />
            <Field label="When" value={when ?? "No date in this code"} />
            <Field label="Where" value={payload.location} copy />
            <Field label="Details" value={payload.description} />
          </div>
          <Actions>
            <Button
              size="lg"
              onClick={() =>
                downloadText(
                  payload.ics,
                  fileName(payload.summary || "event", "ics"),
                  "text/calendar;charset=utf-8",
                )
              }
            >
              <CalendarPlus aria-hidden /> Add to calendar (.ics)
            </Button>
          </Actions>
          <p className="text-xs text-muted-foreground">
            Open the downloaded .ics file to add it to Google Calendar, Apple
            Calendar or Outlook.
          </p>
        </div>
      );
    }
    case "upi": {
      const validVpa = UPI_VPA_RE.test(payload.vpa);
      const amount =
        payload.amount && Number.isFinite(Number(payload.amount))
          ? Number(payload.amount)
          : null;
      return (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-surface/50 px-4 shadow-sm backdrop-blur-sm">
            <Field
              label="Pay to"
              value={payload.name || "(name not included)"}
            />
            <Field label="UPI ID" value={payload.vpa} copy mono />
            <Field
              label="Amount"
              value={
                amount !== null
                  ? `${payload.currency && payload.currency !== "INR" ? `${payload.currency} ` : "₹"}${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : "Not set — you'll enter it in your UPI app"
              }
            />
            <Field label="Note" value={payload.note} />
          </div>
          {!validVpa ? (
            <p className="flex gap-2 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{" "}
              This doesn&apos;t look like a valid UPI ID. Don&apos;t pay unless
              you trust the source.
            </p>
          ) : null}
          <Actions>
            {validVpa ? (
              <a className={primaryLinkBtn} href={payload.url}>
                <IndianRupee aria-hidden /> Open in UPI app
              </a>
            ) : null}
            <CopyButton value={payload.vpa} label="Copy UPI ID" size="lg" />
          </Actions>
          <p className="text-xs text-muted-foreground">
            Opens GPay, PhonePe, Paytm or your bank&apos;s app on a phone.
            Always check the payee name in the app before you pay — LifeKit
            never handles the payment.
          </p>
        </div>
      );
    }
    case "whatsapp":
      return (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-surface/50 px-4 shadow-sm backdrop-blur-sm">
            <Field
              label="Chat with"
              value={
                payload.number
                  ? `+${payload.number}`
                  : "Choose a chat in WhatsApp"
              }
              copy={!!payload.number}
              mono
            />
            <Field label="Message" value={payload.text} copy />
          </div>
          <Actions>
            <Button
              size="lg"
              className="h-11 rounded-xl shadow-sm px-5"
              onClick={() => openExternal(payload.url)}
              disabled={!payload.analysis.openable}
            >
              <MessageCircle aria-hidden /> Open WhatsApp
            </Button>
          </Actions>
        </div>
      );
    case "email":
      return (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-surface/50 px-4 shadow-sm backdrop-blur-sm">
            <Field label="To" value={payload.to} copy />
            <Field label="Subject" value={payload.subject} copy />
            <Field label="Message" value={payload.body} copy />
          </div>
          {payload.to ? (
            <Actions>
              <a
                className={primaryLinkBtn}
                href={mailtoHref(payload.to, payload.subject, payload.body)}
              >
                <Mail aria-hidden /> Compose email
              </a>
            </Actions>
          ) : null}
        </div>
      );
    case "phone":
      return (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-surface/50 px-4 shadow-sm backdrop-blur-sm">
            <Field label="Phone number" value={payload.number} copy mono />
          </div>
          <Actions>
            <a className={primaryLinkBtn} href={telHref(payload.number)}>
              <Phone aria-hidden /> Call
            </a>
            <a
              className={linkBtn}
              href={`sms:${payload.number.replace(/[^\d+]/g, "")}`}
            >
              <MessageSquare aria-hidden /> Text
            </a>
          </Actions>
        </div>
      );
    case "sms":
      return (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-surface/50 px-4 shadow-sm backdrop-blur-sm">
            <Field label="To" value={payload.number} copy mono />
            <Field label="Message" value={payload.body} copy />
          </div>
          <Actions>
            <a
              className={primaryLinkBtn}
              href={`sms:${payload.number.replace(/[^\d+]/g, "")}${payload.body ? `?body=${encodeURIComponent(payload.body)}` : ""}`}
            >
              <MessageSquare aria-hidden /> Open messages
            </a>
          </Actions>
        </div>
      );
    case "geo":
      return (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-surface/50 px-4 shadow-sm backdrop-blur-sm">
            <Field
              label="Coordinates"
              value={`${payload.lat}, ${payload.lng}`}
              copy
              mono
            />
            <Field label="Label" value={payload.query} />
          </div>
          <Actions>
            <Button
              size="lg"
              onClick={() =>
                openExternal(
                  `https://www.google.com/maps/search/?api=1&query=${payload.lat}%2C${payload.lng}`,
                )
              }
            >
              <MapIcon aria-hidden /> Open in Maps
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() =>
                openExternal(
                  `https://www.openstreetmap.org/?mlat=${payload.lat}&mlon=${payload.lng}#map=16/${payload.lat}/${payload.lng}`,
                )
              }
            >
              <ExternalLink aria-hidden /> OpenStreetMap
            </Button>
          </Actions>
        </div>
      );
    default:
      return (
        <p className="max-h-72 overflow-y-auto rounded-xl border bg-surface p-3 text-sm wrap-break-word whitespace-pre-wrap">
          {raw}
        </p>
      );
  }
}

interface ScanResultCardProps {
  code: DetectedCode;
  source?: "camera" | "image";
  onDismiss?: () => void;
  className?: string;
}

/** Result card shared by the scanners: format, structured view, copy/share. */
export function ScanResultCard({
  code,
  source,
  onDismiss,
  className,
}: ScanResultCardProps) {
  const twoD = is2D(code.format);
  const payload = useMemo(() => parsePayload(code.value), [code.value]);
  const hints = useMemo(
    () => productHints(code.format, code.value),
    [code.format, code.value],
  );
  // Linear barcodes are almost always product/shipping numbers; still detect URLs.
  const showPayload = twoD || payload.type !== "text";
  const Icon = showPayload ? ICONS[payload.type] : Type;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      aria-label="Scan result"
      className={cn(
        "relative overflow-hidden rounded-[24px] border bg-card p-5 shadow-xl sm:p-7 transition-all",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-primary/10 before:via-transparent before:to-transparent before:opacity-60",
        className,
      )}
    >
      <div className="relative mb-5 flex items-start gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary shadow-sm ring-1 ring-primary/20">
          <Icon className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-lg font-semibold tracking-tight">
            {showPayload ? PAYLOAD_LABELS[payload.type] : "Barcode value"}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="bg-secondary/60 hover:bg-secondary/80 backdrop-blur-sm"
            >
              {formatLabel(code.format)}
            </Badge>
            {source ? (
              <Badge
                variant="outline"
                className="border-border/60 bg-surface/30"
              >
                {source === "camera" ? "Camera" : "Image"}
              </Badge>
            ) : null}
          </div>
        </div>
        {onDismiss ? (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Dismiss result"
            className="rounded-full hover:bg-muted/50"
            onClick={onDismiss}
          >
            <X aria-hidden className="size-5" />
          </Button>
        ) : null}
      </div>

      <div className="relative">
        {showPayload ? (
          <PayloadView payload={payload} raw={code.value} />
        ) : (
          <p className="rounded-xl border bg-surface p-3 font-mono text-lg tracking-wider break-all">
            {code.value}
          </p>
        )}

        {hints.length ? (
          <ul className="mt-3 space-y-1.5">
            {hints.map((h) => (
              <li key={h.label} className="flex gap-2 text-sm">
                {h.tone === "warning" ? (
                  <TriangleAlert
                    className="mt-0.5 size-4 shrink-0 text-warning-foreground dark:text-warning"
                    aria-hidden
                  />
                ) : (
                  <Info
                    className="mt-0.5 size-4 shrink-0 text-info"
                    aria-hidden
                  />
                )}
                <span>
                  <span className="font-medium">{h.label}</span>
                  {h.detail ? (
                    <span className="block text-xs text-muted-foreground">
                      {h.detail}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="relative mt-6 space-y-4 border-t border-border/50 pt-5">
          {showPayload && payload.type !== "text" && payload.type !== "url" ? (
            <div className="space-y-2 rounded-2xl bg-muted/30 p-4 ring-1 ring-inset ring-border/50">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/80">
                Raw Data
              </p>
              <p className="max-h-32 overflow-y-auto font-mono text-[13px] leading-relaxed text-muted-foreground break-all whitespace-pre-wrap">
                {code.value}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:flex sm:flex-wrap *:w-full sm:*:w-auto">
            <CopyButton
              value={code.value}
              label={payload.type === "url" ? "Copy link" : "Copy raw text"}
              size="lg"
              className="h-11 rounded-xl shadow-sm"
            />
            <ShareButton text={code.value} className="h-11 rounded-xl shadow-sm px-5" />
          </div>
        </div>
      </div>
    </motion.section>
  );
}
