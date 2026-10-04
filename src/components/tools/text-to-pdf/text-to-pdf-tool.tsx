"use client"

import { useEffect, useRef, useState } from "react"
import { Download, FileText, Loader2, Sparkles, Wand2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/common/empty-state"
import { cn } from "@/lib/utils"

const THEMES = [
  { id: "indigo", name: "Indigo & Professional" },
  { id: "emerald", name: "Emerald & Fresh" },
  { id: "rose", name: "Rose & Warm" },
  { id: "slate", name: "Slate & Minimal" },
  { id: "amber", name: "Amber & Energetic" },
]

export function TextToPdfTool() {
  const [text, setText] = useState("")
  const [html, setHtml] = useState("")
  const [theme, setTheme] = useState("indigo")
  const [loading, setLoading] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const v = sessionStorage.getItem("lifekit:text-to-pdf-handoff")
      if (v) {
        setText(v)
        sessionStorage.removeItem("lifekit:text-to-pdf-handoff")
      }
    } catch {}
  }, [])

  const formatWithAi = async () => {
    if (!text.trim()) {
      toast.error("Please enter some text first.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/ai/format-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, theme }),
      })

      if (!res.ok) {
        throw new Error("Failed to format document.")
      }

      const data = await res.json()
      setHtml(data.html)
      toast.success("Document formatted successfully!")
    } catch (e) {
      toast.error("Something went wrong while formatting.")
    } finally {
      setLoading(false)
    }
  }

  const downloadPdf = async () => {
    if (!previewRef.current) return
    setGeneratingPdf(true)
    try {
      const element = previewRef.current
      const opt = {
        margin: [15, 15] as [number, number],
        filename: "document.pdf",
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
      }

      const html2pdf = (await import("html2pdf.js")).default
      await html2pdf().set(opt).from(element).save()
      toast.success("PDF downloaded successfully!")
    } catch (e) {
      toast.error("Failed to generate PDF.")
    } finally {
      setGeneratingPdf(false)
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2 xl:items-start pb-8">
      {/* Input */}
      <div className="space-y-4">
        <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" /> Raw Text
            </h2>
            <div className="flex items-center gap-2">
              <Select value={theme} onValueChange={(v) => v && setTheme(v)}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  {THEMES.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste your notes, essay, or thoughts here..."
            className="min-h-[300px] resize-y"
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={formatWithAi} disabled={loading || !text.trim()} className="w-full sm:w-auto">
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
              Format & Beautify with AI
            </Button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mt-2">
            AI will automatically add headings, bullet points, highlights, and structure based on the content and selected theme.
          </p>
        </section>
      </div>

      {/* Preview */}
      <div className="space-y-4">
        {html ? (
          <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium flex items-center gap-2">
                <Wand2 className="size-4 text-primary" /> Document Preview
              </h2>
              <Button onClick={downloadPdf} disabled={generatingPdf} size="sm">
                {generatingPdf ? <Loader2 className="size-4 animate-spin mr-2" /> : <Download className="size-4 mr-2" />}
                Download PDF
              </Button>
            </div>

            {/* A4 Paper container for preview */}
            <div className="w-full overflow-x-auto bg-muted/50 p-2 sm:p-4 rounded-xl border">
              <div 
                ref={previewRef}
                className="bg-white text-slate-900 shadow-sm mx-auto p-8 sm:p-12 min-h-[842px] max-w-[595px]"
                style={{
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                <div 
                  className="prose prose-sm prose-slate max-w-none 
                    prose-headings:font-bold prose-h1:text-3xl prose-h1:mb-6 prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
                    prose-p:leading-relaxed prose-p:mb-4
                    prose-ul:list-disc prose-ul:pl-5 prose-ul:mb-4
                    prose-ol:list-decimal prose-ol:pl-5 prose-ol:mb-4
                    prose-li:mb-1
                    prose-strong:font-bold prose-strong:text-slate-900
                    prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-slate-600 prose-blockquote:bg-slate-50 prose-blockquote:py-1
                  "
                  dangerouslySetInnerHTML={{ __html: html }} 
                />
              </div>
            </div>
          </section>
        ) : (
          <div className="xl:sticky xl:top-20">
            <EmptyState
              icon={FileText}
              title="No document yet"
              description="Type some text and click Format to see the magic."
            />
          </div>
        )}
      </div>
    </div>
  )
}
