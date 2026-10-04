"use client"

import { useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { z } from "zod"
import {
  Download,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  QrCode,
  RotateCcw,
  Share2,
  Sparkles,
  X,
} from "lucide-react"
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
import { renderQrCanvas } from "@/lib/qr/render"
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
  encrypting: "Encrypting with AES-256…",
  uploading: "Uploading encrypted package to cloud relay…",
  downloading: "Downloading encrypted package…",
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
  const [isPublicLink, setIsPublicLink] = useState(true)
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
        isPublicLink,
        onStage: setStage,
      })
      if (result) service.release(result)
      setResult(res)
      toast.success(res.publicUrl ? "Public share link generated!" : "Encrypted package ready")
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
            title="Choose files to share securely"
            hint="Multiple images, videos, PDFs or documents · encrypted locally"
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
        <div className="flex items-start justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <Label htmlFor="ss-public-link" className="font-normal cursor-pointer">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              <Globe className="size-4 text-primary" /> Generate Public Link
            </span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              Uploads AES-256 encrypted package to ephemeral cloud so anyone with the link can open it anywhere.
            </span>
          </Label>
          <Switch id="ss-public-link" checked={isPublicLink} onCheckedChange={setIsPublicLink} />
        </div>

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
            <Label htmlFor="ss-password">Password protection (optional)</Label>
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
              placeholder="Leave empty for 1-click decrypt link"
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
                ? "The recipient will be prompted for this password before decryption."
                : "Leave empty to embed the zero-knowledge decryption key in the link URL hash for seamless 1-click opening."}
            </p>
          )}
        </div>

        <div className="flex items-start justify-between gap-3">
          <Label htmlFor="ss-download" className="font-normal cursor-pointer">
            <span>
              Allow file download
              <span className="block text-xs text-muted-foreground">
                When off, recipients can only preview files inline (saving raw files is disabled).
              </span>
            </span>
          </Label>
          <Switch id="ss-download" checked={allowDownload} onCheckedChange={setAllowDownload} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ss-notes">Note to recipient (encrypted)</Label>
          <Textarea
            id="ss-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            placeholder="Add an optional message that is encrypted together with the files..."
            aria-invalid={!!errors.notes}
            className="min-h-20"
          />
          {errors.notes ? <p className="text-sm text-destructive">{errors.notes}</p> : null}
        </div>

        {failure ? (
          <Notice tone="danger" title="Couldn't create the share link">
            {failure}
          </Notice>
        ) : null}

        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-1 bg-card px-1 pt-1 lg:static">
          <Button size="lg" className="w-full" onClick={create} disabled={!files.length || tooLarge || busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Lock aria-hidden />}
            {busy ? STAGE_LABEL[stage!] : isPublicLink ? "Generate secure share link" : "Create offline package"}
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
  const expires = new Date(result.expiresAt)
  const [showQr, setShowQr] = useState(false)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!showQr || !qrCanvasRef.current || !result.publicUrl) return
    renderQrCanvas(
      result.publicUrl,
      { fg: "#000000", bg: "#ffffff", size: 240, margin: 2, ecc: "M", logoRatio: 0 },
      qrCanvasRef.current
    ).catch(console.error)
  }, [showQr, result.publicUrl])

  const shareViaWebShare = async () => {
    if (result.publicUrl && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Secure files shared via LifeKit",
          text:
            result.protection === "password"
              ? "Here are encrypted files. You will need the password I sent you to decrypt them:"
              : "Here are secure files shared with you. Click to open and decrypt instantly in your browser:",
          url: result.publicUrl,
        })
        return
      } catch {
        // Handled or cancelled
      }
    }

    // Fallback to sharing the package file
    const ok = await services.file.share({
      files: [pkg],
      title: "Encrypted file",
      text:
        result.protection === "password"
          ? "Open this with LifeKit → SecureShare → Open a package. I'll send you the password separately."
          : "Open this with LifeKit → SecureShare → Open a package. I'll send you the share key separately.",
    })
    if (!ok) toast.info("Sharing was cancelled or isn't available — you can copy the link or download the package.")
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Notice tone="success" title="Your files are encrypted and ready to share!">
        {result.fileCount} file{result.fileCount === 1 ? "" : "s"} encrypted in your browser using AES-256-GCM.
        {result.publicUrl
          ? " Anyone with the public link can open and view/download the files."
          : " You can download the encrypted package file to send via chat or email."}
      </Notice>

      {/* Public Link Card (Primary when available) */}
      {result.publicUrl ? (
        <section className="space-y-4 rounded-2xl border-2 border-primary/30 bg-card p-4 shadow-soft sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Globe className="size-6" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-foreground">Public Share Link (Zero-Knowledge)</h2>
              <p className="text-xs text-muted-foreground">
                Expires {format(expires, "PPp")} · Downloads {result.allowDownload ? "enabled" : "preview only"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                readOnly
                value={result.publicUrl}
                aria-label="Public Share URL"
                className="font-mono text-xs selection:bg-primary/20"
                onFocus={(e) => e.currentTarget.select()}
              />
              <CopyButton value={result.publicUrl} label="Copy Link" />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="default" onClick={shareViaWebShare} className="flex-1 min-w-[140px]">
                <Share2 aria-hidden /> Share Link
              </Button>
              <Button
                variant="outline"
                size="default"
                onClick={() => setShowQr((v) => !v)}
                aria-pressed={showQr}
              >
                <QrCode aria-hidden /> {showQr ? "Hide QR" : "Show QR Code"}
              </Button>
            </div>
          </div>

          {showQr ? (
            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white border border-border mt-3">
              <canvas ref={qrCanvasRef} className="size-[200px]" />
              <p className="text-xs text-neutral-600 mt-2 font-sans text-center">
                Scan with mobile camera to open and decrypt files directly
              </p>
            </div>
          ) : null}

          <div className="rounded-xl bg-surface-muted/60 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">🔒 Zero-Knowledge Security:</p>
            <p>
              Your files were encrypted locally with AES-256 before leaving your computer.
              {result.protection === "key"
                ? " The decryption key is in the URL anchor (#key=...) which is never transmitted to the host server."
                : " The recipient must enter the password to decrypt the files."}
            </p>
          </div>
        </section>
      ) : null}

      {/* Share Key Card if password was not set and no public link */}
      {result.shareKey && !result.publicUrl ? (
        <section className="space-y-3 rounded-2xl border border-warning/40 bg-card p-4 shadow-soft sm:p-5">
          <h2 className="flex items-center gap-2 font-medium">
            <KeyRound className="size-4" aria-hidden /> Share key
          </h2>
          <code className="block rounded-lg bg-surface px-3 py-2.5 font-mono text-sm break-all select-all">{result.shareKey}</code>
          <CopyButton value={result.shareKey} label="Copy key" className="w-full sm:w-auto" />
          <p className="text-xs text-muted-foreground">
            Anyone with the package <strong>and</strong> this key can open it. Send it separately from the file.
          </p>
        </section>
      ) : null}

      {result.protection === "password" ? (
        <Notice tone="info" icon={KeyRound}>
          Password protected. Remember to share the password with your recipient through a separate message or channel.
        </Notice>
      ) : null}

      {/* Offline Package File Card */}
      <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-muted-foreground">
            <Lock className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sm">{pkg.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(pkg.size)} · Standalone offline encrypted container
            </p>
          </div>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => downloadBlob(pkg, pkg.name)}>
            <Download aria-hidden /> Download .lifekit
          </Button>
        </div>
      </section>

      <Button variant="outline" size="lg" className="w-full" onClick={onReset}>
        <RotateCcw aria-hidden /> Protect & share other files
      </Button>
    </div>
  )
}

