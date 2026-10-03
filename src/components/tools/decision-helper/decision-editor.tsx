"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Check, CircleCheck, Copy, Loader2, MoreVertical, Plus, Sparkles, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useDecisions } from "@/hooks/use-lifekit-data"
import { aiAssist } from "@/lib/ai/client"
import type { AssistOutput } from "@/lib/ai/assist-schemas"
import { createId } from "@/lib/storage/core"
import { cn } from "@/lib/utils"
import type { Decision } from "@/types"
import { AiAdvicePanel, type Advice } from "./ai-advice"
import { DecisionResults } from "./decision-results"
import { computeResults, criterionLabel, hasContent, MAX_CRITERIA, MAX_OPTIONS, MIN_OPTIONS, optionLabel, sensitivity, validateDecision, WEIGHT_LABEL } from "./decision-utils"
import { ScorePicker, ScoringMatrix } from "./scoring-matrix"

type SuggestedCriterion = AssistOutput<"decision-criteria">["criteria"][number]

interface DecisionEditorProps {
  initial: Decision
  aiEnabled: boolean
  onBack: () => void
  onDelete: (d: Decision) => void
  onDuplicate: (d: Decision) => void
}

const SAVE_DELAY = 600

export function DecisionEditor({ initial, aiEnabled, onBack, onDelete, onDuplicate }: DecisionEditorProps) {
  const { upsert } = useDecisions()
  const [draft, setDraft] = useState<Decision>(initial)
  const [saveState, setSaveState] = useState<"idle" | "pending" | "saved">("idle")

  /* ---------------------------------------------------------- autosave */
  const latest = useRef(draft)
  const dirty = useRef(false)
  const upsertRef = useRef(upsert)
  useEffect(() => {
    upsertRef.current = upsert
  }, [upsert])

  useEffect(() => {
    latest.current = draft
    if (!dirty.current) return
    const t = window.setTimeout(() => {
      if (hasContent(latest.current)) {
        upsertRef.current({ ...latest.current, updatedAt: new Date().toISOString() })
        setSaveState("saved")
      } else setSaveState("idle")
      dirty.current = false
    }, SAVE_DELAY)
    return () => window.clearTimeout(t)
  }, [draft])

  // Flush a pending save when leaving the editor.
  useEffect(
    () => () => {
      if (dirty.current && hasContent(latest.current)) upsertRef.current({ ...latest.current, updatedAt: new Date().toISOString() })
    },
    []
  )

  const change = (fn: (d: Decision) => Decision) => {
    dirty.current = true
    setSaveState("pending")
    setDraft(fn)
  }

  /* ----------------------------------------------------------- options */
  const setOptionName = (id: string, name: string) => change((d) => ({ ...d, options: d.options.map((o) => (o.id === id ? { ...o, name } : o)) }))
  const addOption = () => change((d) => (d.options.length >= MAX_OPTIONS ? d : { ...d, options: [...d.options, { id: createId(), name: "" }] }))
  const removeOption = (id: string) =>
    change((d) => {
      if (d.options.length <= MIN_OPTIONS) return d
      const scores = { ...d.scores }
      delete scores[id]
      return { ...d, options: d.options.filter((o) => o.id !== id), scores, chosenOptionId: d.chosenOptionId === id ? undefined : d.chosenOptionId }
    })

  /* ---------------------------------------------------------- criteria */
  const setCriterion = (id: string, patch: Partial<{ name: string; weight: number }>) =>
    change((d) => ({ ...d, criteria: d.criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))
  const addCriterion = (name = "", weight = 3) =>
    change((d) => (d.criteria.length >= MAX_CRITERIA ? d : { ...d, criteria: [...d.criteria, { id: createId(), name, weight }] }))
  const removeCriterion = (id: string) =>
    change((d) => {
      const scores: Decision["scores"] = {}
      for (const [oid, row] of Object.entries(d.scores)) {
        const copy = { ...row }
        delete copy[id]
        scores[oid] = copy
      }
      return { ...d, criteria: d.criteria.filter((c) => c.id !== id), scores }
    })

  const setScore = (optionId: string, criterionId: string, value: number | undefined) =>
    change((d) => {
      const row = { ...(d.scores[optionId] ?? {}) }
      if (value === undefined) delete row[criterionId]
      else row[criterionId] = value
      return { ...d, scores: { ...d.scores, [optionId]: row } }
    })

  /* ----------------------------------------------------------- results */
  const results = useMemo(() => computeResults(draft), [draft])
  const sens = useMemo(() => sensitivity(draft, results), [draft, results])
  const leaderId = results[0]?.scored ? results[0].id : undefined
  const namedOptions = draft.options.filter((o) => o.name.trim())

  /* ---------------------------------------------------------------- AI */
  const aiCtrl = useRef<AbortController | null>(null)
  useEffect(() => () => aiCtrl.current?.abort(), [])
  const [criteriaAi, setCriteriaAi] = useState<{ loading: boolean; items: SuggestedCriterion[] | null; selected: Set<number> }>({
    loading: false,
    items: null,
    selected: new Set(),
  })
  const [adviceState, setAdviceState] = useState<{ loading: boolean; advice: Advice | null }>({ loading: false, advice: null })

  const startAi = () => {
    aiCtrl.current?.abort()
    const c = new AbortController()
    aiCtrl.current = c
    return c
  }
  const cancelAi = () => {
    aiCtrl.current?.abort()
    aiCtrl.current = null
    setCriteriaAi((s) => ({ ...s, loading: false }))
    setAdviceState((s) => ({ ...s, loading: false }))
  }
  const aiError = (err: unknown, c: AbortController, fallback: string) => {
    if (c.signal.aborted || (err as Error)?.name === "AbortError") return
    toast.error((err as Error)?.message || fallback)
  }

  const suggestCriteria = async () => {
    if (!draft.question.trim()) {
      toast.error("Write your question first so Gemini knows what you're deciding.")
      return
    }
    const c = startAi()
    setCriteriaAi({ loading: true, items: null, selected: new Set() })
    try {
      const out = await aiAssist("decision-criteria", JSON.stringify({ question: draft.question.trim(), options: namedOptions.map((o) => o.name.trim()) }), c.signal)
      if (c.signal.aborted) return
      const existing = new Set(draft.criteria.map((x) => x.name.trim().toLowerCase()))
      const items = out.criteria.filter((x) => !existing.has(x.name.trim().toLowerCase()))
      if (!items.length) toast("No new criteria", { description: "Your list already covers Gemini's suggestions." })
      setCriteriaAi({ loading: false, items: items.length ? items : null, selected: new Set(items.map((_, i) => i)) })
    } catch (err) {
      setCriteriaAi({ loading: false, items: null, selected: new Set() })
      aiError(err, c, "Couldn't suggest criteria right now.")
    } finally {
      if (aiCtrl.current === c) aiCtrl.current = null
    }
  }

  const addSuggested = () => {
    const picked = (criteriaAi.items ?? []).filter((_, i) => criteriaAi.selected.has(i))
    const room = MAX_CRITERIA - draft.criteria.length
    const toAdd = picked.slice(0, Math.max(0, room))
    if (toAdd.length) {
      change((d) => ({ ...d, criteria: [...d.criteria, ...toAdd.map((x) => ({ id: createId(), name: x.name.slice(0, 60), weight: x.weight }))] }))
      toast.success(`Added ${toAdd.length} ${toAdd.length === 1 ? "criterion" : "criteria"}`)
    }
    if (picked.length > toAdd.length) toast(`Only ${MAX_CRITERIA} criteria allowed — some weren't added.`)
    setCriteriaAi({ loading: false, items: null, selected: new Set() })
  }

  const scoredCount = Object.values(draft.scores).reduce((n, row) => n + Object.keys(row).length, 0)
  const adviceDisabled = !draft.question.trim()
    ? "Write your question to get advice."
    : namedOptions.length < MIN_OPTIONS
      ? "Name at least two options to get advice."
      : scoredCount === 0
        ? "Score at least a few options first."
        : null

  const getAdvice = async () => {
    if (adviceDisabled) return
    const c = startAi()
    setAdviceState({ loading: true, advice: null })
    try {
      const scores: Record<string, Record<string, number>> = {}
      draft.options.forEach((o, oi) => {
        const row: Record<string, number> = {}
        draft.criteria.forEach((cr, ci) => {
          const s = draft.scores[o.id]?.[cr.id]
          if (typeof s === "number") row[criterionLabel(cr.name, ci)] = s
        })
        scores[optionLabel(o.name, oi)] = row
      })
      const input = {
        question: draft.question.trim(),
        options: draft.options.map((o, i) => optionLabel(o.name, i)),
        criteria: draft.criteria.map((cr, i) => ({ name: criterionLabel(cr.name, i), weight: cr.weight })),
        scores,
      }
      const advice = await aiAssist("decision-advice", JSON.stringify(input), c.signal)
      if (c.signal.aborted) return
      setAdviceState({ loading: false, advice })
    } catch (err) {
      setAdviceState({ loading: false, advice: null })
      aiError(err, c, "Couldn't get advice right now.")
    } finally {
      if (aiCtrl.current === c) aiCtrl.current = null
    }
  }

  /* ----------------------------------------------------------- decided */
  const [decideOpen, setDecideOpen] = useState(false)
  const openDecide = () => {
    const err = validateDecision(draft)
    if (err) {
      toast.error(err)
      return
    }
    setDecideOpen(true)
  }
  const confirmDecision = (optionId: string, notes: string) => {
    change((d) => ({ ...d, chosenOptionId: optionId, notes: notes.trim() || undefined }))
    setDecideOpen(false)
    const idx = draft.options.findIndex((o) => o.id === optionId)
    toast.success("Decision made", { description: optionLabel(draft.options[idx]?.name ?? "", idx) })
  }
  const chosenIndex = draft.options.findIndex((o) => o.id === draft.chosenOptionId)

  const questionError = draft.question.length > 200 ? "Keep the question under 200 characters" : null
  const dupNames = new Set<string>()
  const seen = new Set<string>()
  for (const o of draft.options) {
    const k = o.name.trim().toLowerCase()
    if (!k) continue
    if (seen.has(k)) dupNames.add(k)
    seen.add(k)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" className="-ml-2" onClick={onBack}>
          <ArrowLeft aria-hidden /> All decisions
        </Button>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {saveState === "pending" ? "Saving…" : saveState === "saved" ? "Saved" : ""}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Decision actions" />}>
              <MoreVertical aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuItem disabled={!hasContent(draft)} onClick={() => onDuplicate({ ...draft, updatedAt: new Date().toISOString() })}>
                <Copy aria-hidden /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  // Don't let the unmount flush re-save a deleted decision.
                  dirty.current = false
                  onDelete(draft)
                }}
              >
                <Trash2 aria-hidden /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Question + options */}
        <section aria-labelledby="dh-options" className="space-y-4 rounded-2xl border bg-card p-4 shadow-soft">
          <div className="space-y-1.5">
            <Label htmlFor="dh-question">What are you deciding?</Label>
            <Input
              id="dh-question"
              value={draft.question}
              onChange={(e) => change((d) => ({ ...d, question: e.target.value }))}
              placeholder="e.g. Which job offer should I take?"
              maxLength={220}
              className="h-11"
              aria-invalid={questionError ? true : undefined}
              autoFocus={!initial.question}
            />
            {questionError ? <p className="text-xs font-medium text-destructive">{questionError}</p> : null}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 id="dh-options" className="text-sm font-semibold">
                Options <span className="font-normal text-muted-foreground">({draft.options.length}/{MAX_OPTIONS})</span>
              </h3>
              <Button variant="outline" onClick={addOption} disabled={draft.options.length >= MAX_OPTIONS}>
                <Plus aria-hidden /> Add option
              </Button>
            </div>
            <ul className="space-y-2">
              {draft.options.map((o, i) => {
                const dup = dupNames.has(o.name.trim().toLowerCase())
                return (
                  <li key={o.id}>
                    <div className="flex items-center gap-2">
                      <Input
                        value={o.name}
                        onChange={(e) => setOptionName(o.id, e.target.value)}
                        placeholder={`Option ${i + 1}`}
                        aria-label={`Option ${i + 1} name`}
                        aria-invalid={dup ? true : undefined}
                        maxLength={120}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground"
                        aria-label={`Remove ${optionLabel(o.name, i)}`}
                        disabled={draft.options.length <= MIN_OPTIONS}
                        onClick={() => removeOption(o.id)}
                      >
                        <X aria-hidden />
                      </Button>
                    </div>
                    {dup ? <p className="mt-1 text-xs font-medium text-destructive">Option names must be different</p> : null}
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        {/* Criteria */}
        <section aria-labelledby="dh-criteria" className="space-y-3 rounded-2xl border bg-card p-4 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="dh-criteria" className="text-sm font-semibold">
              Criteria <span className="font-normal text-muted-foreground">& how much they matter</span>
            </h3>
            <div className="flex gap-2">
              {aiEnabled ? (
                criteriaAi.loading ? (
                  <Button variant="outline" onClick={cancelAi}>
                    <X aria-hidden /> Cancel
                  </Button>
                ) : (
                  <Button variant="outline" onClick={suggestCriteria}>
                    <Sparkles aria-hidden /> Suggest
                  </Button>
                )
              ) : null}
              <Button variant="outline" onClick={() => addCriterion()} disabled={draft.criteria.length >= MAX_CRITERIA}>
                <Plus aria-hidden /> Add
              </Button>
            </div>
          </div>
          {aiEnabled ? <p className="text-xs text-muted-foreground">“Suggest” sends your question and options to Google Gemini.</p> : null}

          <div aria-live="polite">
            {criteriaAi.loading ? (
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Finding criteria…
              </p>
            ) : criteriaAi.items ? (
              <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground">Suggested by Gemini — pick the ones that matter to you.</p>
                <ul className="space-y-1">
                  {criteriaAi.items.map((s, i) => (
                    <li key={`${i}-${s.name}`}>
                      <label className="flex min-h-10 cursor-pointer items-start gap-2.5 rounded-lg bg-card px-2.5 py-2 hover:bg-surface">
                        <Checkbox
                          checked={criteriaAi.selected.has(i)}
                          onCheckedChange={() =>
                            setCriteriaAi((st) => {
                              const selected = new Set(st.selected)
                              if (selected.has(i)) selected.delete(i)
                              else selected.add(i)
                              return { ...st, selected }
                            })
                          }
                          className="mt-0.5 size-5"
                        />
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="font-medium">{s.name}</span>{" "}
                          <span className="text-xs text-muted-foreground">· weight {s.weight}</span>
                          {s.description ? <span className="block text-xs text-muted-foreground">{s.description}</span> : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setCriteriaAi({ loading: false, items: null, selected: new Set() })}>
                    Dismiss
                  </Button>
                  <Button onClick={addSuggested} disabled={criteriaAi.selected.size === 0}>
                    Add {criteriaAi.selected.size || ""} selected
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {draft.criteria.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">Add what matters — cost, time, happiness…</p>
          ) : (
            <ul className="space-y-3">
              {draft.criteria.map((c, i) => (
                <li key={c.id} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Input
                      value={c.name}
                      onChange={(e) => setCriterion(c.id, { name: e.target.value })}
                      placeholder={`Criterion ${i + 1}`}
                      aria-label={`Criterion ${i + 1} name`}
                      maxLength={60}
                    />
                    <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={`Remove ${criterionLabel(c.name, i)}`} onClick={() => removeCriterion(c.id)}>
                      <X aria-hidden />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ScorePicker label={`Weight for ${criterionLabel(c.name, i)}`} value={c.weight} onChange={(v) => v && setCriterion(c.id, { weight: v })} />
                    <span className="text-xs text-muted-foreground">{WEIGHT_LABEL[c.weight]}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Matrix */}
      <section aria-labelledby="dh-matrix" className="space-y-3">
        <div>
          <h3 id="dh-matrix" className="text-base font-semibold">
            Score each option
          </h3>
          <p className="text-sm text-muted-foreground">1 = poor, 5 = excellent. Tap a selected score again to clear it.</p>
        </div>
        <ScoringMatrix decision={draft} onScore={setScore} leaderId={leaderId} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="dh-results" className="space-y-3 rounded-2xl border bg-card p-4 shadow-soft">
          <h3 id="dh-results" className="text-base font-semibold">
            Weighted results
          </h3>
          <div aria-live="polite">
            <DecisionResults results={results} sensitivity={sens} chosenId={draft.chosenOptionId} />
          </div>
          <div className="border-t pt-3">
            {chosenIndex >= 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm">
                  <CircleCheck className="size-4 shrink-0 text-success" aria-hidden />
                  <span>
                    You chose <span className="font-semibold">{optionLabel(draft.options[chosenIndex].name, chosenIndex)}</span>
                  </span>
                </p>
                {draft.notes ? <p className="text-sm whitespace-pre-line text-muted-foreground">{draft.notes}</p> : null}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={openDecide}>
                    Change
                  </Button>
                  <Button variant="ghost" onClick={() => change((d) => ({ ...d, chosenOptionId: undefined }))}>
                    Undecide
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="lg" className="w-full sm:h-10 sm:w-auto" onClick={openDecide}>
                <Check aria-hidden /> I&apos;ve decided
              </Button>
            )}
          </div>
        </section>

        {aiEnabled ? (
          <AiAdvicePanel
            loading={adviceState.loading}
            advice={adviceState.advice}
            onRun={getAdvice}
            onCancel={cancelAi}
            onDismiss={() => setAdviceState({ loading: false, advice: null })}
            disabledReason={adviceDisabled}
          />
        ) : null}
      </div>

      <DecideSheet
        open={decideOpen}
        onOpenChange={setDecideOpen}
        decision={draft}
        defaultOptionId={draft.chosenOptionId ?? leaderId ?? draft.options[0]?.id}
        onConfirm={confirmDecision}
      />
    </div>
  )
}

function DecideSheet({
  open,
  onOpenChange,
  decision,
  defaultOptionId,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  decision: Decision
  defaultOptionId?: string
  onConfirm: (optionId: string, notes: string) => void
}) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title="What did you decide?"
      description="The scores are a guide — the choice is yours."
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" size="lg" className="flex-1 sm:h-10 sm:flex-none" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="decide-form" size="lg" className="flex-1 sm:h-10 sm:flex-none">
            Save decision
          </Button>
        </div>
      }
    >
      {open ? <DecideForm decision={decision} defaultOptionId={defaultOptionId} onConfirm={onConfirm} /> : null}
    </ResponsiveSheet>
  )
}

function DecideForm({ decision, defaultOptionId, onConfirm }: { decision: Decision; defaultOptionId?: string; onConfirm: (id: string, notes: string) => void }) {
  const [choice, setChoice] = useState(defaultOptionId ?? "")
  const [notes, setNotes] = useState(decision.notes ?? "")
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      id="decide-form"
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!decision.options.some((o) => o.id === choice)) return setError("Pick an option")
        if (notes.length > 2000) return setError("Notes are limited to 2000 characters")
        onConfirm(choice, notes)
      }}
    >
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Your choice</legend>
        <div role="radiogroup" aria-label="Your choice" className="space-y-1.5">
          {decision.options.map((o, i) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={choice === o.id}
              onClick={() => {
                setChoice(o.id)
                setError(null)
              }}
              className={cn(
                "flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-3 text-left text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                choice === o.id ? "border-primary bg-primary/5 font-medium" : "hover:bg-surface"
              )}
            >
              <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-2", choice === o.id ? "border-primary" : "border-border")}>
                {choice === o.id ? <span className="size-2.5 rounded-full bg-primary" /> : null}
              </span>
              <span className="min-w-0 flex-1 wrap-break-word">{optionLabel(o.name, i)}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="decide-notes">Notes (optional)</Label>
        <Textarea id="decide-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2100} placeholder="Why you chose it, next steps…" />
      </div>
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
    </form>
  )
}
