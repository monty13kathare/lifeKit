"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { toast } from "sonner"
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Ellipsis,
  FilePenLine,
  FilePlus,
  FileText,
  Highlighter,
  LoaderCircle,
  Maximize,
  MousePointer2,
  PenLine,
  RotateCcw,
  RotateCw,
  Signature,
  Trash2,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { Notice } from "@/components/common/notice"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { useIsDesktop } from "@/hooks/use-media-query"
import { downloadBlob, formatBytes } from "@/lib/files"
import {
  DEFAULT_PAGE_NUMBERS,
  DEFAULT_WATERMARK,
  exportEditedPdf,
  normalizeRotation,
  PdfEditError,
  viewToPage,
  visualSize,
  type Annotation,
  type EditorPage,
  type PageNumberSettings,
  type WatermarkSettings,
} from "@/lib/pdf/edit"
import { cn } from "@/lib/utils"
import { PageNumbersForm, WatermarkForm } from "./document-settings"
import { PageCanvas } from "./page-canvas"
import { PageList } from "./page-thumbnails"
import { SignaturePad, type SignatureImage } from "./signature-pad"
import { ToolOptions } from "./tool-options"
import { DEFAULT_TOOL_SETTINGS, PX_PER_POINT, ZOOM_LEVELS, type Tool, type ToolSettings } from "./types"
import { uid, useEditorState, type DocState } from "./use-editor-state"

export interface EditorSession {
  key: string
  file: File
  bytes: ArrayBuffer
  pdf: PDFDocumentProxy
  pages: EditorPage[]
  encrypted: boolean
}

/** How long the "edited PDF is ready" message stays up. */
const RESULT_NOTICE_MS = 10_000

const TOOLS: { id: Tool; label: string; icon: typeof Type; shortcut: string }[] = [
  { id: "select", label: "Select", icon: MousePointer2, shortcut: "V" },
  { id: "edit-text", label: "Edit text", icon: FilePenLine, shortcut: "E" },
  { id: "text", label: "Text", icon: Type, shortcut: "T" },
  { id: "draw", label: "Draw", icon: PenLine, shortcut: "D" },
  { id: "highlight", label: "Highlight", icon: Highlighter, shortcut: "H" },
]

export function PdfEditorWorkspace({ session, onClose }: { session: EditorSession; onClose: () => void }) {
  const isDesktop = useIsDesktop()
  const editor = useEditorState({ pages: session.pages, annotations: {} })
  const { doc } = editor
  const docRef = useRef<DocState>(doc)
  useLayoutEffect(() => {
    docRef.current = doc
  }, [doc])
  const snapshot = useCallback(() => docRef.current, [])

  const [currentId, setCurrentId] = useState(session.pages[0].id)
  const [tool, setToolState] = useState<Tool>("select")
  const [settings, setSettings] = useState<ToolSettings>(DEFAULT_TOOL_SETTINGS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const editRef = useRef<{ id: string; pageId: string; base: DocState; isNew: boolean } | null>(null)
  const [watermark, setWatermark] = useState<WatermarkSettings>(DEFAULT_WATERMARK)
  const [pageNumbers, setPageNumbers] = useState<PageNumberSettings>(DEFAULT_PAGE_NUMBERS)
  const [zoom, setZoom] = useState<"fit" | number>("fit")
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [signOpen, setSignOpen] = useState(false)
  const [savedSig, setSavedSig] = useState<SignatureImage | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [saving, setSaving] = useState<{ progress: number; label: string } | null>(null)
  const [result, setResult] = useState<{ name: string; size: number } | null>(null)
  // The "PDF is ready" message hides itself after a few seconds.
  useEffect(() => {
    if (!result) return
    const id = window.setTimeout(() => setResult(null), RESULT_NOTICE_MS)
    return () => window.clearTimeout(id)
  }, [result])
  const [saveError, setSaveError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const pageIndex = Math.max(0, doc.pages.findIndex((p) => p.id === currentId))
  const page = doc.pages[pageIndex]
  const pageAnnotations = useMemo(() => doc.annotations[page.id] ?? [], [doc.annotations, page.id])
  const selected = pageAnnotations.find((a) => a.id === selectedId) ?? null
  const counts = useMemo(() => {
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(doc.annotations)) out[k] = v.length
    return out
  }, [doc.annotations])
  const totalAnnotations = doc.pages.reduce((n, p) => n + (counts[p.id] ?? 0), 0)

  // ---- Zoom -----------------------------------------------------------------
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setBox((b) => (Math.abs(b.w - width) < 1 && Math.abs(b.h - height) < 1 ? b : { w: width, h: height }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const [VW, VH] = visualSize(page)
  const fitScale = box.w
    ? isDesktop && box.h
      ? Math.min((box.w - 48) / VW, (box.h - 48) / VH)
      : (box.w - 16) / VW
    : 1
  const scale = zoom === "fit" ? Math.max(0.1, fitScale) : (zoom / 100) * PX_PER_POINT
  const percent = Math.round((scale / PX_PER_POINT) * 100)
  const zoomIn = useCallback(() => setZoom(ZOOM_LEVELS.find((z) => z > percent) ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1]), [percent])
  const zoomOut = useCallback(() => setZoom([...ZOOM_LEVELS].reverse().find((z) => z < percent) ?? ZOOM_LEVELS[0]), [percent])

  // ---- Editing lifecycle ----------------------------------------------------------
  const finishEditing = useCallback(() => {
    const ed = editRef.current
    if (!ed) return
    editRef.current = null
    setEditingId(null)
    const a = docRef.current.annotations[ed.pageId]?.find((x) => x.id === ed.id)
    if (!a || a.type !== "text") return
    if (!a.text.trim()) {
      editor.removeAnnotation(ed.pageId, ed.id, ed.isNew ? { record: false } : { base: ed.base })
      setSelectedId(null)
      return
    }
    const before = ed.base.annotations[ed.pageId]?.find((x) => x.id === ed.id)
    if (ed.isNew || !before || before.type !== "text" || before.text !== a.text) editor.commit(ed.base)
  }, [editor])

  const startEditing = useCallback(
    (id: string, opts?: { isNew?: boolean; base?: DocState }) => {
      if (editRef.current?.id === id) return
      finishEditing()
      editRef.current = { id, pageId: page.id, base: opts?.base ?? docRef.current, isNew: !!opts?.isNew }
      setEditingId(id)
    },
    [finishEditing, page.id]
  )

  const setTool = useCallback(
    (t: Tool) => {
      finishEditing()
      setToolState(t)
      if (t !== "select") setSelectedId(null)
    },
    [finishEditing]
  )

  const goToPage = useCallback(
    (id: string) => {
      finishEditing()
      setSelectedId(null)
      setCurrentId(id)
    },
    [finishEditing]
  )

  const undo = useCallback(() => {
    finishEditing()
    setSelectedId(null)
    editor.undo()
  }, [editor, finishEditing])

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    if (editRef.current?.id === selectedId) {
      editRef.current = null
      setEditingId(null)
    }
    editor.removeAnnotation(page.id, selectedId)
    setSelectedId(null)
  }, [editor, page.id, selectedId])

  // ---- Page operations --------------------------------------------------------
  const deletePage = () => {
    if (doc.pages.length <= 1) return
    finishEditing()
    const idx = pageIndex
    const removed = page
    const neighbour = doc.pages[idx + 1] ?? doc.pages[idx - 1]
    editor.deletePage(removed.id)
    setSelectedId(null)
    setCurrentId(neighbour.id)
    toast(`Page ${idx + 1} deleted`, {
      action: {
        label: "Undo",
        onClick: () => {
          editor.restorePage(removed, idx)
          setCurrentId(removed.id)
        },
      },
    })
  }

  const duplicatePage = () => {
    finishEditing()
    const id = editor.duplicatePage(page.id)
    setSelectedId(null)
    setCurrentId(id)
    toast.success(`Page ${pageIndex + 1} duplicated`)
  }

  // ---- Signature ----------------------------------------------------------------
  const placeSignature = (sig: SignatureImage) => {
    setSavedSig(sig)
    const width = Math.min(180, VW * 0.45)
    const height = (width * sig.height) / sig.width
    const [x, y] = viewToPage((VW - width) / 2 / VW, (VH - height) / 2 / VH, page.rotation)
    const a: Annotation = {
      id: uid("ann"),
      type: "image",
      x,
      y,
      width,
      height,
      rotation: normalizeRotation(360 - page.rotation),
      src: sig.src,
    }
    editor.addAnnotation(page.id, a)
    setToolState("select")
    setSelectedId(a.id)
  }

  const openSign = () => {
    finishEditing()
    setSignOpen(true)
  }

  // ---- Save -----------------------------------------------------------------------
  const save = async () => {
    if (saving) return
    finishEditing()
    setSaving({ progress: 0, label: "Preparing…" })
    setResult(null)
    setSaveError(null)
    try {
      const current = docRef.current
      const res = await exportEditedPdf({
        bytes: session.bytes,
        pages: current.pages,
        annotations: current.annotations,
        watermark,
        pageNumbers,
        onProgress: (progress, label) => setSaving({ progress, label }),
      })
      const name = `${session.file.name.replace(/\.pdf$/i, "") || "document"}-edited.pdf`
      downloadBlob(new Blob([res.bytes as BlobPart], { type: "application/pdf" }), name)
      setResult({ name, size: res.bytes.byteLength })
      toast.success("Edited PDF downloaded")
      if (res.replacedCharacters) {
        toast.warning("Some characters aren't supported by the PDF font and were replaced with “?”.")
      }
      if (res.usedStandardFonts) {
        toast.warning(
          "Some typed characters aren't in the PDF's embedded font and a look-alike font couldn't be downloaded, so a standard PDF font was used for just those characters."
        )
      } else if (res.substitutedFonts > 0) {
        toast.info(
          `${res.substitutedFonts} edit${res.substitutedFonts === 1 ? "" : "s"} used characters the embedded font didn't include; those were drawn with a matching look-alike font.`
        )
      }
    } catch (err) {
      console.error(err)
      const message =
        err instanceof PdfEditError
          ? err.message
          : "Something went wrong while building the PDF. Try again, or reload the page if the file is very large."
      setSaveError(message)
      toast.error("Couldn't save the PDF")
    } finally {
      setSaving(null)
    }
  }

  // ---- Keyboard shortcuts (desktop) -------------------------------------------------
  useEffect(() => {
    if (!isDesktop) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], [role='alertdialog'], [role='listbox']")) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if (mod || e.altKey) return
      switch (e.key) {
        case "Delete":
        case "Backspace":
          if (selectedId) {
            e.preventDefault()
            deleteSelected()
          }
          break
        case "+":
        case "=":
          e.preventDefault()
          zoomIn()
          break
        case "-":
        case "_":
          e.preventDefault()
          zoomOut()
          break
        case "0":
          setZoom("fit")
          break
        case "Escape":
          setSelectedId(null)
          break
        case "PageDown":
          if (doc.pages[pageIndex + 1]) {
            e.preventDefault()
            goToPage(doc.pages[pageIndex + 1].id)
          }
          break
        case "PageUp":
          if (doc.pages[pageIndex - 1]) {
            e.preventDefault()
            goToPage(doc.pages[pageIndex - 1].id)
          }
          break
        default: {
          const k = e.key.toLowerCase()
          const match = TOOLS.find((x) => x.shortcut.toLowerCase() === k)
          if (match) setTool(match.id)
          else if (k === "s") openSign()
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  // ---- Shared pieces -----------------------------------------------------------------
  const editSelected = () => {
    if (selected) startEditing(selected.id)
  }
  const toolOptionProps = {
    tool,
    settings,
    onSettings: (patch: Partial<ToolSettings>) => setSettings((s) => ({ ...s, ...patch })),
    selected,
    onUpdateSelected: (patch: Partial<Annotation>) => {
      if (selected) editor.updateAnnotation(page.id, selected.id, patch)
    },
    onDeleteSelected: deleteSelected,
    onEditSelected: editSelected,
  }

  const iconSize = isDesktop ? "icon-sm" : "icon"
  const pageActions = (
    <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Page actions">
      <Button variant="ghost" size={iconSize} aria-label="Rotate page left" onClick={() => editor.rotatePage(page.id, -90)}>
        <RotateCcw aria-hidden />
      </Button>
      <Button variant="ghost" size={iconSize} aria-label="Rotate page right" onClick={() => editor.rotatePage(page.id, 90)}>
        <RotateCw aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size={iconSize}
        aria-label="Move page earlier"
        disabled={pageIndex === 0}
        onClick={() => editor.movePage(pageIndex, pageIndex - 1)}
      >
        <ArrowUp aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size={iconSize}
        aria-label="Move page later"
        disabled={pageIndex === doc.pages.length - 1}
        onClick={() => editor.movePage(pageIndex, pageIndex + 1)}
      >
        <ArrowDown aria-hidden />
      </Button>
      <Button variant="ghost" size={iconSize} aria-label="Duplicate page" onClick={duplicatePage}>
        <Copy aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size={iconSize}
        aria-label="Delete page"
        disabled={doc.pages.length <= 1}
        onClick={deletePage}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 aria-hidden />
      </Button>
    </div>
  )

  const pageNav = (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size={iconSize}
        aria-label="Previous page"
        disabled={pageIndex === 0}
        onClick={() => goToPage(doc.pages[pageIndex - 1].id)}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <span className="min-w-14 text-center text-sm tabular-nums" aria-live="polite">
        {pageIndex + 1} / {doc.pages.length}
      </span>
      <Button
        variant="ghost"
        size={iconSize}
        aria-label="Next page"
        disabled={pageIndex === doc.pages.length - 1}
        onClick={() => goToPage(doc.pages[pageIndex + 1].id)}
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  )

  const zoomControls = (
    <div className="flex items-center gap-0.5" role="group" aria-label="Zoom">
      <Button variant="ghost" size={iconSize} aria-label="Zoom out" onClick={zoomOut} disabled={percent <= ZOOM_LEVELS[0]}>
        <ZoomOut aria-hidden />
      </Button>
      <span className="w-11 text-center text-xs tabular-nums text-muted-foreground">{percent}%</span>
      <Button variant="ghost" size={iconSize} aria-label="Zoom in" onClick={zoomIn} disabled={percent >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}>
        <ZoomIn aria-hidden />
      </Button>
      <Button
        variant={zoom === "fit" ? "secondary" : "ghost"}
        size={iconSize}
        aria-label="Fit page"
        aria-pressed={zoom === "fit"}
        onClick={() => setZoom("fit")}
      >
        <Maximize aria-hidden />
      </Button>
    </div>
  )

  const fontNotice = (
    <p className="text-xs text-muted-foreground">
      Edited text reuses the font embedded in this PDF, with its exact colour, and the old words are removed from the page. If you type a character that font doesn’t include, a matching look-alike font file is downloaded for just those characters — your PDF itself never leaves your browser. Added text uses standard PDF fonts.
    </p>
  )

  const showMobileOptions = !isDesktop && (!!selected || tool !== "select")

  return (
    <div className="space-y-3">
      {session.encrypted && (
        <Notice tone="warning" title="This PDF has security restrictions">
          You can preview and mark it up, but saving an edited copy may not be possible.
        </Notice>
      )}

      {/* Top bar */}
      <div className="flex items-center gap-2 rounded-2xl border bg-card p-2 pl-3 shadow-soft">
        <FileText className="size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={session.file.name}>
            {session.file.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {doc.pages.length} {doc.pages.length === 1 ? "page" : "pages"} · {formatBytes(session.file.size)}
            {totalAnnotations > 0 && ` · ${totalAnnotations} ${totalAnnotations === 1 ? "edit" : "edits"}`}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!editor.canUndo} onClick={undo}>
          <Undo2 aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open another PDF"
          title="Open another PDF"
          onClick={() => (editor.canUndo ? setConfirmClose(true) : onClose())}
        >
          <FilePlus aria-hidden />
        </Button>
        <Button onClick={save} disabled={!!saving} aria-label="Download edited PDF">
          {saving ? <LoaderCircle className="animate-spin" aria-hidden /> : <Download aria-hidden />}
          <span className="hidden sm:inline">{saving ? "Saving…" : "Download PDF"}</span>
        </Button>
      </div>

      {saving && (
        <div className="rounded-2xl border bg-card p-3">
          <Progress value={Math.round(saving.progress * 100)}>
            <ProgressLabel className="text-xs font-normal text-muted-foreground">{saving.label}</ProgressLabel>
            <ProgressValue className="text-xs" />
          </Progress>
        </div>
      )}
      {result && !saving && (
        <Notice
          tone="success"
          title="Your edited PDF is ready"
          action={
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={save}>
                <Download aria-hidden /> Download again
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setResult(null)} aria-label="Dismiss">
                <X aria-hidden />
              </Button>
            </div>
          }
        >
          {result.name} · {formatBytes(result.size)}. Check your downloads folder.
        </Notice>
      )}
      {saveError && !saving && <Notice tone="danger" title="Couldn't save">{saveError}</Notice>}

      {/* Mobile page strip */}
      <div className="rounded-2xl border bg-card lg:hidden">
        <PageList pdf={session.pdf} pages={doc.pages} currentId={page.id} counts={counts} onSelect={goToPage} onMove={editor.movePage} orientation="horizontal" />
      </div>

      <div className="lg:grid lg:h-[calc(100dvh-15rem)] lg:min-h-[560px] lg:grid-cols-[176px_minmax(0,1fr)_300px] lg:gap-3">
        {/* Pages column (desktop) */}
        <aside className="hidden min-h-0 flex-col rounded-2xl border bg-card lg:flex" aria-label="Page thumbnails">
          <div className="flex items-center justify-between border-b px-3 py-2.5">
            <h2 className="text-sm font-medium">Pages</h2>
            <span className="text-xs text-muted-foreground tabular-nums">{doc.pages.length}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PageList pdf={session.pdf} pages={doc.pages} currentId={page.id} counts={counts} onSelect={goToPage} onMove={editor.movePage} orientation="vertical" />
          </div>
          <p className="border-t px-3 py-2 text-[11px] leading-snug text-muted-foreground">Drag thumbnails to reorder.</p>
        </aside>

        {/* Canvas */}
        <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-surface-muted lg:min-h-0" aria-label="Page editor">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b bg-card px-1.5 py-1">
            {pageNav}
            <div className="order-last w-full sm:order-none sm:w-auto">{pageActions}</div>
            {zoomControls}
          </div>
          <div ref={scrollRef} className="relative overflow-auto overscroll-contain lg:min-h-0 lg:flex-1">
            <div className="flex w-max min-w-full justify-center p-2 lg:min-h-full lg:items-center lg:p-6">
              <PageCanvas
                pdf={session.pdf}
                page={page}
                pageIndex={pageIndex}
                pageCount={doc.pages.length}
                annotations={pageAnnotations}
                scale={scale}
                tool={tool}
                settings={settings}
                selectedId={selectedId}
                editingId={editingId}
                watermark={watermark}
                pageNumbers={pageNumbers}
                onSelect={setSelectedId}
                onStartEditing={startEditing}
                onFinishEditing={finishEditing}
                onAdd={(a, opts) => editor.apply((d) => ({ ...d, annotations: { ...d.annotations, [page.id]: [...(d.annotations[page.id] ?? []), a] } }), opts)}
                onUpdate={(id, patch, opts) => editor.updateAnnotation(page.id, id, patch, opts)}
                onRemove={(id, opts) => {
                  editor.removeAnnotation(page.id, id, opts)
                  setSelectedId(null)
                }}
                onCommit={editor.commit}
                snapshot={snapshot}
              />
            </div>
          </div>
        </section>

        {/* Tools column (desktop) */}
        <aside className="hidden min-h-0 flex-col gap-5 overflow-y-auto rounded-2xl border bg-card p-4 lg:flex" aria-label="Tools">
          <div className="space-y-2">
            <h2 className="text-sm font-medium">Tools</h2>
            <div className="grid grid-cols-2 gap-2" role="toolbar" aria-label="Annotation tools">
              {TOOLS.map(({ id, label, icon: Icon, shortcut }) => (
                <Button
                  key={id}
                  variant={tool === id ? "secondary" : "outline"}
                  aria-pressed={tool === id}
                  title={`${label} (${shortcut})`}
                  onClick={() => setTool(id)}
                  className={cn("justify-start", tool === id && "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15")}
                >
                  <Icon aria-hidden /> {label}
                </Button>
              ))}
              <Button variant="outline" className="col-span-2 justify-start" onClick={openSign} title="Add signature (S)">
                <Signature aria-hidden /> Add signature
              </Button>
            </div>
          </div>
          <div className="rounded-xl bg-surface-muted/60 p-3">
            <ToolOptions {...toolOptionProps} />
          </div>
          <Separator />
          <WatermarkForm value={watermark} onChange={setWatermark} />
          <Separator />
          <PageNumbersForm value={pageNumbers} onChange={setPageNumbers} />
          <Separator />
          {fontNotice}
          <p className="text-xs text-muted-foreground">
            Shortcuts: V/T/D/H tools, S sign, Delete removes, Ctrl+Z undo, +/− zoom, 0 fit.
          </p>
        </aside>
      </div>

      {/* Mobile spacer so the fixed toolbar doesn't cover content */}
      <div className={cn("lg:hidden", showMobileOptions ? "h-32" : "h-16")} aria-hidden />

      {/* Mobile bottom toolbar */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t bg-background/95 backdrop-blur-lg lg:hidden">
        {showMobileOptions && (
          <div className="border-b px-3 py-1.5">
            <ToolOptions {...toolOptionProps} compact />
          </div>
        )}
        <div className="mx-auto grid max-w-lg grid-cols-7" role="toolbar" aria-label="Editor tools">
          {TOOLS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={tool === id}
              onClick={() => setTool(id)}
              className={cn(
                "flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 text-[11px] font-medium outline-none focus-visible:bg-muted",
                tool === id ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span className={cn("flex h-7 w-10 items-center justify-center rounded-full", tool === id && "bg-primary/10")}>
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="max-w-full truncate px-0.5">{label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={openSign}
            className="flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground outline-none focus-visible:bg-muted"
          >
            <span className="flex h-7 w-10 items-center justify-center rounded-full">
              <Signature className="size-5" aria-hidden />
            </span>
            Sign
          </button>
          <button
            type="button"
            onClick={() => {
              finishEditing()
              setMoreOpen(true)
            }}
            aria-haspopup="dialog"
            className="flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground outline-none focus-visible:bg-muted"
          >
            <span className="flex h-7 w-10 items-center justify-center rounded-full">
              <Ellipsis className="size-5" aria-hidden />
            </span>
            More
          </button>
        </div>
      </div>

      <ResponsiveSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        title="Document options"
        description="These apply to every page when you download."
        footer={<Button onClick={() => setMoreOpen(false)}>Done</Button>}
      >
        <div className="space-y-5">
          <WatermarkForm value={watermark} onChange={setWatermark} />
          <Separator />
          <PageNumbersForm value={pageNumbers} onChange={setPageNumbers} />
          <Separator />
          {fontNotice}
        </div>
      </ResponsiveSheet>

      <SignaturePad open={signOpen} onOpenChange={setSignOpen} saved={savedSig} onUse={placeSignature} />

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your edits?</AlertDialogTitle>
            <AlertDialogDescription>
              Opening another PDF clears the current edits. Download first if you want to keep them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmClose(false)
                onClose()
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
