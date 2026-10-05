"use client"

import { useId, useState } from "react"
import { CalendarIcon, Clock, Eye, EyeOff, Loader2, LocateFixed } from "lucide-react"
import { format as formatDate, parseISO } from "date-fns"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Textarea } from "@/components/ui/textarea"
import type { FormValues, QrContentType } from "@/lib/qr/generator"
import { cn } from "@/lib/utils"

type FieldKind = "text" | "textarea" | "email" | "tel" | "url" | "password" | "decimal" | "date" | "time" | "select" | "switch"

interface FieldDef {
  name: string
  label: string
  kind: FieldKind
  placeholder?: string
  autoComplete?: string
  options?: Array<{ value: string; label: string }>
  wide?: boolean
  optional?: boolean
  /** Helper text under the field. */
  hint?: string
  /** Only show the field when this returns true. */
  when?: (values: FormValues) => boolean
}

const FIELDS: Record<Exclude<QrContentType, "file">, FieldDef[]> = {
  url: [{ name: "url", label: "Website address", kind: "url", placeholder: "https://example.com", wide: true, autoComplete: "url" }],
  text: [{ name: "text", label: "Text", kind: "textarea", placeholder: "Anything you like…", wide: true }],
  contact: [
    { name: "firstName", label: "First name", kind: "text", autoComplete: "given-name" },
    { name: "lastName", label: "Last name", kind: "text", autoComplete: "family-name", optional: true },
    { name: "phone", label: "Phone", kind: "tel", placeholder: "+91 98765 43210", autoComplete: "tel", optional: true },
    { name: "email", label: "Email", kind: "email", placeholder: "name@example.com", autoComplete: "email", optional: true },
    { name: "org", label: "Organisation", kind: "text", autoComplete: "organization", optional: true },
    { name: "title", label: "Job title", kind: "text", autoComplete: "organization-title", optional: true },
    { name: "website", label: "Website", kind: "url", placeholder: "https://", wide: true, optional: true },
    { name: "address", label: "Address", kind: "text", wide: true, autoComplete: "street-address", optional: true },
    { name: "note", label: "Note", kind: "textarea", wide: true, optional: true },
  ],
  wifi: [
    { name: "ssid", label: "Network name (SSID)", kind: "text", placeholder: "MyHomeWiFi", wide: true },
    {
      name: "encryption",
      label: "Security",
      kind: "select",
      options: [
        { value: "WPA", label: "WPA / WPA2 / WPA3" },
        { value: "WEP", label: "WEP (old)" },
        { value: "nopass", label: "None (open network)" },
      ],
    },
    { name: "password", label: "Password", kind: "password", autoComplete: "off" },
    { name: "hidden", label: "Hidden network", kind: "switch", wide: true },
  ],
  email: [
    { name: "to", label: "To", kind: "email", placeholder: "name@example.com", wide: true },
    { name: "subject", label: "Subject", kind: "text", wide: true, optional: true },
    { name: "body", label: "Message", kind: "textarea", wide: true, optional: true },
  ],
  phone: [{ name: "phone", label: "Phone number", kind: "tel", placeholder: "+1 555 123 4567", wide: true }],
  sms: [
    { name: "phone", label: "Phone number", kind: "tel", placeholder: "+1 555 123 4567", wide: true },
    { name: "message", label: "Message", kind: "textarea", wide: true, optional: true },
  ],
  whatsapp: [
    { name: "phone", label: "WhatsApp number", kind: "tel", placeholder: "+91 98765 43210", wide: true, autoComplete: "tel", hint: "Include the country code." },
    { name: "message", label: "Pre-filled message", kind: "textarea", wide: true, optional: true },
  ],
  upi: [
    { name: "vpa", label: "UPI ID", kind: "email", autoComplete: "off", placeholder: "name@okaxis", wide: true, hint: "The payee’s VPA, e.g. 9876543210@ybl or shop@okicici." },
    { name: "name", label: "Payee name", kind: "text", placeholder: "Asha Stores", optional: true },
    { name: "amount", label: "Amount (₹)", kind: "decimal", placeholder: "Leave empty to let the payer enter it", optional: true },
    { name: "note", label: "Note", kind: "text", placeholder: "Order #123", wide: true, optional: true },
  ],
  event: [
    { name: "title", label: "Event title", kind: "text", placeholder: "Team lunch", wide: true },
    { name: "allDay", label: "All-day event", kind: "switch", wide: true },
    { name: "startDate", label: "Starts", kind: "date" },
    { name: "startTime", label: "Start time", kind: "time", when: (v) => !v.allDay },
    { name: "endDate", label: "Ends", kind: "date", optional: true },
    { name: "endTime", label: "End time", kind: "time", optional: true, when: (v) => !v.allDay, hint: "Defaults to one hour." },
    { name: "location", label: "Location", kind: "text", wide: true, optional: true },
    { name: "description", label: "Description", kind: "textarea", wide: true, optional: true },
  ],
  location: [
    { name: "lat", label: "Latitude", kind: "decimal", placeholder: "28.6139" },
    { name: "lng", label: "Longitude", kind: "decimal", placeholder: "77.2090" },
  ],
}

interface QrTypeFormProps {
  type: Exclude<QrContentType, "file">
  values: FormValues
  errors: Record<string, string>
  /** Show errors only once the user has interacted. */
  showErrors: boolean
  onChange: (name: string, value: string | boolean) => void
}

export function QrTypeForm({ type, values, errors, showErrors, onChange }: QrTypeFormProps) {
  const baseId = useId()
  const [showPassword, setShowPassword] = useState(false)
  const [locating, setLocating] = useState(false)

  const locate = () => {
    if (!("geolocation" in navigator)) {
      toast.error("This browser does not support location access. Enter coordinates instead.")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange("lat", pos.coords.latitude.toFixed(6))
        onChange("lng", pos.coords.longitude.toFixed(6))
        setLocating(false)
        toast.success(`Location found (±${Math.round(pos.coords.accuracy)} m)`)
      },
      (err) => {
        setLocating(false)
        toast.error(err.code === err.PERMISSION_DENIED ? "Location permission was denied." : "Couldn't get your location. Enter coordinates instead.")
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {FIELDS[type].map((f) => {
        const id = `${baseId}-${f.name}`
        const err = showErrors ? errors[f.name] : undefined
        const errId = `${id}-error`
        const value = values[f.name]
        if (f.kind === "password" && values.encryption === "nopass") return null
        if (f.when && !f.when(values)) return null
        if (f.kind === "switch") {
          return (
            <div key={f.name} className={cn("flex items-center justify-between gap-3 rounded-xl border bg-surface px-3 py-2.5", f.wide && "sm:col-span-2")}>
              <Label htmlFor={id}>{f.label}</Label>
              <Switch id={id} checked={!!value} onCheckedChange={(c) => onChange(f.name, c)} />
            </div>
          )
        }
        const common = {
          id,
          "aria-invalid": err ? true : undefined,
          "aria-describedby": err ? errId : undefined,
        }
        return (
          <div key={f.name} className={cn("space-y-1.5", f.wide && "sm:col-span-2")}>
            <Label htmlFor={id}>
              {f.label}
              {f.optional ? <span className="font-normal text-muted-foreground"> (optional)</span> : null}
            </Label>
            {f.kind === "textarea" ? (
              <Textarea
                {...common}
                rows={type === "text" ? 5 : 3}
                placeholder={f.placeholder}
                value={String(value ?? "")}
                onChange={(e) => onChange(f.name, e.target.value)}
              />
            ) : f.kind === "select" ? (
              <Select items={f.options} value={String(value)} onValueChange={(v) => v && onChange(f.name, String(v))}>
                <SelectTrigger id={id} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {f.options!.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : f.kind === "password" ? (
              <div className="relative">
                <Input
                  {...common}
                  type={showPassword ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  className="pr-11"
                  value={String(value ?? "")}
                  onChange={(e) => onChange(f.name, e.target.value)}
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="absolute top-1 right-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((s) => !s)}
                >
                  {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                </Button>
              </div>
            ) : f.kind === "date" ? (
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      id={id}
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-surface transition-all",
                        !value && "text-muted-foreground",
                        err && "border-destructive text-destructive focus-visible:ring-destructive"
                      )}
                    />
                  }
                >
                  <CalendarIcon className="mr-2 size-4 opacity-70" aria-hidden />
                  {value && !isNaN(parseISO(String(value)).getTime()) ? formatDate(parseISO(String(value)), "PPP") : <span>Pick a date</span>}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={value && !isNaN(parseISO(String(value)).getTime()) ? parseISO(String(value)) : undefined}
                    onSelect={(d) => onChange(f.name, d ? formatDate(d, "yyyy-MM-dd") : "")}
                  />
                </PopoverContent>
              </Popover>
            ) : f.kind === "time" ? (
              <div className="relative">
                <Input
                  {...common}
                  type="time"
                  className={cn("block min-w-0 pl-10 bg-surface", err && "border-destructive text-destructive focus-visible:ring-destructive")}
                  value={String(value ?? "")}
                  onChange={(e) => onChange(f.name, e.target.value)}
                />
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 opacity-50 pointer-events-none" aria-hidden />
              </div>
            ) : (
              <Input
                {...common}
                type={f.kind === "decimal" ? "text" : f.kind}
                className={cn("bg-surface", err && "border-destructive focus-visible:ring-destructive")}
                inputMode={f.kind === "decimal" ? "decimal" : f.kind === "tel" ? "tel" : f.kind === "email" ? "email" : f.kind === "url" ? "url" : undefined}
                autoComplete={f.autoComplete}
                autoCapitalize={f.kind === "text" ? undefined : "off"}
                placeholder={f.placeholder}
                value={String(value ?? "")}
                onChange={(e) => onChange(f.name, e.target.value)}
              />
            )}
            {err ? (
              <p id={errId} className="text-xs text-destructive">
                {err}
              </p>
            ) : f.hint ? (
              <p className="text-xs text-muted-foreground">{f.hint}</p>
            ) : null}
          </div>
        )
      })}
      {type === "location" ? (
        <div className="sm:col-span-2">
          <Button type="button" variant="outline" onClick={locate} disabled={locating}>
            {locating ? <Loader2 className="animate-spin" aria-hidden /> : <LocateFixed aria-hidden />}
            {locating ? "Finding you…" : "Use my location"}
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">Your location is only used to fill these fields. It isn&apos;t sent anywhere.</p>
        </div>
      ) : null}
    </div>
  )
}
