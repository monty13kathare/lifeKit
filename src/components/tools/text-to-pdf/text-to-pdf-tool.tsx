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

  const downloadPdf = () => {
    if (!html) return
    setGeneratingPdf(true)
    
    try {
      const iframe = document.createElement("iframe")
      iframe.style.position = "fixed"
      iframe.style.right = "0"
      iframe.style.bottom = "0"
      iframe.style.width = "0"
      iframe.style.height = "0"
      iframe.style.border = "0"
      document.body.appendChild(iframe)

      const doc = iframe.contentWindow?.document
      if (!doc) throw new Error("Could not create print frame")

      doc.open()
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>document</title>
            <style>
              @page { margin: 10mm; size: A4 portrait; }
              body { 
                font-family: system-ui, -apple-system, sans-serif; 
                color: #0f172a; 
                background: #ffffff;
                line-height: 1.6;
                padding: 0;
                margin: 0;
              }
              h1 { font-size: 1.875rem; font-weight: bold; margin-bottom: 1.5rem; line-height: 1.2; }
              h2 { font-size: 1.5rem; font-weight: bold; margin-top: 2rem; margin-bottom: 1rem; line-height: 1.3; }
              p { margin-bottom: 1rem; }
              ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
              ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1rem; }
              li { margin-bottom: 0.25rem; }
              strong { font-weight: bold; color: #000000; }
              blockquote { 
                border-left: 4px solid #6366f1; 
                padding: 0.5rem 1rem; 
                font-style: italic; 
                color: #475569; 
                background: #f8fafc; 
                margin-bottom: 1rem; 
              }
              img, video, svg, canvas {
                max-width: 100% !important;
                height: auto !important;
                page-break-inside: avoid;
                break-inside: avoid;
              }
              table, pre, code {
                max-width: 100% !important;
                white-space: pre-wrap !important;
                word-wrap: break-word !important;
              }
              * {
                box-sizing: border-box;
                max-width: 100%;
                word-break: break-word;
              }
            </style>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `)
      doc.close()

      setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        setTimeout(() => {
          document.body.removeChild(iframe)
          setGeneratingPdf(false)
        }, 1000)
      }, 250)
      
      toast.success("Opening print dialog... Save as PDF.")
    } catch (e) {
      console.error("PDF Generation Error:", e)
      toast.error("Failed to generate PDF.")
      setGeneratingPdf(false)
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2 xl:items-start pb-8">
      {/* Input */}
      <div className="space-y-4">
        <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" /> Raw Text
            </h2>
            <div className="flex items-center gap-2 self-start sm:self-auto w-full sm:w-auto">
              <Select 
                value={theme} 
                onValueChange={(v) => v && setTheme(v as string)}
                items={THEMES.map(t => ({ value: t.id, label: t.name }))}
              >
                <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs">
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
            className="min-h-[300px] max-h-[50dvh] overflow-y-auto resize-y"
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-sm font-medium flex items-center gap-2">
                <Wand2 className="size-4 text-primary" /> Document Preview
              </h2>
              <Button onClick={downloadPdf} disabled={generatingPdf} size="sm" className="w-full sm:w-auto">
                {generatingPdf ? <Loader2 className="size-4 animate-spin mr-2" /> : <Download className="size-4 mr-2" />}
                Download PDF
              </Button>
            </div>

            {/* A4 Paper container for preview */}
            <div className="w-full max-h-[60dvh] overflow-y-auto overflow-x-hidden bg-muted/50 p-2 sm:p-4 rounded-xl border">
              <div 
                ref={previewRef}
                className="bg-white text-slate-900 shadow-sm mx-auto p-6 sm:p-12 min-h-[50dvh] sm:min-h-[842px] max-w-full sm:max-w-[595px] break-words"
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
