"use client"

import { useEffect, useRef, useState } from "react"
import { File as FileIcon, FileArchive, FileAudio, FileImage, FileText, FileVideo } from "lucide-react"
import { formatBytes } from "@/lib/files"
import { cn } from "@/lib/utils"

type Kind = "image" | "pdf" | "video" | "audio" | "text" | "other"

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|html?|css|js|ts|tsx|jsx|log|ini|ya?ml|toml|srt|vtt)$/i
const TEXT_PREVIEW_BYTES = 256 * 1024

export function fileKind(file: File): Kind {
  const t = file.type
  if (t.startsWith("image/")) return "image"
  if (t === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf"
  if (t.startsWith("video/")) return "video"
  if (t.startsWith("audio/")) return "audio"
  if (t.startsWith("text/") || t === "application/json" || t === "application/xml" || TEXT_EXT.test(file.name)) return "text"
  return "other"
}

export function FileKindIcon({ file, className }: { file: File; className?: string }) {
  const kind = fileKind(file)
  const Icon =
    kind === "image"
      ? FileImage
      : kind === "video"
        ? FileVideo
        : kind === "audio"
          ? FileAudio
          : kind === "text" || kind === "pdf"
            ? FileText
            : /zip|rar|7z|tar|gzip/.test(file.type)
              ? FileArchive
              : FileIcon
  return <Icon className={className} aria-hidden />
}

/** Attach a short-lived object URL to a media element (revoked on change/unmount). */
function useObjectUrl<T extends HTMLImageElement | HTMLVideoElement | HTMLAudioElement | HTMLIFrameElement>(blob: Blob) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const url = URL.createObjectURL(blob)
    el.src = url
    return () => {
      el.removeAttribute("src")
      URL.revokeObjectURL(url)
    }
  }, [blob])
  return ref
}

function Fallback({ file, message }: { file: File; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <FileKindIcon file={file} className="size-8" />
      </div>
      <p className="text-sm text-muted-foreground">{message ?? "No preview available for this file type."}</p>
    </div>
  )
}

function ImagePreview({ file }: { file: File }) {
  const ref = useObjectUrl<HTMLImageElement>(file)
  const [failed, setFailed] = useState(false)
  if (failed) return <Fallback file={file} message="This image couldn't be displayed." />
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not an optimisable asset
    <img
      ref={ref}
      alt={`Preview of ${file.name}`}
      draggable={false}
      onError={() => setFailed(true)}
      className="mx-auto max-h-[60dvh] w-auto max-w-full object-contain"
    />
  )
}

function PdfPreview({ file }: { file: File }) {
  const ref = useObjectUrl<HTMLIFrameElement>(file)
  return (
    <div>
      <iframe ref={ref} title={`Preview of ${file.name}`} className="h-[60dvh] w-full bg-white" />
      <p className="px-3 py-2 text-xs text-muted-foreground">
        If the PDF doesn&apos;t appear, your browser can&apos;t show PDFs inline (common on phones).
      </p>
    </div>
  )
}

function VideoPreview({ file, allowDownload }: { file: File; allowDownload: boolean }) {
  const ref = useObjectUrl<HTMLVideoElement>(file)
  const [failed, setFailed] = useState(false)
  if (failed) return <Fallback file={file} message="This video format can't be played in this browser." />
  return (
    <video
      ref={ref}
      controls
      playsInline
      controlsList={allowDownload ? undefined : "nodownload"}
      onError={() => setFailed(true)}
      className="max-h-[60dvh] w-full bg-black"
    />
  )
}

function AudioPreview({ file, allowDownload }: { file: File; allowDownload: boolean }) {
  const ref = useObjectUrl<HTMLAudioElement>(file)
  const [failed, setFailed] = useState(false)
  if (failed) return <Fallback file={file} message="This audio format can't be played in this browser." />
  return (
    <div className="p-4">
      <audio
        ref={ref}
        controls
        controlsList={allowDownload ? undefined : "nodownload"}
        onError={() => setFailed(true)}
        className="w-full"
      />
    </div>
  )
}

function TextPreview({ file }: { file: File }) {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    file
      .slice(0, TEXT_PREVIEW_BYTES)
      .text()
      .then((t) => alive && setText(t))
      .catch(() => alive && setText(""))
    return () => {
      alive = false
    }
  }, [file])
  if (text === null) return <p className="p-4 text-sm text-muted-foreground">Loading preview…</p>
  return (
    <div>
      <pre className="max-h-[60dvh] overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words sm:text-sm">
        {text || "(empty file)"}
      </pre>
      {file.size > TEXT_PREVIEW_BYTES ? (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">Showing the first {formatBytes(TEXT_PREVIEW_BYTES, 0)}.</p>
      ) : null}
    </div>
  )
}

/** Local preview for any file: image, PDF, video, audio, text, or an icon + metadata. */
export function FilePreview({ file, allowDownload = true, className }: { file: File; allowDownload?: boolean; className?: string }) {
  const kind = fileKind(file)
  return (
    <figure className={cn("overflow-hidden rounded-xl border bg-surface", className)}>
      <div className="bg-surface-muted/40" onContextMenu={allowDownload ? undefined : (e) => e.preventDefault()}>
        {kind === "image" ? (
          <ImagePreview key={`${file.name}-${file.size}-${file.lastModified}`} file={file} />
        ) : kind === "pdf" ? (
          <PdfPreview file={file} />
        ) : kind === "video" ? (
          <VideoPreview key={file.name + file.size} file={file} allowDownload={allowDownload} />
        ) : kind === "audio" ? (
          <AudioPreview key={file.name + file.size} file={file} allowDownload={allowDownload} />
        ) : kind === "text" ? (
          <TextPreview key={file.name + file.size} file={file} />
        ) : (
          <Fallback file={file} />
        )}
      </div>
      <figcaption className="flex items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
        <FileKindIcon file={file} className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{file.name}</span>
        <span className="shrink-0">{file.type || "unknown type"}</span>
        <span className="shrink-0 tabular-nums">· {formatBytes(file.size)}</span>
      </figcaption>
    </figure>
  )
}
