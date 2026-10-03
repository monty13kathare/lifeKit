"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, Check, Dumbbell, History, Moon, ShieldCheck, Sparkles, Stethoscope, Trash2, Utensils, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { AiLanguageToggle } from "@/components/common/ai-language-toggle"
import { CopyButton } from "@/components/common/copy-button"
import { Notice } from "@/components/common/notice"
import { ProgressRing } from "@/components/common/progress-ring"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAiStatus } from "@/hooks/use-ai-status"
import { useSettings, useWellness } from "@/hooks/use-lifekit-data"
import { aiAssist } from "@/lib/ai/client"
import { assistInputLimit } from "@/lib/ai/assist-schemas"
import { todayString } from "@/lib/dates"
import { createId } from "@/lib/storage/core"
import { cn } from "@/lib/utils"
import type { HealthInsight, WellnessGoals } from "@/types"
import { GoalChangesSheet } from "./goal-changes-sheet"
import {
  compareSnapshots,
  fmtGoal,
  fmtInsightDate,
  GOAL_LABELS,
  goalChanges,
  insightAsText,
  lastSevenDays,
  MAX_INSIGHTS,
  newestFirst,
  serializeHealthInput,
  snapshotFor,
  type GoalKey,
  type WeightUnit,
} from "./health-utils"

interface AiCoachProps {
  onGoToProfile: () => void
  weightUnit: WeightUnit
}

export function AiCoach({ onGoToProfile, weightUnit }: AiCoachProps) {
  const ai = useAiStatus()
  const { settings } = useSettings()
  const { profile, days, goals, setGoals, insights, addInsight, removeInsight } = useWellness()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [insist, setInsist] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  const sorted = useMemo(() => newestFirst(insights), [insights])
  const selected = sorted.find((i) => i.id === selectedId) ?? sorted[0]
  const selectedIndex = selected ? sorted.indexOf(selected) : -1
  const previous = selectedIndex >= 0 ? sorted[selectedIndex + 1] : undefined
  const incomplete = !profile.heightCm || !profile.weightKg
  const configured = !!ai?.configured

  const run = async () => {
    controllerRef.current?.abort()
    const ctl = new AbortController()
    controllerRef.current = ctl
    setLoading(true)
    setError(null)
    try {
      const week = lastSevenDays(days, todayString())
      const input = serializeHealthInput(profile, goals, week, assistInputLimit("health-insights"))
      const data = await aiAssist("health-insights", input, ctl.signal)
      const insight: HealthInsight = {
        id: createId(),
        generatedAt: new Date().toISOString(),
        language: settings.aiLanguage === "hi" ? "hi" : "en",
        snapshot: snapshotFor(profile, week),
        data,
      }
      addInsight(insight)
      // Keep only the latest MAX_INSIGHTS checks.
      for (const old of newestFirst([...insights, insight]).slice(MAX_INSIGHTS)) removeInsight(old.id)
      setSelectedId(insight.id)
      toast.success("Your health check is ready")
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return
      const message = (err as Error)?.message || "Something went wrong. Please try again."
      setError(message)
      toast.error("Couldn't get your health check", { description: message })
    } finally {
      if (controllerRef.current === ctl) {
        controllerRef.current = null
        setLoading(false)
      }
    }
  }

  const cancel = () => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setLoading(false)
    toast("Health check cancelled")
  }

  const remove = (insight: HealthInsight) => {
    removeInsight(insight.id)
    if (selectedId === insight.id) setSelectedId(null)
    toast("Check deleted", { action: { label: "Undo", onClick: () => addInsight(insight) } })
  }

  return (
    <div className="space-y-5">
      {ai === null ? (
        <Skeleton className="h-14 rounded-xl" />
      ) : !configured ? (
        <Notice tone="info" title="The AI coach needs Gemini">
          This tab uses Google Gemini, which isn&apos;t set up for this copy of LifeKit. The Today and My health tabs work fully offline.
          {sorted.length ? " Your saved checks are still shown below." : null}
        </Notice>
      ) : (
        <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5" aria-labelledby="coach-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="coach-heading" className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" aria-hidden /> AI health check
            </h2>
            <AiLanguageToggle />
          </div>
          <p className="flex gap-2 rounded-xl bg-surface-muted p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Sends your health profile and the last 7 days of water, steps, exercise, sleep, mood, habits and meal notes to Google Gemini. Your journal is never
              sent.
            </span>
          </p>

          {incomplete && !insist && !loading ? (
            <Notice
              tone="warning"
              title="Add your height and weight first"
              action={
                <div className="flex flex-wrap gap-2">
                  <Button size="lg" className="sm:h-10" onClick={onGoToProfile}>
                    Complete my health profile <ArrowRight aria-hidden />
                  </Button>
                  <Button variant="ghost" size="lg" className="sm:h-10" onClick={() => setInsist(true)}>
                    Run it anyway
                  </Button>
                </div>
              }
            >
              The coach gives much more useful advice when it knows your basics. It only takes a minute in the My health tab.
            </Notice>
          ) : loading ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground" role="status">
                Looking over your week… this usually takes a few seconds.
              </p>
              <Button variant="outline" size="lg" className="sm:h-10" onClick={cancel}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {incomplete ? (
                <p className="text-xs text-warning-foreground dark:text-warning">Without height and weight, the advice will be more general.</p>
              ) : null}
              <Button size="lg" className="w-full sm:w-auto" onClick={run}>
                <Sparkles aria-hidden /> {sorted.length ? "Get a new health check" : "Get my health check"}
              </Button>
            </div>
          )}

          {error && !loading ? (
            <Notice tone="danger" title="Couldn't get your health check" action={<Button variant="outline" onClick={run}>Try again</Button>}>
              {error}
            </Notice>
          ) : null}
        </section>
      )}

      <div aria-live="polite" aria-busy={loading}>
        {loading ? <InsightSkeleton /> : selected ? (
          <InsightView insight={selected} previous={previous} isLatest={selectedIndex === 0} goals={goals} setGoals={setGoals} weightUnit={weightUnit} />
        ) : configured ? (
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No health checks yet. Your first one will appear here — it looks at your profile and how the past week went.
          </div>
        ) : null}
      </div>

      {sorted.length > 1 ? (
        <section aria-labelledby="history-heading" className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
          <h2 id="history-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <History className="size-4 text-muted-foreground" aria-hidden /> Previous checks
          </h2>
          <ul className="space-y-2">
            {sorted.map((i) => {
              const active = i.id === selected?.id
              return (
                <li key={i.id} className={cn("flex items-center gap-2 rounded-xl border bg-surface p-1.5 pl-3", active && "border-primary/40 bg-primary/5")}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(i.id)}
                    aria-current={active ? "true" : undefined}
                    className="flex min-h-10 min-w-0 flex-1 items-center justify-between gap-3 rounded-lg text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="truncate">{fmtInsightDate(i.generatedAt)}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{i.data.score}/100</span>
                  </button>
                  <Button variant="ghost" size="icon" aria-label={`Delete check from ${fmtInsightDate(i.generatedAt)}`} onClick={() => remove(i)}>
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : sorted.length === 1 ? (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => remove(sorted[0])}>
            <Trash2 aria-hidden /> Delete this check
          </Button>
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------ Result view */

function InsightView({
  insight,
  previous,
  isLatest,
  goals,
  setGoals,
  weightUnit,
}: {
  insight: HealthInsight
  previous?: HealthInsight
  isLatest: boolean
  goals: WellnessGoals
  setGoals: (g: WellnessGoals) => void
  weightUnit: WeightUnit
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const d = insight.data
  const suggestedKeys = (Object.keys(GOAL_LABELS) as GoalKey[]).filter((k) => typeof d.suggestedGoals[k] === "number")
  const changes = goalChanges(goals, d.suggestedGoals)
  const comparison = previous ? compareSnapshots(insight.snapshot, previous.snapshot, weightUnit) : null

  return (
    <article className="space-y-4" aria-labelledby="insight-heading" lang={insight.language}>
      <section className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <ProgressRing value={d.score / 100} size={92} stroke={8} label="Wellness consistency score">
              <span className="text-2xl font-semibold tabular-nums">{d.score}</span>
            </ProgressRing>
            <div className="sm:hidden">
              <p className="text-sm font-semibold">Wellness consistency</p>
              <p className="text-xs text-muted-foreground">{fmtInsightDate(insight.generatedAt)}</p>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="hidden sm:block">
              <h2 id="insight-heading" className="text-sm font-semibold">
                Wellness consistency · {isLatest ? "latest check" : "earlier check"}
              </h2>
              <p className="text-xs text-muted-foreground">{fmtInsightDate(insight.generatedAt)}</p>
            </div>
            <h2 className="sr-only sm:hidden">Health check results</h2>
            <p className="text-sm leading-relaxed">{d.summary}</p>
            {comparison ? <p className="text-xs text-muted-foreground">Compared with your previous check: {comparison}.</p> : null}
          </div>
        </div>
        {isLatest ? (
          <div className="mt-4 flex justify-end">
            <CopyButton value={insightAsText(insight)} label="Copy as text" />
          </div>
        ) : null}
      </section>

      {d.seeDoctor.length ? (
        <Notice tone="warning" icon={Stethoscope} title="Worth discussing with a doctor">
          <ul className="list-disc space-y-1 pl-4">
            {d.seeDoctor.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {d.highlights.length ? (
          <ListCard title="What's going well" icon={Check}>
            <ul className="space-y-2">
              {d.highlights.map((h, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </ListCard>
        ) : null}

        {suggestedKeys.length ? (
          <ListCard title="Suggested daily goals" icon={Sparkles}>
            <ul className="space-y-2">
              {suggestedKeys.map((k) => {
                const to = d.suggestedGoals[k] as number
                const same = to === goals[k]
                return (
                  <li key={k} className="flex items-center justify-between gap-2 rounded-xl border bg-surface px-3 py-2 text-sm">
                    <span className="font-medium">{GOAL_LABELS[k].label}</span>
                    <span className="flex items-center gap-1.5 text-right tabular-nums">
                      {same ? (
                        <span className="text-muted-foreground">{fmtGoal(k, to)} · already set</span>
                      ) : (
                        <>
                          <span className="text-muted-foreground">{fmtGoal(k, goals[k])}</span>
                          <ArrowRight className="size-3.5 text-muted-foreground" aria-label="to" />
                          <span className="font-semibold">{fmtGoal(k, to)}</span>
                        </>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
            <Button
              variant="outline"
              className="mt-3 h-11 w-full sm:w-auto"
              onClick={() => (changes.length ? setConfirmOpen(true) : toast("Your goals already match these suggestions"))}
            >
              Apply to my goals
            </Button>
          </ListCard>
        ) : null}
      </div>

      {d.improvements.length ? (
        <section aria-labelledby="improve-heading" className="space-y-3">
          <h3 id="improve-heading" className="text-sm font-semibold">
            Small steps to try
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {d.improvements.map((imp, i) => (
              <div key={i} className="space-y-1.5 rounded-2xl border bg-card p-4 shadow-soft">
                <p className="text-xs font-semibold tracking-wide text-primary uppercase">{imp.area}</p>
                <p className="text-sm text-muted-foreground">{imp.observation}</p>
                <p className="text-sm">
                  <span className="font-medium">Try: </span>
                  {imp.recommendation}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <IdeaList title="Meal ideas" icon={Utensils} items={d.mealIdeas} />
        <IdeaList title="Exercise ideas" icon={Dumbbell} items={d.exerciseIdeas} />
        <IdeaList title="Sleep tips" icon={Moon} items={d.sleepTips} />
      </div>

      <p className="text-center text-xs text-muted-foreground">AI-generated general wellness guidance, not medical advice.</p>

      <GoalChangesSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Apply suggested goals?"
        description="Only the goals the coach suggested will change."
        changes={changes}
        goals={goals}
        setGoals={setGoals}
      />
    </article>
  )
}

function ListCard({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-muted-foreground" aria-hidden /> {title}
      </h3>
      {children}
    </section>
  )
}

function IdeaList({ title, icon, items }: { title: string; icon: LucideIcon; items: string[] }) {
  if (!items.length) return null
  return (
    <ListCard title={title} icon={icon}>
      <ul className="list-disc space-y-1.5 pl-5 text-sm marker:text-muted-foreground">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </ListCard>
  )
}

function InsightSkeleton() {
  return (
    <div className="space-y-4" aria-label="Preparing your health check">
      <div className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
        <Skeleton className="size-[92px] shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    </div>
  )
}
