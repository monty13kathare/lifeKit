"use client"

import { useState } from "react"
import { Gamepad2, GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"
import { LearnFunApp } from "./fun/learn-fun-app"
import { LearningZone } from "./zone/learning-zone"

type Tab = "fun" | "learn"

const TABS: { id: Tab; label: string; hint: string; icon: typeof Gamepad2 }[] = [
  { id: "fun", label: "Fun", hint: "Quiz games", icon: Gamepad2 },
  { id: "learn", label: "Learn", hint: "AI lessons", icon: GraduationCap },
]

/** /learn: "Fun" quiz games and the "Learn" zone with AI lessons. */
export function LearnPage() {
  const [tab, setTab] = useState<Tab>("fun")

  const tabs = (
    <div role="tablist" aria-label="Learn mode" className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
      {TABS.map(({ id, label, hint, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`learn-tab-${id}`}
          aria-selected={tab === id}
          aria-controls={`learn-panel-${id}`}
          onClick={() => {
            setTab(id)
            window.scrollTo({ top: 0, behavior: "smooth" })
          }}
          className={cn(
            "flex min-h-12 items-center justify-center gap-2.5 rounded-xl px-3 transition-all",
            tab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className={cn("size-5", tab === id && "text-primary")} aria-hidden />
          <span className="text-left leading-tight">
            <span className="block text-sm font-semibold">{label}</span>
            <span className="hidden text-xs font-normal text-muted-foreground min-[380px]:block">{hint}</span>
          </span>
        </button>
      ))}
    </div>
  )

  return (
    <div role="tabpanel" id={`learn-panel-${tab}`} aria-labelledby={`learn-tab-${tab}`}>
      {tab === "fun" ? <LearnFunApp tabs={tabs} /> : <LearningZone tabs={tabs} />}
    </div>
  )
}
