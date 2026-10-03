"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { CheckCircle2, Circle, CloudUpload, Dices, Gauge, Loader2, Play, Sparkles, Square, Target, Trophy, Wand2 } from "lucide-react"
import { toast } from "sonner"
import { CopyButton } from "@/components/common/copy-button"
import { Notice } from "@/components/common/notice"
import { ProgressRing } from "@/components/common/progress-ring"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useAiStatus } from "@/hooks/use-ai-status"
import { useLearn } from "@/hooks/use-lifekit-data"
import { aiAssist } from "@/lib/ai/client"
import type { AssistOutput } from "@/lib/ai/assist-schemas"
import { todayString } from "@/lib/dates"
import { recordBest } from "@/lib/learn/progress"
import { cn } from "@/lib/utils"
import { PROMPT_SCENARIOS, type Difficulty, type PromptScenario } from "@/data/learn/prompting"
import { quickCheck, RUBRIC, type HeuristicResult } from "./heuristic"
import { rewardXp } from "./rewards"

export const MAX_PROMPT = 4000
const OFFLINE_XP = 5

type Grade = AssistOutput<"prompt-grade">
type Running = "grade" | "run-mine" | "run-improved" | null

interface GradeState {
  result: Grade
  prevBest?: number
  newBest: boolean
  xp: number
}

interface RunState {
  prompt: string
  output: string
}

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  easy: "bg-success/12 text-success",
  medium: "bg-warning/15 text-warning-foreground dark:text-warning",
  hard: "bg-destructive/10 text-destructive",
}

const scenarioItems = PROMPT_SCENARIOS.map((s) => ({ value: s.id, label: s.title }))

export function scoreColor(score: number) {
  return score >= 75 ? "var(--success)" : score >= 50 ? "var(--warning)" : "var(--destructive)"
}

function quickLabel(s: PromptScenario) {
  return `Quick check: ${s.title}`
}

export function PromptLab({
  prompt,
  onPromptChange,
  scenarioId,
  onScenarioChange,
}: {
  prompt: string
  onPromptChange: (p: string) => void
  scenarioId: string
  onScenarioChange: (id: string) => void
}) {
  const status = useAiStatus()
  const aiReady = status?.configured === true
  const { bests, history } = useLearn()
  const scenario = PROMPT_SCENARIOS.find((s) => s.id === scenarioId) ?? PROMPT_SCENARIOS[0]
  const bestKey = `prompting:${scenario.id}`
  const best = bests[bestKey]

  const [running, setRunning] = useState<Running>(null)
  const [grade, setGrade] = useState<GradeState | null>(null)
  const [runs, setRuns] = useState<{ mine?: RunState; improved?: RunState }>({})
  const [offline, setOffline] = useState<HeuristicResult | null>(null)
  const [showRubric, setShowRubric] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const lastGradedRef = useRef<string>("")

  useEffect(() => () => abortRef.current?.abort(), [])

  const trimmed = prompt.trim()
  const live = quickCheck(prompt)
  const busy = running !== null

  const resetResults = () => {
    abortRef.current?.abort()
    setGrade(null)
    setRuns({})
    setOffline(null)
  }

  const pickScenario = (id: string) => {
    if (id === scenario.id) return
    resetResults()
    onScenarioChange(id)
  }

  const randomScenario = () => {
    const others = PROMPT_SCENARIOS.filter((s) => s.id !== scenario.id)
    pickScenario(others[Math.floor(Math.random() * others.length)].id)
  }

  async function withAi<T>(kind: Exclude<Running, null>, job: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(kind)
    try {
      return await job(controller.signal)
    } catch (err) {
      if ((err as Error)?.name === "AbortError") toast.info("Cancelled")
      else toast.error((err as Error)?.message || "Something went wrong. Please try again.")
      return undefined
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setRunning(null)
      }
    }
  }

  const gradePrompt = async () => {
    if (!trimmed) return
    const result = await withAi("grade", (signal) =>
      aiAssist("prompt-grade", JSON.stringify({ scenario: `${scenario.title}. ${scenario.situation}`, goal: scenario.goal, prompt: trimmed }), signal)
    )
    if (!result) return
    const overall = Math.max(0, Math.min(100, Math.round(result.overall)))
    const prevBest = best
    const newBest = recordBest(bestKey, overall)
    // Only award XP once per distinct prompt, so re-grading the same text can't farm XP.
    const gradedKey = `${scenario.id}\n${trimmed}`
    let xp = 0
    if (lastGradedRef.current !== gradedKey) {
      lastGradedRef.current = gradedKey
      xp = Math.round(overall / 5)
      if (xp > 0) rewardXp(xp, `Prompt Lab: ${scenario.title} — ${overall}/100`)
    }
    setGrade({ result: { ...result, overall }, prevBest, newBest, xp })
    setOffline(null)
    setRuns((r) => ({ mine: r.mine })) // improved prompt changed → old comparison is stale
  }

  const runPrompt = async (which: "mine" | "improved") => {
    const text = which === "mine" ? trimmed : grade?.result.improvedPrompt.trim()
    if (!text) return
    const result = await withAi(which === "mine" ? "run-mine" : "run-improved", (signal) => aiAssist("prompt-run", text, signal))
    if (result) setRuns((r) => ({ ...r, [which]: { prompt: text, output: result.output } }))
  }

  const offlineCheck = () => {
    const res = quickCheck(prompt)
    setOffline(res)
    setGrade(null)
    const today = todayString()
    const already = history.some((h) => h.track === "prompting" && h.date === today && h.label === quickLabel(scenario))
    const words = trimmed.split(/\s+/).length
    if (!already && words >= 10) {
      rewardXp(OFFLINE_XP, quickLabel(scenario))
      toast.success(`+${OFFLINE_XP} XP for practising`)
    } else if (!already) {
      toast.info("Write at least 10 words to earn XP for this scenario.")
    }
  }

  const applyImproved = () => {
    if (!grade) return
    onPromptChange(grade.result.improvedPrompt.slice(0, MAX_PROMPT))
    toast.success("Improved prompt loaded — tweak it and grade again.")
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {/* ------------------------------------------------ editor */}
        <div className="min-w-0 space-y-4">
          <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="scenario-label">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label id="scenario-label">Scenario</Label>
                <Select items={scenarioItems} value={scenario.id} onValueChange={(v) => v && pickScenario(v)} disabled={busy}>
                  <SelectTrigger className="w-full" aria-labelledby="scenario-label">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scenarioItems.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={randomScenario} disabled={busy} aria-label="Random scenario">
                <Dices aria-hidden /> <span className="hidden sm:inline">Random</span>
              </Button>
            </div>
            <motion.div key={scenario.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", DIFFICULTY_STYLE[scenario.difficulty])}>{scenario.difficulty}</span>
                <Badge variant="outline">{scenario.category}</Badge>
                {best !== undefined ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Trophy className="size-3.5 text-warning" aria-hidden /> Best {best}/100
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">{scenario.situation}</p>
              <p className="flex gap-2 text-sm">
                <Target className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="font-medium">Goal: </span>
                  {scenario.goal}
                </span>
              </p>
            </motion.div>
          </section>

          <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="lab-prompt">Your prompt</Label>
              <span className={cn("text-xs tabular-nums", prompt.length > MAX_PROMPT * 0.9 ? "text-warning" : "text-muted-foreground")} aria-live="off">
                {prompt.length}/{MAX_PROMPT}
              </span>
            </div>
            <Textarea
              id="lab-prompt"
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value.slice(0, MAX_PROMPT))}
              maxLength={MAX_PROMPT}
              placeholder="Write the prompt you'd send to an AI for this scenario. Tip: role, context, task, format, constraints…"
              className="min-h-40 resize-y"
              disabled={busy}
            />

            <LiveChecklist live={live} />

            {status === null ? (
              <Skeleton className="h-12 rounded-xl" />
            ) : aiReady ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button size="lg" onClick={gradePrompt} disabled={!trimmed || busy}>
                    {running === "grade" ? <Loader2 className="animate-spin" aria-hidden /> : <Gauge aria-hidden />}
                    {running === "grade" ? "Grading…" : "Grade my prompt"}
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => runPrompt("mine")} disabled={!trimmed || busy}>
                    {running === "run-mine" ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
                    {running === "run-mine" ? "Running…" : "Run my prompt"}
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CloudUpload className="size-3.5" aria-hidden /> Sent to {status.provider || "Google Gemini"} when you grade or run.
                  </p>
                  {busy ? (
                    <Button size="sm" variant="ghost" onClick={() => abortRef.current?.abort()}>
                      <Square aria-hidden /> Cancel
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setShowRubric((v) => !v)} aria-expanded={showRubric}>
                      Quick check (offline)
                    </Button>
                  )}
                </div>
                {showRubric && !busy ? (
                  <Button variant="outline" className="w-full" onClick={offlineCheck} disabled={!trimmed}>
                    <Gauge aria-hidden /> Score it offline
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <Button size="lg" className="w-full" onClick={offlineCheck} disabled={!trimmed}>
                  <Gauge aria-hidden /> Quick check (offline)
                </Button>
                <p className="text-xs text-muted-foreground">
                  AI grading isn&apos;t set up, so this uses a simple keyword and structure check in your browser. +{OFFLINE_XP} XP once per scenario per day.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* ------------------------------------------------ results */}
        <div className="min-w-0 space-y-4" aria-busy={running === "grade"}>
          <p className="sr-only" aria-live="polite">
            {running === "grade"
              ? "Grading your prompt…"
              : grade
                ? `AI grade: ${grade.result.overall} out of 100.${grade.newBest ? " New best!" : ""}`
                : offline
                  ? `Quick check score: ${offline.score} out of 100.`
                  : ""}
          </p>
          {running === "grade" ? (
            <GradeSkeleton />
          ) : grade ? (
            <GradeResult grade={grade} onUseImproved={applyImproved} onRunImproved={() => runPrompt("improved")} busy={busy} running={running} />
          ) : offline ? (
            <OfflineResult result={offline} />
          ) : (
            <div className="flex h-full min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed bg-surface/50 p-6 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="size-6" aria-hidden />
              </div>
              <p className="font-medium">Your feedback will appear here</p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                {aiReady ? "Grade your prompt for a score, per-criterion feedback and an improved version." : "Run a quick check to see which prompt building blocks you've covered."}
              </p>
            </div>
          )}
        </div>
      </div>

      {aiReady && (runs.mine || runs.improved || running === "run-mine" || running === "run-improved") ? (
        <section aria-labelledby="compare-title" className="space-y-3">
          <h3 id="compare-title" className="font-semibold">
            Compare outputs
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <OutputCard title="Your prompt" run={runs.mine} loading={running === "run-mine"} />
            <OutputCard
              title="Improved prompt"
              run={runs.improved}
              loading={running === "run-improved"}
              empty={
                grade ? (
                  <Button variant="outline" onClick={() => runPrompt("improved")} disabled={busy}>
                    <Play aria-hidden /> Run improved prompt
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">Grade your prompt to get an improved version to compare.</p>
                )
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">AI output can be wrong or made up — check facts before relying on it.</p>
        </section>
      ) : null}
    </div>
  )
}

function LiveChecklist({ live }: { live: HeuristicResult }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Self-check · building blocks spotted as you type</p>
      <ul className="flex flex-wrap gap-1.5" aria-label="Prompt building blocks">
        {RUBRIC.map((r) => {
          const ok = live.detected[r.key]
          return (
            <li
              key={r.key}
              title={r.hint}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs",
                ok ? "border-success/40 bg-success/10 text-success" : "text-muted-foreground"
              )}
            >
              {ok ? <CheckCircle2 className="size-3.5" aria-hidden /> : <Circle className="size-3.5" aria-hidden />}
              {r.label}
              <span className="sr-only">{ok ? " — present" : " — missing"}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ScoreHeader({ score, label, children }: { score: number; label: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <ProgressRing value={score / 100} size={92} stroke={8} color={scoreColor(score)} label={label}>
        <span className="text-2xl font-semibold tabular-nums">{score}</span>
      </ProgressRing>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{score >= 85 ? "Excellent prompt" : score >= 70 ? "Strong prompt" : score >= 50 ? "Decent start" : "Needs work"}</p>
        {children}
      </div>
    </div>
  )
}

function GradeResult({
  grade,
  onUseImproved,
  onRunImproved,
  busy,
  running,
}: {
  grade: GradeState
  onUseImproved: () => void
  onRunImproved: () => void
  busy: boolean
  running: Running
}) {
  const { result, prevBest, newBest, xp } = grade
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-4">
      <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
        <ScoreHeader score={result.overall} label="AI grade">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {newBest ? <span className="rounded-full bg-success/12 px-2 py-0.5 font-medium text-success">New best!</span> : null}
            {prevBest !== undefined ? <span className="text-muted-foreground">Previous best {prevBest}/100</span> : null}
            {xp > 0 ? <span className="text-muted-foreground">· +{xp} XP</span> : <span className="text-muted-foreground">· No XP for re-grading the same prompt</span>}
          </div>
        </ScoreHeader>
        <ul className="space-y-3">
          {result.criteria.map((c) => (
            <li key={c.name} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{c.name}</span>
                <span className="tabular-nums text-muted-foreground">{c.score}/10</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-label={c.name} aria-valuemin={0} aria-valuemax={10} aria-valuenow={c.score}>
                <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${c.score * 10}%`, background: scoreColor(c.score * 10) }} />
              </div>
              {c.feedback ? <p className="text-xs text-muted-foreground">{c.feedback}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      {result.strengths.length || result.improvements.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {result.strengths.length ? (
            <section className="rounded-2xl border border-success/30 bg-success/6 p-4">
              <h4 className="text-sm font-semibold text-success">Strengths</h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {result.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {result.improvements.length ? (
            <section className="rounded-2xl border border-warning/35 bg-warning/8 p-4">
              <h4 className="text-sm font-semibold">To improve</h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {result.improvements.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {result.improvedPrompt.trim() ? (
        <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold">
            <Wand2 className="size-4 text-primary" aria-hidden /> Improved prompt
          </h4>
          <p className="max-h-72 overflow-y-auto rounded-xl bg-surface-muted p-3 text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">{result.improvedPrompt}</p>
          <div className="flex flex-wrap gap-2">
            <CopyButton value={result.improvedPrompt} size="sm" />
            <Button size="sm" variant="outline" onClick={onUseImproved} disabled={busy}>
              Try the improved version
            </Button>
            <Button size="sm" variant="outline" onClick={onRunImproved} disabled={busy}>
              {running === "run-improved" ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />} Run improved prompt
            </Button>
          </div>
        </section>
      ) : null}
    </motion.div>
  )
}

function OfflineResult({ result }: { result: HeuristicResult }) {
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
      <ScoreHeader score={result.score} label="Quick check (offline)">
        <p className="text-xs text-muted-foreground">Keyword and structure check — not a real quality grade.</p>
      </ScoreHeader>
      <ul className="space-y-2">
        {RUBRIC.map((r) => {
          const ok = result.detected[r.key]
          return (
            <li key={r.key} className="flex gap-2.5 text-sm">
              {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
              <span>
                <span className="font-medium">{r.label}</span>
                <span className="sr-only">{ok ? " (present)" : " (missing)"}</span>
                <span className="block text-xs text-muted-foreground">{r.hint}</span>
              </span>
            </li>
          )
        })}
      </ul>
      {result.tips.length ? (
        <Notice tone="info" title="Next steps">
          <ul className="list-disc space-y-1 pl-4">
            {result.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Notice>
      ) : (
        <Notice tone="success" title="All the building blocks are there">
          Now read it as the AI would: is anything ambiguous or contradictory?
        </Notice>
      )}
    </motion.section>
  )
}

function OutputCard({ title, run, loading, empty }: { title: string; run?: RunState; loading: boolean; empty?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border bg-card p-4" aria-busy={loading}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{title}</h4>
        {run && !loading ? <CopyButton value={run.output} iconOnly size="icon-sm" variant="ghost" label={`Copy ${title.toLowerCase()} output`} /> : null}
      </div>
      {loading ? (
        <div className="space-y-2" aria-label="Generating output">
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : run ? (
        <div className="max-h-112 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">{run.output}</div>
      ) : (
        <div className="flex flex-1 items-center justify-center py-6 text-center">{empty}</div>
      )}
    </div>
  )
}

function GradeSkeleton() {
  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5" aria-label="Grading your prompt">
      <div className="flex items-center gap-4">
        <Skeleton className="size-23 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-40" />
        </div>
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-2 w-full" />
        </div>
      ))}
    </div>
  )
}
