"use client"

import { useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { z } from "zod"
import { Download, Eye, EyeOff, KeyRound, Link2, Loader2, Lock, RotateCcw, Share2, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { CopyButton } from "@/components/common/copy-button"
import { FileDropzone } from "@/components/common/file-dropzone"
import { Notice } from "@/components/common/notice"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { generatePassphrase } from "@/components/tools/password-generator/generator"
import { WORDLIST } from "@/components/tools/password-generator/wordlist"
import { downloadBlob, formatBytes, MB } from "@/lib/files"
import { services } from "@/lib/services"
import { getShareService, MAX_SHARE_BYTES, PBKDF2_ITERATIONS, ShareError, type ShareResult, type ShareStage } from "@/lib/services/share"
import { cn } from "@/lib/utils"
import { FileKindIcon, FilePreview } from "./file-preview"

/** Matches every file, including ones the OS reports without a MIME type. */
const ACCEPT_ALL = ["*"]

type Preset = "1h" | "24h" | "7d" | "custom"
const PRESETS: { id: Preset; label: string; ms?: number }[] = [
  { id: "1h", label: "1 hour", ms: 3600_000 },
  { id: "24h", label: "24 hours", ms: 86_400_000 },
  { id: "7d", label: "7 days", ms: 7 * 86_400_000 },
  { id: "custom", label: "Custom" },
]

const STAGE_LABEL: Record<ShareStage, string> = {
  reading: "Reading files…",
  "deriving-key": "Strengthening your password…",
  encrypting: "Encrypting…",
  decrypting: "Decrypting…",
  done: "Done",
}

const formSchema = z.object({
  password: z
    .string()
    .max(256, "Passwords can be up to 256 characters.")
    .refine((p) => p === "" || p.length >= 8, "Use at least 8 characters — or leave it empty to get a random share key."),
  notes: z.string().max(2000, "Notes can be up to 2,000 characters."),
  expiresAt: z
    .date({ error: "Choose a valid expiry date and time." })
    .refine((d) => d.getTime() > Date.now() + 60_000, "The expiry must be in the future.")
    .refine((d) => d.getTime() <= Date.now() + 366 * 86_400_000, "The expiry can be at most one year away."),
})

const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm")
const fromNow = (ms: number) => new Date(Date.now() + ms)

export function CreateShare() {
  const service = getShareService()
  const [files, setFiles] = useState<File[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [preset, setPreset] = useState<Preset>("24h")
  const [customExpiry, setCustomExpiry] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [allowDownload, setAllowDownload] = useState(true)
  const [notes, setNotes] = useState("")
  const [stage, setStage] = useState<ShareStage | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [result, setResult] = useState<ShareResult | null>(null)

  // Revoke the local blob URL when replaced or on unmount.
  const resultRef = useRef<ShareResult | null>(null)
  useEffect(() => {
    resultRef.current = result
  }, [result])
  useEffect(() => () => void (resultRef.current && service.release(resultRef.current)), [service])

  const total = files.reduce((n, f) => n + f.size, 0)
  const tooLarge = total > MAX_SHARE_BYTES
  const busy = stage !== null && stage !== "done"
  const preview = files[Math.min(previewIndex, files.length - 1)]

  const addFiles = (incoming: File[]) => {
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}|${f.size}|${f.lastModified}`))
      return [...prev, ...incoming.filter((f) => !seen.has(`${f.name}|${f.size}|${f.lastModified}`))]
    })
    setFailure(null)
  }

  const removeFile = (i: number) => {
    setFiles((prev) => prev.filter((_, j) => j !== i))
    setPreviewIndex(0)
  }

  const pickPreset = (p: Preset) => {
    setPreset(p)
    if (p === "custom" && !customExpiry) setCustomExpiry(toLocalInput(fromNow(3 * 86_400_000)))
  }

  const create = async () => {
    setFailure(null)
    const expiresAt = preset === "custom" ? new Date(customExpiry) : fromNow(PRESETS.find((p) => p.id === preset)!.ms!)
    const parsed = formSchema.safeParse({ password, notes, expiresAt })
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message
      setErrors(next)
      return
    }
    setErrors({})
    try {
      setStage("reading")
      const res = await service.createShare(files, {
        expiresAt,
        password: password || undefined,
        allowDownload,
        notes,
        onStage: setStage,
      })
      if (result) service.release(result)
      setResult(res)
      toast.success("Encrypted package ready")
    } catch (err) {
      setFailure(
        err instanceof ShareError
          ? err.message
          : err instanceof RangeError || (err as Error)?.name === "NotReadableError"
            ? "The browser ran out of memory or couldn't read a file. Try fewer or smaller files."
            : "Encryption failed. Please try again."
      )
    } finally {
      setStage(null)
    }
  }

  const reset = () => {
    if (result) service.release(result)
    setResult(null)
    setFiles([])
    setPassword("")
    setNotes("")
    setPreviewIndex(0)
  }

  if (result) return <ShareResultView result={result} onReset={reset} />

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
      <div className="space-y-4">
        {files.length === 0 ? (
          <FileDropzone
            multiple
            accept={ACCEPT_ALL}
            maxBytes={MAX_SHARE_BYTES}
            warnBytes={50 * MB}
            onFiles={addFiles}
            title="Choose files to protect"
            hint="Any file type · encrypted on this device"
          />
        ) : (
          <>
            <ul className="divide-y rounded-2xl border bg-card shadow-soft" aria-label="Selected files">
              {files.map((f, i) => (
                <li key={`${f.name}-${f.size}-${f.lastModified}`} className="flex items-center gap-2 px-3 py-2">
                  <FileKindIcon file={f} className="size-5 shrink-0 text-muted-foreground" />
                  <button
                    type="button"
                    onClick={() => setPreviewIndex(i)}
                    aria-pressed={preview === f}
                    className={cn(
                      "min-w-0 flex-1 rounded-md px-1 py-1.5 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      preview === f && "font-medium text-primary"
                    )}
                  >
                    <span className="block truncate">{f.name}</span>
                    <span className="block text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                  </button>
                  <Button variant="ghost" size="icon-sm" onClick={() => removeFile(i)} aria-label={`Remove ${f.name}`} disabled={busy}>
                    <X aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
            <FileDropzone
              compact
              multiple
              accept={ACCEPT_ALL}
              maxBytes={MAX_SHARE_BYTES}
              warnBytes={50 * MB}
              onFiles={addFiles}
              title="Add more files"
              disabled={busy}
            />
            {tooLarge ? (
              <Notice tone="danger">
                Total size is {formatBytes(total)}. Browser encryption is limited to {formatBytes(MAX_SHARE_BYTES, 0)} per package — remove some files.
              </Notice>
            ) : total > 50 * MB ? (
              <Notice tone="warning">Large package ({formatBytes(total)}). Encryption may take a while and use a lot of memory on phones.</Notice>
            ) : null}
            {preview ? <FilePreview file={preview} /> : null}
          </>
        )}
      </div>

      <section aria-label="Protection settings" className="space-y-5 rounded-2xl border bg-card p-4 shadow-soft sm:p-5 lg:sticky lg:top-6">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Expires after</legend>
          <div className="grid grid-cols-4 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={preset === p.id}
                onClick={() => pickPreset(p.id)}
                className={cn(
                  "min-h-10 rounded-lg border px-1 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm",
                  preset === p.id ? "border-primary bg-primary/10 text-primary" : "bg-background hover:bg-muted"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === "custom" ? (
            <div className="space-y-1 pt-1">
              <Label htmlFor="ss-expiry" className="text-xs text-muted-foreground">
                Expiry date and time
              </Label>
              <Input
                id="ss-expiry"
                type="datetime-local"
                value={customExpiry}
                onChange={(e) => setCustomExpiry(e.target.value)}
                aria-invalid={!!errors.expiresAt}
              />
            </div>
          ) : null}
          {errors.expiresAt ? <p className="text-sm text-destructive">{errors.expiresAt}</p> : null}
        </fieldset>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="ss-password">Password (optional)</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setPassword(generatePassphrase({ words: 4, separator: "-", capitalize: false, addNumber: true }, WORDLIST))
                setShowPassword(true)
              }}
            >
              <Sparkles aria-hidden /> Suggest
            </Button>
          </div>
          <div className="relative">
            <Input
              id="ss-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
              aria-describedby="ss-password-help"
              className="pr-11"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1 right-1"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </Button>
          </div>
          {errors.password ? (
            <p className="text-sm text-destructive">{errors.password}</p>
          ) : (
            <p id="ss-password-help" className="text-xs text-muted-foreground">
              {password
                ? "The recipient needs this password. LifeKit can't recover it."
                : "Leave empty and LifeKit generates a random share key instead."}
            </p>
          )}
        </div>

        <div className="flex items-start justify-between gap-3">
          <Label htmlFor="ss-download" className="font-normal">
            <span>
              Allow download
              <span className="block text-xs text-muted-foreground">
                When off, the recipient&apos;s app shows a preview only. This can&apos;t stop someone from saving what they can see.
              </span>
            </span>
          </Label>
          <Switch id="ss-download" checked={allowDownload} onCheckedChange={setAllowDownload} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ss-notes">Note to recipient (optional, encrypted)</Label>
          <Textarea
            id="ss-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            aria-invalid={!!errors.notes}
            className="min-h-20"
          />
          {errors.notes ? <p className="text-sm text-destructive">{errors.notes}</p> : null}
        </div>

        {failure ? (
          <Notice tone="danger" title="Couldn't create the package">
            {failure}
          </Notice>
        ) : null}

        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-1 bg-card px-1 pt-1 lg:static">
          <Button size="lg" className="w-full" onClick={create} disabled={!files.length || tooLarge || busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Lock aria-hidden />}
            {busy ? STAGE_LABEL[stage!] : "Create secure package"}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground" aria-live="polite">
            {files.length
              ? `${files.length} file${files.length === 1 ? "" : "s"} · ${formatBytes(total)} · AES-256-GCM${password ? `, PBKDF2 ×${PBKDF2_ITERATIONS.toLocaleString()}` : ""}`
              : "Choose at least one file to continue."}
          </p>
        </div>
      </section>
    </div>
  )
}

function ShareResultView({ result, onReset }: { result: ShareResult; onReset: () => void }) {
  const pkg = result.package
  const canShare = services.file.canShareFiles([pkg])
  const expires = new Date(result.expiresAt)

  const share = async () => {
    const ok = await services.file.share({
      files: [pkg],
      title: "Encrypted file",
      text:
        result.protection === "password"
          ? "Open this with LifeKit → SecureShare → Open a package. I'll send you the password separately."
          : "Open this with LifeKit → SecureShare → Open a package. I'll send you the share key separately.",
    })
    if (!ok) toast.info("Sharing was cancelled or isn't available — you can download the package instead.")
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Notice tone="success" title="Your encrypted package is ready">
        {result.fileCount} file{result.fileCount === 1 ? "" : "s"} encrypted in your browser. Send the package file to the recipient,
        and send the {result.protection === "password" ? "password" : "share key"} through a different channel.
      </Notice>

      <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Lock className="size-6" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{pkg.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatBytes(pkg.size)} · expires {format(expires, "PPp")} · downloads {result.allowDownload ? "allowed" : "off"}
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {canShare ? (
            <Button size="lg" onClick={share}>
              <Share2 aria-hidden /> Share package
            </Button>
          ) : null}
          <Button size="lg" variant={canShare ? "outline" : "default"} onClick={() => downloadBlob(pkg, pkg.name)} className={cn(!canShare && "sm:col-span-2")}>
            <Download aria-hidden /> Download package
          </Button>
        </div>
        {!canShare ? (
          <p className="text-xs text-muted-foreground">
            This device can&apos;t share this file type directly. Download it, then attach it in your email or messaging app.
          </p>
        ) : null}
      </section>

      {result.shareKey ? (
        <section className="space-y-3 rounded-2xl border border-warning/40 bg-card p-4 shadow-soft sm:p-5">
          <h2 className="flex items-center gap-2 font-medium">
            <KeyRound className="size-4" aria-hidden /> Share key
          </h2>
          <code className="block rounded-lg bg-surface px-3 py-2.5 font-mono text-sm break-all select-all">{result.shareKey}</code>
          <CopyButton value={result.shareKey} label="Copy key" className="w-full sm:w-auto" />
          <p className="text-xs text-muted-foreground">
            Anyone with the package <strong>and</strong> this key can open it. Send it separately from the file (e.g. a different app).
            It isn&apos;t saved anywhere — copy it now; it can&apos;t be recovered.
          </p>
        </section>
      ) : (
        <Notice tone="info" icon={KeyRound}>
          Protected with your password. Tell the recipient the password separately — not in the same message as the file.
        </Notice>
      )}

      <section className="space-y-2 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <Link2 className="size-4" aria-hidden /> Local link — works only in this browser tab, not on other devices
        </h2>
        <div className="flex gap-2">
          <Input readOnly value={result.localUrl} aria-label="Local link to the encrypted package" className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <CopyButton value={result.localUrl} iconOnly label="Copy local link" />
        </div>
        <p className="text-xs text-muted-foreground">
          This <code>blob:</code> link points to the encrypted package in this tab&apos;s memory and stops working when you close or reload
          it. It is not a public link and can&apos;t be opened by anyone else.
        </p>
      </section>

      <Button variant="outline" size="lg" className="w-full" onClick={onReset}>
        <RotateCcw aria-hidden /> Protect other files
      </Button>
    </div>
  )
}
