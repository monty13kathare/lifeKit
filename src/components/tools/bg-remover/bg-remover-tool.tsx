"use client"

import { useState } from "react"
import { removeBackground } from "@imgly/background-removal"
import { Download, ImageIcon, LoaderCircle, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { FileDropzone } from "@/components/common/file-dropzone"
import { Notice } from "@/components/common/notice"
import { Button } from "@/components/ui/button"
import { downloadBlob, formatBytes, replaceExtension } from "@/lib/files"
import { EXTENDED_IMAGE_ACCEPT, IMAGE_MAX_BYTES, IMAGE_WARN_BYTES, mimeOf } from "@/lib/image/formats"
import { useObjectUrls } from "../image-shared/hooks"
import { Workspace } from "../image-shared/fields"

export function BgRemoverTool() {
  const urls = useObjectUrls()
  const [source, setSource] = useState<{ file: File; url: string; mime: string } | null>(null)
  const [result, setResult] = useState<{ blob: Blob; url: string } | null>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [progressText, setProgressText] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const processImage = async (file: File) => {
    setStatus("loading")
    setProgressText("Initializing AI model...")
    try {
      const config = {
        progress: (key: string, current: number, total: number) => {
          const pct = total > 0 ? Math.round((current / total) * 100) : 0
          if (key.includes("fetch")) {
            setProgressText(`Downloading AI model (${pct}%)... This happens once.`)
          } else {
            setProgressText("Removing background...")
          }
        },
      }
      const blob = await removeBackground(file, config)
      const url = urls.create(blob)
      setResult({ blob, url })
      setStatus("done")
      toast.success("Background removed!")
    } catch (err) {
      console.error(err)
      setStatus("error")
      setErrorMsg(err instanceof Error ? err.message : "Couldn't remove the background.")
      toast.error("Failed to remove background")
    }
  }

  const onFiles = async ([file]: File[]) => {
    if (!file) return
    if (source?.url) urls.revoke(source.url)
    if (result?.url) urls.revoke(result.url)
    setSource({ file, url: urls.create(file), mime: mimeOf(file) })
    setResult(null)
    setErrorMsg(null)
    await processImage(file)
  }

  const reset = () => {
    if (source?.url) urls.revoke(source.url)
    if (result?.url) urls.revoke(result.url)
    setSource(null)
    setResult(null)
    setStatus("idle")
    setErrorMsg(null)
  }

  const download = () => {
    if (!result || !source) return
    const base = source.file.name.replace(/\.[^.]+$/, "")
    downloadBlob(result.blob, replaceExtension(`${base}-nobg`, ".png"))
    toast.success("Image saved")
  }

  const main = !source ? (
    <FileDropzone
      accept={EXTENDED_IMAGE_ACCEPT}
      maxBytes={IMAGE_MAX_BYTES}
      warnBytes={IMAGE_WARN_BYTES}
      onFiles={onFiles}
      title="Add a photo"
      hint="JPG, PNG, WebP or HEIC"
      allowCamera
    />
  ) : (
    <section aria-labelledby="bg-preview-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 id="bg-preview-heading" className="truncate text-base font-semibold" title={source.file.name}>
            {source.file.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatBytes(source.file.size)}
          </p>
        </div>
        <Button variant="outline" onClick={reset} disabled={status === "loading"}>
          <RefreshCw aria-hidden /> Try another
        </Button>
      </div>

      <div className="relative flex min-h-56 items-center justify-center overflow-hidden rounded-2xl border bg-checker p-3 sm:min-h-72">
        {status === "done" && result ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={result.url} alt="Result" className="max-h-[55vh] max-w-full shadow-soft" />
        ) : status === "error" ? (
          <div className="flex flex-col items-center justify-center space-y-2 text-center text-muted-foreground">
            <ImageIcon className="size-10" />
            <p>Failed to process image.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={source.url} alt="Original" className="max-h-[55vh] max-w-full opacity-30 blur-sm grayscale" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/20 backdrop-blur-[2px]">
              <LoaderCircle className="size-10 animate-spin text-primary" />
              <p className="rounded-full bg-background/80 px-3 py-1 font-medium text-foreground shadow-sm">
                {progressText || "Processing..."}
              </p>
            </div>
          </div>
        )}
      </div>

      {errorMsg ? (
        <Notice tone="danger" title="Error">
          {errorMsg}
        </Notice>
      ) : null}
      <Notice tone="info" title="On-Device Privacy">
        The AI model runs entirely in your browser. Your photos are never uploaded to any server.
      </Notice>
    </section>
  )

  const controls = source && status === "done" ? (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Details</h2>
      <p className="text-sm text-muted-foreground">
        The background was successfully removed. The image is now a transparent PNG.
      </p>
      {result && (
        <p className="text-sm font-medium">
          Output size: {formatBytes(result.blob.size)}
        </p>
      )}
    </div>
  ) : null

  const actions = source ? (
    <Button size="lg" className="w-full" onClick={download} disabled={status !== "done"}>
      {status === "loading" ? <LoaderCircle className="animate-spin" aria-hidden /> : <Download aria-hidden />}
      {status === "loading" ? "Removing Background…" : "Download Image"}
    </Button>
  ) : null

  return <Workspace main={main} controls={controls} actions={actions} />
}
