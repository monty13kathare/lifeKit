"use client"

import { useRef, useState } from "react"
import { Gamepad2, Languages, Play, Shuffle, Sparkles, Trash2, Wand2 } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"
import { Notice } from "@/components/common/notice"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { ToolPage } from "@/components/common/tool-page"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { CUSTOM_CATEGORY, FUN_CATEGORIES, FUN_MODES, getFunCategory } from "@/data/learn/fun-categories"
import { hasStarter, starterQuestions } from "@/data/learn/fun-starter"
import { useAiStatus } from "@/hooks/use-ai-status"
import { useLearnFun, useSettings } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { aiAssist } from "@/lib/ai/client"
import { levelInfo, liveDayStreak, MAX_SAVED_QUIZZES, recordFunGame, shuffle, shuffleOptions, XP_PER_LEVEL } from "@/lib/learn/fun"
import { cn } from "@/lib/utils"
import type { FunDifficulty, FunLanguage, FunMode, FunQuizSet } from "@/types"
import { DIFFICULTIES, label, LANGUAGES, tr, type ActiveQuiz } from "./fun-utils"
import { QuizPlayer, type GameSummary } from "./quiz-player"
import { QuizResults } from "./quiz-results"

const topicSchema = z.string().trim().min(2, "Type a topic of at least 2 characters.").max(80, "Keep the topic under 80 characters.")
const MIXED = { en: "Mixed", hi: "मिश्रित" }

interface Setup {
  category: string
  topic: string
  custom: string
  difficulty: FunDifficulty
  count: number
  mode: FunMode
}

type View =
  | { name: "home" }
  | { name: "loading" }
  | { name: "play"; quiz: ActiveQuiz; mode: FunMode; round: number }
  | { name: "results"; quiz: ActiveQuiz; mode: FunMode; summary: GameSummary; levelUp: number | null; savedId?: string }

export function LearnFunApp() {
  const hydrated = useHydrated()
  const ai = useAiStatus()
  const aiEnabled = !!ai?.configured
  const { settings } = useSettings()
  const { stats, quizzes, add: addQuiz, update: updateQuiz, remove: removeQuiz, upsert: upsertQuiz } = useLearnFun()

  const [langChoice, setLangChoice] = useState<FunLanguage | null>(null)
  const lang: FunLanguage = langChoice ?? (hydrated ? settings.aiLanguage : "en")
  const [view, setView] = useState<View>({ name: "home" })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [setup, setSetup] = useState<Setup>({ category: "logical", topic: MIXED.en, custom: "", difficulty: "easy", count: 5, mode: "classic" })
  const [customDraft, setCustomDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  /** Recently asked questions per category, so "New questions" doesn't repeat them. */
  const recentRef = useRef(new Map<string, string[]>())

  const maxCount = 10
  const level = levelInfo(stats.xp)
  const accuracy = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0

  /* --------------------------------------------------------------- actions */

  const openSetup = (category: string, topic = MIXED.en) => {
    setSetup((s) => ({ ...s, category, topic, custom: category === CUSTOM_CATEGORY ? topic : "", count: Math.min(s.count, maxCount) }))
    setError(null)
    setSheetOpen(true)
  }

  const surprise = () => {
    const pool = aiEnabled ? FUN_CATEGORIES : FUN_CATEGORIES.filter((c) => hasStarter(c.id))
    const cat = pool[Math.floor(Math.random() * pool.length)]
    const mode = FUN_MODES[Math.floor(Math.random() * 3)].id
    setSetup((s) => ({ ...s, mode }))
    openSetup(cat.id)
  }

  const startStarter = (category: string, mode: FunMode) => {
    const cat = getFunCategory(category)
    const questions = shuffle(starterQuestions(category, lang)).map(shuffleOptions)
    setView({
      name: "play",
      mode,
      round: Date.now(),
      quiz: { title: cat ? label(lang, cat.name) : "Starter quiz", category, topic: MIXED.en, difficulty: "easy", language: lang, questions, source: "starter" },
    })
  }

  const generate = async (s: Setup, avoidExtra: string[] = []) => {
    const isCustom = s.category === CUSTOM_CATEGORY
    let topic = s.topic
    if (isCustom) {
      const parsed = topicSchema.safeParse(s.custom)
      if (!parsed.success) {
        setError(parsed.error.issues[0].message)
        return
      }
      topic = parsed.data
    }
    const cat = getFunCategory(s.category)
    const count = Math.min(s.count, maxCount)
    const avoid = [...avoidExtra, ...(recentRef.current.get(s.category) ?? [])].slice(0, 15).map((t) => t.slice(0, 100))

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setSheetOpen(false)
    setError(null)
    setView({ name: "loading" })
    try {
      const out = await aiAssist(
        "fun-quiz",
        JSON.stringify({ category: cat ? cat.id : "custom (any subject the user chose)", topic, difficulty: s.difficulty, count, language: lang, avoid }),
        controller.signal
      )
      const questions = out.questions.map((q) => shuffleOptions({ ...q, hindi: undefined }))
      recentRef.current.set(s.category, [...questions.map((q) => q.question), ...(recentRef.current.get(s.category) ?? [])].slice(0, 15))
      setView({
        name: "play",
        mode: s.mode,
        round: Date.now(),
        quiz: { title: out.title || topic, category: s.category, topic, difficulty: s.difficulty, language: lang, questions, source: "ai" },
      })
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return
      const message = err instanceof Error ? err.message : "Couldn't create the quiz."
      setView({ name: "home" })
      setError(message)
      setSheetOpen(true)
      toast.error("Couldn't create the quiz", { description: message })
    }
  }

  const start = () => {
    if (aiEnabled) void generate(setup)
    else {
      setSheetOpen(false)
      startStarter(setup.category, setup.mode)
    }
  }

  const cancelLoading = () => {
    abortRef.current?.abort()
    setView({ name: "home" })
    setSheetOpen(true)
  }

  const finish = (quiz: ActiveQuiz, mode: FunMode, summary: GameSummary) => {
    const before = levelInfo(stats.xp).level
    const after = levelInfo(stats.xp + summary.xp).level
    recordFunGame({ category: quiz.category, answered: summary.answered, correct: summary.correct, xp: summary.xp, bestCombo: summary.bestCombo })
    const pct = Math.round((summary.correct / quiz.questions.length) * 100)
    if (quiz.savedId) updateQuiz(quiz.savedId, (prev) => ({ ...prev, plays: prev.plays + 1, best: Math.max(prev.best ?? 0, pct) }))
    setView({ name: "results", quiz, mode, summary, levelUp: after > before ? after : null, savedId: quiz.savedId })
  }

  const saveQuiz = (quiz: ActiveQuiz, summary: GameSummary) => {
    if (quizzes.length >= MAX_SAVED_QUIZZES) {
      const oldest = [...quizzes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
      removeQuiz(oldest.id)
    }
    const created = addQuiz({
      title: quiz.title,
      category: quiz.category,
      topic: quiz.topic,
      difficulty: quiz.difficulty,
      language: quiz.language,
      questions: quiz.questions,
      source: quiz.source,
      createdAt: new Date().toISOString(),
      plays: 1,
      best: Math.round((summary.correct / quiz.questions.length) * 100),
    })
    setView((v) => (v.name === "results" ? { ...v, savedId: created.id, quiz: { ...v.quiz, savedId: created.id } } : v))
    toast.success("Quiz saved", { description: "Find it under My quizzes." })
  }

  const playSaved = (set: FunQuizSet, mode: FunMode = "classic") => {
    setView({
      name: "play",
      mode,
      round: Date.now(),
      quiz: { ...set, savedId: set.id, questions: shuffle(set.questions).map(shuffleOptions) },
    })
  }

  const deleteSaved = (set: FunQuizSet) => {
    removeQuiz(set.id)
    toast("Quiz deleted", { description: set.title, action: { label: "Undo", onClick: () => upsertQuiz(set) } })
  }

  /* ---------------------------------------------------------------- render */

  if (view.name === "play") {
    return (
      <QuizPlayer
        key={view.round}
        quiz={view.quiz}
        mode={view.mode}
        onFinish={(s) => finish(view.quiz, view.mode, s)}
        onQuit={() => setView({ name: "home" })}
      />
    )
  }

  if (view.name === "results") {
    return (
      <QuizResults
        quiz={view.quiz}
        mode={view.mode}
        summary={view.summary}
        levelUp={view.levelUp}
        saved={!!view.savedId}
        aiEnabled={aiEnabled}
        onReplay={() => setView({ name: "play", mode: view.mode, round: Date.now(), quiz: { ...view.quiz, questions: shuffle(view.quiz.questions).map(shuffleOptions) } })}
        onMore={() =>
          void generate(
            { ...setup, category: view.quiz.category, topic: view.quiz.topic, custom: view.quiz.topic, difficulty: view.quiz.difficulty, mode: view.mode },
            view.quiz.questions.map((q) => q.question)
          )
        }
        onSave={() => saveQuiz(view.quiz, view.summary)}
        onHome={() => setView({ name: "home" })}
      />
    )
  }

  const selectedCat = getFunCategory(setup.category)
  const isCustom = setup.category === CUSTOM_CATEGORY

  return (
    <ToolPage toolId="learn" hideBack>
      {view.name === "loading" ? (
        <LoadingCard lang={lang} onCancel={cancelLoading} />
      ) : !hydrated ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-36 w-full rounded-3xl" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Player card */}
          <section className="rounded-3xl border bg-linear-to-br from-primary/10 via-card to-card p-4 shadow-soft sm:p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">{level.level}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {tr(lang, { en: "Level", hi: "लेवल" })} {level.level} · <span lang={lang === "hi" ? "hi" : "en"}>{tr(lang, level.title)}</span>
                </p>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="XP to next level" aria-valuenow={level.pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${level.pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {stats.xp} XP · {XP_PER_LEVEL - level.into} {tr(lang, { en: "XP to next level", hi: "XP अगले लेवल तक" })}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              <MiniStat value={`🔥 ${liveDayStreak(stats)}`} label={tr(lang, { en: "Day streak", hi: "दिन लगातार" })} />
              <MiniStat value={`${accuracy}%`} label={tr(lang, { en: "Accuracy", hi: "सटीकता" })} />
              <MiniStat value={String(stats.games)} label={tr(lang, { en: "Games", hi: "खेल" })} />
              <MiniStat value={`⚡ ${stats.bestCombo}`} label={tr(lang, { en: "Combo", hi: "कॉम्बो" })} />
            </div>
          </section>

          {/* Language + surprise */}
          <div className="flex items-center gap-2 sm:justify-between sm:gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
              <Languages className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
              <div role="radiogroup" aria-label="Quiz language" className="grid flex-1 grid-cols-2 rounded-xl bg-muted p-1 text-sm sm:flex sm:flex-none">
                {LANGUAGES.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    lang={o.lang}
                    aria-checked={lang === o.id}
                    onClick={() => setLangChoice(o.id)}
                    className={cn(
                      "min-h-10 truncate rounded-lg px-2 font-medium whitespace-nowrap transition-colors sm:px-3",
                      lang === o.id ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <Button variant="outline" size="icon" className="h-12 w-12 shrink-0 sm:hidden" onClick={surprise} aria-label={tr(lang, { en: "Surprise me", hi: "कुछ भी खिलाओ" })}>
              <Shuffle aria-hidden />
            </Button>
            <Button variant="outline" className="hidden sm:inline-flex" onClick={surprise}>
              <Shuffle aria-hidden /> {tr(lang, { en: "Surprise me", hi: "कुछ भी खिलाओ" })}
            </Button>
          </div>

          {ai && !aiEnabled && (
            <Notice title="Playing built-in starter questions">
              AI quizzes need a Google Gemini key on the server. Until then you can play 3 starter questions in every category, in English and Hindi.
            </Notice>
          )}

          {/* Create your own */}
          {aiEnabled && (
            <form
              className="rounded-2xl border border-dashed bg-surface/60 p-4"
              onSubmit={(e) => {
                e.preventDefault()
                const parsed = topicSchema.safeParse(customDraft)
                if (!parsed.success) {
                  toast.error(parsed.error.issues[0].message)
                  return
                }
                openSetup(CUSTOM_CATEGORY, parsed.data)
              }}
            >
              <p className="flex items-center gap-2 font-semibold">
                <Wand2 className="size-4.5 text-primary" aria-hidden /> {tr(lang, { en: "Create a quiz on any topic", hi: "किसी भी विषय पर क्विज़ बनाएँ" })}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {tr(lang, { en: "e.g. Solar system, Indian festivals, Cricket rules, Past tense", hi: "जैसे सौरमंडल, भारतीय त्योहार, क्रिकेट के नियम, भूतकाल" })}
              </p>
              <div className="mt-3 flex gap-2">
                <Input
                  value={customDraft}
                  onChange={(e) => setCustomDraft(e.target.value)}
                  maxLength={80}
                  placeholder={tr(lang, { en: "Type a topic…", hi: "विषय लिखें…" })}
                  aria-label="Quiz topic"
                  className="h-10 flex-1"
                />
                <Button type="submit">
                  <Sparkles aria-hidden /> {tr(lang, { en: "Create", hi: "बनाएँ" })}
                </Button>
              </div>
            </form>
          )}

          {/* Categories */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{tr(lang, { en: "Pick a challenge", hi: "चुनौती चुनें" })}</h2>
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {FUN_CATEGORIES.map((c) => {
                const Icon = c.icon
                const cs = stats.categories[c.id]
                const acc = cs?.answered ? Math.round((cs.correct / cs.answered) * 100) : null
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => openSetup(c.id)}
                      className="flex h-full w-full flex-col items-start gap-2 rounded-2xl border bg-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft active:scale-[0.98]"
                    >
                      <span className={cn("flex size-11 items-center justify-center rounded-xl", c.accent)}>
                        <Icon className="size-5.5" aria-hidden />
                      </span>
                      <span className="font-semibold leading-tight">
                        {tr(lang, c.name)}
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">{tr(lang, c.blurb)}</span>
                      {acc !== null && (
                        <span className="mt-auto rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground tabular-nums">
                          🎯 {acc}% · {cs!.games} {tr(lang, { en: "played", hi: "खेले" })}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          {/* Saved quizzes */}
          {quizzes.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">{tr(lang, { en: "My quizzes", hi: "मेरे क्विज़" })}</h2>
              <ul className="space-y-2">
                {[...quizzes]
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((q) => {
                    const cat = getFunCategory(q.category)
                    const Icon = cat?.icon ?? Wand2
                    return (
                      <li key={q.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", cat?.accent ?? "bg-primary/10 text-primary")}>
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{q.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {q.questions.length} Q · {LANGUAGES.find((l) => l.id === q.language)?.label} · {q.plays}× {q.best != null ? `· best ${q.best}%` : ""}
                          </p>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => deleteSaved(q)} aria-label={`Delete ${q.title}`}>
                          <Trash2 aria-hidden />
                        </Button>
                        <Button size="icon" onClick={() => playSaved(q)} aria-label={`Play ${q.title}`}>
                          <Play aria-hidden />
                        </Button>
                      </li>
                    )
                  })}
              </ul>
            </section>
          )}

          {aiEnabled && (
            <p className="text-center text-xs text-muted-foreground">
              Topics you choose are sent to Google Gemini to write questions. AI can make mistakes — read the explanations with care.
            </p>
          )}
        </div>
      )}

      {/* Game setup */}
      <ResponsiveSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        size="lg"
        title={isCustom ? `“${setup.custom}”` : selectedCat ? label(lang, selectedCat.name) : "Quiz"}
        description={tr(lang, { en: "Choose how you want to play.", hi: "चुनें कि आप कैसे खेलना चाहते हैं।" })}
        footer={
          <Button size="lg" className="w-full sm:w-auto" onClick={start}>
            <Gamepad2 aria-hidden /> {aiEnabled ? tr(lang, { en: "Create & play", hi: "बनाएँ और खेलें" }) : tr(lang, { en: "Play", hi: "खेलें" })}
          </Button>
        }
      >
        <div className="space-y-5">
          {error && (
            <Notice tone="danger" title="Something went wrong">
              {error}
            </Notice>
          )}

          {aiEnabled && isCustom && (
            <Field label={tr(lang, { en: "Topic", hi: "विषय" })}>
              <Input value={setup.custom} maxLength={80} onChange={(e) => setSetup((s) => ({ ...s, custom: e.target.value }))} aria-label="Quiz topic" />
            </Field>
          )}

          {aiEnabled && selectedCat && (
            <Field label={tr(lang, { en: "Topic", hi: "विषय" })}>
              <div className="flex flex-wrap gap-2">
                {[MIXED, ...selectedCat.topics].map((t) => (
                  <Chip key={t.en} active={setup.topic === t.en} onClick={() => setSetup((s) => ({ ...s, topic: t.en }))}>
                    {tr(lang, t)}
                  </Chip>
                ))}
              </div>
            </Field>
          )}

          {aiEnabled && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={tr(lang, { en: "Difficulty", hi: "कठिनाई" })}>
                <div className="flex flex-wrap gap-2">
                  {DIFFICULTIES.map((d) => (
                    <Chip key={d.id} active={setup.difficulty === d.id} onClick={() => setSetup((s) => ({ ...s, difficulty: d.id }))}>
                      {d.emoji} {tr(lang, d.name)}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label={tr(lang, { en: "Questions", hi: "प्रश्न" })}>
                <div className="flex flex-wrap gap-2">
                  {[5, 10].map((n) => (
                    <Chip key={n} active={Math.min(setup.count, maxCount) === n} disabled={n > maxCount} onClick={() => setSetup((s) => ({ ...s, count: n }))}>
                      {n}
                    </Chip>
                  ))}
                </div>
              </Field>
            </div>
          )}

          <Field label={tr(lang, { en: "Game mode", hi: "खेल का तरीका" })}>
            <div className="grid grid-cols-2 gap-2">
              {FUN_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={setup.mode === m.id}
                  onClick={() => setSetup((s) => ({ ...s, mode: m.id }))}
                  className={cn(
                    "rounded-xl border-2 p-3 text-left transition-colors",
                    setup.mode === m.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/60"
                  )}
                >
                  <span className="block font-semibold">
                    {m.emoji} {tr(lang, m.name)}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{tr(lang, m.blurb)}</span>
                </button>
              ))}
            </div>
          </Field>

          {!aiEnabled && (
            <p className="text-sm text-muted-foreground">
              {tr(lang, {
                en: "You'll play the built-in starter questions for this category.",
                hi: "आप इस श्रेणी के पहले से मौजूद प्रश्न खेलेंगे।",
              })}
            </p>
          )}
          {aiEnabled && <p className="text-xs text-muted-foreground">Your topic and settings are sent to Google Gemini to create the questions.</p>}
        </div>
      </ResponsiveSheet>
    </ToolPage>
  )
}

function LoadingCard({ lang, onCancel }: { lang: FunLanguage; onCancel: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl border bg-card px-6 py-12 text-center shadow-soft" aria-busy="true" role="status">
      <div className="flex gap-2 text-4xl" aria-hidden>
        {["🧠", "✨", "🎲"].map((e, i) => (
          <span key={e} className="animate-bounce" style={{ animationDelay: `${i * 150}ms` }}>
            {e}
          </span>
        ))}
      </div>
      <p className="mt-5 text-lg font-semibold">{tr(lang, { en: "Cooking up your quiz…", hi: "आपका क्विज़ तैयार हो रहा है…" })}</p>
      <p className="mt-1 text-sm text-muted-foreground">{tr(lang, { en: "Gemini is writing fresh questions. This takes a few seconds.", hi: "Gemini नए प्रश्न लिख रहा है। कुछ सेकंड लगेंगे।" })}</p>
      <Button variant="ghost" className="mt-5" onClick={onCancel}>
        {tr(lang, { en: "Cancel", hi: "रद्द करें" })}
      </Button>
    </div>
  )
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-card/70 px-1 py-2">
      <p className="text-sm font-semibold tabular-nums sm:text-base">{value}</p>
      <p className="truncate text-[0.7rem] text-muted-foreground">{label}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      {children}
    </div>
  )
}

function Chip({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-full border px-3.5 text-sm font-medium transition-colors disabled:opacity-40",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
      )}
    >
      {children}
    </button>
  )
}
