"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { aiAssist } from "@/lib/ai/client"
import { cn } from "@/lib/utils"

export interface SubtaskSuggestionState {
  loading: boolean
  /** Suggested subtask titles, null until a request succeeds. */
  items: string[] | null
  selected: Set<number>
}

/**
 * Asks Gemini to break a task into subtasks. Only call `run` after an explicit
 * user action, and only when AI is configured. In-flight requests are aborted
 * on `cancel` and on unmount.
 */
export function useSubtaskSuggestions() {
  const [state, setState] = useState<SubtaskSuggestionState>({ loading: false, items: null, selected: new Set() })
  const ctrl = useRef<AbortController | null>(null)

  useEffect(() => () => ctrl.current?.abort(), [])

  const cancel = useCallback(() => {
    ctrl.current?.abort()
    ctrl.current = null
    setState({ loading: false, items: null, selected: new Set() })
  }, [])

  const run = useCallback(async (title: string, notes?: string) => {
    const text = [title.trim(), notes?.trim()].filter(Boolean).join("\n\n")
    if (!text) return
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    setState({ loading: true, items: null, selected: new Set() })
    try {
      const out = await aiAssist("subtasks", text, c.signal)
      if (c.signal.aborted) return
      const items = Array.from(new Set(out.subtasks.map((s) => s.trim()).filter(Boolean)))
      setState({ loading: false, items, selected: new Set(items.map((_, i) => i)) })
    } catch (err) {
      if (c.signal.aborted || (err as Error)?.name === "AbortError") return
      setState({ loading: false, items: null, selected: new Set() })
      toast.error((err as Error)?.message || "Couldn't suggest subtasks right now.")
    } finally {
      if (ctrl.current === c) ctrl.current = null
    }
  }, [])

  const toggle = useCallback((i: number) => {
    setState((s) => {
      const selected = new Set(s.selected)
      if (selected.has(i)) selected.delete(i)
      else selected.add(i)
      return { ...s, selected }
    })
  }, [])

  const selectedTitles = state.items ? state.items.filter((_, i) => state.selected.has(i)) : []

  return { ...state, run, cancel, toggle, selectedTitles }
}

type Suggestions = ReturnType<typeof useSubtaskSuggestions>

/** Checkbox list of suggestions (shared by the sheet and the inline form panel). */
export function SubtaskSuggestionList({ s, className }: { s: Suggestions; className?: string }) {
  if (s.loading) {
    return (
      <p role="status" aria-live="polite" className={cn("flex items-center gap-2 py-3 text-sm text-muted-foreground", className)}>
        <Loader2 className="size-4 animate-spin" aria-hidden /> Asking Gemini for subtasks…
      </p>
    )
  }
  if (!s.items) return null
  return (
    <div className={className} aria-live="polite">
      <p className="mb-1.5 text-xs text-muted-foreground">
        {s.items.length} suggested — untick any you don&apos;t want.
      </p>
      <ul className="space-y-1" aria-label="Suggested subtasks">
        {s.items.map((title, i) => (
          <li key={`${i}-${title}`}>
            <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border bg-surface px-2.5 py-1.5 hover:bg-surface-muted">
              <Checkbox checked={s.selected.has(i)} onCheckedChange={() => s.toggle(i)} className="size-5" />
              <span className="min-w-0 flex-1 text-sm wrap-break-word">{title}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Sheet used from the task card menu. */
export function SubtaskSuggestionsSheet({
  s,
  taskTitle,
  onAdd,
}: {
  s: Suggestions
  taskTitle?: string
  onAdd: (titles: string[]) => void
}) {
  const open = s.loading || !!s.items
  const count = s.selectedTitles.length
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(o) => !o && s.cancel()}
      title="Break into subtasks"
      description={taskTitle ? `Suggestions for "${taskTitle}" from Google Gemini.` : "Suggestions from Google Gemini."}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button type="button" variant="outline" size="lg" className="flex-1 sm:h-10 sm:flex-none" onClick={s.cancel}>
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            className="flex-1 sm:h-10 sm:flex-none"
            disabled={s.loading || count === 0}
            onClick={() => {
              onAdd(s.selectedTitles)
              s.cancel()
            }}
          >
            {count ? `Add ${count} selected` : "Add selected"}
          </Button>
        </div>
      }
    >
      <SubtaskSuggestionList s={s} />
    </ResponsiveSheet>
  )
}

export function BreakDownButton({
  onClick,
  loading,
  disabled,
  className,
}: {
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  className?: string
}) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={disabled || loading} className={className}>
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
      Break into subtasks
    </Button>
  )
}
