"use client"

import { useEffect, useRef, useState } from "react"
import { Download, FileText, Loader2, Sparkles, Wand2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/common/empty-state"
import { Notice } from "@/components/common/notice"
import { useAiStatus } from "@/hooks/use-ai-status"
import { useHydrated } from "@/hooks/use-store"
import { buildDocumentElement, exportDocumentPdf, plainTextToHtml } from "./document-html"

const HANDOFF_KEY = "lifekit:text-to-pdf-handoff"
const MAX_CHARS = 60_000

const THEMES = [
  { id: "indigo", name: "Indigo & Professional", accent: "#4f46e5" },
  { id: "emerald", name: "Emerald & Fresh", accent: "#059669" },
  { id: "rose", name: "Rose & Warm", accent: "#e11d48" },
  { id: "slate", name: "Slate & Minimal", accent: "#334155" },
  { id: "amber", name: "Amber & Energetic", accent: "#d97706" },
]

function readHandoff(): string {
  try {
    return sessionStorage.getItem(HANDOFF_KEY) ?? ""
  } catch {
    return ""
  }
}

/** Renders sanitized document HTML (never raw) into a white "paper" preview. */
function DocumentPreview({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.replaceChildren(buildDocumentElement(html))
  }, [html])
  return <div ref={ref} />
}

export function TextToPdfTool() {
  // Text handed off from other tools lives in sessionStorage, so the editor
  // only mounts in the browser (avoids an SSR/hydration mismatch).
  const hydrated = useHydrated()
  if (!hydrated) return <div className="min-h-105 rounded-2xl border bg-card" aria-busy="true" />
  return <TextToPdfEditor />
}

function TextToPdfEditor() {
  const [text, setText] = useState(readHandoff)
  const [html, setHtml] = useState("")
  const [theme, setTheme] = useState("indigo")
  const [loading, setLoading] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const ai = useAiStatus()
  const aiReady = ai?.configured === true

  useEffect(() => {
    // The hand-off is one-shot: forget it once it's in the editor.
    try {
      sessionStorage.removeItem(HANDOFF_KEY)
    } catch {}
  }, [])

  const accent = THEMES.find((t) => t.id === theme)?.accent ?? THEMES[0].accent
  const tooLong = text.length > MAX_CHARS

  const applyPlainLayout = () => {
    if (!text.trim()) {
      toast.error("Please enter some text first.")
      return
    }
    setHtml(plainTextToHtml(text, accent))
  }

  const formatWithAi = async () => {
    if (!text.trim()) {
      toast.error("Please enter some text first.")
      return
    }
    if (tooLong) {
      toast.error(`That's too long for AI formatting (max ${MAX_CHARS.toLocaleString()} characters).`)
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/ai/format-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, theme: `${THEMES.find((t) => t.id === theme)?.name ?? theme} (accent ${accent})` }),
      })
      const data = (await res.json().catch(() => ({}))) as { html?: string; error?: string }
      if (!res.ok || !data.html) throw new Error(data.error || "Failed to format document.")
      setHtml(data.html)
      toast.success("Document formatted.")
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Something went wrong while formatting.")
    } finally {
      setLoading(false)
    }
  }

  const downloadPdf = async () => {
    if (!html) return
    setGeneratingPdf(true)
    try {
      await exportDocumentPdf(html, "document.pdf")
      toast.success("PDF downloaded.")
    } catch (e) {
      console.error("PDF generation failed", e)
      toast.error("Couldn't create the PDF. Please try again.")
    } finally {
      setGeneratingPdf(false)
    }
  }

  return (
    <div className="grid gap-5 pb-8 xl:grid-cols-2 xl:items-start">
      {/* Input */}
      <div className="min-w-0 space-y-4">
        {ai && !aiReady ? (
          <Notice tone="info" title="AI formatting is off">
            Add <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">GEMINI_API_KEY</code> to enable it. You can still create a PDF with the plain layout.
          </Notice>
        ) : null}

        <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <FileText className="size-4 text-muted-foreground" /> Your text
            </h2>
            <Select
              value={theme}
              onValueChange={(v) => v && setTheme(v as string)}
              items={THEMES.map((t) => ({ value: t.id, label: t.name }))}
            >
              <SelectTrigger className="h-10 w-full text-sm sm:w-50" aria-label="Colour theme">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                {THEMES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste your notes, essay, or thoughts here..."
            className="max-h-[50dvh] min-h-65 resize-y overflow-y-auto"
            aria-label="Text to convert"
          />
          {tooLong ? (
            <p className="text-xs text-warning">
              {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters — too long for AI formatting. The plain layout still works.
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {aiReady ? (
              <Button onClick={formatWithAi} disabled={loading || !text.trim() || tooLong} size="lg" className="w-full sm:w-auto">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Format with AI
              </Button>
            ) : null}
            <Button
              variant={aiReady ? "outline" : "default"}
              onClick={applyPlainLayout}
              disabled={loading || !text.trim()}
              size="lg"
              className="w-full sm:w-auto"
            >
              <FileText className="size-4" /> Plain layout
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {aiReady
              ? "AI adds headings, bullet points and structure. Your text is sent to Google Gemini. Plain layout works offline: use # for headings and - for bullets."
              : "Plain layout works in your browser: use # for headings, - for bullets and > for quotes."}
          </p>
        </section>
      </div>

      {/* Preview */}
      <div className="min-w-0 space-y-4">
        {html ? (
          <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <Wand2 className="size-4 text-primary" /> Document preview
              </h2>
              <Button onClick={downloadPdf} disabled={generatingPdf} className="w-full sm:w-auto">
                {generatingPdf ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Download PDF
              </Button>
            </div>

            {/* A4 paper preview */}
            <div className="max-h-[60dvh] w-full overflow-x-hidden overflow-y-auto rounded-xl border bg-surface-muted p-2 sm:p-4">
              <div className="mx-auto min-h-[40dvh] max-w-full bg-white p-5 text-slate-900 shadow-sm sm:min-h-[842px] sm:max-w-[595px] sm:p-12">
                <DocumentPreview html={html} />
              </div>
            </div>
          </section>
        ) : (
          <div className="xl:sticky xl:top-20">
            <EmptyState
              icon={FileText}
              title="No document yet"
              description={aiReady ? "Type some text, then format it with AI or use the plain layout." : "Type some text, then tap Plain layout."}
            />
          </div>
        )}
      </div>
    </div>
  )
}
