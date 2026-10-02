"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Camera, FileScan, Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/common/empty-state"
import { FileDropzone } from "@/components/common/file-dropzone"
import { Notice, UnsupportedNotice } from "@/components/common/notice"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useHydrated } from "@/hooks/use-store"
import { MB } from "@/lib/files"
import { cn } from "@/lib/utils"
import { blobToPixels } from "@/lib/scanner/image"
import {
  createPage,
  PREVIEW_MAX,
  processPage,
  renderPage,
  revokePage,
  warpPage,
  type ScanPage,
} from "@/lib/scanner/pipeline"
import type { EnhanceSettings, Pixels, Quad } from "@/lib/scanner/types"
import { CameraView, isCameraSupported, type CapturedFrame } from "./camera-view"
import { CropEditor } from "./crop-editor"
import { EnhanceEditor } from "./enhance-editor"
import { ExportPanel } from "./export-panel"
import { PageList } from "./page-list"

type View =
  | { kind: "list" }
  | { kind: "crop"; id: string; fresh: boolean }
  | { kind: "enhance"; id: string; preview: Pixels; fresh: boolean }

const ACCEPT = ["image/*"]
const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)

export function PdfScanner() {
  const hydrated = useHydrated()
  const cameraOk = hydrated && isCameraSupported()

  const [pages, setPages] = useState<ScanPage[]>([])
  const [view, setView] = useState<View>({ kind: "list" })
  const [camera, setCamera] = useState<{ retakeId?: string } | null>(null)
  const [quick, setQuick] = useState(false)
  const [sessionCount, setSessionCount] = useState(0)
  const [backgroundJobs, setBackgroundJobs] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null)
  const [announce, setAnnounce] = useState("")
  const addRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef(pages)

  useEffect(() => {
    pagesRef.current = pages
  }, [pages])
  // free object URLs when leaving the tool
  useEffect(() => () => pagesRef.current.forEach(revokePage), [])

  const say = (msg: string) => setAnnounce(msg)
  const patch = (id: string, p: Partial<ScanPage>) => setPages((ps) => ps.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const indexOf = (id: string) => pagesRef.current.findIndex((p) => p.id === id)

  // ---------------------------------------------------------------- adding pages

  /** Add a page and process it in the background (quick capture / batch upload). */
  const addAndProcess = useCallback(async (page: ScanPage) => {
    setPages((ps) => [...ps, { ...page, status: "processing" }])
    try {
      const done = await processPage(page)
      setPages((ps) => ps.map((x) => (x.id === page.id ? done : x)))
    } catch (e) {
      setPages((ps) =>
        ps.map((x) => (x.id === page.id ? { ...x, status: "error", error: errMsg(e, "Processing failed") } : x))
      )
    }
  }, [])

  const handleCapture = useCallback(
    async ({ canvas, detected }: CapturedFrame) => {
      const retakeId = camera?.retakeId
      if (retakeId) {
        setCamera(null)
        setBusy("Preparing photo…")
        try {
          const fresh = await createPage(canvas, canvas.width, canvas.height, detected)
          const page = { ...fresh, id: retakeId }
          setPages((ps) =>
            ps.map((x) => {
              if (x.id !== retakeId) return x
              revokePage(x)
              return page
            })
          )
          setView({ kind: "crop", id: retakeId, fresh: false })
          say("Photo retaken. Adjust the crop.")
        } catch (e) {
          toast.error(errMsg(e, "Couldn't use that photo."))
        } finally {
          setBusy(null)
        }
        return
      }

      setSessionCount((n) => n + 1)
      if (quick) {
        setBackgroundJobs((n) => n + 1)
        try {
          const page = await createPage(canvas, canvas.width, canvas.height, detected)
          say(`Page captured`)
          await addAndProcess(page)
        } catch (e) {
          toast.error(errMsg(e, "Couldn't use that photo."))
        } finally {
          setBackgroundJobs((n) => n - 1)
        }
        return
      }

      setCamera(null)
      setBusy("Preparing photo…")
      try {
        const page = await createPage(canvas, canvas.width, canvas.height, detected)
        setPages((ps) => [...ps, page])
        setView({ kind: "crop", id: page.id, fresh: true })
        say(page.confidence >= 0.45 ? "Document edges detected. Check the crop." : "Drag the corners onto the page edges.")
      } catch (e) {
        toast.error(errMsg(e, "Couldn't use that photo."))
      } finally {
        setBusy(null)
      }
    },
    [camera, quick, addAndProcess]
  )

  const handleFiles = async (files: File[]) => {
    if (files.length === 1) {
      setBusy("Reading photo…")
      try {
        const page = await createPage(files[0])
        setPages((ps) => [...ps, page])
        setView({ kind: "crop", id: page.id, fresh: true })
        say("Photo loaded. Check the crop.")
      } catch (e) {
        toast.error(errMsg(e, "This image couldn't be read."))
      } finally {
        setBusy(null)
      }
      return
    }
    setImporting({ done: 0, total: files.length })
    let failed = 0
    for (let i = 0; i < files.length; i++) {
      try {
        const page = await createPage(files[i])
        await addAndProcess(page)
      } catch {
        failed++
      }
      setImporting({ done: i + 1, total: files.length })
    }
    setImporting(null)
    const ok = files.length - failed
    say(`${ok} page${ok === 1 ? "" : "s"} added`)
    if (failed) toast.error(`${failed} image${failed === 1 ? "" : "s"} couldn't be read. Try JPG, PNG or WebP.`)
    else toast.success(`${ok} pages added — auto-cropped and enhanced. Tap a page to adjust it.`)
  }

  const openCamera = (retakeId?: string) => {
    setSessionCount(0)
    setCamera({ retakeId })
  }

  // ---------------------------------------------------------------- editing

  const confirmCrop = async (id: string, quad: Quad, fresh: boolean) => {
    const page = pagesRef.current.find((p) => p.id === id)
    if (!page) return
    setBusy("Straightening page…")
    try {
      const { warped, preview } = await warpPage(page, quad)
      patch(id, { quad, warped })
      setView({ kind: "enhance", id, preview, fresh })
      say("Page straightened. Choose a filter.")
    } catch (e) {
      toast.error(errMsg(e, "Couldn't straighten this page."))
    } finally {
      setBusy(null)
    }
  }

  const saveEnhance = async (id: string, settings: EnhanceSettings) => {
    const page = pagesRef.current.find((p) => p.id === id)
    if (!page?.warped) return
    setBusy("Saving page…")
    try {
      const r = await renderPage(page.warped, settings)
      const oldThumb = page.thumbUrl
      patch(id, {
        settings,
        processed: r.processed,
        processedW: r.processedW,
        processedH: r.processedH,
        thumbUrl: URL.createObjectURL(r.thumb),
        status: "ready",
        error: undefined,
      })
      if (oldThumb) setTimeout(() => URL.revokeObjectURL(oldThumb), 1000)
      setView({ kind: "list" })
      const n = indexOf(id) + 1
      say(`Page ${n} saved`)
      toast.success(`Page ${n} saved`)
    } catch (e) {
      toast.error(errMsg(e, "Couldn't save this page."))
    } finally {
      setBusy(null)
    }
  }

  const openEnhance = async (id: string) => {
    const page = pagesRef.current.find((p) => p.id === id)
    if (!page) return
    if (!page.warped) return setView({ kind: "crop", id, fresh: false })
    setBusy("Opening page…")
    try {
      const preview = await blobToPixels(page.warped, PREVIEW_MAX)
      setView({ kind: "enhance", id, preview, fresh: false })
    } catch (e) {
      toast.error(errMsg(e, "Couldn't open this page."))
    } finally {
      setBusy(null)
    }
  }

  const deletePage = (id: string) => {
    const page = pagesRef.current.find((p) => p.id === id)
    if (!page) return
    setPages((ps) => ps.filter((p) => p.id !== id))
    setTimeout(() => revokePage(page), 500)
    if (view.kind !== "list" && view.id === id) setView({ kind: "list" })
    say("Page deleted")
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= pages.length) return
    setPages((ps) => {
      const next = ps.slice()
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
    say(`Moved to position ${to + 1}`)
  }

  // ---------------------------------------------------------------- render

  const editing = view.kind !== "list"
  const editPage = editing ? pages.find((p) => p.id === view.id) : undefined
  const pageNo = editPage ? pages.indexOf(editPage) + 1 : 0

  const addCard = (
    <div ref={addRef} className="space-y-3 scroll-mt-24">
      {hydrated && !cameraOk ? (
        <UnsupportedNotice feature="camera access" alternative="Please upload an image instead." />
      ) : (
        <div className={cn("rounded-2xl border bg-card p-4 shadow-soft", pages.length > 0 && "p-3")}>
          <Button size="lg" className="w-full" onClick={() => openCamera()} disabled={!hydrated || !!busy}>
            <Camera aria-hidden /> {pages.length ? "Scan more pages" : "Start camera"}
          </Button>
          {pages.length === 0 && (
            <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
              Your browser will ask for camera permission. The video never leaves your device.
            </p>
          )}
        </div>
      )}
      <FileDropzone
        onFiles={handleFiles}
        accept={ACCEPT}
        multiple
        maxBytes={50 * MB}
        warnBytes={15 * MB}
        title={pages.length ? "Upload more photos" : "Upload photos"}
        hint="JPG, PNG or WebP photos of documents"
        compact={pages.length > 0}
        disabled={!!busy || !!importing}
      />
    </div>
  )

  return (
    <div className="space-y-4">
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {busy && view.kind === "list" && (
        <Notice icon={Loader2} className="[&>svg]:animate-spin">
          {busy}
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] lg:items-start">
        <aside className={cn("space-y-4", editing && "hidden lg:block")} aria-label="Pages">
          {addCard}
          {importing && (
            <div aria-live="polite" className="space-y-2 rounded-xl border bg-card p-3">
              <p className="text-sm">
                Processing {importing.done} of {importing.total}…
              </p>
              <Progress value={(importing.done / importing.total) * 100} aria-label="Import progress" />
            </div>
          )}
          {pages.length > 0 && (
            <PageList
              pages={pages}
              activeId={editing ? view.id : undefined}
              canRetake={cameraOk}
              onMove={move}
              onCrop={(id) => setView({ kind: "crop", id, fresh: false })}
              onEnhance={openEnhance}
              onRetake={(id) => openCamera(id)}
              onDelete={deletePage}
            />
          )}
        </aside>

        <div className="min-w-0">
          {editing && editPage ? (
            <motion.section
              key={`${view.kind}-${view.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              aria-label={`${view.kind === "crop" ? "Crop" : "Enhance"} page ${pageNo}`}
              className="space-y-3"
            >
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">
                  {view.kind === "crop" ? "Crop" : "Enhance"} page {pageNo}
                </h2>
                <span className="text-sm text-muted-foreground">Step {view.kind === "crop" ? 1 : 2} of 2</span>
              </div>
              {view.kind === "crop" ? (
                <CropEditor
                  key={editPage.id + editPage.sourceUrl}
                  page={editPage}
                  busy={!!busy}
                  cancelLabel={view.fresh ? "Discard" : "Back"}
                  onCancel={() => (view.fresh ? deletePage(editPage.id) : setView({ kind: "list" }))}
                  onConfirm={(q) => confirmCrop(editPage.id, q, view.fresh)}
                />
              ) : (
                <EnhanceEditor
                  key={editPage.id}
                  initial={editPage.settings}
                  preview={view.preview}
                  saving={!!busy}
                  onBack={() => setView({ kind: "crop", id: editPage.id, fresh: view.fresh })}
                  onSave={(s) => saveEnhance(editPage.id, s)}
                />
              )}
            </motion.section>
          ) : pages.length > 0 ? (
            <ExportPanel pages={pages} />
          ) : (
            <EmptyState
              icon={FileScan}
              title="No pages yet"
              description="Scan with your camera or upload photos. Each page is auto-cropped, straightened and enhanced, then combined into one PDF."
              className="hidden lg:flex"
            />
          )}
        </div>
      </div>

      {camera && (
        <CameraView
          onClose={() => setCamera(null)}
          onCapture={handleCapture}
          onUploadInstead={() => {
            setCamera(null)
            setTimeout(() => addRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
          }}
          quick={quick}
          onQuickChange={setQuick}
          count={sessionCount}
          processing={backgroundJobs}
          single={!!camera.retakeId}
        />
      )}
    </div>
  )
}
