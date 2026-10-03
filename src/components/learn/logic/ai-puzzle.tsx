"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { aiAssist } from "@/lib/ai/client"
import { DIFFICULTIES, PUZZLE_CATEGORIES, puzzleXp, type Difficulty, type PuzzleCategory } from "@/data/learn/logic"
import { PuzzleSolver, type SolverPuzzle } from "./puzzle-solver"
import { awardLogicXp, GeminiHint, isAbort } from "./shared"

const CATEGORY_ITEMS = (Object.keys(PUZZLE_CATEGORIES) as PuzzleCategory[]).map((c) => ({ value: c, label: PUZZLE_CATEGORIES[c].label }))
const DIFFICULTY_ITEMS = (Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => ({ value: d, label: DIFFICULTIES[d].label }))

/** AI-generated puzzles (only rendered when Gemini is configured). */
export function AiPuzzle() {
  const [category, setCategory] = useState<PuzzleCategory>("deduction")
  const [difficulty, setDifficulty] = useState<Difficulty>("medium")
  const [loading, setLoading] = useState(false)
  const [puzzle, setPuzzle] = useState<SolverPuzzle | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  async function generate() {
    if (loading) return
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    try {
      const res = await aiAssist(
        "logic-puzzle",
        JSON.stringify({ category: PUZZLE_CATEGORIES[category].label, difficulty }),
        controller.signal
      )
      setPuzzle({
        id: `ai-${Date.now()}`,
        title: res.title || "AI puzzle",
        puzzle: res.puzzle,
        hint: res.hint,
        answer: res.answer,
        accept: res.acceptableAnswers,
        explanation: res.explanation,
        difficulty,
        category,
      })
    } catch (err) {
      if (!isAbort(err)) toast.error((err as Error).message || "Couldn't generate a puzzle. Try again.")
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setLoading(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-dashed bg-surface p-4 sm:p-5" aria-labelledby="ai-puzzle-title">
      <div>
        <h2 id="ai-puzzle-title" className="flex items-center gap-2 font-semibold">
          <Sparkles className="size-4.5 text-primary" aria-hidden /> Generate a new puzzle
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Fresh puzzles from AI, on any category and difficulty.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="ai-cat">Category</Label>
          <Select items={CATEGORY_ITEMS} value={category} onValueChange={(v) => v && setCategory(v as PuzzleCategory)} disabled={loading}>
            <SelectTrigger id="ai-cat" className="h-11 w-full">
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
          <Label htmlFor="ai-diff">Difficulty</Label>
          <Select items={DIFFICULTY_ITEMS} value={difficulty} onValueChange={(v) => v && setDifficulty(v as Difficulty)} disabled={loading}>
            <SelectTrigger id="ai-diff" className="h-11 w-full">
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
        <div className="flex gap-2">
          <Button size="lg" className="flex-1" onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
            {loading ? "Generating…" : "Generate"}
          </Button>
          {loading ? (
            <Button size="lg" variant="outline" onClick={() => abortRef.current?.abort()}>
              <X aria-hidden /> Cancel
            </Button>
          ) : null}
        </div>
      </div>
      <GeminiHint />

      {puzzle ? (
        <PuzzleSolver
          key={puzzle.id}
          puzzle={puzzle}
          badge={<Badge>✨ AI</Badge>}
          onSolve={(hintUsed) => {
            const xp = puzzleXp(puzzle.difficulty, hintUsed)
            awardLogicXp(xp, `AI puzzle: ${puzzle.title}`)
            return xp
          }}
          aiCheck={(userAnswer, userReasoning, signal) =>
            aiAssist(
              "logic-check",
              JSON.stringify({ puzzle: puzzle.puzzle, answer: puzzle.answer, explanation: puzzle.explanation, userAnswer, userReasoning }),
              signal
            )
          }
          footer={
            <Button variant="outline" onClick={() => setPuzzle(null)}>
              Close
            </Button>
          }
        />
      ) : null}
    </section>
  )
}
