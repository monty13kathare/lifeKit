"use client"

import { useEffect, useState } from "react"
import { format, formatDistanceToNowStrict } from "date-fns"
import {
  Archive,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileLock2,
  Globe,
  Loader2,
  LockOpen,
  RotateCcw,
} from "lucide-react"
import { toast } from "sonner"
import { FileDropzone } from "@/components/common/file-dropzone"
import { Notice } from "@/components/common/notice"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { todayString } from "@/lib/dates"
import { downloadBlob, formatBytes } from "@/lib/files"
import { downloadFromCloudRelay } from "@/lib/services/share/cloud-relay"
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

  // Remote link handling
  const [linkInput, setLinkInput] = useState("")
  const [fetchingRemote, setFetchingRemote] = useState(false)
  const [zipping, setZipping] = useState(false)

  // Load from remote cloud package and optionally decrypt with hash key
  const loadRemotePackage = async (url: string, autoKey?: string) => {
    setFetchingRemote(true)
    setStage("downloading")
    setInspectError(null)
    setOpenError(null)
    setPkg(null)
    setInfo(null)
    setOpened(null)

    try {
      const blob = await downloadFromCloudRelay(url)
      const file = new File([blob], "shared-package.lifekit", { type: "application/octet-stream" })
      setPkg(file)
      const parsedInfo = await service.inspectShare(file)
      setInfo(parsedInfo)

      // If autoKey is available and package uses key protection, decrypt automatically!
      if (autoKey && parsedInfo.protection === "key" && !parsedInfo.expired) {
        setStage("decrypting")
        const result = await service.openShare(file, autoKey, { onStage: setStage })
        setOpened(result)
        setPreviewIndex(0)
        toast.success("Package decrypted successfully!")
      } else if (parsedInfo.protection === "key" && !autoKey) {
        // Share key needed
        toast.info("Please enter the share key to decrypt these files.")
      } else if (parsedInfo.protection === "password") {
        toast.info("Please enter the password to decrypt these files.")
      }
    } catch (err) {
      console.error("[OpenShare Load Remote Error]", err)
      setInspectError(
        err instanceof ShareError
          ? err.message
          : "Failed to download or read the package. The link may have expired or is invalid."
      )
    } finally {
      setFetchingRemote(false)
      setStage(null)
    }
  }

  // Check URL query parameters and hash on mount
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const pkgUrl = params.get("pkg")
    if (!pkgUrl) return

    // Extract decryption key from URL hash (#key=xyz)
    const hash = window.location.hash
    const match = hash.match(/key=([^&]+)/)
    const keyFromHash = match ? decodeURIComponent(match[1]) : ""

    loadRemotePackage(pkgUrl, keyFromHash)
  }, [])

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

  const handleManualLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!linkInput.trim()) return

    try {
      const urlObj = new URL(linkInput.trim())
      const pkgParam = urlObj.searchParams.get("pkg")
      const match = urlObj.hash.match(/key=([^&]+)/)
      const keyFromHash = match ? decodeURIComponent(match[1]) : ""

      if (pkgParam) {
        loadRemotePackage(pkgParam, keyFromHash)
      } else {
        // Direct download URL
        loadRemotePackage(linkInput.trim(), keyFromHash)
      }
    } catch {
      // If not a full URL, treat as direct package URL
      loadRemotePackage(linkInput.trim())
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
      setOpenError(err instanceof ShareError ? err.message : "Decryption failed. The secret may be wrong, or the file is damaged.")
    } finally {
      setStage(null)
    }
  }

  const downloadAllZip = async () => {
    if (!opened || !opened.files.length) return
    setZipping(true)
    try {
      const JSZip = (await import("jszip")).default
      const zip = new JSZip()
      for (const file of opened.files) {
        zip.file(file.name, file)
      }
      const blob = await zip.generateAsync({ type: "blob" })
      downloadBlob(blob, `shared-files-${todayString()}.zip`)
      toast.success("Downloaded all files as a ZIP archive")
    } catch (err) {
      console.error("[ZIP Export Error]", err)
      toast.error("Failed to generate ZIP file.")
    } finally {
      setZipping(false)
    }
  }

  const reset = () => {
    setPkg(null)
    setInfo(null)
    setOpened(null)
    setOpenError(null)
    setInspectError(null)
    setSecret("")
    setLinkInput("")
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState(null, "", window.location.pathname)
    }
  }

  const busy = stage !== null || fetchingRemote
  const isKey = info?.protection === "key"

  if (opened) {
    const allow = opened.info.allowDownload
    const current = opened.files[Math.min(previewIndex, opened.files.length - 1)]
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Notice tone="success" icon={LockOpen} title="Files decrypted & ready">
          Decrypted securely in your browser. {opened.files.length} file{opened.files.length === 1 ? "" : "s"} · expires{" "}
          {format(new Date(opened.info.expiresAt), "PPp")}.
        </Notice>

        {opened.notes ? (
          <section className="rounded-2xl border bg-card p-4 shadow-soft">
            <h2 className="mb-1 text-sm font-medium">Note from the sender</h2>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{opened.notes}</p>
          </section>
        ) : null}

        {!allow ? (
          <Notice tone="warning" title="View only mode">
            The sender disabled downloading raw files. LifeKit displays an in-browser preview only.
          </Notice>
        ) : null}

        {/* Files Navigation List */}
        {opened.files.length > 1 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Files ({opened.files.length})
              </span>
              {allow ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadAllZip}
                  disabled={zipping}
                  className="h-8 gap-1.5 text-xs"
                >
                  {zipping ? <Loader2 className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />}
                  Download all as ZIP
                </Button>
              ) : null}
            </div>

            <ul className="divide-y rounded-2xl border bg-card shadow-soft" aria-label="Files in package">
              {opened.files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2">
                  <FileKindIcon file={f} className="size-5 shrink-0 text-muted-foreground" />
                  <button
                    type="button"
                    onClick={() => setPreviewIndex(i)}
                    aria-pressed={i === previewIndex}
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
          </div>
        ) : null}

        {/* Current Active File Preview (Image, Video, Audio, PDF, Text) */}
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
      {fetchingRemote ? (
        <section className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border bg-card shadow-soft space-y-4">
          <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Downloading encrypted package…</h3>
            <p className="text-sm text-muted-foreground">Fetching encrypted files from zero-knowledge cloud relay.</p>
          </div>
        </section>
      ) : !pkg || inspectError ? (
        <>
          <FileDropzone
            accept={[PACKAGE_EXTENSION, "application/octet-stream", ""]}
            maxBytes={MAX_SHARE_BYTES + 1024 * 1024}
            onFiles={choose}
            title="Open an encrypted package (.lifekit)"
            hint="Drag & drop a .lifekit file or choose from your computer"
          />

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-border"></div>
            <span className="flex-shrink mx-4 text-xs font-medium text-muted-foreground uppercase">Or open from link</span>
            <div className="flex-grow border-t border-border"></div>
          </div>

          <form onSubmit={handleManualLinkSubmit} className="flex gap-2">
            <Input
              type="url"
              placeholder="Paste a LifeKit public share link here..."
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              className="text-sm font-mono"
            />
            <Button type="submit" disabled={!linkInput.trim() || busy}>
              <Globe className="size-4 mr-1.5" /> Open Link
            </Button>
          </form>

          {inspectError ? (
            <Notice tone="danger" title="Can't open this file or link">
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
              <Loader2 className="size-4 animate-spin" aria-hidden /> Reading package header…
            </p>
          ) : info.expired ? (
            <Notice tone="danger" icon={Clock} title="This package has expired">
              It expired on {format(new Date(info.expiresAt), "PPp")}. Ask the sender for a new link.
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
                  {busy ? (stage === "deriving-key" ? "Verifying password…" : "Decrypting files…") : "Decrypt and view files"}
                </Button>
              </form>
            </>
          )}
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        Zero-knowledge architecture: All decryption takes place inside your browser using the Web Crypto API.
        No plaintext content is ever sent to or seen by the server.
      </p>
    </div>
  )
}

