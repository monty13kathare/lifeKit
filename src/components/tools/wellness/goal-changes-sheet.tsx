"use client"

import { ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Button } from "@/components/ui/button"
import type { WellnessGoals } from "@/types"
import { fmtGoal, GOAL_LABELS, type GoalChange } from "./health-utils"

interface GoalChangesSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  changes: GoalChange[]
  goals: WellnessGoals
  setGoals: (goals: WellnessGoals) => void
  /** Optional note under the list (e.g. "Exercise stays as it is."). */
  note?: string
}

/** Preview "current → new" daily goals, apply on confirm with an Undo toast. */
export function GoalChangesSheet({ open, onOpenChange, title, description, changes, goals, setGoals, note }: GoalChangesSheetProps) {
  const apply = () => {
    const previous = goals
    const next: WellnessGoals = { ...goals }
    for (const c of changes) next[c.key] = c.to
    setGoals(next)
    onOpenChange(false)
    toast.success("Daily goals updated", {
      description: changes.map((c) => `${GOAL_LABELS[c.key].label}: ${fmtGoal(c.key, c.to)}`).join(" · "),
      action: { label: "Undo", onClick: () => setGoals(previous) },
    })
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="lg" className="sm:h-10" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="lg" className="sm:h-10" onClick={apply} disabled={!changes.length}>
            Update goals
          </Button>
        </>
      }
    >
      {changes.length ? (
        <ul className="space-y-2">
          {changes.map((c) => (
            <li key={c.key} className="flex items-center justify-between gap-3 rounded-xl border bg-surface px-3 py-2.5 text-sm">
              <span className="font-medium">{GOAL_LABELS[c.key].label}</span>
              <span className="flex items-center gap-2 tabular-nums">
                <span className="text-muted-foreground">{fmtGoal(c.key, c.from)}</span>
                <ArrowRight className="size-4 text-muted-foreground" aria-label="changes to" />
                <span className="font-semibold">{fmtGoal(c.key, c.to)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Your goals already match — nothing to change.</p>
      )}
      {note ? <p className="mt-3 text-xs text-muted-foreground">{note}</p> : null}
    </ResponsiveSheet>
  )
}
