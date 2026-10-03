"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ListPlus, LoaderCircle, SearchX, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Notice } from "@/components/common/notice"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useAiStatus } from "@/hooks/use-ai-status"
import { useTasks } from "@/hooks/use-lifekit-data"
import { aiAssist } from "@/lib/ai/client"
import { aiTaskToTask, describeWhen } from "@/lib/ai/convert"
import type { AiTask } from "@/lib/ai/assist-schemas"
import { cn } from "@/lib/utils"

const PRIORITY_CLASS: Record<AiTask["priority"], string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-warning/20 text-warning-foreground dark:text-warning",
  low: "bg-surface-muted text-muted-foreground",
}

interface ExtractTasksProps {
  /** Text to scan (title + content). */
  text: string
}

/** "Extract tasks" button + review sheet. Renders nothing unless Gemini is configured. */
export function ExtractTasks({ text }: ExtractTasksProps) {
  const status = useAiStatus()
  const router = useRouter()
  const { add } = useTasks()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<AiTask[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => controller.current?.abort(), [])

  if (!status?.configured) return null

  const trimmed = text.trim()

  const run = async () => {
    controller.current?.abort()
    const ctl = new AbortController()
    controller.current = ctl
    setOpen(true)
    setBusy(true)
    setError(null)
    setTasks(null)
    try {
      const out = await aiAssist("extract-tasks", trimmed, ctl.signal)
      if (ctl.signal.aborted) return
      const found = out.tasks ?? []
      setTasks(found)
      setSelected(new Set(found.map((_, i) => i)))
    } catch (err) {
      if (!ctl.signal.aborted) setError(err instanceof Error ? err.message : "The AI request failed.")
    } finally {
      if (!ctl.signal.aborted) setBusy(false)
    }
  }

  const close = () => {
    controller.current?.abort()
    setBusy(false)
    setOpen(false)
  }

  const toggle = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  const addSelected = () => {
    if (!tasks) return
    const chosen = tasks.filter((_, i) => selected.has(i))
    chosen.forEach((t) => add(aiTaskToTask(t)))
    close()
    toast.success(`Added ${chosen.length} ${chosen.length === 1 ? "task" : "tasks"}`, {
      action: { label: "Open Tasks", onClick: () => router.push("/tools/todo") },
    })
  }

  const count = selected.size

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => void run()} disabled={!trimmed || busy}>
        {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
        Extract tasks
      </Button>

      <ResponsiveSheet
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : close())}
        title="Extract tasks"
        description="Sent to Google Gemini. Review before adding — AI can make mistakes."
        size="md"
        footer={
          tasks && tasks.length > 0 ? (
            <>
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button onClick={addSelected} disabled={count === 0}>
                <ListPlus aria-hidden /> Add {count} to Tasks
              </Button>
            </>
          ) : error ? (
            <Button variant="outline" onClick={() => void run()}>
              Try again
            </Button>
          ) : null
        }
      >
        <div aria-live="polite" aria-busy={busy}>
          {busy ? (
            <div className="flex items-center gap-3 rounded-xl bg-surface-muted p-4 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden /> Looking for action items…
            </div>
          ) : null}
          {error ? (
            <Notice tone="danger" title="Couldn't extract tasks">
              {error}
            </Notice>
          ) : null}
          {tasks && tasks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center">
              <SearchX className="size-6 text-muted-foreground" aria-hidden />
              <p className="font-medium">No action items found</p>
              <p className="text-sm text-muted-foreground">This note doesn&apos;t seem to contain any to-dos.</p>
            </div>
          ) : null}
          {tasks && tasks.length > 0 ? (
            <>
              <p className="mb-2 text-sm text-muted-foreground">
                Found {tasks.length} {tasks.length === 1 ? "task" : "tasks"}. Untick any you don&apos;t want.
              </p>
              <ul className="space-y-2">
                {tasks.map((t, i) => (
                  <li key={i}>
                    <label
                      className={cn(
                        "flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                        selected.has(i) ? "border-primary/40 bg-primary/5" : "bg-card"
                      )}
                    >
                      <Checkbox checked={selected.has(i)} onCheckedChange={() => toggle(i)} className="mt-0.5 size-5" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium wrap-break-word">{t.title}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{describeWhen(t.dueDate, t.dueTime)}</span>
                          <span className={cn("rounded-full px-2 py-0.5 font-medium capitalize", PRIORITY_CLASS[t.priority])}>
                            {t.priority} priority
                          </span>
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </ResponsiveSheet>
    </>
  )
}
