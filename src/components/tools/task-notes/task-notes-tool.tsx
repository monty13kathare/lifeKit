"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertCircle,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  Download,
  FileText,
  Layers,
  ListChecks,
  LoaderCircle,
  MessageSquare,
  Plus,
  RotateCcw,
  Send,
  Share2,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { downloadText } from "@/lib/files"
import { useAiStatus } from "@/hooks/use-ai-status"
import { useNotes, useTasks } from "@/hooks/use-lifekit-data"
import { aiAssist } from "@/lib/ai/client"
import { generateLocalTaskNotes, type TaskNotesOutput } from "@/lib/ai/task-notes-local"
import { cn } from "@/lib/utils"

interface SamplePreset {
  label: string
  emoji: string
  text: string
}

const SAMPLE_PRESETS: SamplePreset[] = [
  {
    label: "Daily Errands",
    emoji: "🛒",
    text: "buy milk eggs and brown bread, call electrician for kitchen switchboard, pay electricity and wifi bill, pick up dry cleaning, buy fresh vegetables for dinner",
  },
  {
    label: "Client Project Launch",
    emoji: "💼",
    text: "review pull request on github, call client about project deadline and feedback, update API documentation, run smoke tests, deploy release to production, send invoice",
  },
  {
    label: "Fitness & Health",
    emoji: "🏋️",
    text: "morning 5km jog, leg day workout at gym, drink 3L water throughout day, buy protein powder, schedule dentist appointment",
  },
  {
    label: "Developer Sprint",
    emoji: "💻",
    text: "fix auth session timeout bug, write unit tests for payments, attend team standup meeting, merge release branch to main, verify staging server",
  },
  {
    label: "Weekend Trip Checklist",
    emoji: "✈️",
    text: "pack clothes and laptop chargers, book train tickets, buy travel snacks, withdraw cash from atm, check hotel check-in confirmation",
  },
]

export function TaskNotesTool() {
  const aiStatus = useAiStatus()
  const { add: addTask } = useTasks()
  const { add: addNote } = useNotes()

  // Form State
  const [roughInput, setRoughInput] = useState("")
  const [style, setStyle] = useState<"whatsapp" | "detailed" | "meeting" | "routine" | "standard">("whatsapp")
  const [detailLevel, setDetailLevel] = useState<"standard" | "deep">("standard")
  const [language, setLanguage] = useState<"en" | "hinglish" | "hi">("en")

  // Generation & Output State
  const [generating, setGenerating] = useState(false)
  const [output, setOutput] = useState<TaskNotesOutput | null>(null)
  const [activeView, setActiveView] = useState<"checklist" | "whatsapp" | "markdown">("checklist")
  const [copiedType, setCopiedType] = useState<"whatsapp" | "markdown" | null>(null)
  const [rawMarkdownMode, setRawMarkdownMode] = useState(false)
  const [waListStyle, setWaListStyle] = useState<"bullet" | "numbered" | "emoji">("bullet")

  // Character & estimated count
  const estimatedTasks = useMemo(() => {
    if (!roughInput.trim()) return 0
    return roughInput.split(/[,\n;\r]+/).filter((s) => s.trim().length > 1).length
  }, [roughInput])

  // Aggregate stats from current output
  const stats = useMemo(() => {
    if (!output) return { total: 0, done: 0, percent: 0, high: 0 }
    let total = 0
    let done = 0
    let high = 0
    for (const cat of output.categories) {
      for (const item of cat.items) {
        total++
        if (item.completed) done++
        if (item.priority === "high") high++
      }
    }
    const percent = total > 0 ? Math.round((done / total) * 100) : 0
    return { total, done, percent, high }
  }, [output])

  // Sync WhatsApp and Markdown text strictly following WhatsApp's official markdown syntax
  const syncFormats = (updated: TaskNotesOutput, waStyle = waListStyle) => {
    let wa = `*📋 ${updated.title.toUpperCase()}*\n`
    wa += `> _${updated.summary}_\n\n`

    for (const cat of updated.categories) {
      wa += `*━━━━━━━━━━━━━━━━━━━━━*\n`
      wa += `*${cat.emoji || "📌"} ${cat.name.toUpperCase()}*\n`
      wa += `*━━━━━━━━━━━━━━━━━━━━━*\n\n`

      for (let i = 0; i < cat.items.length; i++) {
        const item = cat.items[i]
        const prioEmoji = item.priority === "high" ? "🔴" : item.priority === "medium" ? "🟡" : "🟢"

        // Strictly WhatsApp-supported format (no raw brackets [ ])
        let prefix = ""
        let titleText = item.task

        if (item.completed) {
          // WhatsApp native strikethrough for completed tasks
          titleText = `~*${item.task}*~`
          if (waStyle === "numbered") {
            prefix = `${i + 1}. ✅`
          } else if (waStyle === "emoji") {
            prefix = `✅`
          } else {
            // WhatsApp native bullet list (- ) with checkmark
            prefix = `- ✅`
          }
        } else {
          titleText = `*${item.task}*`
          if (waStyle === "numbered") {
            prefix = `${i + 1}. ◻️`
          } else if (waStyle === "emoji") {
            prefix = `◻️`
          } else {
            // WhatsApp native bullet list (- ) with clean square checkbox
            prefix = `- ◻️`
          }
        }

        wa += `${prefix} ${titleText}\n`
        if (item.details) wa += `  > _${item.details}_\n`
        if (item.timeEstimate || item.priority) {
          wa += `  > ⏱️ ${item.timeEstimate || "N/A"} | ${prioEmoji} Priority: *${item.priority?.toUpperCase()}*\n`
        }

        if (item.subtasks && item.subtasks.length > 0) {
          for (const sub of item.subtasks) {
            wa += `  > ▫️ ${sub}\n`
          }
        }
        wa += `\n`
      }
    }

    if (updated.tips && updated.tips.length > 0) {
      wa += `*💡 PRODUCTIVITY TIPS:*\n`
      for (const tip of updated.tips) {
        wa += `- ${tip}\n`
      }
    }

    let md = `# 📋 ${updated.title}\n\n`
    md += `> ${updated.summary}\n\n`

    for (const cat of updated.categories) {
      md += `## ${cat.emoji || "📌"} ${cat.name}\n\n`
      for (const item of cat.items) {
        const prioLabel = item.priority === "high" ? "🔴 High" : item.priority === "medium" ? "🟡 Medium" : "🟢 Low"
        const checkStr = item.completed ? "- [x]" : "- [ ]"
        md += `${checkStr} **${item.task}** *(⏱️ ${item.timeEstimate || "15m"} · Priority: ${prioLabel})*\n`
        if (item.details) {
          md += `  - ${item.details}\n`
        }
        if (item.subtasks && item.subtasks.length > 0) {
          for (const sub of item.subtasks) {
            md += `  - [ ] ${sub}\n`
          }
        }
        md += `\n`
      }
    }

    if (updated.tips && updated.tips.length > 0) {
      md += `### 💡 Productivity Tips\n`
      for (const tip of updated.tips) {
        md += `- ${tip}\n`
      }
    }

    return { ...updated, whatsappFormatted: wa, markdownFormatted: md }
  }

  const handleWaStyleChange = (style: "bullet" | "numbered" | "emoji") => {
    setWaListStyle(style)
    if (output) {
      setOutput(syncFormats(output, style))
    }
  }

  const handleGenerate = async () => {
    if (!roughInput.trim()) {
      toast.info("Please enter some tasks or choose a sample preset below.")
      return
    }

    setGenerating(true)
    try {
      if (aiStatus?.configured) {
        toast.loading("AI is organizing and expanding your tasks…", { id: "gen-toast" })
        const res = await aiAssist(
          "task-notes",
          JSON.stringify({
            roughNotes: roughInput,
            style,
            detailLevel,
            language,
          })
        )
        toast.dismiss("gen-toast")
        setOutput(syncFormats(res))
        toast.success("Point-to-point Task Notes generated successfully!")
      } else {
        // High quality offline fallback
        const localRes = generateLocalTaskNotes(roughInput, { style, detailLevel, language })
        setOutput(syncFormats(localRes))
        toast.success("Structured Task Notes generated locally!")
      }
    } catch {
      toast.dismiss("gen-toast")
      // Seamless fallback on error
      const localRes = generateLocalTaskNotes(roughInput, { style, detailLevel, language })
      setOutput(syncFormats(localRes))
      toast.info("Generated with local intelligence engine.")
    } finally {
      setGenerating(false)
    }
  }

  // Toggle item completion
  const handleToggleItem = (catIdx: number, itemIdx: number) => {
    if (!output) return
    const updated = { ...output }
    const cat = { ...updated.categories[catIdx] }
    const items = [...cat.items]
    const item = { ...items[itemIdx], completed: !items[itemIdx].completed }
    items[itemIdx] = item
    cat.items = items
    const newCats = [...updated.categories]
    newCats[catIdx] = cat
    updated.categories = newCats

    setOutput(syncFormats(updated))
  }

  // Delete item
  const handleDeleteItem = (catIdx: number, itemIdx: number) => {
    if (!output) return
    const updated = { ...output }
    const cat = { ...updated.categories[catIdx] }
    cat.items = cat.items.filter((_, idx) => idx !== itemIdx)
    const newCats = [...updated.categories]
    if (cat.items.length === 0) {
      updated.categories = newCats.filter((_, idx) => idx !== catIdx)
    } else {
      newCats[catIdx] = cat
      updated.categories = newCats
    }
    setOutput(syncFormats(updated))
    toast("Task removed")
  }

  // WhatsApp 1-click sharing
  const handleSendToWhatsApp = () => {
    if (!output) return
    const encoded = encodeURIComponent(output.whatsappFormatted)
    const url = `https://api.whatsapp.com/send?text=${encoded}`
    window.open(url, "_blank")
    toast.success("Opening WhatsApp with your formatted notes…")
  }

  // Copy WhatsApp formatted text
  const handleCopyWhatsApp = async () => {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output.whatsappFormatted)
      setCopiedType("whatsapp")
      setTimeout(() => setCopiedType(null), 2000)
      toast.success("Copied WhatsApp-ready task notes! Paste anywhere.")
    } catch {
      toast.error("Couldn't copy to clipboard.")
    }
  }

  // Copy Markdown text
  const handleCopyMarkdown = async () => {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output.markdownFormatted)
      setCopiedType("markdown")
      setTimeout(() => setCopiedType(null), 2000)
      toast.success("Copied standard Markdown!")
    } catch {
      toast.error("Couldn't copy to clipboard.")
    }
  }

  // Save to LifeKit Tasks
  const handleAddToLifeKitTasks = () => {
    if (!output) return
    let count = 0
    for (const cat of output.categories) {
      for (const item of cat.items) {
        addTask({
          id: crypto.randomUUID(),
          title: item.task,
          notes: item.details,
          priority: item.priority || "medium",
          category: cat.name,
          recurrence: "none",
          completed: item.completed,
          subtasks: (item.subtasks || []).map((st) => ({
            id: crypto.randomUUID(),
            title: st,
            done: false,
          })),
          createdAt: new Date().toISOString(),
        })
        count++
      }
    }
    toast.success(`Saved ${count} tasks into your LifeKit Tasks!`)
  }

  // Save to LifeKit Notes
  const handleSaveToLifeKitNotes = () => {
    if (!output) return
    addNote({
      id: crypto.randomUUID(),
      title: output.title,
      content: output.markdownFormatted,
      source: "manual",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ["AI", "Tasks", "ActionPlan"],
    })
    toast.success("Saved to your LifeKit Notes!")
  }

  // Download .txt or .md
  const handleDownloadFile = () => {
    if (!output) return
    const safeTitle = output.title.replace(/[^a-zA-Z0-9_-]/g, "_")
    downloadText(output.markdownFormatted, `${safeTitle}.md`, "text/markdown")
    toast.success("Downloaded task notes as Markdown file!")
  }

  return (
    <div className="space-y-6">
      {/* SECTION 1: ROUGH INPUT CARD */}
      <div className="rounded-2xl border bg-card p-4 sm:p-6 shadow-soft space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ListChecks className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Rough Tasks / Quick Thoughts</h2>
              <p className="text-xs text-muted-foreground">
                Type roughly with commas or lines — AI expands them into point-by-point checklists.
              </p>
            </div>
          </div>

          {/* Quick Counter */}
          {estimatedTasks > 0 && (
            <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-mono text-muted-foreground">
              ~{estimatedTasks} {estimatedTasks === 1 ? "task" : "tasks"} detected
            </span>
          )}
        </div>

        {/* Quick Sample Presets */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Sparkles className="size-3 text-primary" /> Click a sample preset to test:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setRoughInput(preset.text)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-surface px-2.5 py-1 text-xs text-foreground transition-all hover:border-primary/50 hover:bg-muted"
              >
                <span>{preset.emoji}</span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Text Area */}
        <div className="relative">
          <textarea
            value={roughInput}
            onChange={(e) => setRoughInput(e.target.value)}
            placeholder="Type roughly in short (e.g.: buy groceries, call client about project deadline, pay electricity bill, gym leg workout, review pull request)..."
            rows={4}
            className="w-full resize-y rounded-xl border border-input bg-background p-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-xs"
          />
          {roughInput && (
            <button
              type="button"
              onClick={() => setRoughInput("")}
              className="absolute top-3 right-3 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>

        {/* Options Row */}
        <div className="grid gap-3 sm:grid-cols-3 pt-1">
          {/* Format Style */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Target Format</Label>
            <Select
              items={[
                { value: "whatsapp", label: "🟢 WhatsApp Ready (Bold, bullets, emojis)" },
                { value: "detailed", label: "🎯 Detailed Action Plan (Priorities & Times)" },
                { value: "standard", label: "📋 Standard Markdown (GFM Checklist)" },
                { value: "meeting", label: "📝 Meeting & Discussion Notes" },
                { value: "routine", label: "📅 Daily Routine & Schedule" },
              ]}
              value={style}
              onValueChange={(v) => v && setStyle(v as typeof style)}
            >
              <SelectTrigger className="h-9 text-xs w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">🟢 WhatsApp Ready (Bold, bullets, emojis)</SelectItem>
                <SelectItem value="detailed">🎯 Detailed Action Plan (Priorities & Times)</SelectItem>
                <SelectItem value="standard">📋 Standard Markdown (GFM Checklist)</SelectItem>
                <SelectItem value="meeting">📝 Meeting & Discussion Notes</SelectItem>
                <SelectItem value="routine">📅 Daily Routine & Schedule</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Detail Depth */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Expansion Depth</Label>
            <Select
              items={[
                { value: "standard", label: "Actionable Points" },
                { value: "deep", label: "Deep (With Sub-steps & Times)" },
              ]}
              value={detailLevel}
              onValueChange={(v) => v && setDetailLevel(v as typeof detailLevel)}
            >
              <SelectTrigger className="h-9 text-xs w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Actionable Points</SelectItem>
                <SelectItem value="deep">Deep (With Sub-steps & Times)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Language */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Language / Tone</Label>
            <Select
              items={[
                { value: "en", label: "English" },
                { value: "hinglish", label: "Hinglish (Hindi in English Script)" },
                { value: "hi", label: "Hindi (हिंदी)" },
              ]}
              value={language}
              onValueChange={(v) => v && setLanguage(v as typeof language)}
            >
              <SelectTrigger className="h-9 text-xs w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hinglish">Hinglish (Hindi in English Script)</SelectItem>
                <SelectItem value="hi">Hindi (हिंदी)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Generate Button */}
        <div className="pt-2">
          <Button
            size="lg"
            onClick={handleGenerate}
            disabled={generating || !roughInput.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md"
          >
            {generating ? (
              <>
                <LoaderCircle className="size-4 mr-2 animate-spin" />
                Generating Point-to-Point Task Notes…
              </>
            ) : (
              <>
                <Wand2 className="size-4 mr-2" />
                ✨ Generate Point-to-Point Task Notes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* SECTION 2: GENERATED OUTPUT WORKSPACE */}
      <AnimatePresence>
        {output && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="rounded-2xl border bg-card shadow-soft overflow-hidden"
          >
            {/* Header & Stats Bar */}
            <div className="border-b bg-surface/50 p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <span>📋</span>
                    <span>{output.title}</span>
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{output.summary}</p>
                </div>

                {/* Quick Share Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSendToWhatsApp}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
                  >
                    <Send className="size-3.5 mr-1.5" />
                    Send to WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyWhatsApp}
                    className="text-xs"
                  >
                    {copiedType === "whatsapp" ? (
                      <Check className="size-3.5 mr-1 text-emerald-500" />
                    ) : (
                      <Copy className="size-3.5 mr-1" />
                    )}
                    {copiedType === "whatsapp" ? "Copied" : "Copy for WhatsApp"}
                  </Button>
                </div>
              </div>

              {/* Progress & Stat Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-600 dark:text-emerald-400">
                  ✅ Completed: {stats.done} / {stats.total} ({stats.percent}%)
                </span>
                <span className="rounded-lg bg-surface-muted px-2.5 py-1 text-muted-foreground">
                  📊 {output.categories.length} Categories
                </span>
                {stats.high > 0 && (
                  <span className="rounded-lg bg-rose-500/10 px-2.5 py-1 font-medium text-rose-600 dark:text-rose-400">
                    🔴 {stats.high} High Priority
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                  style={{ width: `${stats.percent}%` }}
                />
              </div>
            </div>

            {/* View Switcher Tabs */}
            <div className="flex items-center justify-between border-b px-4 py-2.5 bg-muted/30">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveView("checklist")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                    activeView === "checklist"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ListChecks className="size-3.5 text-emerald-500" />
                  <span>Interactive Checklist</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveView("whatsapp")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                    activeView === "whatsapp"
                      ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MessageSquare className="size-3.5 text-emerald-500" />
                  <span>WhatsApp Message Preview</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveView("markdown")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                    activeView === "markdown"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileText className="size-3.5" />
                  <span>Markdown View</span>
                </button>
              </div>

              {/* Raw toggle for markdown */}
              {activeView === "markdown" && (
                <button
                  type="button"
                  onClick={() => setRawMarkdownMode((v) => !v)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {rawMarkdownMode ? "Show Rendered" : "Show Raw Code"}
                </button>
              )}
            </div>

            {/* TAB CONTENT */}
            <div className="p-4 sm:p-6">
              {/* VIEW 1: INTERACTIVE CHECKLIST */}
              {activeView === "checklist" && (
                <div className="space-y-6">
                  {output.categories.map((cat, catIdx) => (
                    <div key={cat.name} className="rounded-xl border bg-surface/50 p-4 space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{cat.emoji || "📌"}</span>
                          <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                            {cat.name}
                          </h4>
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {cat.items.filter((i) => i.completed).length} / {cat.items.length} done
                        </span>
                      </div>

                      <div className="space-y-2">
                        {cat.items.map((item, itemIdx) => (
                          <div
                            key={itemIdx}
                            className={cn(
                              "group rounded-xl border p-3 transition-all",
                              item.completed
                                ? "bg-muted/40 border-border/50 opacity-70"
                                : "bg-card border-border/80 hover:border-primary/40 shadow-xs"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              {/* Clickable Checkbox & Title */}
                              <button
                                type="button"
                                onClick={() => handleToggleItem(catIdx, itemIdx)}
                                className="flex items-start gap-2.5 text-left flex-1"
                              >
                                <span className="mt-0.5 shrink-0 text-emerald-500">
                                  {item.completed ? (
                                    <CheckCircle2 className="size-4 fill-emerald-500 text-white dark:text-neutral-900" />
                                  ) : (
                                    <Circle className="size-4 text-muted-foreground/70 group-hover:text-emerald-500" />
                                  )}
                                </span>
                                <div>
                                  <span
                                    className={cn(
                                      "text-sm font-medium text-foreground",
                                      item.completed && "line-through text-muted-foreground"
                                    )}
                                  >
                                    {item.task}
                                  </span>
                                  {item.details && (
                                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                                      {item.details}
                                    </p>
                                  )}
                                </div>
                              </button>

                              {/* Badges & Actions */}
                              <div className="flex items-center gap-2 shrink-0">
                                {item.timeEstimate && (
                                  <span className="flex items-center gap-1 rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                                    <Clock className="size-3" />
                                    {item.timeEstimate}
                                  </span>
                                )}

                                {item.priority && (
                                  <span
                                    className={cn(
                                      "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                                      item.priority === "high"
                                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                        : item.priority === "medium"
                                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    )}
                                  >
                                    {item.priority}
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(catIdx, itemIdx)}
                                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 transition-opacity"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Subtasks checklist if present */}
                            {item.subtasks && item.subtasks.length > 0 && (
                              <div className="mt-2.5 ml-6 pl-2 border-l-2 border-border/60 space-y-1.5">
                                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">
                                  Sub-steps
                                </span>
                                {item.subtasks.map((sub, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className="flex items-center gap-2 text-xs text-muted-foreground"
                                  >
                                    <span className="text-muted-foreground/60">•</span>
                                    <span>{sub}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Tips box */}
                  {output.tips && output.tips.length > 0 && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Sparkles className="size-3.5 text-primary" />
                        Productivity Tips
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                        {output.tips.map((tip, idx) => (
                          <li key={idx}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 2: WHATSAPP CHAT PREVIEW */}
              {activeView === "whatsapp" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">List Style for WhatsApp:</span>
                      <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => handleWaStyleChange("bullet")}
                          className={cn(
                            "px-2.5 py-1 rounded-md transition-all text-xs",
                            waListStyle === "bullet"
                              ? "bg-background text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          - ◻️ Native Bullets
                        </button>
                        <button
                          type="button"
                          onClick={() => handleWaStyleChange("numbered")}
                          className={cn(
                            "px-2.5 py-1 rounded-md transition-all text-xs",
                            waListStyle === "numbered"
                              ? "bg-background text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          1. ◻️ Numbered
                        </button>
                        <button
                          type="button"
                          onClick={() => handleWaStyleChange("emoji")}
                          className={cn(
                            "px-2.5 py-1 rounded-md transition-all text-xs",
                            waListStyle === "emoji"
                              ? "bg-background text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          ◻️ Clean Emoji
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleSendToWhatsApp}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 shadow-xs"
                      >
                        <Send className="size-3 mr-1.5" /> Send to WhatsApp
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyWhatsApp}
                        className="text-xs h-8"
                      >
                        {copiedType === "whatsapp" ? (
                          <Check className="size-3.5 mr-1 text-emerald-500" />
                        ) : (
                          <Copy className="size-3.5 mr-1" />
                        )}
                        {copiedType === "whatsapp" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl bg-surface-muted/60 p-2.5 text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>
                      💡 <strong>WhatsApp Native Support:</strong> Uses WhatsApp&apos;s real bullet lists (<code>- </code>), blockquotes (<code>&gt; </code>), <strong>*bold*</strong> headers, and completed tasks get <s>~strikethrough~</s>.
                    </span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">100% WhatsApp Friendly</span>
                  </div>

                  {/* WhatsApp Bubble Simulation */}
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/15 dark:bg-emerald-950/40 p-4 sm:p-6 font-sans leading-relaxed text-sm text-foreground shadow-sm max-w-2xl mx-auto space-y-2 border-l-4 border-l-emerald-500">
                    <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm leading-relaxed select-all">
                      {output.whatsappFormatted}
                    </pre>
                  </div>
                </div>
              )}

              {/* VIEW 3: MARKDOWN PREVIEW */}
              {activeView === "markdown" && (
                <div className="space-y-3">
                  {rawMarkdownMode ? (
                    <div className="relative">
                      <textarea
                        readOnly
                        value={output.markdownFormatted}
                        rows={16}
                        className="w-full rounded-xl border bg-muted/30 p-4 font-mono text-xs text-foreground focus:outline-none select-all"
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl border bg-surface p-4 sm:p-6 space-y-4 prose prose-sm dark:prose-invert max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-transparent p-0 border-0">
                        {output.markdownFormatted}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="border-t bg-surface/80 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSendToWhatsApp}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
                >
                  <Send className="size-3.5 mr-1.5" />
                  Send to WhatsApp
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyWhatsApp}
                  className="text-xs"
                >
                  <MessageSquare className="size-3.5 mr-1 text-emerald-500" />
                  Copy for WhatsApp
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyMarkdown}
                  className="text-xs"
                >
                  <FileText className="size-3.5 mr-1" />
                  Copy Markdown
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddToLifeKitTasks}
                  className="text-xs border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
                >
                  <ListChecks className="size-3.5 mr-1" />
                  Save to LifeKit Tasks
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveToLifeKitNotes}
                  className="text-xs border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
                >
                  <BookOpen className="size-3.5 mr-1" />
                  Save to Notes
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownloadFile}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <Download className="size-3.5 mr-1" />
                  .md file
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
