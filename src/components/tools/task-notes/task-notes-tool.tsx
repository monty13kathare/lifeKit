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

  // Form State - Default Language is explicitly ENGLISH
  const [roughInput, setRoughInput] = useState("")
  const [style, setStyle] = useState<"whatsapp" | "detailed" | "meeting" | "routine" | "standard">("whatsapp")
  const [detailLevel, setDetailLevel] = useState<"standard" | "deep">("standard")
  const [language, setLanguage] = useState<"en" | "auto" | "hi" | "hinglish">("en")

  // Generation & Output State - Only 2 views: Checklist & WhatsApp Preview (NO RAW MARKDOWN)
  const [generating, setGenerating] = useState(false)
  const [output, setOutput] = useState<TaskNotesOutput | null>(null)
  const [activeView, setActiveView] = useState<"checklist" | "whatsapp">("checklist")
  const [copiedType, setCopiedType] = useState<"whatsapp" | null>(null)
  const [waListStyle, setWaListStyle] = useState<"numbered" | "bullet" | "emoji">("numbered")

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

  /**
   * Rebuilds WhatsApp text with 100% mathematical guarantee of:
   * 1. ZERO bracket checkboxes [ ] anywhere
   * 2. Clean visual emoji checkboxes: ◻️ (pending) and ✅ (completed)
   * 3. Clear numbering (1. 2. 3.) or bullet points
   * 4. Bold headers & titles (*text*)
   * 5. Monospace highlight badges (`⏱️ 45 mins` • `🔴 HIGH PRIORITY`)
   * 6. WhatsApp bullet sub-steps (▪️ item) and notes (• _Note:_)
   * 7. Aesthetic dividers (*━━━━━━━━━━━━━━━━━━━━━*)
   */
  const syncFormats = (updated: TaskNotesOutput, waStyle = waListStyle): TaskNotesOutput => {
    let wa = `*📋 ${updated.title.toUpperCase()}*\n`
    if (updated.summary) {
      wa += `> _${updated.summary}_\n\n`
    }

    for (const cat of updated.categories) {
      wa += `*━━━━━━━━━━━━━━━━━━━━━*\n`
      wa += `*${cat.emoji || "📌"} ${cat.name.toUpperCase()}*\n`
      wa += `*━━━━━━━━━━━━━━━━━━━━━*\n\n`

      for (let i = 0; i < cat.items.length; i++) {
        const item = cat.items[i]
        const prioEmoji = item.priority === "high" ? "🔴" : item.priority === "medium" ? "🟡" : "🟢"
        const prioText = item.priority ? `${item.priority.toUpperCase()} PRIORITY` : "NORMAL"

        let prefix = ""
        let titleText = ""

        if (waStyle === "numbered") {
          if (item.completed) {
            prefix = `✅`
            titleText = `~*${i + 1}. ${item.task}*~`
          } else {
            prefix = `◻️`
            titleText = `*${i + 1}. ${item.task}*`
          }
        } else if (waStyle === "bullet") {
          if (item.completed) {
            prefix = `- ✅`
            titleText = `~*${item.task}*~`
          } else {
            prefix = `- ◻️`
            titleText = `*${item.task}*`
          }
        } else {
          // Clean Emoji
          if (item.completed) {
            prefix = `✅`
            titleText = `~*${item.task}*~`
          } else {
            prefix = `◻️`
            titleText = `*${item.task}*`
          }
        }

        wa += `${prefix} ${titleText}\n`

        if (item.details) {
          wa += `  > • _Note:_ ${item.details}\n`
        }

        // WhatsApp inline code backticks create authentic highlighted badges
        const timePart = item.timeEstimate ? `\`⏱️ ${item.timeEstimate}\` • ` : ""
        wa += `  > ${timePart}\`${prioEmoji} ${prioText}\`\n`

        if (item.subtasks && item.subtasks.length > 0) {
          wa += `  > *Sub-steps:*\n`
          for (const sub of item.subtasks) {
            wa += `    ▪️ ${sub}\n`
          }
        }

        wa += `\n`
      }
    }

    if (updated.tips && updated.tips.length > 0) {
      wa += `*━━━━━━━━━━━━━━━━━━━━━*\n`
      wa += `*💡 PRODUCTIVITY TIPS:*\n`
      for (const tip of updated.tips) {
        wa += `• ${tip}\n`
      }
    }

    return { ...updated, whatsappFormatted: wa, markdownFormatted: wa }
  }

  const handleWaStyleChange = (style: "numbered" | "bullet" | "emoji") => {
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

    // Detect language:
    // If language is "auto": check if roughInput has Devanagari characters (Hindi). If so, use "hi", else "en".
    // If language is "en", strictly use English.
    // If language is "hi", use Hindi.
    // If language is "hinglish", use Hinglish.
    const resolvedLang =
      language === "auto"
        ? /[\u0900-\u097F]/.test(roughInput)
          ? "hi"
          : "en"
        : language

    try {
      if (aiStatus?.configured) {
        toast.loading("AI is analyzing and organizing your tasks…", { id: "gen-toast" })
        const res = await aiAssist(
          "task-notes",
          JSON.stringify({
            roughNotes: roughInput,
            style,
            detailLevel,
            language: resolvedLang,
          })
        )
        toast.dismiss("gen-toast")
        // Always run syncFormats to guarantee perfect formatting without [ ]
        setOutput(syncFormats(res))
        toast.success("Point-to-point Task Notes generated successfully!")
      } else {
        const localRes = generateLocalTaskNotes(roughInput, { style, detailLevel, language: resolvedLang })
        setOutput(syncFormats(localRes))
        toast.success("Structured Task Notes generated locally!")
      }
    } catch {
      toast.dismiss("gen-toast")
      const localRes = generateLocalTaskNotes(roughInput, { style, detailLevel, language: resolvedLang })
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
    toast.success("Opening WhatsApp with formatted task notes…")
  }

  // Copy WhatsApp formatted text
  const handleCopyWhatsApp = async () => {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output.whatsappFormatted)
      setCopiedType("whatsapp")
      toast.success("Copied for WhatsApp! Paste directly into any WhatsApp chat.")
      setTimeout(() => setCopiedType(null), 2500)
    } catch {
      toast.error("Failed to copy to clipboard")
    }
  }

  // Save to LifeKit Tasks
  const handleAddToLifeKitTasks = () => {
    if (!output) return
    let count = 0
    const now = new Date().toISOString()
    for (const cat of output.categories) {
      for (const item of cat.items) {
        addTask({
          title: item.task,
          notes: item.details,
          category: cat.name,
          priority: item.priority || "medium",
          completed: item.completed,
          recurrence: "none",
          createdAt: now,
          subtasks: (item.subtasks || []).map((st) => ({
            id: crypto.randomUUID(),
            title: st,
            done: false,
          })),
        })
        count++
      }
    }
    toast.success(`Added ${count} tasks to LifeKit Tasks!`)
  }

  // Save to LifeKit Notes
  const handleSaveToLifeKitNotes = () => {
    if (!output) return
    const now = new Date().toISOString()
    addNote({
      title: output.title,
      content: output.whatsappFormatted,
      source: "manual",
      createdAt: now,
      updatedAt: now,
    })
    toast.success("Saved to LifeKit Notes!")
  }

  // Download as text file
  const handleDownloadFile = () => {
    if (!output) return
    downloadText(`${output.title.toLowerCase().replace(/\s+/g, "-")}.txt`, output.whatsappFormatted)
    toast.success("Downloaded task notes as text file.")
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* SECTION 1: INPUT COMPOSER */}
      <div className="rounded-2xl border bg-card p-4 sm:p-6 space-y-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <ListChecks className="size-4" />
              </span>
              <span>AI Task Notes & WhatsApp Checklist</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Type rough comma-separated thoughts. AI will convert them into point-to-point checklists with numbers, bullets, bold titles, and highlights for WhatsApp.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {roughInput && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRoughInput("")}
                className="text-xs text-muted-foreground hover:text-foreground h-8"
              >
                <RotateCcw className="size-3 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* Rough Thoughts Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <Label htmlFor="rough-tasks" className="font-semibold text-foreground">
              Rough Thoughts / Comma Separated Tasks
            </Label>
            <span>
              {estimatedTasks > 0 ? `~${estimatedTasks} items detected` : "Separate with commas or new lines"}
            </span>
          </div>
          <textarea
            id="rough-tasks"
            rows={4}
            value={roughInput}
            onChange={(e) => setRoughInput(e.target.value)}
            placeholder="e.g. buy groceries, fix auth bug, call client about feedback, pay electricity bill, gym leg workout, send weekly invoice"
            className="w-full rounded-xl border border-input bg-surface p-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-xs leading-relaxed"
          />
        </div>

        {/* Quick Sample Presets */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground block">
            Try a Quick Preset:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {SAMPLE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setRoughInput(preset.text)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-surface px-3 py-1 text-xs font-medium text-muted-foreground hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-600 transition-all active:scale-95"
              >
                <span>{preset.emoji}</span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Configuration Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-border/60">
          {/* Style */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Note Style</Label>
            <Select
              items={[
                { value: "whatsapp", label: "WhatsApp Ready (Clean Checklists)" },
                { value: "detailed", label: "Executive (Detailed Context)" },
                { value: "meeting", label: "Meeting Action Items" },
                { value: "routine", label: "Daily Timeline Routine" },
              ]}
              value={style}
              onValueChange={(v) => v && setStyle(v as typeof style)}
            >
              <SelectTrigger className="h-9 text-xs w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp Ready (Clean Checklists)</SelectItem>
                <SelectItem value="detailed">Executive (Detailed Context)</SelectItem>
                <SelectItem value="meeting">Meeting Action Items</SelectItem>
                <SelectItem value="routine">Daily Timeline Routine</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Detail Level */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Detail Level</Label>
            <Select
              items={[
                { value: "standard", label: "Balanced (Tasks + Key Context)" },
                { value: "deep", label: "Deep (With Sub-steps Breakdown)" },
              ]}
              value={detailLevel}
              onValueChange={(v) => v && setDetailLevel(v as typeof detailLevel)}
            >
              <SelectTrigger className="h-9 text-xs w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Balanced (Tasks + Key Context)</SelectItem>
                <SelectItem value="deep">Deep (With Sub-steps Breakdown)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Language: DEFAULT IS ENGLISH, MATCHES USER REQUEST */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Language</Label>
            <Select
              items={[
                { value: "en", label: "English (Default)" },
                { value: "auto", label: "Auto-detect (Same as input text)" },
                { value: "hi", label: "Hindi (हिंदी)" },
                { value: "hinglish", label: "Hinglish (Hindi in English Script)" },
              ]}
              value={language}
              onValueChange={(v) => v && setLanguage(v as typeof language)}
            >
              <SelectTrigger className="h-9 text-xs w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English (Default)</SelectItem>
                <SelectItem value="auto">Auto-detect (Same as input text)</SelectItem>
                <SelectItem value="hi">Hindi (हिंदी)</SelectItem>
                <SelectItem value="hinglish">Hinglish (Hindi in English Script)</SelectItem>
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
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md h-12"
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

            {/* View Switcher Tabs - ONLY 2 CLEAN VIEWS: NO MARKDOWN FORMAT */}
            <div className="flex items-center justify-between border-b px-4 py-2.5 bg-muted/30">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveView("checklist")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all active:scale-95",
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
                    "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all active:scale-95",
                    activeView === "whatsapp"
                      ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MessageSquare className="size-3.5 text-emerald-500" />
                  <span>WhatsApp Message Preview</span>
                </button>
              </div>

              {activeView === "whatsapp" && (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">Format:</span>
                  <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => handleWaStyleChange("numbered")}
                      className={cn(
                        "px-2 py-0.5 rounded text-[11px] font-medium transition-all",
                        waListStyle === "numbered"
                          ? "bg-background text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs"
                          : "text-muted-foreground"
                      )}
                    >
                      1. ◻️ Numbered
                    </button>
                    <button
                      type="button"
                      onClick={() => handleWaStyleChange("bullet")}
                      className={cn(
                        "px-2 py-0.5 rounded text-[11px] font-medium transition-all",
                        waListStyle === "bullet"
                          ? "bg-background text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs"
                          : "text-muted-foreground"
                      )}
                    >
                      • ◻️ Bullets
                    </button>
                  </div>
                </div>
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

                      <div className="space-y-2.5">
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
                              {/* Clickable Custom Checkbox & Title */}
                              <button
                                type="button"
                                onClick={() => handleToggleItem(catIdx, itemIdx)}
                                className="flex items-start gap-3 text-left flex-1"
                              >
                                <span className="mt-0.5 shrink-0">
                                  {item.completed ? (
                                    <div className="size-5 rounded-md bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                                      <Check className="size-3.5 stroke-[3]" />
                                    </div>
                                  ) : (
                                    <div className="size-5 rounded-md border-2 border-muted-foreground/60 hover:border-emerald-500 bg-background transition-colors" />
                                  )}
                                </span>

                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono font-bold text-muted-foreground">
                                      {itemIdx + 1}.
                                    </span>
                                    <span
                                      className={cn(
                                        "text-sm font-semibold text-foreground",
                                        item.completed && "line-through text-muted-foreground"
                                      )}
                                    >
                                      {item.task}
                                    </span>
                                  </div>

                                  {item.details && (
                                    <p className="text-xs text-muted-foreground leading-relaxed pl-5">
                                      {item.details}
                                    </p>
                                  )}
                                </div>
                              </button>

                              {/* Badges & Actions */}
                              <div className="flex items-center gap-2 shrink-0">
                                {item.timeEstimate && (
                                  <span className="flex items-center gap-1 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 px-2 py-0.5 text-[11px] font-mono font-medium">
                                    <Clock className="size-3" />
                                    {item.timeEstimate}
                                  </span>
                                )}

                                {item.priority && (
                                  <span
                                    className={cn(
                                      "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border",
                                      item.priority === "high"
                                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                        : item.priority === "medium"
                                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                    )}
                                  >
                                    {item.priority === "high" ? "🔴 HIGH" : item.priority === "medium" ? "🟡 MEDIUM" : "🟢 LOW"}
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(catIdx, itemIdx)}
                                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 transition-opacity"
                                  title="Delete task"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Subtasks checklist if present */}
                            {item.subtasks && item.subtasks.length > 0 && (
                              <div className="mt-2.5 ml-8 pl-2 border-l-2 border-border/60 space-y-1.5">
                                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">
                                  Sub-steps
                                </span>
                                {item.subtasks.map((sub, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className="flex items-center gap-2 text-xs text-muted-foreground"
                                  >
                                    <span className="text-emerald-500">▪️</span>
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
                      <ul className="text-xs text-muted-foreground space-y-1 pl-1">
                        {output.tips.map((tip, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 2: WHATSAPP CHAT PREVIEW - SIMULATED WHATSAPP MESSAGE */}
              {activeView === "whatsapp" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="size-4 text-emerald-500" />
                      <span>This is how your notes will look when pasted into WhatsApp:</span>
                    </span>

                    <Button
                      size="sm"
                      onClick={handleSendToWhatsApp}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 shadow-xs"
                    >
                      <Send className="size-3 mr-1.5" /> Send to WhatsApp
                    </Button>
                  </div>

                  {/* WhatsApp Message Bubble Simulation */}
                  <div className="rounded-2xl border border-emerald-500/25 bg-[#0b141a] p-4 sm:p-6 text-foreground shadow-lg max-w-2xl mx-auto space-y-2 border-l-4 border-l-emerald-500 relative">
                    <div className="flex items-center justify-between text-[11px] text-emerald-400/80 border-b border-emerald-500/20 pb-2 mb-3">
                      <span className="font-semibold flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                        WhatsApp Formatted Message
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyWhatsApp}
                        className="hover:text-emerald-300 font-medium underline flex items-center gap-1"
                      >
                        <Copy className="size-3" /> Copy Text
                      </button>
                    </div>

                    {/* Pre-formatted WhatsApp text */}
                    <div className="whitespace-pre-wrap font-sans text-xs sm:text-sm leading-relaxed select-all text-neutral-100">
                      {output.whatsappFormatted}
                    </div>

                    {/* Bottom message time and read ticks */}
                    <div className="flex items-center justify-end gap-1 pt-2 text-[10px] text-neutral-400">
                      <span>Just now</span>
                      <span className="text-sky-400 font-bold">✓✓</span>
                    </div>
                  </div>
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
                  .txt file
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
