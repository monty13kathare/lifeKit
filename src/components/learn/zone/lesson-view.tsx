"use client"

import { useState } from "react"
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  CircleAlert,
  Lightbulb,
  ListOrdered,
  Loader2,
  MessageCircleQuestion,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  X,
} from "lucide-react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getLessonSubject, LEVELS, STYLES } from "@/data/learn/lesson-subjects"
import { aiAssist } from "@/lib/ai/client"
import { cn } from "@/lib/utils"
import type { LessonContent, LearnLesson } from "@/types"
import { haptic } from "../fun/celebrate"
import { tr } from "../fun/fun-utils"

const doubtSchema = z.string().trim().min(3, "Type your doubt — a few words is enough.").max(400, "Keep your doubt under 400 characters.")

/** XP for finishing a lesson's quick check: 5 for reading + 5 per correct answer. */
export const lessonXp = (correct: number) => 5 + correct * 5

interface LessonViewProps {
  lesson: LearnLesson
  saved: boolean
  aiEnabled: boolean
  busy: boolean
  onBack: () => void
  onSave: () => void
  onDelete: () => void
  onSimpler: () => void
  onLearnTopic: (topic: string) => void
  onQuizDone: (correct: number, total: number) => void
}

export function LessonView({ lesson, saved, aiEnabled, busy, onBack, onSave, onDelete, onSimpler, onLearnTopic, onQuizDone }: LessonViewProps) {
  const lang = lesson.language
  const d = lesson.data
  const subject = getLessonSubject(lesson.subject)
  const Icon = subject?.icon ?? Sparkles
  const t = (en: string, hi: string) => tr(lang, { en, hi })

  return (
    <article className={cn("mx-auto max-w-3xl space-y-4", busy && "pointer-events-none opacity-60")} lang={lang} aria-busy={busy}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label={t("Back to Learning Zone", "लर्निंग ज़ोन पर वापस")}>
          <ArrowLeft aria-hidden />
        </Button>
        <div className="flex-1" />
        {aiEnabled && (
          <Button variant="outline" onClick={onSimpler} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
            <span className="hidden sm:inline">{t("Explain more simply", "और आसान समझाएँ")}</span>
            <span className="sm:hidden">{t("Simpler", "आसान")}</span>
          </Button>
        )}
        <Button variant={saved ? "secondary" : "default"} onClick={onSave} disabled={saved} aria-label={saved ? t("Saved", "सहेजा गया") : t("Save lesson", "पाठ सहेजें")}>
          {saved ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
          <span className="hidden sm:inline">{saved ? t("Saved", "सहेजा गया") : t("Save", "सहेजें")}</span>
        </Button>
        {saved && (
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label={t("Delete lesson", "पाठ हटाएँ")}>
            <Trash2 aria-hidden />
          </Button>
        )}
      </div>

      <header className="relative overflow-hidden rounded-3xl border bg-card p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/12 via-transparent to-transparent" aria-hidden />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1", subject?.accent ?? "bg-primary/10 text-primary")}>
              <Icon className="size-3.5" aria-hidden /> {subject ? tr(lang, subject.name) : t("Any topic", "कोई भी विषय")}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1">{tr(lang, LEVELS.find((l) => l.id === lesson.level)!.name)}</span>
            <span className="rounded-full bg-muted px-2.5 py-1">{tr(lang, STYLES.find((s) => s.id === lesson.style)!.name)}</span>
            {lesson.score !== undefined && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2.5 py-1 text-success">
                <Trophy className="size-3.5" aria-hidden /> {lesson.score}%
              </span>
            )}
          </div>
          <h1 className="mt-3 text-2xl leading-tight font-bold tracking-tight text-balance sm:text-3xl">{d.title}</h1>
          <p className="mt-2 leading-relaxed text-muted-foreground">{d.intro}</p>
        </div>
      </header>

      {/* Key ideas */}
      <Section icon={Lightbulb} tone="amber" title={t("Key ideas", "मुख्य बातें")}>
        <ol className="space-y-3">
          {d.keyIdeas.map((k, i) => (
            <li key={i} className="rounded-2xl border bg-background/50 p-4">
              <p className="flex items-start gap-2.5 font-semibold">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs text-primary">{i + 1}</span>
                {k.heading}
              </p>
              <p className="mt-2 text-sm leading-relaxed">{k.explanation}</p>
              {k.example && (
                <div className="mt-3 rounded-xl border-l-4 border-amber-400 bg-amber-500/8 px-3 py-2.5 text-sm leading-relaxed">
                  <span className="font-semibold text-amber-700 dark:text-amber-300">{t("Example: ", "उदाहरण: ")}</span>
                  <span className="whitespace-pre-line">{k.example}</span>
                </div>
              )}
            </li>
          ))}
        </ol>
      </Section>

      {/* Story */}
      {d.story.text.trim() && (
        <Section icon={BookOpen} tone="violet" title={d.story.title || t("Learn it as a story", "कहानी से समझें")}>
          <p className="text-[0.95rem] leading-relaxed whitespace-pre-line">{d.story.text}</p>
        </Section>
      )}

      {/* Method */}
      {d.method.length > 0 && (
        <Section icon={ListOrdered} tone="sky" title={t("Step-by-step method", "चरण-दर-चरण तरीका")}>
          <ol className="space-y-2">
            {d.method.map((m, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-sky-500/12 text-xs font-semibold text-sky-700 dark:text-sky-300">{i + 1}</span>
                <span className="pt-0.5">{m}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Worked examples */}
      <Section icon={Target} tone="emerald" title={t("Worked examples", "हल किए गए उदाहरण")}>
        <div className="space-y-3">
          {d.examples.map((ex, i) => (
            <WorkedExample key={i} n={i + 1} ex={ex} lang={lang} />
          ))}
        </div>
      </Section>

      {/* Tips & mistakes */}
      {(d.tips.length > 0 || d.mistakes.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {d.tips.length > 0 && (
            <Section icon={Sparkles} tone="emerald" title={t("Tips & shortcuts", "टिप्स और शॉर्टकट")}>
              <ul className="space-y-2 text-sm">
                {d.tips.map((tip, i) => (
                  <li key={i} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {tip}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {d.mistakes.length > 0 && (
            <Section icon={CircleAlert} tone="rose" title={t("Common mistakes", "आम गलतियाँ")}>
              <ul className="space-y-2 text-sm">
                {d.mistakes.map((m, i) => (
                  <li key={i} className="flex gap-2">
                    <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden /> {m}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

      {/* Quick check */}
      <QuickCheck key={lesson.id} lesson={lesson} onDone={onQuizDone} />

      {/* Summary */}
      <Section icon={BookmarkCheck} tone="indigo" title={t("Key takeaways", "याद रखने वाली बातें")}>
        <ul className="space-y-2 text-sm">
          {d.summary.map((s, i) => (
            <li key={i} className="flex gap-2.5 rounded-xl bg-muted/60 px-3 py-2">
              <span className="font-semibold text-primary">{i + 1}.</span> {s}
            </li>
          ))}
        </ul>
      </Section>

      {/* Next topics */}
      {aiEnabled && d.nextTopics.length > 0 && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">{t("Learn next", "आगे सीखें")}</h2>
          <div className="flex flex-wrap gap-2">
            {d.nextTopics.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => onLearnTopic(topic)}
                disabled={busy}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors hover:border-primary/40 hover:bg-primary/8"
              >
                <Sparkles className="size-3.5 text-primary" aria-hidden /> {topic}
              </button>
            ))}
          </div>
        </section>
      )}

      {aiEnabled && <AskDoubt lesson={lesson} />}
    </article>
  )
}

const TONES = {
  amber: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
  violet: "bg-violet-500/12 text-violet-600 dark:text-violet-300",
  sky: "bg-sky-500/12 text-sky-600 dark:text-sky-300",
  emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
  rose: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
  indigo: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-300",
} as const

function Section({ icon: Icon, tone, title, children }: { icon: typeof Lightbulb; tone: keyof typeof TONES; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2.5 font-semibold">
        <span className={cn("flex size-8 items-center justify-center rounded-lg", TONES[tone])}>
          <Icon className="size-4" aria-hidden />
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function WorkedExample({ n, ex, lang }: { n: number; ex: LessonContent["examples"][number]; lang: LearnLesson["language"] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl border bg-background/50 p-4">
      <p className="text-sm leading-relaxed">
        <span className="font-semibold">{tr(lang, { en: `Q${n}. `, hi: `प्रश्न ${n}. ` })}</span>
        <span className="whitespace-pre-line">{ex.question}</span>
      </p>
      <Button variant="outline" size="sm" className="mt-3 h-10" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <ChevronDown className={cn("transition-transform", open && "rotate-180")} aria-hidden />
        {open ? tr(lang, { en: "Hide solution", hi: "हल छिपाएँ" }) : tr(lang, { en: "Show solution", hi: "हल देखें" })}
      </Button>
      {open && (
        <div className="mt-3 animate-in space-y-2 fade-in slide-in-from-top-1">
          <ol className="space-y-1.5 text-sm leading-relaxed">
            {ex.steps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-medium text-muted-foreground">{i + 1}.</span> {s}
              </li>
            ))}
          </ol>
          <p className="rounded-xl bg-success/10 px-3 py-2 text-sm font-semibold text-success">
            {tr(lang, { en: "Answer: ", hi: "उत्तर: " })}
            {ex.answer}
          </p>
        </div>
      )}
    </div>
  )
}

function QuickCheck({ lesson, onDone }: { lesson: LearnLesson; onDone: (correct: number, total: number) => void }) {
  const lang = lesson.language
  const qs = lesson.data.practice
  const [picked, setPicked] = useState<(number | null)[]>(() => qs.map(() => null))
  // Was the quick check already finished before this attempt? (XP is only awarded once.)
  const [retake] = useState(() => !!lesson.completedAt)
  const answered = picked.filter((p) => p !== null).length
  const correct = picked.filter((p, i) => p === qs[i].answerIndex).length
  const done = answered === qs.length

  const choose = (qi: number, oi: number) => {
    if (picked[qi] !== null) return
    const next = picked.map((p, i) => (i === qi ? oi : p))
    setPicked(next)
    haptic(oi === qs[qi].answerIndex ? 25 : [60, 40, 60])
    if (next.every((p) => p !== null)) onDone(next.filter((p, i) => p === qs[i].answerIndex).length, qs.length)
  }

  return (
    <Section icon={Trophy} tone="indigo" title={tr(lang, { en: "Quick check", hi: "जल्दी जाँचें" })}>
      <p className="-mt-1 mb-3 text-xs text-muted-foreground">
        {tr(lang, { en: "Answer to check your understanding and earn XP.", hi: "अपनी समझ जाँचें और XP कमाएँ।" })}
      </p>
      <ol className="space-y-4">
        {qs.map((q, qi) => (
          <li key={qi}>
            <p className="mb-2 text-sm font-medium">
              {qi + 1}. {q.question}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {q.options.map((o, oi) => {
                const isPicked = picked[qi] === oi
                const show = picked[qi] !== null
                const right = oi === q.answerIndex
                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={show}
                    onClick={() => choose(qi, oi)}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm transition-colors",
                      !show && "hover:border-primary/50 hover:bg-primary/5",
                      show && right && "border-success bg-success/10",
                      show && isPicked && !right && "animate-lk-shake border-destructive bg-destructive/10",
                      show && !right && !isPicked && "opacity-60"
                    )}
                  >
                    <span className="font-semibold text-muted-foreground">{String.fromCharCode(65 + oi)}.</span> {o}
                  </button>
                )
              })}
            </div>
            {picked[qi] !== null && <p className="mt-2 animate-in rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed fade-in">{q.explanation}</p>}
          </li>
        ))}
      </ol>
      {done && (
        <div className="mt-4 flex animate-lk-pop items-center gap-3 rounded-2xl bg-primary/10 p-3">
          <Trophy className="size-6 text-primary" aria-hidden />
          <p className="text-sm font-semibold">
            {retake
              ? tr(lang, { en: `${correct} of ${qs.length} correct`, hi: `${qs.length} में से ${correct} सही` })
              : tr(lang, { en: `${correct} of ${qs.length} correct · +${lessonXp(correct)} XP`, hi: `${qs.length} में से ${correct} सही · +${lessonXp(correct)} XP` })}
            {retake && <span className="block text-xs font-normal text-muted-foreground">{tr(lang, { en: "XP is awarded the first time only.", hi: "XP केवल पहली बार मिलता है।" })}</span>}
          </p>
        </div>
      )}
    </Section>
  )
}

function AskDoubt({ lesson }: { lesson: LearnLesson }) {
  const lang = lesson.language
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thread, setThread] = useState<{ q: string; answer: string; example?: string }[]>([])

  const ask = async () => {
    const parsed = doubtSchema.safeParse(q)
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    setBusy(true)
    setError(null)
    try {
      const out = await aiAssist(
        "learn-ask",
        JSON.stringify({
          subject: lesson.subject,
          topic: lesson.topic,
          lessonTitle: lesson.data.title,
          keyIdeas: lesson.data.keyIdeas.map((k) => k.heading),
          question: parsed.data,
          language: lesson.language,
        })
      )
      setThread((t) => [...t, { q: parsed.data, ...out }])
      setQ("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't get an answer.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4" aria-labelledby="ask-doubt">
      <h2 id="ask-doubt" className="flex items-center gap-2 font-semibold">
        <MessageCircleQuestion className="size-4.5 text-primary" aria-hidden /> {tr(lang, { en: "Ask a doubt", hi: "अपना सवाल पूछें" })}
      </h2>
      {thread.map((m, i) => (
        <div key={i} className="space-y-2">
          <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground">{m.q}</p>
          <div className="max-w-[92%] space-y-2 rounded-2xl rounded-bl-md bg-muted/70 px-3 py-2.5 text-sm leading-relaxed" aria-live="polite">
            <p className="whitespace-pre-line">{m.answer}</p>
            {m.example && (
              <p className="rounded-lg border-l-4 border-amber-400 bg-background/60 px-2.5 py-1.5">
                <span className="font-semibold">{tr(lang, { en: "Example: ", hi: "उदाहरण: " })}</span>
                {m.example}
              </p>
            )}
          </div>
        </div>
      ))}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void ask()
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={400}
          placeholder={tr(lang, { en: "e.g. Why is this answer correct?", hi: "जैसे: यह उत्तर सही क्यों है?" })}
          aria-label={tr(lang, { en: "Your doubt", hi: "आपका सवाल" })}
          className="h-11 flex-1"
        />
        <Button type="submit" size="icon" className="size-11" disabled={busy} aria-label={tr(lang, { en: "Ask", hi: "पूछें" })}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">{tr(lang, { en: "Your question is sent to Google Gemini.", hi: "आपका सवाल Google Gemini को भेजा जाता है।" })}</p>
    </section>
  )
}
