import { toast } from "sonner"
import { awardXp, completeLesson, learnState, levelInfo } from "@/lib/learn/progress"

function celebrate(level: number) {
  toast.success("Level up! 🎉", { description: `You reached level ${level} in AI Prompting.` })
}

/** Award prompting XP and toast on level-up. */
export function rewardXp(xp: number, label: string) {
  const res = awardXp("prompting", xp, label)
  if (res.levelUp) celebrate(res.level)
  return res
}

/** Complete a lesson (idempotent) and toast XP / level-up. */
export function rewardLesson(lessonId: string, title: string, xp = 20): boolean {
  const before = levelInfo(learnState().xp.prompting).level
  const first = completeLesson("prompting", lessonId, title, xp)
  if (first) {
    const after = levelInfo(learnState().xp.prompting).level
    if (after > before) celebrate(after)
    else toast.success(`Lesson complete · +${xp} XP`)
  }
  return first
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return a
}
