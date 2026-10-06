"use client"

import { useEffect, useRef, useState } from "react"
import { BookOpen, CheckCircle2, Layers, Lightbulb, Loader2, RefreshCw, Sparkles, Target, Zap } from "lucide-react"
import { RichText } from "@/components/common/rich-text"
import { Button } from "@/components/ui/button"
import { aiAssist } from "@/lib/ai/client"
import { cn } from "@/lib/utils"
import type { LearnLesson, TopicDetail } from "@/types"
import { haptic } from "../fun/celebrate"
import { tr } from "../fun/fun-utils"

export const topicKey = (section: string, topic: string) => `${section}::${topic}`

/**
 * On-demand deep explanations for syllabus / module topics. Results are stored
 * on the lesson (`topicDetails`) so a saved lesson keeps them offline.
 */
export function useTopicDetails(lesson: LearnLesson, onUpdate: (next: LearnLesson) => void) {
  // Several requests can be in flight; always merge into the newest lesson.
  const latest = useRef(lesson)
  useEffect(() => {
    latest.current = lesson
  }, [lesson])
  const [loading, setLoading] = useState<Set<string>>(() => new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})

  const explain = async (section: string, topic: string, hint?: string) => {
    const key = topicKey(section, topic)
    if (loading.has(key)) return
    setLoading((s) => new Set(s).add(key))
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)))
    try {
      const detail = await aiAssist(
        "learn-topic",
        JSON.stringify({
          subject: lesson.subject,
          lessonTitle: lesson.data.title,
          section,
          topic,
          hint: hint?.slice(0, 600),
          level: lesson.level,
          language: lesson.language,
        })
      )
      const cur = latest.current
      const next = { ...cur, topicDetails: { ...cur.topicDetails, [key]: detail } }
      latest.current = next
      onUpdate(next)
    } catch (err) {
      setErrors((e) => ({ ...e, [key]: err instanceof Error ? err.message : "Couldn't load the explanation." }))
    } finally {
      setLoading((s) => {
        const n = new Set(s)
        n.delete(key)
        return n
      })
    }
  }

  return { details: lesson.topicDetails ?? {}, loading, errors, explain }
}

export type TopicDetails = ReturnType<typeof useTopicDetails>

/** "Explain in detail" button, loading skeleton, error, or the finished notes. */
export function TopicDeepDive({
  section,
  topic,
  hint,
  lang,
  state,
  tone = "primary",
}: {
  section: string
  topic: string
  hint?: string
  lang: LearnLesson["language"]
  state: TopicDetails
  tone?: "primary" | "sky" | "emerald"
}) {
  const t = (en: string, hi: string) => tr(lang, { en, hi })
  const key = topicKey(section, topic)
  const detail = state.details[key]
  const loading = state.loading.has(key)
  const error = state.errors[key]

  if (loading)
    return (
      <div className="space-y-2.5 rounded-xl border border-dashed p-4" aria-live="polite">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden /> {t("Writing detailed notes…", "विस्तृत नोट्स तैयार हो रहे हैं…")}
        </p>
        <div className="h-3 w-11/12 animate-pulse rounded bg-muted" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    )

  if (detail) return <TopicDetailView detail={detail} lang={lang} onRefresh={() => void state.explain(section, topic, hint)} />

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className={cn(
          "h-11 w-full justify-center sm:w-auto",
          tone === "sky" && "border-sky-500/30 text-sky-700 hover:bg-sky-500/10 dark:text-sky-300",
          tone === "emerald" && "border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
        )}
        onClick={() => void state.explain(section, topic, hint)}
      >
        <Sparkles aria-hidden /> {t("Explain in detail", "विस्तार से समझाएँ")}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

export function TopicDetailView({ detail, lang, onRefresh }: { detail: TopicDetail; lang: LearnLesson["language"]; onRefresh?: () => void }) {
  const t = (en: string, hi: string) => tr(lang, { en, hi })
  return (
    <div className="animate-in space-y-4 fade-in slide-in-from-top-1">
      <RichText text={detail.overview} className="text-[0.95rem] text-foreground/90" />

      {detail.keyPoints.length > 0 && (
        <div className="rounded-xl border bg-primary/5 p-3.5">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-primary">
            <Target className="size-4" aria-hidden /> {t("Remember these", "ये याद रखें")}
          </p>
          <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
            {detail.keyPoints.map((p, i) => (
              <li key={i} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                <span className="min-w-0">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {detail.subTopics.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Layers className="size-4 text-primary" aria-hidden /> {t("Sub-topics explained", "उप-विषय विस्तार से")}
          </p>
          <ol className="grid gap-2 sm:grid-cols-2">
            {detail.subTopics.map((s, i) => (
              <li key={i} className="rounded-xl border bg-background/50 p-3">
                <p className="flex items-start gap-2 text-sm font-semibold">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/12 text-[0.7rem] text-primary">{i + 1}</span>
                  {s.name}
                </p>
                <RichText text={s.explanation} className="mt-1.5 text-muted-foreground" />
              </li>
            ))}
          </ol>
        </div>
      )}

      {detail.example.trim() && (
        <div className="rounded-xl border-l-4 border-amber-400 bg-amber-500/8 px-3.5 py-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300">
            <Lightbulb className="size-4" aria-hidden /> {t("Worked example", "हल किया गया उदाहरण")}
          </p>
          <RichText text={detail.example} />
        </div>
      )}

      {detail.tip && (
        <p className="flex gap-2 rounded-xl bg-success/10 px-3.5 py-2.5 text-sm">
          <Zap className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <span>
            <span className="font-semibold text-success">{t("Pro tip: ", "प्रो टिप: ")}</span>
            {detail.tip}
          </span>
        </p>
      )}

      {detail.quiz.length > 0 && <MiniQuiz quiz={detail.quiz} lang={lang} />}

      {onRefresh && (
        <Button variant="ghost" size="sm" className="h-10 text-muted-foreground" onClick={onRefresh}>
          <RefreshCw aria-hidden /> {t("Rewrite these notes", "नोट्स दोबारा लिखें")}
        </Button>
      )}
    </div>
  )
}

function MiniQuiz({ quiz, lang }: { quiz: TopicDetail["quiz"]; lang: LearnLesson["language"] }) {
  const [picked, setPicked] = useState<(number | null)[]>(() => quiz.map(() => null))
  return (
    <div className="rounded-xl border p-3.5">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <BookOpen className="size-4 text-primary" aria-hidden /> {tr(lang, { en: "Test yourself", hi: "खुद को परखें" })}
      </p>
      <ol className="space-y-4">
        {quiz.map((q, qi) => {
          const answered = picked[qi] !== null
          return (
            <li key={qi}>
              <p className="mb-2 text-sm font-medium">
                {qi + 1}. {q.question}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((o, oi) => {
                  const right = oi === q.answerIndex
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={answered}
                      onClick={() => {
                        setPicked((p) => p.map((v, i) => (i === qi ? oi : v)))
                        haptic(right ? 25 : [60, 40, 60])
                      }}
                      className={cn(
                        "flex min-h-11 items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm transition-colors",
                        !answered && "hover:border-primary/50 hover:bg-primary/5",
                        answered && right && "border-success bg-success/10",
                        answered && picked[qi] === oi && !right && "border-destructive bg-destructive/10",
                        answered && !right && picked[qi] !== oi && "opacity-60"
                      )}
                    >
                      <span className="font-semibold text-muted-foreground">{String.fromCharCode(65 + oi)}.</span> {o}
                    </button>
                  )
                })}
              </div>
              {answered && <p className="mt-2 animate-in rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed fade-in">{q.explanation}</p>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
