"use client"

import { Loader2, Minus, Plus, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AssistOutput } from "@/lib/ai/assist-schemas"

export type Advice = AssistOutput<"decision-advice">

export function AiAdvicePanel({
  loading,
  advice,
  onRun,
  onCancel,
  onDismiss,
  disabledReason,
}: {
  loading: boolean
  advice: Advice | null
  onRun: () => void
  onCancel: () => void
  onDismiss: () => void
  disabledReason: string | null
}) {
  return (
    <section aria-labelledby="ai-advice-heading" className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="ai-advice-heading" className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="size-4 text-primary" aria-hidden /> AI advice
        </h3>
        {loading ? (
          <Button variant="outline" onClick={onCancel}>
            <X aria-hidden /> Cancel
          </Button>
        ) : (
          <Button onClick={onRun} disabled={!!disabledReason}>
            <Sparkles aria-hidden /> {advice ? "Ask again" : "Get AI advice"}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {disabledReason ?? "Your question, options, criteria and scores are sent to Google Gemini."}
      </p>

      <div aria-live="polite">
        {loading ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Thinking it through…
          </p>
        ) : advice ? (
          <div className="space-y-4 rounded-xl border bg-card p-3 sm:p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Suggestion — you decide</p>
                <p className="mt-1 font-semibold wrap-break-word">{advice.recommendation}</p>
              </div>
              <Button variant="ghost" size="icon" className="-mt-1 -mr-1 text-muted-foreground" aria-label="Dismiss advice" onClick={onDismiss}>
                <X aria-hidden />
              </Button>
            </div>
            <p className="text-sm whitespace-pre-line text-muted-foreground">{advice.reasoning}</p>
            {advice.considerations.length ? (
              <div>
                <p className="mb-1 text-sm font-medium">Worth considering</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {advice.considerations.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {advice.perOption.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {advice.perOption.map((o, i) => (
                  <div key={i} className="rounded-lg bg-surface p-3">
                    <p className="mb-1.5 text-sm font-medium wrap-break-word">{o.option}</p>
                    <ul className="space-y-1 text-sm" aria-label={`Pros and cons of ${o.option}`}>
                      {o.pros.map((p, j) => (
                        <li key={`p${j}`} className="flex gap-1.5">
                          <Plus className="mt-0.5 size-4 shrink-0 text-success" aria-label="Pro" />
                          <span>{p}</span>
                        </li>
                      ))}
                      {o.cons.map((c, j) => (
                        <li key={`c${j}`} className="flex gap-1.5">
                          <Minus className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Con" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">AI can be wrong. Treat this as a second opinion, not the answer.</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
