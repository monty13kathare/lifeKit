"use client"

import { useMemo, useState } from "react"
import { FlaskConical, Search, Wand2 } from "lucide-react"
import { CopyButton } from "@/components/common/copy-button"
import { EmptyState } from "@/components/common/empty-state"
import { ResponsiveSheet } from "@/components/common/responsive-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { fillTemplate, PROMPT_TEMPLATES, TEMPLATE_GROUPS, templatePlaceholders, type PromptTemplate, type TemplateGroup } from "@/data/learn/prompting"

type Filter = TemplateGroup | "All"

/** Placeholders that usually hold pasted text get a textarea. */
const LONG_FIELD = /code|notes|text|essay|explanation|error message|resume/i

export function PromptLibrary({ onPractice }: { onPractice: (prompt: string) => void }) {
  const [filter, setFilter] = useState<Filter>("All")
  const [query, setQuery] = useState("")
  const [active, setActive] = useState<PromptTemplate | null>(null)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return PROMPT_TEMPLATES.filter(
      (t) => (filter === "All" || t.group === filter) && (!q || `${t.title} ${t.description} ${t.template}`.toLowerCase().includes(q))
    )
  }, [filter, query])

  const groups = TEMPLATE_GROUPS.filter((g) => list.some((t) => t.group === g))

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates"
            aria-label="Search templates"
            className="h-10 pl-9"
          />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0" role="group" aria-label="Filter by category">
          {(["All", ...TEMPLATE_GROUPS] as Filter[]).map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={filter === g}
              onClick={() => setFilter(g)}
              className={cn(
                "h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                filter === g ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-surface-muted"
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Search} title="No templates found" description="Try a different search or category." />
      ) : (
        groups.map((g) => (
          <section key={g} aria-labelledby={`tpl-${g}`} className="space-y-2.5">
            <h3 id={`tpl-${g}`} className="text-sm font-semibold text-muted-foreground">
              {g}
            </h3>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {list
                .filter((t) => t.group === g)
                .map((t) => (
                  <div key={t.id} className="flex flex-col rounded-2xl border bg-card p-4">
                    <p className="font-medium">{t.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p>
                    <p className="mt-2 line-clamp-3 flex-1 text-xs leading-relaxed text-muted-foreground">{t.template}</p>
                    <Button variant="outline" className="mt-3 w-full" onClick={() => setActive(t)}>
                      <Wand2 aria-hidden /> Use template
                    </Button>
                  </div>
                ))}
            </div>
          </section>
        ))
      )}

      {active ? (
        <TemplateSheet
          key={active.id}
          template={active}
          onClose={() => setActive(null)}
          onPractice={(p) => {
            setActive(null)
            onPractice(p)
          }}
        />
      ) : null}
    </div>
  )
}

function TemplateSheet({ template, onClose, onPractice }: { template: PromptTemplate; onClose: () => void; onPractice: (prompt: string) => void }) {
  const fields = useMemo(() => templatePlaceholders(template.template), [template])
  const [values, setValues] = useState<Record<string, string>>({})
  const final = fillTemplate(template.template, values)
  const filled = fields.filter((f) => values[f]?.trim()).length

  return (
    <ResponsiveSheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={template.title}
      description="Fill in the blanks, then copy the prompt or practise it in the Lab."
      size="lg"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onPractice(final)}>
            <FlaskConical aria-hidden /> Practice in Lab
          </Button>
          <CopyButton value={final} label="Copy prompt" variant="default" />
        </div>
      }
    >
      <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
        {fields.map((f, i) => (
          <div key={f} className="space-y-1.5">
            <Label htmlFor={`ph-${i}`} className="capitalize">
              {f}
            </Label>
            {LONG_FIELD.test(f) ? (
              <Textarea
                id={`ph-${i}`}
                value={values[f] ?? ""}
                maxLength={3000}
                rows={3}
                onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
                placeholder={`Paste ${f} here`}
                className="max-h-48"
              />
            ) : (
              <Input
                id={`ph-${i}`}
                value={values[f] ?? ""}
                maxLength={300}
                onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
                placeholder={f}
                className="h-10"
              />
            )}
          </div>
        ))}
      </form>
      <div className="mt-4 space-y-1.5">
        <p className="text-sm font-medium">
          Preview <span className="font-normal text-muted-foreground">· {filled}/{fields.length} filled</span>
        </p>
        <p className="rounded-xl border bg-surface-muted p-3 text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">
          {final}
        </p>
      </div>
    </ResponsiveSheet>
  )
}
