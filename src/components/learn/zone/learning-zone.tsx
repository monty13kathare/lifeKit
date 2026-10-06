"use client"

import { useRef, useState } from "react"
import { ArrowRight, BookOpenCheck, ChevronRight, GraduationCap, Languages, Search, Sparkles, Trash2, Trophy, Signal, Palette, Check } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"
import { Notice } from "@/components/common/notice"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { ToolPage } from "@/components/common/tool-page"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getLessonSubject, LESSON_SUBJECTS, LEVELS, MAX_SAVED_LESSONS, STYLES, type LessonSubject } from "@/data/learn/lesson-subjects"
import { useAiStatus } from "@/hooks/use-ai-status"
import { useLessons, useSettings } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { aiAssist } from "@/lib/ai/client"
import { awardXp } from "@/lib/learn/fun"
import { createId } from "@/lib/storage/core"
import { cn } from "@/lib/utils"
import type { AiLanguage, LearnLesson, LessonLevel, LessonStyle } from "@/types"
import { LANGUAGES, tr } from "../fun/fun-utils"
import { LessonView, lessonXp } from "./lesson-view"

const topicSchema = z.string().trim().min(2, "Type a topic of at least 2 characters.").max(120, "Keep the topic under 120 characters.")

/** "Learn" tab: AI lessons on any topic, explained simply with examples and stories. */
export function LearningZone({ tabs }: { tabs?: React.ReactNode }) {
  const hydrated = useHydrated()
  const ai = useAiStatus()
  const aiEnabled = !!ai?.configured
  const { settings } = useSettings()
  const { lessons, upsert, remove } = useLessons()

  const [langChoice, setLangChoice] = useState<AiLanguage | null>(null)
  const lang: AiLanguage = langChoice ?? (hydrated && settings.aiLanguage === "hi" ? "hi" : "en")
  const [level, setLevel] = useState<LessonLevel>("beginner")
  const [style, setStyle] = useState<LessonStyle>("examples")
  const [topic, setTopic] = useState("")
  const [sheetSubject, setSheetSubject] = useState<LessonSubject | null>(null)
  const [history, setHistory] = useState<LearnLesson[]>([])
  const current = history[history.length - 1] || null
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ctlRef = useRef<AbortController | null>(null)
  const t = (en: string, hi: string) => tr(lang, { en, hi })

  const saved = !!current && lessons.some((l) => l.id === current.id)

  const generate = async (subject: string, rawTopic: string, opts: { level?: LessonLevel; style?: LessonStyle; simpler?: boolean; language?: AiLanguage } = {}) => {
    const parsed = topicSchema.safeParse(rawTopic)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    const lessonLang = opts.language ?? lang
    const lessonLevel = opts.level ?? level
    const lessonStyle = opts.style ?? style
    ctlRef.current?.abort()
    const ctl = new AbortController()
    ctlRef.current = ctl
    setLoading(true)
    setError(null)
    setSheetSubject(null)
    try {
      const data = await aiAssist(
        "learn-lesson",
        JSON.stringify({ subject, topic: parsed.data, level: lessonLevel, style: lessonStyle, language: lessonLang, simpler: opts.simpler || undefined }),
        ctl.signal
      )
      const newLesson: LearnLesson = { id: createId(), subject, topic: parsed.data, level: lessonLevel, style: lessonStyle, language: lessonLang, createdAt: new Date().toISOString(), data }
      setHistory((h) => [...h, newLesson])
      setTopic("")
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return
      const message = err instanceof Error ? err.message : "Couldn't create the lesson."
      setError(message)
      toast.error("Couldn't create the lesson", { description: message })
    } finally {
      if (ctlRef.current === ctl) setLoading(false)
    }
  }

  const save = (lesson: LearnLesson) => {
    if (lessons.length >= MAX_SAVED_LESSONS) {
      const oldest = [...lessons].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
      remove(oldest.id)
    }
    upsert(lesson)
    toast.success(t("Lesson saved", "पाठ सहेजा गया"), { description: t("Find it under My lessons.", "इसे 'मेरे पाठ' में देखें।") })
  }

  const quizDone = (correct: number, total: number) => {
    if (!current) return
    if (!current.completedAt) awardXp(lessonXp(correct))
    const next: LearnLesson = { ...current, completedAt: current.completedAt ?? new Date().toISOString(), score: Math.round((correct / total) * 100) }
    setHistory((h) => {
      const clone = [...h]
      clone[clone.length - 1] = next
      return clone
    })
    if (saved) upsert(next)
  }

  /** Replace a lesson in the open history (e.g. with fetched topic details); saved lessons are persisted too. */
  const updateLesson = (next: LearnLesson) => {
    setHistory((h) => h.map((l) => (l.id === next.id ? next : l)))
    if (lessons.some((l) => l.id === next.id)) upsert(next)
  }

  const deleteLesson = (lesson: LearnLesson) => {
    remove(lesson.id)
    toast(t("Lesson deleted", "पाठ हटाया गया"), { description: lesson.data.title, action: { label: t("Undo", "वापस"), onClick: () => upsert(lesson) } })
  }

  /* ----------------------------------------------------------- Lesson */

  if (current) {
    return (
      <ToolPage toolId="learn" hideBack>
        {tabs}
        <LessonView
          lesson={current}
          saved={saved}
          aiEnabled={aiEnabled}
          busy={loading}
          onBack={() => {
            ctlRef.current?.abort()
            setLoading(false)
            setHistory((h) => h.slice(0, -1))
          }}
          onSave={() => save(current)}
          onDelete={() => {
            deleteLesson(current)
            setHistory((h) => h.slice(0, -1))
          }}
          onSimpler={() => void generate(current.subject, current.topic, { level: "beginner", style: current.style, simpler: true, language: current.language })}
          onLearnTopic={(next) => void generate(current.subject, next, { language: current.language })}
          onQuizDone={quizDone}
          onUpdate={updateLesson}
        />
      </ToolPage>
    )
  }

  /* ------------------------------------------------------------- Home */

  return (
    <ToolPage toolId="learn" hideBack>
      {tabs}
      {loading ? (
        <LessonLoading lang={lang} onCancel={() => ctlRef.current?.abort()} />
      ) : (
        <div className="space-y-6">
          {/* Ask anything */}
          <section className="relative overflow-hidden rounded-3xl border bg-card p-5 sm:p-6">
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/14 via-fuchsia-500/5 to-transparent" aria-hidden />
            <div className="relative space-y-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-primary">
                  <GraduationCap className="size-4" aria-hidden /> {t("Learning Zone", "लर्निंग ज़ोन")}
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{t("What do you want to learn today?", "आज आप क्या सीखना चाहते हैं?")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("Any topic, explained simply with easy examples, a story and practice.", "कोई भी विषय — आसान उदाहरण, कहानी और अभ्यास के साथ।")}
                </p>
              </div>

              {aiEnabled ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void generate("any", topic)
                  }}
                >
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <input
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      maxLength={120}
                      placeholder={t("e.g. Syllogism, Tenses…", "जैसे: सिलोजिज़्म, काल…")}
                      aria-label={t("Topic to learn", "सीखने का विषय")}
                      className="h-12 w-full rounded-2xl border bg-background pr-3 pl-10 text-base outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20"
                    />
                  </div>
                  <Button type="submit" size="lg" className="h-12 rounded-2xl">
                    <Sparkles aria-hidden /> <span className="hidden sm:inline">{t("Teach me", "सिखाएँ")}</span>
                    <span className="sr-only sm:hidden">{t("Teach me", "सिखाएँ")}</span>
                  </Button>
                </form>
              ) : (
                ai && (
                  <Notice tone="warning" title={t("Lessons need Google Gemini", "पाठ के लिए Google Gemini ज़रूरी है")}>
                    {t(
                      "Add a GEMINI_API_KEY on the server to create lessons. Saved lessons below still open offline.",
                      "पाठ बनाने के लिए सर्वर पर GEMINI_API_KEY जोड़ें। सहेजे गए पाठ ऑफ़लाइन भी खुलते हैं।"
                    )}
                  </Notice>
                )
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}

              {/* Options */}
              {aiEnabled && (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  <OptionRow label={t("Language", "भाषा")} icon={<Languages className="size-4" aria-hidden />}>
                    {LANGUAGES.map((l) => (
                      <Chip key={l.id} active={lang === l.id} onClick={() => setLangChoice(l.id as AiLanguage)} lang={l.lang}>
                        {l.label}
                      </Chip>
                    ))}
                  </OptionRow>
                  <OptionRow label={t("Level", "स्तर")} icon={<Signal className="size-4" aria-hidden />}>
                    {LEVELS.map((l) => (
                      <Chip key={l.id} active={level === l.id} onClick={() => setLevel(l.id)}>
                        {tr(lang, l.name)}
                      </Chip>
                    ))}
                  </OptionRow>
                  <OptionRow label={t("Style", "तरीका")} className="sm:col-span-2 md:col-span-1" icon={<Palette className="size-4" aria-hidden />}>
                    {STYLES.map((s) => (
                      <Chip key={s.id} active={style === s.id} onClick={() => setStyle(s.id)}>
                        {tr(lang, s.name)}
                      </Chip>
                    ))}
                  </OptionRow>
                </div>
              )}
            </div>
          </section>

          {/* Subjects */}
          {aiEnabled && (
            <section aria-labelledby="subjects-title">
              <h2 id="subjects-title" className="mb-3 text-lg font-semibold">
                {t("Pick a subject", "विषय चुनें")}
              </h2>
              <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {LESSON_SUBJECTS.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSheetSubject(s)}
                      className="flex h-full w-full items-center gap-3 rounded-2xl border bg-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft active:scale-[0.98]"
                    >
                      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", s.accent)}>
                        <s.icon className="size-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-tight font-semibold">{tr(lang, s.name)}</span>
                        <span className="text-xs text-muted-foreground">
                          {s.topics.length} {t("lessons", "पाठ")}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Saved lessons */}
          {!hydrated ? (
            <Skeleton className="h-24 rounded-2xl" />
          ) : (
            lessons.length > 0 && (
              <section aria-labelledby="my-lessons">
                <h2 id="my-lessons" className="mb-3 text-lg font-semibold">
                  {t("My lessons", "मेरे पाठ")}
                </h2>
                <ul className="space-y-2">
                  {[...lessons]
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .map((l) => {
                      const subj = getLessonSubject(l.subject)
                      const Icon = subj?.icon ?? Sparkles
                      return (
                        <li key={l.id} className="flex items-center gap-2 rounded-2xl border bg-card p-2 pr-1.5">
                          <button type="button" onClick={() => setHistory([l])} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 text-left hover:bg-muted/50">
                            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", subj?.accent ?? "bg-primary/10 text-primary")}>
                              <Icon className="size-5" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium" lang={l.language}>
                                {l.data.title}
                              </span>
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                {l.language === "hi" ? "हिन्दी" : "English"} · {tr(lang, LEVELS.find((x) => x.id === l.level)!.name)}
                                {l.score !== undefined && (
                                  <span className="inline-flex items-center gap-0.5 text-success">
                                    · <Trophy className="size-3" aria-hidden /> {l.score}%
                                  </span>
                                )}
                              </span>
                            </span>
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          </button>
                          <Button variant="ghost" size="icon" onClick={() => deleteLesson(l)} aria-label={`${t("Delete", "हटाएँ")} ${l.data.title}`}>
                            <Trash2 aria-hidden />
                          </Button>
                        </li>
                      )
                    })}
                </ul>
              </section>
            )
          )}

          {aiEnabled && (
            <p className="text-center text-xs text-muted-foreground">
              {t("Topics you choose are sent to Google Gemini to write the lesson. AI can make mistakes — check important facts.", "आपका विषय पाठ बनाने के लिए Google Gemini को भेजा जाता है। AI गलती कर सकता है — ज़रूरी बातें जाँच लें।")}
            </p>
          )}
        </div>
      )}

      {/* Topics of a subject */}
      <ResponsiveSheet
        open={!!sheetSubject}
        onOpenChange={(o) => !o && setSheetSubject(null)}
        title={sheetSubject ? tr(lang, sheetSubject.name) : ""}
        description={t("Pick a lesson, or type your own topic.", "कोई पाठ चुनें या अपना विषय लिखें।")}
      >
        {sheetSubject && (
          <div className="space-y-4">
            <ul className="space-y-2">
              {sheetSubject.topics.map((tp) => (
                <li key={tp.en}>
                  <button
                    type="button"
                    onClick={() => void generate(sheetSubject.id, tp.en)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <BookOpenCheck className="size-4.5 shrink-0 text-primary" aria-hidden />
                    <span className="flex-1 text-sm font-medium" lang={lang}>
                      {tr(lang, tp)}
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void generate(sheetSubject.id, topic)
              }}
            >
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={120}
                placeholder={t("Or type a topic in this subject…", "या इस विषय का कोई टॉपिक लिखें…")}
                aria-label={t("Topic", "टॉपिक")}
                className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20"
              />
              <Button type="submit" className="h-11">
                <Sparkles aria-hidden /> {t("Learn", "सीखें")}
              </Button>
            </form>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </ResponsiveSheet>
    </ToolPage>
  )
}

function OptionRow({ label, icon, className, children }: { label: string; icon?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0 rounded-2xl border border-primary/10 bg-primary/5 p-3.5 sm:p-4 transition-colors hover:border-primary/20", className)}>
      <p className="mb-3 flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wider text-primary/70">
        {icon} {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function Chip({ active, onClick, lang, children }: { active: boolean; onClick: () => void; lang?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      lang={lang}
      onClick={onClick}
      className={cn(
        "flex min-h-9 items-center justify-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[0.8rem] font-semibold transition-all duration-300 ease-out",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30 ring-1 ring-primary ring-offset-1 ring-offset-background scale-[1.02]"
          : "bg-background/50 text-muted-foreground shadow-sm hover:scale-[1.02] hover:border-primary/40 hover:bg-muted hover:text-foreground active:scale-[0.98]"
      )}
    >
      {active && <Check className="size-3.5" aria-hidden />}
      {children}
    </button>
  )
}

function LessonLoading({ lang, onCancel }: { lang: AiLanguage; onCancel: () => void }) {
  return (
    <div className="mx-auto max-w-md space-y-4 py-6 text-center" role="status" aria-busy="true">
      <div className="mx-auto flex size-16 animate-lk-glow items-center justify-center rounded-2xl bg-primary/12 text-primary">
        <GraduationCap className="size-8" aria-hidden />
      </div>
      <div>
        <p className="text-lg font-semibold">{tr(lang, { en: "Preparing your lesson…", hi: "आपका पाठ तैयार हो रहा है…" })}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr(lang, { en: "Writing examples, a story and practice questions.", hi: "उदाहरण, कहानी और अभ्यास प्रश्न लिखे जा रहे हैं।" })}
        </p>
      </div>
      <div className="space-y-2 text-left" aria-hidden>
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Button variant="ghost" onClick={onCancel}>
        {tr(lang, { en: "Cancel", hi: "रद्द करें" })}
      </Button>
    </div>
  )
}
