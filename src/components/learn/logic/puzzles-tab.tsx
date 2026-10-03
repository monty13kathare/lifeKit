"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, CircleCheck, Puzzle, Shuffle, SkipForward } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { EmptyState } from "@/components/common/empty-state"
import { useLearn } from "@/hooks/use-lifekit-data"
import { useAiStatus } from "@/hooks/use-ai-status"
import { cn } from "@/lib/utils"
import { DIFFICULTIES, PUZZLE_CATEGORIES, PUZZLES, puzzleXp, type Difficulty, type PuzzleCategory } from "@/data/learn/logic"
import { AiPuzzle } from "./ai-puzzle"
import { PuzzleSolver } from "./puzzle-solver"
import { completeLogic } from "./shared"

type CatFilter = PuzzleCategory | "all"
type DiffFilter = Difficulty | "all"

const CATEGORY_ITEMS: { value: CatFilter; label: string }[] = [
  { value: "all", label: "All categories" },
  ...(Object.keys(PUZZLE_CATEGORIES) as PuzzleCategory[]).map((c) => ({ value: c, label: PUZZLE_CATEGORIES[c].label })),
]
const DIFFICULTY_ITEMS: { value: DiffFilter; label: string }[] = [
  { value: "all", label: "Any difficulty" },
  ...(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => ({ value: d, label: DIFFICULTIES[d].label })),
]

export function PuzzlesTab() {
  const { completedLessons } = useLearn()
  const ai = useAiStatus()
  const [category, setCategory] = useState<CatFilter>("all")
  const [difficulty, setDifficulty] = useState<DiffFilter>("all")
  const [unsolvedOnly, setUnsolvedOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const solved = useMemo(() => new Set(completedLessons.filter((id) => id.startsWith("puzzle:")).map((id) => id.slice(7))), [completedLessons])
  const filtered = PUZZLES.filter(
    (p) => (category === "all" || p.category === category) && (difficulty === "all" || p.difficulty === difficulty) && (!unsolvedOnly || !solved.has(p.id))
  )
  const selected = PUZZLES.find((p) => p.id === selectedId) ?? null
  const solvedCount = PUZZLES.filter((p) => solved.has(p.id)).length

  function nextUnsolved() {
    const pool = filtered.filter((p) => !solved.has(p.id) && p.id !== selectedId)
    const fallback = PUZZLES.filter((p) => !solved.has(p.id) && p.id !== selectedId)
    const list = pool.length ? pool : fallback
    if (!list.length) return setSelectedId(null)
    const idx = selectedId ? list.findIndex((p) => PUZZLES.indexOf(p) > PUZZLES.findIndex((q) => q.id === selectedId)) : 0
    setSelectedId(list[idx >= 0 ? idx : 0].id)
  }

  function random() {
    const pool = filtered.length ? filtered : PUZZLES
    const unsolved = pool.filter((p) => !solved.has(p.id))
    const list = unsolved.length ? unsolved : pool
    setSelectedId(list[Math.floor(Math.random() * list.length)].id)
  }

  if (selected) {
    const solvedBefore = solved.has(selected.id)
    return (
      <div className="space-y-4">
        <Button variant="ghost" className="-ml-2" onClick={() => setSelectedId(null)}>
          <ChevronLeft aria-hidden /> All puzzles
        </Button>
        <PuzzleSolver
          key={selected.id}
          puzzle={selected}
          solvedBefore={solvedBefore}
          onSolve={(hintUsed) => {
            const xp = puzzleXp(selected.difficulty, hintUsed)
            return completeLogic(`puzzle:${selected.id}`, selected.title, xp) ? xp : 0
          }}
          footer={
            <Button variant="secondary" onClick={nextUnsolved}>
              <SkipForward aria-hidden /> Next puzzle
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {ai?.configured ? <AiPuzzle /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">
            {solvedCount}/{PUZZLES.length}
          </span>{" "}
          puzzles solved
        </p>
        <Button variant="outline" onClick={random}>
          <Shuffle aria-hidden /> Random puzzle
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="pz-cat">Category</Label>
          <Select items={CATEGORY_ITEMS} value={category} onValueChange={(v) => v && setCategory(v as CatFilter)}>
            <SelectTrigger id="pz-cat" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_ITEMS.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pz-diff">Difficulty</Label>
          <Select items={DIFFICULTY_ITEMS} value={difficulty} onValueChange={(v) => v && setDifficulty(v as DiffFilter)}>
            <SelectTrigger id="pz-diff" className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTY_ITEMS.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium">
          <Switch checked={unsolvedOnly} onCheckedChange={(v) => setUnsolvedOnly(v)} aria-label="Unsolved only" />
          Unsolved only
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Puzzle}
          title={unsolvedOnly ? "All solved here!" : "No puzzles match"}
          description={unsolvedOnly ? "You've solved every puzzle with these filters. Try another category." : "Try different filters."}
          action={
            <Button
              variant="outline"
              onClick={() => {
                setCategory("all")
                setDifficulty("all")
                setUnsolvedOnly(false)
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const isSolved = solved.has(p.id)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "flex h-full w-full flex-col gap-2 rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-surface-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    isSolved && "border-success/30"
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-medium">{p.title}</span>
                    {isSolved ? <CircleCheck className="size-5 shrink-0 text-success" aria-label="Solved" /> : null}
                  </span>
                  <span className="line-clamp-2 text-sm text-muted-foreground">{p.puzzle}</span>
                  <span className="mt-auto flex flex-wrap gap-1.5 pt-1">
                    <Badge variant="secondary">{PUZZLE_CATEGORIES[p.category].label}</Badge>
                    <Badge variant="outline">{DIFFICULTIES[p.difficulty].label}</Badge>
                    <Badge variant="outline" className="tabular-nums">
                      {DIFFICULTIES[p.difficulty].xp} XP
                    </Badge>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
