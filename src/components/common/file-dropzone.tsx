"use client"

import { useId, useImperativeHandle, useRef, useState } from "react"
import { Camera, TriangleAlert, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { checkFile, formatBytes, type FileRules } from "@/lib/files"
import { cn } from "@/lib/utils"

interface FileDropzoneProps extends FileRules {
  onFiles: (files: File[]) => void
  multiple?: boolean
  /** Short label for the accepted formats, e.g. "JPG, PNG or WebP". */
  hint?: string
  title?: string
  /** Offer a "Take photo" button that opens the rear camera on mobile. */
  allowCamera?: boolean
  /** Render a compact single-row version (e.g. "add more" under a list). */
  compact?: boolean
  disabled?: boolean
  /** Imperative handle: `pickerRef.current?.open()` opens the file picker from elsewhere. */
  pickerRef?: React.Ref<{ open: () => void }>
  className?: string
}

/**
 * Drag-and-drop + click-to-browse file input with MIME/size validation.
 * Rejected files are reported inline; accepted files are passed to `onFiles`.
 */
export function FileDropzone({
  onFiles,
  accept,
  maxBytes,
  warnBytes,
  multiple = false,
  hint,
  title,
  allowCamera = false,
  compact = false,
  disabled = false,
  pickerRef,
  className,
}: FileDropzoneProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  useImperativeHandle(pickerRef, () => ({ open: () => inputRef.current?.click() }), [])
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])

  const handle = (list: FileList | null) => {
    if (!list?.length) return
    const files = Array.from(list).slice(0, multiple ? undefined : 1)
    const accepted: File[] = []
    const errs: string[] = []
    const warns: string[] = []
    for (const file of files) {
      const res = checkFile(file, { accept, maxBytes, warnBytes })
      if (!res.ok) errs.push(res.error!)
      else {
        accepted.push(file)
        if (res.warning) warns.push(res.warning)
      }
    }
    setErrors(errs)
    setWarnings(warns)
    if (accepted.length) onFiles(accepted)
  }

  const acceptAttr = accept.join(",")
  const sizeHint = maxBytes ? `Up to ${formatBytes(maxBytes, 0)}${multiple ? " each" : ""}` : null

  return (
    <div className={className}>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!disabled) handle(e.dataTransfer.files)
        }}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-surface text-center transition-colors",
          compact ? "flex-row gap-3 px-4 py-3" : "gap-3 px-6 py-10 sm:py-14",
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
          disabled && "pointer-events-none opacity-60"
        )}
      >
        {!compact && (
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Upload className="size-6" aria-hidden />
          </div>
        )}
        <div className={cn(compact && "flex-1 text-left")}>
          <p className={cn("font-medium", compact ? "text-sm" : "text-base")}>
            {title ?? (multiple ? "Drop files here" : "Drop a file here")}
            <span className="hidden text-muted-foreground sm:inline"> or browse</span>
          </p>
          {(hint || sizeHint) && (
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              {[hint, sizeHint].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <div className={cn("flex flex-wrap items-center justify-center gap-2", !compact && "mt-1")}>
          <Button
            type="button"
            size={compact ? "sm" : "lg"}
            variant={compact ? "outline" : "default"}
            onClick={() => inputRef.current?.click()}
          >
            <Upload aria-hidden /> {compact ? "Add" : multiple ? "Choose files" : "Choose file"}
          </Button>
          {allowCamera && (
            <Button
              type="button"
              size={compact ? "sm" : "lg"}
              variant="outline"
              onClick={() => cameraRef.current?.click()}
            >
              <Camera aria-hidden /> Take photo
            </Button>
          )}
        </div>
        <label htmlFor={inputId} className="sr-only">
          {title ?? "Choose file"}
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={acceptAttr}
          multiple={multiple}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            handle(e.target.files)
            e.target.value = ""
          }}
        />
        {allowCamera && (
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              handle(e.target.files)
              e.target.value = ""
            }}
          />
        )}
      </div>
      {(errors.length > 0 || warnings.length > 0) && (
        <ul className="mt-3 space-y-1.5" aria-live="polite">
          {errors.map((msg) => (
            <li key={msg} className="flex items-start gap-2 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {msg}
            </li>
          ))}
          {warnings.map((msg) => (
            <li key={msg} className="flex items-start gap-2 text-sm text-warning-foreground dark:text-warning">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {msg}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
