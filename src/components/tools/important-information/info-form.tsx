"use client"

import { useState } from "react"
import { Loader2, Lock, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"
import { Notice, UnsupportedNotice } from "@/components/common/notice"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { encryptJson, isCryptoSupported } from "@/lib/crypto/passphrase"
import { cn } from "@/lib/utils"
import type { ImportantInfo, InfoCategory } from "@/types"
import { INFO_CATEGORIES, looksSensitive } from "./categories"
import type { UnlockedSecret } from "./unlocked-store"

export type InfoRecord = Omit<ImportantInfo, "id" | "createdAt">

const baseSchema = z.object({
  title: z.string().trim().min(1, "Give this entry a title").max(80, "Keep the title under 80 characters"),
  category: z.enum(["emergency", "family", "work", "school", "vehicle", "home", "travel", "other"]),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => !v || /^[+\d][\d\s()\-.*#]{2,}$/.test(v), "Enter a valid phone number (digits, spaces, + ( ) -)"),
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => !v || z.email().safeParse(v).success, "Enter a valid email address"),
  details: z.string().max(5000, "Details are too long"),
  notes: z.string().max(5000, "Notes are too long"),
})

type Field = keyof z.infer<typeof baseSchema> | "passphrase" | "confirm"
type Errors = Partial<Record<Field, string>>

interface InfoFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: ImportantInfo | null
  /** Plaintext for an unlocked sensitive entry being edited. */
  initialSecret?: UnlockedSecret
  defaultCategory?: InfoCategory
  onSave: (record: InfoRecord, secret: UnlockedSecret | null) => void
}

export function InfoFormSheet({ open, onOpenChange, initial, initialSecret, defaultCategory, onSave }: InfoFormSheetProps) {
  const [busy, setBusy] = useState(false)
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={initial ? "Edit entry" : "Add entry"}
      description="Stored in this browser only."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="info-form" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {busy ? "Encrypting…" : initial ? "Save changes" : "Save entry"}
          </Button>
        </>
      }
    >
      {open ? (
        <InfoForm
          key={initial?.id ?? "new"}
          initial={initial}
          initialSecret={initialSecret}
          defaultCategory={defaultCategory}
          setBusy={setBusy}
          onSave={onSave}
        />
      ) : null}
    </ResponsiveSheet>
  )
}

function InfoForm({
  initial,
  initialSecret,
  defaultCategory,
  setBusy,
  onSave,
}: Pick<InfoFormSheetProps, "initial" | "initialSecret" | "defaultCategory" | "onSave"> & { setBusy: (b: boolean) => void }) {
  const cryptoOk = isCryptoSupported()
  const [values, setValues] = useState({
    title: initial?.title ?? "",
    category: (initial?.category ?? defaultCategory ?? "emergency") as InfoCategory,
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    details: initialSecret?.details ?? initial?.details ?? "",
    notes: initialSecret?.notes ?? initial?.notes ?? "",
  })
  const [sensitive, setSensitive] = useState(initial?.sensitive ?? false)
  const [passphrase, setPassphrase] = useState("")
  const [confirm, setConfirm] = useState("")
  const [errors, setErrors] = useState<Errors>({})

  const knownPassphrase = initialSecret?.passphrase
  const needsPassphrase = sensitive && !knownPassphrase
  const wasEncrypted = !!initial?.sensitive && !!initial.encrypted
  const set = <K extends keyof typeof values>(k: K, v: (typeof values)[K]) => setValues((prev) => ({ ...prev, [k]: v }))
  const showSensitiveHint = !sensitive && looksSensitive(`${values.details}\n${values.notes}`)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = baseSchema.safeParse(values)
    const next: Errors = {}
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as Field
        if (!next[key]) next[key] = issue.message
      }
    }
    const pass = passphrase || knownPassphrase || ""
    if (sensitive) {
      if (!cryptoOk) next.passphrase = "Encryption isn't available in this browser"
      else if (needsPassphrase || passphrase) {
        if (passphrase.length < 8) next.passphrase = "Use at least 8 characters"
        else if (passphrase !== confirm) next.confirm = "Passphrases don't match"
      }
    }
    setErrors(next)
    if (Object.keys(next).length || !parsed.success) return

    const v = parsed.data
    const common = {
      title: v.title,
      category: v.category,
      phone: v.phone || undefined,
      email: v.email || undefined,
      demo: initial?.demo,
    }
    if (!sensitive) {
      onSave({ ...common, details: v.details || undefined, notes: v.notes || undefined, sensitive: false, encrypted: undefined }, null)
      return
    }
    try {
      setBusy(true)
      const encrypted = await encryptJson({ details: v.details, notes: v.notes }, pass)
      onSave(
        { ...common, details: undefined, notes: undefined, sensitive: true, encrypted },
        { details: v.details, notes: v.notes, passphrase: pass }
      )
    } catch {
      toast.error("Couldn't encrypt this entry in this browser")
    } finally {
      setBusy(false)
    }
  }

  const err = (k: Field) => (errors[k] ? <p id={`info-${k}-err`} className="text-xs text-destructive">{errors[k]}</p> : null)
  const aria = (k: Field) => ({ "aria-invalid": errors[k] ? true : undefined, "aria-describedby": errors[k] ? `info-${k}-err` : undefined })

  return (
    <form id="info-form" onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="info-title">Title</Label>
        <Input id="info-title" autoFocus={!initial} placeholder="e.g. Family doctor" value={values.title} maxLength={80} onChange={(e) => set("title", e.target.value)} className="h-11" {...aria("title")} />
        {err("title")}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Category</legend>
        <div className="grid grid-cols-4 gap-1.5">
          {INFO_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={values.category === c.id}
              onClick={() => set("category", c.id)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border px-1 text-xs font-medium transition-colors",
                values.category === c.id ? "border-primary bg-primary/10 text-primary" : "bg-surface text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <c.icon className="size-4" aria-hidden />
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="info-phone">Phone (optional)</Label>
          <Input id="info-phone" type="tel" inputMode="tel" autoComplete="off" placeholder="+91 98765 43210" value={values.phone} onChange={(e) => set("phone", e.target.value)} className="h-11" {...aria("phone")} />
          {err("phone")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="info-email">Email (optional)</Label>
          <Input id="info-email" type="email" inputMode="email" autoComplete="off" autoCapitalize="off" value={values.email} onChange={(e) => set("email", e.target.value)} className="h-11" {...aria("email")} />
          {err("email")}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="info-details">Details (optional)</Label>
        <Textarea id="info-details" rows={3} placeholder="Address, ID numbers, policy details…" value={values.details} onChange={(e) => set("details", e.target.value)} {...aria("details")} />
        {err("details")}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="info-notes">Notes (optional)</Label>
        <Textarea id="info-notes" rows={2} value={values.notes} onChange={(e) => set("notes", e.target.value)} {...aria("notes")} />
        {err("notes")}
      </div>

      {showSensitiveHint ? (
        <Notice tone="warning" icon={TriangleAlert} title="This looks like sensitive information">
          Turn on <strong>Sensitive</strong> to encrypt the details and notes with a passphrase. Keeping it unencrypted is your choice.
        </Notice>
      ) : null}

      <div className="space-y-3 rounded-xl border bg-surface p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label htmlFor="info-sensitive" className="flex items-center gap-1.5">
              <Lock className="size-4" aria-hidden /> Sensitive
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Encrypts details and notes with your passphrase (AES-256). Title, phone and email stay readable for quick calling.
            </p>
          </div>
          <Switch id="info-sensitive" checked={sensitive} onCheckedChange={(c) => setSensitive(c)} disabled={!cryptoOk && !sensitive} />
        </div>
        {!cryptoOk ? <UnsupportedNotice feature="Web Crypto encryption" alternative="Use an up-to-date browser over HTTPS to encrypt entries." /> : null}
        {wasEncrypted && !sensitive ? (
          <p className="text-xs text-warning-foreground dark:text-warning">Saving will store the details and notes unencrypted in this browser.</p>
        ) : null}
        {sensitive && cryptoOk ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="info-pass">{knownPassphrase ? "New passphrase (optional)" : "Passphrase"}</Label>
              <Input id="info-pass" type="password" autoComplete="new-password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} className="h-11" {...aria("passphrase")} />
              {err("passphrase") ?? <p className="text-xs text-muted-foreground">{knownPassphrase ? "Leave blank to keep the current passphrase." : "At least 8 characters. It can't be recovered if lost."}</p>}
            </div>
            {needsPassphrase || passphrase ? (
              <div className="space-y-1.5">
                <Label htmlFor="info-confirm">Confirm passphrase</Label>
                <Input id="info-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11" {...aria("confirm")} />
                {err("confirm")}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </form>
  )
}
