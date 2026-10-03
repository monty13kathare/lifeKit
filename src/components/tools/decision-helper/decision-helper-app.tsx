"use client"

import { useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { CircleCheck, Copy, MoreVertical, Plus, Scale, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/components/common/empty-state"
import { ToolPage } from "@/components/common/tool-page"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useAiStatus } from "@/hooks/use-ai-status"
import { useDecisions } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { createId } from "@/lib/storage/core"
import type { Decision } from "@/types"
import { DecisionEditor } from "./decision-editor"
import { blankDecision, computeResults, optionLabel } from "./decision-utils"

function formatUpdated(iso: string): string {
  try {
    return format(parseISO(iso), "d MMM yyyy")
  } catch {
    return ""
  }
}

export function DecisionHelperApp() {
  const hydrated = useHydrated()
  const { decisions, add, remove, upsert } = useDecisions()
  const ai = useAiStatus()
  const aiEnabled = !!ai?.configured
  /** The decision being edited: either a stored one or a fresh, not-yet-saved draft. */
  const [editing, setEditing] = useState<Decision | null>(null)

  const sorted = useMemo(() => [...decisions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [decisions])

  const startNew = () => setEditing(blankDecision())

  const deleteDecision = (d: Decision) => {
    const stored = decisions.find((x) => x.id === d.id)
    remove(d.id)
    if (editing?.id === d.id) setEditing(null)
    if (!stored) return // never saved: nothing to undo
    toast("Decision deleted", {
      description: d.question || "Untitled decision",
      action: { label: "Undo", onClick: () => upsert(stored) },
    })
  }

  const duplicate = (d: Decision) => {
    const now = new Date().toISOString()
    const idMap = new Map<string, string>()
    const options = d.options.map((o) => {
      const id = createId()
      idMap.set(o.id, id)
      return { ...o, id }
    })
    const critMap = new Map<string, string>()
    const criteria = d.criteria.map((c) => {
      const id = createId()
      critMap.set(c.id, id)
      return { ...c, id }
    })
    const scores: Decision["scores"] = {}
    for (const [oid, row] of Object.entries(d.scores)) {
      const newOid = idMap.get(oid)
      if (!newOid) continue
      scores[newOid] = {}
      for (const [cid, s] of Object.entries(row)) {
        const newCid = critMap.get(cid)
        if (newCid) scores[newOid][newCid] = s
      }
    }
    const copy = add({
      question: d.question ? `${d.question} (copy)`.slice(0, 200) : "",
      options,
      criteria,
      scores,
      chosenOptionId: undefined,
      notes: undefined,
      createdAt: now,
      updatedAt: now,
    })
    toast.success("Decision duplicated", { action: { label: "Undo", onClick: () => remove(copy.id) } })
    if (editing) setEditing(copy)
  }

  return (
    <ToolPage
      toolId="decision-helper"
      width="wide"
      actions={
        editing ? undefined : (
          <Button onClick={startNew} className="hidden sm:inline-flex">
            <Plus aria-hidden /> New decision
          </Button>
        )
      }
    >
      {!hydrated ? (
        <div className="grid gap-3 md:grid-cols-2" aria-busy="true" aria-label="Loading decisions">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : editing ? (
        <DecisionEditor
          key={editing.id}
          initial={decisions.find((d) => d.id === editing.id) ?? editing}
          aiEnabled={aiEnabled}
          onBack={() => setEditing(null)}
          onDelete={deleteDecision}
          onDuplicate={duplicate}
        />
      ) : (
        <div className="space-y-4">
          <Button size="lg" className="w-full sm:hidden" onClick={startNew}>
            <Plus aria-hidden /> New decision
          </Button>
          {sorted.length === 0 ? (
            <EmptyState
              icon={Scale}
              title="Stuck between options?"
              description="List your options, decide what matters, score each one and see which comes out on top."
              action={
                <Button onClick={startNew}>
                  <Plus aria-hidden /> New decision
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sorted.map((d) => (
                <li key={d.id}>
                  <DecisionCard decision={d} onOpen={() => setEditing(d)} onDuplicate={() => duplicate(d)} onDelete={() => deleteDecision(d)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </ToolPage>
  )
}

function DecisionCard({ decision, onOpen, onDuplicate, onDelete }: { decision: Decision; onOpen: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const chosenIndex = decision.options.findIndex((o) => o.id === decision.chosenOptionId)
  const leader = useMemo(() => {
    const r = computeResults(decision)[0]
    return r && r.scored ? r : null
  }, [decision])
  return (
    <div className="flex h-full items-start gap-1 rounded-2xl border bg-card shadow-soft transition-colors hover:bg-surface">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 rounded-2xl p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <p className="line-clamp-2 font-medium wrap-break-word">{decision.question || "Untitled decision"}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {decision.options.length} options · {decision.criteria.length} criteria · {formatUpdated(decision.updatedAt)}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chosenIndex >= 0 ? (
            <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
              <CircleCheck className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">Chose {optionLabel(decision.options[chosenIndex].name, chosenIndex)}</span>
            </span>
          ) : leader ? (
            <span className="inline-flex max-w-full items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <span className="truncate">
                Leading: {leader.name} · {Math.round(leader.percent)}%
              </span>
            </span>
          ) : (
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted-foreground">Not scored yet</span>
          )}
        </div>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="mt-2 mr-2 text-muted-foreground" aria-label={`Actions for "${decision.question || "Untitled decision"}"`} />}>
          <MoreVertical aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy aria-hidden /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 aria-hidden /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
