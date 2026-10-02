"use client"

import { useState } from "react"
import { format, formatDistanceToNowStrict } from "date-fns"
import { Clock, Download, Eye, EyeOff, FileLock2, Loader2, LockOpen, RotateCcw } from "lucide-react"
import { FileDropzone } from "@/components/common/file-dropzone"
import { Notice } from "@/components/common/notice"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { downloadBlob, formatBytes } from "@/lib/files"
import {
  getShareService,
  MAX_SHARE_BYTES,
  PACKAGE_EXTENSION,
  ShareError,
  type OpenedShare,
  type SharePackageInfo,
  type ShareStage,
} from "@/lib/services/share"
import { cn } from "@/lib/utils"
import { FileKindIcon, FilePreview } from "./file-preview"

export function OpenShare() {
  const service = getShareService()
  const [pkg, setPkg] = useState<File | null>(null)
  const [info, setInfo] = useState<SharePackageInfo | null>(null)
  const [inspectError, setInspectError] = useState<string | null>(null)
  const [secret, setSecret] = useState("")
  const [showSecret, setShowSecret] = useState(false)
  const [stage, setStage] = useState<ShareStage | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)
  const [opened, setOpened] = useState<OpenedShare | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)

  const choose = async ([file]: File[]) => {
    setPkg(file)
    setInfo(null)
    setOpened(null)
    setOpenError(null)
    setInspectError(null)
    setSecret("")
    try {
      setInfo(await service.inspectShare(file))
    } catch (err) {
      setInspectError(err instanceof ShareError ? err.message : "This file couldn't be read.")
    }
  }

  const open = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pkg) return
    setOpenError(null)
    try {
      setStage("decrypting")
      const result = await service.openShare(pkg, secret, { onStage: setStage })
      setOpened(result)
      setPreviewIndex(0)
      setSecret("")
    } catch (err) {
      if (err instanceof ShareError && err.code === "expired" && info) setInfo({ ...info, expired: true })
      setOpenError(err instanceof ShareError ? err.message : "Decryption failed. The file may be damaged or too large for this device.")
    } finally {
      setStage(null)
    }
  }

  const reset = () => {
    setPkg(null)
    setInfo(null)
    setOpened(null)
    setOpenError(null)
    setInspectError(null)
    setSecret("")
  }

  const busy = stage !== null
  const isKey = info?.protection === "key"

  if (opened) {
    const allow = opened.info.allowDownload
    const current = opened.files[Math.min(previewIndex, opened.files.length - 1)]
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Notice tone="success" icon={LockOpen} title="Package opened">
          Decrypted on this device. {opened.files.length} file{opened.files.length === 1 ? "" : "s"} · expires{" "}
          {format(new Date(opened.info.expiresAt), "PPp")}.
        </Notice>

        {opened.notes ? (
          <section className="rounded-2xl border bg-card p-4 shadow-soft">
            <h2 className="mb-1 text-sm font-medium">Note from the sender</h2>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{opened.notes}</p>
          </section>
        ) : null}

        {!allow ? (
          <Notice tone="warning" title="View only">
            The sender turned off downloads, so LifeKit only shows a preview. Note that a browser can&apos;t truly enforce
            &ldquo;view only&rdquo; — anything shown on screen can still be captured.
          </Notice>
        ) : null}

        {opened.files.length > 1 ? (
          <ul className="divide-y rounded-2xl border bg-card shadow-soft" aria-label="Files in package">
            {opened.files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2">
                <FileKindIcon file={f} className="size-5 shrink-0 text-muted-foreground" />
                <button
                  type="button"
                  aria-pressed={i === previewIndex}
                  onClick={() => setPreviewIndex(i)}
                  className={cn(
                    "min-w-0 flex-1 rounded-md px-1 py-1.5 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    i === previewIndex && "font-medium text-primary"
                  )}
                >
                  <span className="block truncate">{f.name}</span>
                  <span className="block text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                </button>
                {allow ? (
                  <Button variant="ghost" size="icon-sm" onClick={() => downloadBlob(f, f.name)} aria-label={`Download ${f.name}`}>
                    <Download aria-hidden />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {current ? <FilePreview key={`${current.name}-${previewIndex}`} file={current} allowDownload={allow} /> : null}

        <div className="grid gap-2 sm:grid-cols-2">
          {allow && current ? (
            <Button size="lg" onClick={() => downloadBlob(current, current.name)}>
              <Download aria-hidden /> Download {opened.files.length > 1 ? "this file" : current.name}
            </Button>
          ) : null}
          <Button size="lg" variant="outline" onClick={reset} className={cn(!(allow && current) && "sm:col-span-2")}>
            <RotateCcw aria-hidden /> Open another package
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {!pkg || inspectError ? (
        <>
          <FileDropzone
            // iOS can grey out unknown extensions, so also allow generic binary/typeless files;
            // the package header check rejects anything that isn't a LifeKit package.
            accept={[PACKAGE_EXTENSION, "application/octet-stream", ""]}
            maxBytes={MAX_SHARE_BYTES + 1024 * 1024}
            onFiles={choose}
            title="Choose a .lifekit package"
            hint="Received from someone using LifeKit SecureShare"
          />
          {inspectError ? (
            <Notice tone="danger" title="Can't open this file">
              {inspectError}
            </Notice>
          ) : null}
        </>
      ) : (
        <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileLock2 className="size-6" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{pkg.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatBytes(pkg.size)}
                {info ? ` · ${info.fileCount} file${info.fileCount === 1 ? "" : "s"} · ${isKey ? "share key" : "password"} protected` : ""}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              Change
            </Button>
          </div>

          {!info ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Reading package…
            </p>
          ) : info.expired ? (
            <Notice tone="danger" icon={Clock} title="This package has expired">
              It expired on {format(new Date(info.expiresAt), "PPp")}. Ask the sender for a new one.
            </Notice>
          ) : (
            <>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="size-4" aria-hidden />
                Expires in {formatDistanceToNowStrict(new Date(info.expiresAt))} ({format(new Date(info.expiresAt), "PPp")})
              </p>
              <form onSubmit={open} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ss-secret">{isKey ? "Share key" : "Password"}</Label>
                  <div className="relative">
                    <Input
                      id="ss-secret"
                      type={showSecret || isKey ? "text" : "password"}
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      placeholder={isKey ? "Paste the share key" : "Enter the password"}
                      aria-invalid={!!openError}
                      className={cn("pr-11", isKey && "font-mono text-sm")}
                    />
                    {!isKey ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-1 right-1"
                        onClick={() => setShowSecret((v) => !v)}
                        aria-label={showSecret ? "Hide password" : "Show password"}
                        aria-pressed={showSecret}
                      >
                        {showSecret ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {openError ? <p className="text-sm text-destructive" role="alert">{openError}</p> : null}
                <Button type="submit" size="lg" className="w-full" disabled={busy || !secret.trim()}>
                  {busy ? <Loader2 className="animate-spin" aria-hidden /> : <LockOpen aria-hidden />}
                  {busy ? (stage === "deriving-key" ? "Checking password…" : "Decrypting…") : "Decrypt and preview"}
                </Button>
              </form>
            </>
          )}
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        Expiry is enforced by the LifeKit app, not by the encryption itself. The cryptography guarantees only that the file can&apos;t be
        read without the password or key, and that the package wasn&apos;t modified — someone with the file, the password and modified
        software could still open it after it expires.
      </p>
    </div>
  )
}
