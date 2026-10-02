"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  ImageUp,
  Languages,
  Loader2,
  NotebookPen,
  Pencil,
  Play,
  RotateCcw,
  ScanText,
  Square,
  Volume2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { CopyButton } from "@/components/common/copy-button"
import { EmptyState } from "@/components/common/empty-state"
import { FileDropzone } from "@/components/common/file-dropzone"
import { Notice } from "@/components/common/notice"
import { downloadText, loadImage, MB } from "@/lib/files"
import { openPdf, renderPdfPage } from "@/lib/pdf/pdfjs"
import { takeOcrHandoff } from "@/lib/qr/session"
import { saveNote } from "@/lib/storage/notes"
import { cn } from "@/lib/utils"
import { OcrCamera } from "./ocr-camera"
import { OCR_LANGUAGES, OcrEngine, languageOf, preprocess, toCanvas, type OcrProgress, type Preprocess } from "./ocr-engine"

type PdfDoc = Awaited<ReturnType<typeof openPdf>>

interface Source {
  canvas: HTMLCanvasElement
  preview: string
  label: string
}

const LANG_ITEMS = OCR_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))
const MAX_QUERY_TEXT = 4000

const noop = () => () => {}
function useSpeechSupported() {
  return useSyncExternalStore(noop, () => typeof window !== "undefined" && "speechSynthesis" in window, () => false)
}

function makeSource(canvas: HTMLCanvasElement, label: string): Source {
  return { canvas, label, preview: canvas.toDataURL("image/jpeg", 0.85) }
}

export function OcrTool() {
  const router = useRouter()
  const [tab, setTab] = useState("upload")
  const [source, setSource] = useState<Source | null>(null)
  const [loadingInput, setLoadingInput] = useState<string | null>(null)
  const [inputError, setInputError] = useState<string | null>(null)
  const [pdf, setPdf] = useState<{ doc: PdfDoc; name: string; pages: number; page: number } | null>(null)
  const [lang, setLang] = useState("eng")
  const [withEnglish, setWithEnglish] = useState(true)
  const [pre, setPre] = useState<Preprocess>({ grayscale: false, contrast: false })
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle")
  const [progress, setProgress] = useState<OcrProgress>({ status: "", progress: 0 })
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [confidence, setConfidence] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const engineRef = useRef<OcrEngine | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const pdfRef = useRef<PdfDoc | null>(null)
  const speechSupported = useSpeechSupported()

  const langs = lang === "eng" || !withEnglish ? [lang] : [lang, "eng"]

  const run = useCallback(
    async (canvas: HTMLCanvasElement, opts: { langs: string[]; pre: Preprocess }) => {
      if (!engineRef.current) {
        engineRef.current = new OcrEngine()
        engineRef.current.setProgressHandler(setProgress)
      }
      setPhase("running")
      setOcrError(null)
      setEditing(false)
      setProgress({ status: "Preparing image", progress: 0 })
      try {
        await new Promise((r) => setTimeout(r, 0))
        const input = preprocess(canvas, opts.pre)
        const result = await engineRef.current.recognize(input, opts.langs)
        setText(result.text.trim())
        setConfidence(result.confidence)
        setPhase("done")
        if (!result.text.trim()) toast.info("No text found in this image.")
      } catch (e) {
        console.error(e)
        setPhase("error")
        setOcrError(
          navigator.onLine
            ? "Text recognition failed. Try a clearer image or a different language."
            : "You're offline and the OCR engine or language data isn't cached yet. Connect once to download it."
        )
      }
    },
    []
  )

  // Pick up an image handed over from the Scan page and run straight away.
  useEffect(() => {
    const dataUrl = takeOcrHandoff()
    if (!dataUrl) return
    void loadImage(dataUrl).then((img) => {
      const canvas = toCanvas(img, img.naturalWidth, img.naturalHeight)
      setSource(makeSource(canvas, "Camera capture from Scan"))
      void run(canvas, { langs: ["eng"], pre: { grayscale: false, contrast: false } })
    })
  }, [run])

  // Clean up: workers, speech, PDF documents.
  useEffect(() => {
    return () => {
      void engineRef.current?.terminate()
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel()
      void pdfRef.current?.destroy()
    }
  }, [])

  const resetOutput = () => {
    setPhase("idle")
    setText("")
    setConfidence(null)
    setOcrError(null)
  }

  const closePdf = () => {
    void pdfRef.current?.destroy()
    pdfRef.current = null
    setPdf(null)
  }

  const renderPage = async (doc: PdfDoc, page: number, name: string) => {
    setLoadingInput(`Rendering page ${page}…`)
    try {
      const canvas = await renderPdfPage(doc, page, 2.5)
      setSource(makeSource(toCanvas(canvas), `${name} · page ${page}`))
      resetOutput()
    } catch {
      setInputError("This page couldn't be rendered.")
    } finally {
      setLoadingInput(null)
    }
  }

  const onFile = async (file: File) => {
    setInputError(null)
    resetOutput()
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setLoadingInput("Opening PDF…")
      try {
        closePdf()
        const doc = await openPdf(await file.arrayBuffer())
        pdfRef.current = doc
        setPdf({ doc, name: file.name, pages: doc.numPages, page: 1 })
        await renderPage(doc, 1, file.name)
      } catch (e) {
        const msg = e instanceof Error && /password/i.test(e.message) ? "This PDF is password-protected." : "This PDF couldn't be opened. It may be damaged."
        setInputError(msg)
        setLoadingInput(null)
      }
      return
    }
    closePdf()
    setLoadingInput("Loading image…")
    try {
      const img = await loadImage(file)
      setSource(makeSource(toCanvas(img, img.naturalWidth, img.naturalHeight), file.name))
    } catch (e) {
      setInputError(e instanceof Error ? e.message : "This image couldn't be read.")
    } finally {
      setLoadingInput(null)
    }
  }

  const goToPage = (page: number) => {
    if (!pdf) return
    const p = Math.min(Math.max(1, page), pdf.pages)
    if (p === pdf.page) return
    setPdf({ ...pdf, page: p })
    void renderPage(pdf.doc, p, pdf.name)
  }

  const clearSource = () => {
    setSource(null)
    closePdf()
    resetOutput()
  }

  const speak = () => {
    if (!speechSupported || !text) return
    const synth = window.speechSynthesis
    if (speaking) {
      synth.cancel()
      setSpeaking(false)
      return
    }
    const u = new SpeechSynthesisUtterance(text)
    u.lang = languageOf(lang).bcp47
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    synth.cancel()
    synth.speak(u)
    setSpeaking(true)
  }

  const handOff = (path: string) => {
    let t = text
    if (t.length > MAX_QUERY_TEXT) {
      t = t.slice(0, MAX_QUERY_TEXT)
      toast.info(`Only the first ${MAX_QUERY_TEXT.toLocaleString()} characters were sent.`)
    }
    router.push(`${path}?text=${encodeURIComponent(t)}`)
  }

  const save = () => {
    if (!text.trim()) return
    saveNote(text, "ocr")
    toast.success("Saved to notes", { action: { label: "Open notes", onClick: () => router.push("/tools/notes") } })
  }

  const running = phase === "running"
  const pct = Math.round(progress.progress * 100)
  const confTone = confidence == null ? "" : confidence >= 80 ? "text-success" : confidence >= 60 ? "text-warning-foreground dark:text-warning" : "text-destructive"

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      {/* Input */}
      <div className="min-w-0 space-y-4">
        {source ? (
          <section className="rounded-2xl border bg-card p-3 sm:p-4" aria-label="Selected image">
            <div className="mb-2 flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{source.label}</p>
              <Button size="sm" variant="ghost" onClick={clearSource} disabled={running}>
                <X aria-hidden /> Change
              </Button>
            </div>
            <div className="relative overflow-hidden rounded-xl border bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
              <img
                src={source.preview}
                alt="Image to read"
                className="mx-auto max-h-[55dvh] w-auto object-contain"
                style={{ filter: [pre.grayscale && "grayscale(1)", pre.contrast && "contrast(1.6)"].filter(Boolean).join(" ") || undefined }}
              />
              {loadingInput ? (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm">
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> {loadingInput}
                </div>
              ) : null}
            </div>
            {pdf && pdf.pages > 1 ? (
              <div className="mt-3 flex items-center justify-center gap-2">
                <Button size="icon" variant="outline" aria-label="Previous page" disabled={pdf.page <= 1 || running || !!loadingInput} onClick={() => goToPage(pdf.page - 1)}>
                  <ChevronLeft aria-hidden />
                </Button>
                <Label className="flex items-center gap-2 text-sm font-normal">
                  Page
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={pdf.pages}
                    defaultValue={pdf.page}
                    key={pdf.page}
                    className="h-10 w-16 text-center"
                    disabled={running || !!loadingInput}
                    onBlur={(e) => goToPage(Number(e.target.value) || 1)}
                    onKeyDown={(e) => e.key === "Enter" && goToPage(Number((e.target as HTMLInputElement).value) || 1)}
                  />
                  of {pdf.pages}
                </Label>
                <Button size="icon" variant="outline" aria-label="Next page" disabled={pdf.page >= pdf.pages || running || !!loadingInput} onClick={() => goToPage(pdf.page + 1)}>
                  <ChevronRight aria-hidden />
                </Button>
              </div>
            ) : null}
          </section>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList className="w-full sm:w-fit">
              <TabsTrigger value="upload" className="px-4">
                <ImageUp aria-hidden /> Image or PDF
              </TabsTrigger>
              <TabsTrigger value="camera" className="px-4">
                <Camera aria-hidden /> Live camera
              </TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="mt-2 space-y-3">
              <FileDropzone
                accept={["image/*", "application/pdf"]}
                maxBytes={50 * MB}
                warnBytes={15 * MB}
                allowCamera
                title="Drop an image or PDF"
                hint="JPG, PNG, WebP, screenshots or a PDF page"
                disabled={!!loadingInput}
                onFiles={([f]) => void onFile(f)}
              />
              {loadingInput ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> {loadingInput}
                </p>
              ) : null}
            </TabsContent>
            <TabsContent value="camera" className="mt-2">
              <OcrCamera
                onCapture={(canvas) => {
                  resetOutput()
                  setSource(makeSource(toCanvas(canvas), "Camera capture"))
                }}
              />
            </TabsContent>
          </Tabs>
        )}
        {inputError ? <Notice tone="danger">{inputError}</Notice> : null}

        {/* Options */}
        <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="ocr-options">
          <h2 id="ocr-options" className="font-medium">
            Options
          </h2>
          <div className="space-y-1.5">
            <Label htmlFor="ocr-lang">Text language</Label>
            <Select items={LANG_ITEMS} value={lang} onValueChange={(v) => v && setLang(String(v))}>
              <SelectTrigger id="ocr-lang" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANG_ITEMS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {lang !== "eng" ? (
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="ocr-eng">Also detect English words</Label>
              <Switch id="ocr-eng" checked={withEnglish} onCheckedChange={setWithEnglish} />
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="ocr-gray">Grayscale</Label>
              <p className="text-xs text-muted-foreground">Removes colour noise from photos.</p>
            </div>
            <Switch id="ocr-gray" checked={pre.grayscale} onCheckedChange={(c) => setPre((p) => ({ ...p, grayscale: c }))} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="ocr-contrast">Boost contrast</Label>
              <p className="text-xs text-muted-foreground">Helps with faded or low-light text.</p>
            </div>
            <Switch id="ocr-contrast" checked={pre.contrast} onCheckedChange={(c) => setPre((p) => ({ ...p, contrast: c }))} />
          </div>
          <p className="text-xs text-muted-foreground">
            Language data downloads once from the OCR engine&apos;s CDN and is cached; your image never leaves your device.
          </p>
          <Button size="lg" className="w-full" disabled={!source || running || !!loadingInput} onClick={() => source && void run(source.canvas, { langs, pre })}>
            {running ? <Loader2 className="animate-spin" aria-hidden /> : phase === "done" ? <RotateCcw aria-hidden /> : <ScanText aria-hidden />}
            {running ? "Reading…" : phase === "done" ? "Run again" : "Extract text"}
          </Button>
        </section>
      </div>

      {/* Output */}
      <section className="min-w-0 space-y-3 lg:sticky lg:top-20" aria-labelledby="ocr-result">
        <h2 id="ocr-result" className="sr-only">
          Extracted text
        </h2>
        <div aria-live="polite">
          {running ? (
            <div className="rounded-2xl border bg-card p-4 sm:p-5">
              <Progress value={pct}>
                <ProgressLabel>{progress.status || "Working…"}</ProgressLabel>
                <ProgressValue>{() => `${pct}%`}</ProgressValue>
              </Progress>
              <p className="mt-3 text-xs text-muted-foreground">The first run downloads the OCR engine and language data (a few MB). Later runs are faster.</p>
            </div>
          ) : null}
          {phase === "error" && ocrError ? <Notice tone="danger" title="Couldn't read text">{ocrError}</Notice> : null}
        </div>

        {phase === "done" || (text && !running) ? (
          <div className="rounded-2xl border bg-card p-4 sm:p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" aria-hidden />
                <span className="text-sm font-medium">Extracted text</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {confidence != null ? (
                  <Badge variant="outline" className={confTone}>
                    {confidence}% confidence
                  </Badge>
                ) : null}
                <span>{text.length.toLocaleString()} chars</span>
              </div>
            </div>
            <Label htmlFor="ocr-text" className="sr-only">
              Extracted text
            </Label>
            <Textarea
              id="ocr-text"
              ref={textRef}
              value={text}
              readOnly={!editing}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              placeholder="No text was found. Try enabling grayscale and contrast, or a sharper image."
              className={cn("min-h-60 font-mono text-sm leading-relaxed", !editing && "bg-surface")}
            />
            {confidence != null && confidence < 60 && text ? (
              <p className="mt-2 text-xs text-warning-foreground dark:text-warning">Low confidence — check the text, or try the pre-processing options and run again.</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton value={text} />
              <Button
                variant={editing ? "secondary" : "outline"}
                aria-pressed={editing}
                onClick={() => {
                  setEditing((e) => !e)
                  if (!editing) requestAnimationFrame(() => textRef.current?.focus())
                }}
              >
                <Pencil aria-hidden /> {editing ? "Done" : "Edit"}
              </Button>
              <Button variant="outline" disabled={!text.trim()} onClick={save}>
                <NotebookPen aria-hidden /> Save to notes
              </Button>
              <Button variant="outline" disabled={!text.trim()} onClick={() => handOff("/tools/translator")}>
                <Languages aria-hidden /> Translate
              </Button>
              {speechSupported ? (
                <Button variant="outline" disabled={!text.trim()} onClick={speak} aria-pressed={speaking}>
                  {speaking ? <Square aria-hidden /> : <Play aria-hidden />} {speaking ? "Stop" : "Read aloud"}
                </Button>
              ) : null}
              <Button variant="outline" disabled={!text.trim()} onClick={() => handOff("/tools/text-to-voice")}>
                <Volume2 aria-hidden /> Text to speech
              </Button>
              <Button variant="outline" disabled={!text.trim()} onClick={() => downloadText(text, "extracted-text.txt")}>
                <Download aria-hidden /> TXT
              </Button>
            </div>
          </div>
        ) : !running && phase !== "error" ? (
          <EmptyState
            icon={ScanText}
            title={source ? "Ready to read" : "No image yet"}
            description={source ? "Pick the language and tap Extract text." : "Upload a photo, screenshot or PDF page, or capture one with your camera."}
          />
        ) : null}
      </section>
    </div>
  )
}
