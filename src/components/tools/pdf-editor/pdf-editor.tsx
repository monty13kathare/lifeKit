"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { FileLock, FilePen, FileX, Highlighter, LoaderCircle, PenLine, Signature, Stamp } from "lucide-react"
import { FileDropzone } from "@/components/common/file-dropzone"
import { Notice } from "@/components/common/notice"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { MB, PDF_TYPES } from "@/lib/files"
import { looksEncrypted, normalizeRotation, type EditorPage } from "@/lib/pdf/edit"
import { openPdf } from "@/lib/pdf/pdfjs"
import { PdfEditorWorkspace, type EditorSession } from "./editor"
import { uid } from "./use-editor-state"

type Phase =
  | { status: "empty" }
  | { status: "loading"; label: string; progress: number | null }
  | { status: "error"; kind: "password" | "invalid" | "generic"; message: string }
  | { status: "ready"; session: EditorSession }

const FEATURES = [
  { icon: FilePen, label: "Reorder, rotate, duplicate & delete pages" },
  { icon: PenLine, label: "Add text and freehand drawings" },
  { icon: Highlighter, label: "Highlight important areas" },
  { icon: Signature, label: "Sign with your finger or mouse" },
  { icon: Stamp, label: "Watermarks and page numbers" },
]

function classifyError(err: unknown): Extract<Phase, { status: "error" }> {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : ""
  if (name === "PasswordException") {
    return {
      status: "error",
      kind: "password",
      message:
        "This PDF is password-protected. LifeKit can't open encrypted files — remove the password in the app that created it (or print it to a new PDF) and try again.",
    }
  }
  if (name === "InvalidPDFException" || name === "NotAPdf" || name === "FormatError") {
    return {
      status: "error",
      kind: "invalid",
      message: "This file doesn't look like a valid PDF, or it's damaged. Try re-exporting it and upload again.",
    }
  }
  return {
    status: "error",
    kind: "generic",
    message: "Something went wrong while opening this PDF. It may be damaged or use features this browser can't read.",
  }
}

export function PdfEditor() {
  const [phase, setPhase] = useState<Phase>({ status: "empty" })
  const loadId = useRef(0)
  const pdfRef = useRef<EditorSession["pdf"] | null>(null)

  const releasePdf = useCallback(() => {
    const pdf = pdfRef.current
    pdfRef.current = null
    if (pdf) void pdf.destroy()
  }, [])

  useEffect(() => releasePdf, [releasePdf])

  const load = async (file: File) => {
    const id = ++loadId.current
    releasePdf()
    setPhase({ status: "loading", label: "Reading file…", progress: null })
    try {
      const bytes = await file.arrayBuffer()
      const head = new TextDecoder("latin1").decode(new Uint8Array(bytes, 0, Math.min(1024, bytes.byteLength)))
      if (!head.includes("%PDF")) throw Object.assign(new Error("Not a PDF"), { name: "NotAPdf" })
      setPhase({ status: "loading", label: "Opening PDF…", progress: null })
      // pdf.js transfers (detaches) its buffer, so hand it a copy.
      const pdf = await openPdf(bytes.slice(0))
      if (id !== loadId.current) {
        void pdf.destroy()
        return
      }
      pdfRef.current = pdf
      const pages: EditorPage[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const p = await pdf.getPage(i)
        const [x1, y1, x2, y2] = p.view
        pages.push({
          id: uid("page"),
          srcIndex: i - 1,
          width: Math.abs(x2 - x1),
          height: Math.abs(y2 - y1),
          rotation: normalizeRotation(p.rotate),
        })
        if (i % 10 === 0 || i === pdf.numPages) {
          if (id !== loadId.current) return
          setPhase({ status: "loading", label: `Reading pages ${i} of ${pdf.numPages}…`, progress: i / pdf.numPages })
        }
      }
      if (id !== loadId.current) return
      if (!pages.length) throw Object.assign(new Error("No pages"), { name: "InvalidPDFException" })
      setPhase({
        status: "ready",
        session: { key: uid("session"), file, bytes, pdf, pages, encrypted: looksEncrypted(bytes) },
      })
    } catch (err) {
      if (id !== loadId.current) return
      const failure = classifyError(err)
      // Password-protected and invalid files are expected user errors, not bugs.
      if (failure.kind !== "password" && failure.kind !== "invalid") console.error(err)
      releasePdf()
      setPhase(failure)
    }
  }

  const reset = () => {
    loadId.current++
    releasePdf()
    setPhase({ status: "empty" })
  }

  if (phase.status === "ready") {
    return <PdfEditorWorkspace key={phase.session.key} session={phase.session} onClose={reset} />
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {phase.status === "loading" ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card px-6 py-14 text-center" role="status" aria-live="polite">
          <LoaderCircle className="size-8 animate-spin text-primary" aria-hidden />
          <p className="text-sm font-medium">{phase.label}</p>
          {phase.progress !== null && <Progress value={Math.round(phase.progress * 100)} className="w-full max-w-xs" />}
        </div>
      ) : (
        <FileDropzone
          accept={PDF_TYPES}
          maxBytes={100 * MB}
          warnBytes={25 * MB}
          onFiles={([f]) => f && load(f)}
          title="Drop a PDF here"
          hint="PDF files"
        />
      )}

      {phase.status === "error" && (
        <Notice
          tone="danger"
          icon={phase.kind === "password" ? FileLock : FileX}
          title={phase.kind === "password" ? "Password-protected PDF" : phase.kind === "invalid" ? "Unsupported or damaged file" : "Couldn't open this PDF"}
          action={
            <Button variant="outline" onClick={reset}>
              Try another file
            </Button>
          }
        >
          {phase.message}
        </Notice>
      )}

      {phase.status === "empty" && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-sm">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" aria-hidden />
              </span>
              {label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
