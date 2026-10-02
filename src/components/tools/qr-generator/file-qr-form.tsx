"use client"

import { useId } from "react"
import { FileAudio, FileImage, FileText, FileVideo, HardDrive, Link2, PackageOpen, TriangleAlert, X, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileDropzone } from "@/components/common/file-dropzone"
import { Notice } from "@/components/common/notice"
import { formatBytes, MB, readAsDataURL } from "@/lib/files"
import { QR_BYTE_CAPACITY, maxEmbeddableBytes, type EccLevel } from "@/lib/qr/capacity"
import { FILE_KINDS, checkHostedUrl, type FileKind, type FileMode } from "@/lib/qr/generator"
import { cn } from "@/lib/utils"

export interface FileQrState {
  kind: FileKind
  mode: FileMode
  hostedUrl: string
  embed: { name: string; size: number; mime: string; dataUrl: string } | null
  local: { name: string; size: number; url: string } | null
}

export const INITIAL_FILE_STATE: FileQrState = { kind: "pdf", mode: "hosted", hostedUrl: "", embed: null, local: null }

export interface FileQrResult {
  payload: string | null
  error?: string
  warning?: string
}

const KIND_ICONS: Record<FileKind, LucideIcon> = { pdf: FileText, image: FileImage, video: FileVideo, audio: FileAudio }

const MODES: Array<{ id: FileMode; title: string; description: string; icon: LucideIcon }> = [
  { id: "hosted", title: "Link to a file you've hosted", description: "Best option. Works on any phone.", icon: Link2 },
  { id: "embed", title: "Embed small file in QR", description: "Tiny files only (about 2 KB).", icon: PackageOpen },
  { id: "local", title: "Local reference (this device only)", description: "Won't work on other devices.", icon: HardDrive },
]

/** Pure: derive the QR payload for the file modes. */
export function fileQrPayload(state: FileQrState, ecc: EccLevel): FileQrResult {
  if (state.mode === "hosted") {
    if (!state.hostedUrl.trim()) return { payload: null }
    const check = checkHostedUrl(state.hostedUrl, state.kind)
    return check.error ? { payload: null, error: check.error } : { payload: check.url!, warning: check.warning }
  }
  if (state.mode === "embed") {
    if (!state.embed) return { payload: null }
    const cap = QR_BYTE_CAPACITY[ecc]
    if (state.embed.dataUrl.length > cap) {
      return {
        payload: null,
        error: `Encoded file is ${formatBytes(state.embed.dataUrl.length)} but a QR code at “${ecc}” correction holds ${formatBytes(cap)}. Lower the error correction${ecc === "H" ? " or remove the logo" : ""}, or use a hosted link.`,
      }
    }
    return { payload: state.embed.dataUrl }
  }
  if (!state.local) return { payload: null }
  return { payload: state.local.url }
}

interface FileQrFormProps {
  state: FileQrState
  ecc: EccLevel
  logoForcesH: boolean
  onChange: (next: Partial<FileQrState>) => void
  onError: (message: string) => void
}

export function FileQrForm({ state, ecc, logoForcesH, onChange, onError }: FileQrFormProps) {
  const id = useId()
  const kind = FILE_KINDS[state.kind]
  const hosted = state.mode === "hosted" && state.hostedUrl.trim() ? checkHostedUrl(state.hostedUrl, state.kind) : null
  const cap = QR_BYTE_CAPACITY[ecc]
  const maxFile = maxEmbeddableBytes(state.embed?.mime || kind.accept[0].replace("/*", "/png"), ecc)

  const pickEmbed = async (file: File) => {
    const mime = file.type || "application/octet-stream"
    const absoluteMax = maxEmbeddableBytes(mime, "L")
    if (file.size > absoluteMax) {
      onError(`“${file.name}” is ${formatBytes(file.size)}. The largest file that fits in any QR code is about ${formatBytes(absoluteMax)}. Use “Link to a file you've hosted” instead.`)
      return
    }
    try {
      const dataUrl = await readAsDataURL(file)
      onChange({ embed: { name: file.name, size: file.size, mime, dataUrl } })
    } catch {
      onError("This file couldn't be read.")
    }
  }

  const pickLocal = (file: File) => {
    onChange({ local: { name: file.name, size: file.size, url: URL.createObjectURL(file) } })
  }

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">File type</legend>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(FILE_KINDS) as FileKind[]).map((k) => {
            const Icon = KIND_ICONS[k]
            return (
              <button
                key={k}
                type="button"
                aria-pressed={state.kind === k}
                onClick={() => onChange({ kind: k, embed: null, local: null })}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium transition-colors",
                  state.kind === k ? "border-primary bg-primary/8 text-primary" : "bg-surface hover:bg-muted"
                )}
              >
                <Icon className="size-5" aria-hidden />
                {FILE_KINDS[k].label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">How should the QR reach the file?</legend>
        <div className="grid gap-2" role="radiogroup">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={state.mode === m.id}
              onClick={() => onChange({ mode: m.id })}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                state.mode === m.id ? "border-primary bg-primary/8" : "bg-surface hover:bg-muted"
              )}
            >
              <m.icon className={cn("size-5 shrink-0", state.mode === m.id ? "text-primary" : "text-muted-foreground")} aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{m.title}</span>
                <span className="block text-xs text-muted-foreground">{m.description}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {state.mode === "hosted" ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-url`}>Public link to your {kind.label.toLowerCase()}</Label>
            <Input
              id={`${id}-url`}
              type="url"
              inputMode="url"
              autoCapitalize="off"
              placeholder={`https://example.com/file.${kind.extensions[0]}`}
              value={state.hostedUrl}
              aria-invalid={hosted?.error ? true : undefined}
              onChange={(e) => onChange({ hostedUrl: e.target.value })}
            />
            {hosted?.error ? <p className="text-xs text-destructive">{hosted.error}</p> : null}
            {hosted?.warning ? <p className="text-xs text-warning-foreground dark:text-warning">{hosted.warning}</p> : null}
          </div>
          <Notice tone="info">
            LifeKit has no server, so it can&apos;t host files. Upload your file to a service you trust (Google Drive, Dropbox, OneDrive, your website…), set
            sharing to “anyone with the link”, and paste the link here.
          </Notice>
        </div>
      ) : null}

      {state.mode === "embed" ? (
        <div className="space-y-3">
          {state.embed ? (
            <div className="flex items-center gap-3 rounded-xl border bg-surface p-3">
              <PackageOpen className="size-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{state.embed.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(state.embed.size)} file → {formatBytes(state.embed.dataUrl.length)} encoded ·{" "}
                  {state.embed.dataUrl.length <= cap ? (
                    <span className="text-success">{formatBytes(cap - state.embed.dataUrl.length)} remaining</span>
                  ) : (
                    <span className="text-destructive">{formatBytes(state.embed.dataUrl.length - cap)} over</span>
                  )}
                </p>
              </div>
              <Button size="icon-sm" variant="ghost" aria-label="Remove file" onClick={() => onChange({ embed: null })}>
                <X aria-hidden />
              </Button>
            </div>
          ) : (
            <FileDropzone
              accept={kind.accept}
              hint={`${kind.hint} · max ~${formatBytes(maxFile)} at “${ecc}” correction`}
              title={`Choose a tiny ${kind.label.toLowerCase()}`}
              onFiles={([f]) => void pickEmbed(f)}
            />
          )}
          <Notice tone="warning" icon={TriangleAlert} title="Limited support">
            The whole file is stored inside the QR as a data link. Capacity is {formatBytes(cap)} at “{ecc}” correction
            {logoForcesH ? " (a logo forces High correction, which reduces capacity)" : ""}. Many scanner apps — including LifeKit&apos;s own, for safety — won&apos;t open data
            links.
          </Notice>
        </div>
      ) : null}

      {state.mode === "local" ? (
        <div className="space-y-3">
          {state.local ? (
            <div className="flex items-center gap-3 rounded-xl border bg-surface p-3">
              <HardDrive className="size-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{state.local.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(state.local.size)} · only on this device, this tab</p>
              </div>
              <Button size="icon-sm" variant="ghost" aria-label="Remove file" onClick={() => onChange({ local: null })}>
                <X aria-hidden />
              </Button>
            </div>
          ) : (
            <FileDropzone
              accept={kind.accept}
              hint={kind.hint}
              warnBytes={200 * MB}
              title={`Choose a ${kind.label.toLowerCase()}`}
              onFiles={([f]) => pickLocal(f)}
            />
          )}
          <Notice tone="warning" title="Won't work on other devices">
            This creates a temporary <code>blob:</code> link that only works in this browser tab and stops working when you close it. Scanning it with another phone
            will fail. Useful only for testing.
          </Notice>
        </div>
      ) : null}
    </div>
  )
}
