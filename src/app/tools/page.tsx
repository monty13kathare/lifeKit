import type { Metadata } from "next"
import { ToolCard } from "@/components/cards/tool-card"
import { CATEGORY_META, TOOL_CATEGORY_ORDER, toolsByCategory } from "@/data/tools"

export const metadata: Metadata = { title: "Tools" }

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tools</h1>
        <p className="mt-1 text-muted-foreground">Everything runs in your browser — nothing is uploaded.</p>
      </header>

      <nav aria-label="Tool categories" className="-mx-4 mb-6 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
        <ul className="flex gap-2">
          {TOOL_CATEGORY_ORDER.map((c) => (
            <li key={c}>
              <a
                href={`#${c}`}
                className="inline-flex h-9 items-center rounded-full border bg-card px-4 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {CATEGORY_META[c].label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-9">
        {TOOL_CATEGORY_ORDER.map((category) => (
          <section key={category} id={category} aria-labelledby={`${category}-title`} className="scroll-mt-24">
            <div className="mb-3">
              <h2 id={`${category}-title`} className="text-lg font-semibold">
                {CATEGORY_META[category].label}
              </h2>
              <p className="text-sm text-muted-foreground">{CATEGORY_META[category].description}</p>
            </div>
            <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:px-0 lg:grid-cols-3 xl:grid-cols-4">
              {toolsByCategory(category).map((tool) => (
                <li key={tool.id} className="w-40 shrink-0 snap-start sm:w-auto">
                  <ToolCard tool={tool} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
