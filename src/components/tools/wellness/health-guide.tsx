"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Activity, CalendarPlus, Moon, Scale, Target, TrendingDown, TrendingUp, Zap, Dumbbell, Lightbulb, ListChecks, Loader2, MessageCircleQuestion, RefreshCw, Send, Sparkles, Stethoscope, Sunrise, Utensils, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"
import { AiLanguageToggle } from "@/components/common/ai-language-toggle"
import { Notice } from "@/components/common/notice"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useAiStatus } from "@/hooks/use-ai-status"
import { useRoutines, useSettings, useWellness } from "@/hooks/use-lifekit-data"
import { aiAssist } from "@/lib/ai/client"
import { aiRoutineToItems } from "@/lib/ai/convert"
import { assistInputLimit } from "@/lib/ai/assist-schemas"
import { formatTime12, todayString } from "@/lib/dates"
import { calorieTarget, GOAL_META, macros } from "@/lib/wellness/health"
import { cn } from "@/lib/utils"
import type { HealthGoal, HealthPlan, HealthProfile } from "@/types"
import { GoalChangesSheet } from "./goal-changes-sheet"
import { buildHealthInput, goalChanges, kgToLb, lastSevenDays, lbToKg, type WeightUnit } from "./health-utils"

const GOALS: { id: HealthGoal; icon: LucideIcon }[] = [
  { id: "lose-weight", icon: TrendingDown },
  { id: "gain-weight", icon: TrendingUp },
  { id: "maintain", icon: Scale },
  { id: "build-fitness", icon: Activity },
  { id: "more-energy", icon: Zap },
  { id: "better-sleep", icon: Moon },
]

type Section = "diet" | "workout" | "routine" | "tips"
const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "diet", label: "Diet", icon: Utensils },
  { id: "workout", label: "Workout", icon: Dumbbell },
  { id: "routine", label: "Routine", icon: Sunrise },
  { id: "tips", label: "Tips", icon: Lightbulb },
]
const DAY_NAMES = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" } as const
const TODAY_KEY = (["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const)[new Date().getDay()]

const questionSchema = z.string().trim().min(5, "Ask a little more — at least a few words.").max(500, "Keep your question under 500 characters.")

interface HealthGuideProps {
  weightUnit: WeightUnit
  onEditProfile: () => void
}

/** AI Guide tab: pick a goal → personal diet, workout week and routine; plus "Ask the coach". */
export function HealthGuide({ weightUnit, onEditProfile }: HealthGuideProps) {
  const ai = useAiStatus()
  const { settings } = useSettings()
  const { profile, setProfile, days, goals, setGoals, plan, setPlan } = useWellness()
  const { routines, add: addRoutine, remove: removeRoutine } = useRoutines()
  const [prefs, setPrefs] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [section, setSection] = useState<Section>("diet")
  const [goalsOpen, setGoalsOpen] = useState(false)
  const ctlRef = useRef<AbortController | null>(null)
  useEffect(() => () => ctlRef.current?.abort(), [])

  if (!ai) return <Skeleton className="h-64 rounded-2xl" />
  if (!ai.configured) {
    return (
      <Notice tone="warning" title="The AI guide needs Google Gemini">
        Add a GEMINI_API_KEY on the server to get a personal diet, workout and routine plan. Your trackers and body numbers work without it.
      </Notice>
    )
  }

  const incomplete = !profile.heightCm || !profile.weightKg || !profile.age
  const needsTarget = profile.goal === "lose-weight" || profile.goal === "gain-weight"

  const generate = async () => {
    ctlRef.current?.abort()
    const ctl = new AbortController()
    ctlRef.current = ctl
    setLoading(true)
    setError(null)
    try {
      const base = buildHealthInput(profile, goals, lastSevenDays(days, todayString()), 120)
      const m = macros(profile)
      const input = JSON.stringify({
        ...base,
        estimates: { ...base.estimates, macrosGrams: m ? { protein: m.protein, carbs: m.carbs, fat: m.fat } : undefined },
        preferences: prefs.trim().slice(0, 300) || undefined,
      })
      if (input.length > assistInputLimit("health-plan")) throw new Error("Your profile notes are too long. Please shorten them.")
      const data = await aiAssist("health-plan", input, ctl.signal)
      const next: HealthPlan = {
        generatedAt: new Date().toISOString(),
        language: settings.aiLanguage === "hi" ? "hi" : "en",
        goal: profile.goal,
        calorieTarget: calorieTarget(profile) ?? undefined,
        weightKg: profile.weightKg,
        data,
      }
      setPlan(next)
      setSection("diet")
      toast.success("Your plan is ready")
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return
      setError(err instanceof Error ? err.message : "Couldn't create your plan.")
    } finally {
      if (ctlRef.current === ctl) setLoading(false)
    }
  }

  const stale = plan && (plan.goal !== profile.goal || (plan.weightKg && profile.weightKg && Math.abs(plan.weightKg - profile.weightKg) >= 2))

  const addRoutineToMyDay = (p: HealthPlan) => {
    const start = routines.reduce((mx, r) => Math.max(mx, r.order), -1) + 1
    const items = aiRoutineToItems(
      p.data.routine.map((r) => ({ ...r, repeatDays: [0, 1, 2, 3, 4, 5, 6], color: "emerald" as const })),
      start
    )
    const created = items.map((it) => addRoutine(it))
    toast.success(`${created.length} blocks added to Daily Routine`, {
      action: { label: "Undo", onClick: () => created.forEach((c) => removeRoutine(c.id)) },
    })
  }

  const changes = plan ? goalChanges(goals, plan.data.suggestedGoals) : []

  return (
    <div className="space-y-5">
      {/* Goal + inputs */}
      <section className="space-y-4 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">What&apos;s your goal?</h2>
          <AiLanguageToggle showLabel={false} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {GOALS.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={profile.goal === g.id}
              onClick={() => setProfile({ goal: g.id })}
              className={cn(
                "flex min-h-12 items-center gap-2 rounded-xl border-2 px-3 text-left text-sm font-medium transition-colors",
                profile.goal === g.id ? "border-primary bg-primary/8" : "border-border hover:bg-muted/60"
              )}
            >
              <g.icon className={cn("size-4.5 shrink-0", profile.goal === g.id ? "text-primary" : "text-muted-foreground")} aria-hidden /> {GOAL_META[g.id].label}
            </button>
          ))}
        </div>

        {needsTarget && <TargetWeight profile={profile} unit={weightUnit} onChange={(kg) => setProfile({ targetWeightKg: kg })} />}

        <div>
          <label htmlFor="plan-prefs" className="text-sm font-medium">
            Anything to consider? <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id="plan-prefs"
            value={prefs}
            maxLength={300}
            onChange={(e) => setPrefs(e.target.value)}
            placeholder="e.g. no gym, 30 min a day, South Indian food, lactose intolerant"
            className="mt-1.5 min-h-20"
          />
        </div>

        {incomplete && (
          <Notice tone="info" title="Add your age, height and weight for an accurate plan" action={<Button variant="outline" size="sm" onClick={onEditProfile}>Edit body profile</Button>} />
        )}
        {error && <Notice tone="danger" title="Couldn't create your plan">{error}</Notice>}

        <Button size="lg" className="w-full" onClick={generate} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" aria-hidden /> : plan ? <RefreshCw aria-hidden /> : <Sparkles aria-hidden />}
          {loading ? "Creating your plan…" : plan ? "Update my plan" : "Create my plan"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Your profile, goal and last 7 days of logs (never your journal) are sent to Google Gemini. General guidance only — not medical advice.
        </p>
      </section>

      {loading && !plan && (
        <div className="space-y-3" aria-busy="true" aria-label="Creating plan">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      )}

      {plan && (
        <section className={cn("space-y-4", loading && "opacity-60")} aria-label="Your plan">
          {stale && !loading && (
            <Notice tone="warning" title="Your goal or weight changed since this plan">
              Tap “Update my plan” for an up-to-date one.
            </Notice>
          )}

          <div className="rounded-2xl border bg-linear-to-br from-primary/10 to-card p-4">
            <p className="text-xs font-medium text-muted-foreground">
              {GOAL_META[plan.goal].label} plan · {new Date(plan.generatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              {plan.calorieTarget ? ` · ${plan.calorieTarget.toLocaleString("en-US")} kcal/day` : ""}
            </p>
            <p className="mt-2 text-sm leading-relaxed">{plan.data.summary}</p>
            {plan.data.focus.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {plan.data.focus.map((f) => (
                  <li key={f} className="rounded-full bg-card px-3 py-1 text-xs font-medium">
                    <Target className="mr-1 inline size-3.5 text-primary" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {plan.data.seeDoctor.length > 0 && (
            <Notice tone="warning" icon={Stethoscope} title="Worth checking with a doctor">
              <ul className="list-disc space-y-1 pl-4">
                {plan.data.seeDoctor.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </Notice>
          )}

          <div role="tablist" aria-label="Plan sections" className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={section === id}
                onClick={() => setSection(id)}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-medium transition-colors sm:flex-row sm:gap-1.5 sm:text-sm",
                  section === id ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            ))}
          </div>

          {section === "diet" && <DietSection plan={plan} />}
          {section === "workout" && <WorkoutSection plan={plan} />}
          {section === "routine" && (
            <RoutineSection plan={plan} onAdd={() => addRoutineToMyDay(plan)} />
          )}
          {section === "tips" && (
            <div className="space-y-3">
              <ul className="space-y-2">
                {plan.data.tips.map((t) => (
                  <li key={t} className="flex gap-2.5 rounded-xl border bg-card p-3 text-sm">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
              {changes.length > 0 && (
                <Button variant="outline" className="w-full" onClick={() => setGoalsOpen(true)}>
                  <ListChecks aria-hidden /> Use suggested daily goals
                </Button>
              )}
            </div>
          )}

          <GoalChangesSheet
            open={goalsOpen}
            onOpenChange={setGoalsOpen}
            title="Update your daily goals?"
            description="Suggested by your plan. You can change them any time."
            changes={changes}
            goals={goals}
            setGoals={setGoals}
          />
        </section>
      )}

      <AskCoach profile={profile} />
    </div>
  )
}

function TargetWeight({ profile, unit, onChange }: { profile: HealthProfile; unit: WeightUnit; onChange: (kg: number | undefined) => void }) {
  const shown = profile.targetWeightKg !== undefined ? String(unit === "lb" ? kgToLb(profile.targetWeightKg) : profile.targetWeightKg) : ""
  const [draft, setDraft] = useState<string | null>(null)
  const lose = profile.goal === "lose-weight"
  const invalid =
    profile.targetWeightKg !== undefined && profile.weightKg !== undefined && (lose ? profile.targetWeightKg >= profile.weightKg : profile.targetWeightKg <= profile.weightKg)
  return (
    <div>
      <label htmlFor="target-weight" className="text-sm font-medium">
        Target weight ({unit})
      </label>
      <Input
        id="target-weight"
        inputMode="decimal"
        value={draft ?? shown}
        onFocus={() => setDraft(shown)}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.]/g, "")
          setDraft(raw)
          const n = parseFloat(raw)
          if (!Number.isFinite(n) || n <= 0) return onChange(undefined)
          const kg = unit === "lb" ? lbToKg(n) : n
          if (kg >= 25 && kg <= 300) onChange(Math.round(kg * 10) / 10)
        }}
        placeholder={lose ? "e.g. 68" : "e.g. 62"}
        className="mt-1.5 h-11"
        aria-invalid={invalid || undefined}
      />
      {invalid && <p className="mt-1 text-xs text-destructive">Target should be {lose ? "below" : "above"} your current weight.</p>}
    </div>
  )
}

function DietSection({ plan }: { plan: HealthPlan }) {
  const total = plan.data.meals.reduce((s, m) => s + m.kcal, 0)
  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {plan.data.meals.map((m, i) => (
          <li key={i} className="rounded-xl border bg-card p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-medium">
                {m.name} <span className="text-xs font-normal text-muted-foreground">· {m.time}</span>
              </p>
              <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">~{m.kcal} kcal</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{m.items}</p>
          </li>
        ))}
      </ol>
      <p className="text-right text-xs text-muted-foreground tabular-nums">Total ≈ {total.toLocaleString("en-US")} kcal</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FoodList title="Eat more" tone="success" items={plan.data.eatMore} />
        <FoodList title="Limit" tone="warning" items={plan.data.limit} />
      </div>
    </div>
  )
}

function FoodList({ title, tone, items }: { title: string; tone: "success" | "warning"; items: string[] }) {
  if (!items.length) return null
  return (
    <div className={cn("rounded-xl border p-3", tone === "success" ? "border-success/30 bg-success/6" : "border-warning/35 bg-warning/8")}>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <li key={it} className="rounded-full bg-card px-2.5 py-1 text-xs">
            {it}
          </li>
        ))}
      </ul>
    </div>
  )
}

function WorkoutSection({ plan }: { plan: HealthPlan }) {
  return (
    <ol className="space-y-2">
      {plan.data.workouts.map((w) => {
        const isToday = w.day === TODAY_KEY
        return (
          <li key={w.day} className={cn("rounded-xl border bg-card p-3", isToday && "border-primary ring-1 ring-primary/30")}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">
                {DAY_NAMES[w.day]}
                {isToday && <span className="ml-2 rounded-full bg-primary/12 px-2 py-0.5 text-xs text-primary">Today</span>}
              </p>
              <span className="text-xs text-muted-foreground tabular-nums">{w.rest ? "Rest" : `${w.minutes} min`}</span>
            </div>
            <p className="mt-0.5 text-sm text-primary">{w.focus}</p>
            {w.exercises.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {w.exercises.map((e) => (
                  <li key={e} className="flex gap-2">
                    <span aria-hidden>•</span> {e}
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function RoutineSection({ plan, onAdd }: { plan: HealthPlan; onAdd: () => void }) {
  return (
    <div className="space-y-3">
      <ol className="relative space-y-1 border-l-2 border-border pl-4">
        {[...plan.data.routine]
          .sort((a, b) => a.time.localeCompare(b.time))
          .map((r, i) => (
            <li key={i} className="relative py-1.5">
              <span className="absolute top-3 -left-[1.3rem] size-2.5 rounded-full bg-primary" aria-hidden />
              <p className="text-xs font-medium text-muted-foreground tabular-nums">
                {formatTime12(r.time)} · {r.durationMinutes} min
              </p>
              <p className="text-sm font-medium">{r.title}</p>
            </li>
          ))}
      </ol>
      <Button variant="outline" className="w-full" onClick={onAdd}>
        <CalendarPlus aria-hidden /> Add to my Daily Routine
      </Button>
    </div>
  )
}

function AskCoach({ profile }: { profile: HealthProfile }) {
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState<{ question: string; answer: string; points: string[]; seeDoctor?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const suggestions = useMemo(
    () => ["What should I eat before a workout?", "How can I stop late-night snacking?", "Is walking enough to lose weight?"],
    []
  )

  const ask = async (text = q) => {
    const parsed = questionSchema.safeParse(text)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const out = await aiAssist(
        "health-ask",
        JSON.stringify({
          question: parsed.data,
          profile: { age: profile.age, sex: profile.sex, heightCm: profile.heightCm, weightKg: profile.weightKg, goal: profile.goal, diet: profile.diet, activity: profile.activity, notes: profile.notes?.slice(0, 300) },
        })
      )
      setAnswer({ question: parsed.data, ...out })
      setQ("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't get an answer.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4" aria-labelledby="ask-coach">
      <h2 id="ask-coach" className="flex items-center gap-2 text-sm font-semibold">
        <MessageCircleQuestion className="size-4 text-primary" aria-hidden /> Ask the coach
      </h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void ask()
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} placeholder="Ask about food, fitness or sleep…" aria-label="Your question" className="h-11 flex-1" />
        <Button type="submit" size="icon" className="size-11" disabled={busy} aria-label="Ask">
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        </Button>
      </form>
      {!answer && !busy && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => void ask(s)} className="min-h-10 rounded-full border px-3 text-left text-xs hover:bg-muted">
              {s}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {answer && (
        <div className="space-y-2 rounded-xl bg-surface-muted p-3.5 text-sm" aria-live="polite">
          <p className="font-medium">{answer.question}</p>
          <p className="leading-relaxed text-muted-foreground">{answer.answer}</p>
          {answer.points.length > 0 && (
            <ul className="space-y-1">
              {answer.points.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="text-success" aria-hidden>
                    ✓
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          )}
          {answer.seeDoctor && <p className="flex gap-2 text-warning-foreground dark:text-warning"><Stethoscope className="mt-0.5 size-4 shrink-0" aria-hidden /> {answer.seeDoctor}</p>}
        </div>
      )}
    </section>
  )
}
