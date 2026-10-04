import type { Bilingual } from "@/data/learn/fun-categories"
import type { FunDifficulty, FunLanguage, FunQuestion } from "@/types"

/** A quiz being played: freshly generated, a starter set or a saved one. */
export interface ActiveQuiz {
  title: string
  category: string
  topic: string
  difficulty: FunDifficulty
  language: FunLanguage
  questions: FunQuestion[]
  source: "ai" | "starter"
  /** Set when replaying a saved quiz. */
  savedId?: string
}

/** Pick UI text for the quiz language ("both" uses English for short UI labels). */
export const tr = (lang: FunLanguage, text: Bilingual) => (lang === "hi" ? text.hi : text.en)

/** "English · हिन्दी" style label for "both", otherwise one language. */
export const label = (lang: FunLanguage, text: Bilingual) => (lang === "both" ? `${text.en} · ${text.hi}` : tr(lang, text))

export const DIFFICULTIES: { id: FunDifficulty; name: Bilingual; emoji: string }[] = [
  { id: "easy", name: { en: "Easy", hi: "आसान" }, emoji: "🌱" },
  { id: "medium", name: { en: "Medium", hi: "मध्यम" }, emoji: "🔥" },
  { id: "hard", name: { en: "Hard", hi: "कठिन" }, emoji: "🧠" },
]

export const LANGUAGES: { id: FunLanguage; label: string; lang: string }[] = [
  { id: "en", label: "English", lang: "en" },
  { id: "hi", label: "हिन्दी", lang: "hi" },
  { id: "both", label: "Both · दोनों", lang: "en" },
]
