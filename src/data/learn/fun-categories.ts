import { BookA, BookOpen, Brain, Calculator, Globe2, Lightbulb, MessageCircleQuestion, Quote, Monitor, type LucideIcon } from "lucide-react"
import type { FunMode } from "@/types"

/** A label in both quiz languages. */
export interface Bilingual {
  en: string
  hi: string
}

export interface FunCategory {
  id: string
  name: Bilingual
  blurb: Bilingual
  icon: LucideIcon
  /** Tailwind classes for the icon tile, light & dark aware. */
  accent: string
  topics: Bilingual[]
}

export const FUN_CATEGORIES: FunCategory[] = [
  {
    id: "logical",
    name: { en: "Logical", hi: "तार्किक" },
    blurb: { en: "Series, patterns and odd one out", hi: "श्रृंखला, पैटर्न और बेमेल शब्द" },
    icon: Lightbulb,
    accent: "bg-amber-500/10 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300",
    topics: [
      { en: "Number series", hi: "संख्या श्रृंखला" },
      { en: "Odd one out", hi: "बेमेल चुनें" },
      { en: "Analogies", hi: "सादृश्यता" },
      { en: "Coding-decoding", hi: "कोडिंग-डिकोडिंग" },
      { en: "Letter patterns", hi: "अक्षर पैटर्न" },
    ],
  },
  {
    id: "reasoning",
    name: { en: "Reasoning", hi: "रीज़निंग" },
    blurb: { en: "Relations, directions and arrangements", hi: "रिश्ते, दिशाएँ और व्यवस्था" },
    icon: Brain,
    accent: "bg-violet-500/10 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300",
    topics: [
      { en: "Blood relations", hi: "रक्त संबंध" },
      { en: "Directions", hi: "दिशा ज्ञान" },
      { en: "Seating arrangement", hi: "बैठक व्यवस्था" },
      { en: "Syllogisms", hi: "न्याय निगमन" },
      { en: "Clocks & calendars", hi: "घड़ी और कैलेंडर" },
    ],
  },
  {
    id: "english",
    name: { en: "English", hi: "अंग्रेज़ी" },
    blurb: { en: "Words, grammar and spelling", hi: "शब्द, व्याकरण और वर्तनी" },
    icon: BookA,
    accent: "bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300",
    topics: [
      { en: "Synonyms & antonyms", hi: "समानार्थी और विलोम" },
      { en: "Tenses", hi: "काल (Tenses)" },
      { en: "Prepositions", hi: "प्रिपोज़िशन" },
      { en: "Spelling", hi: "वर्तनी" },
      { en: "One-word substitution", hi: "एक शब्द" },
      { en: "Fill in the blanks", hi: "रिक्त स्थान भरें" },
    ],
  },
  {
    id: "riddles",
    name: { en: "Riddles", hi: "पहेलियाँ" },
    blurb: { en: "Brain teasers with a twist", hi: "मज़ेदार दिमागी पहेलियाँ" },
    icon: MessageCircleQuestion,
    accent: "bg-rose-500/10 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300",
    topics: [
      { en: "Classic riddles", hi: "क्लासिक पहेलियाँ" },
      { en: "Funny riddles", hi: "मज़ेदार पहेलियाँ" },
      { en: "Hindi paheliyan", hi: "हिंदी पहेलियाँ" },
      { en: "Maths riddles", hi: "गणित पहेलियाँ" },
    ],
  },
  {
    id: "idioms",
    name: { en: "Idioms & Phrases", hi: "मुहावरे और लोकोक्तियाँ" },
    blurb: { en: "Sayings and what they really mean", hi: "कहावतें और उनके असली अर्थ" },
    icon: Quote,
    accent: "bg-teal-500/10 text-teal-600 dark:bg-teal-400/15 dark:text-teal-300",
    topics: [
      { en: "Common idioms", hi: "आम मुहावरे" },
      { en: "Phrasal verbs", hi: "फ्रेज़ल वर्ब्स" },
      { en: "Hindi muhavare", hi: "हिंदी मुहावरे" },
      { en: "Proverbs", hi: "लोकोक्तियाँ" },
    ],
  },
  {
    id: "cs",
    name: { en: "Computer Science", hi: "कंप्यूटर विज्ञान" },
    blurb: { en: "Coding, hardware and internet", hi: "कोडिंग, हार्डवेयर और इंटरनेट" },
    icon: Monitor,
    accent: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300",
    topics: [
      { en: "Programming basics", hi: "प्रोग्रामिंग बेसिक्स" },
      { en: "Internet & web", hi: "इंटरनेट और वेब" },
      { en: "Hardware", hi: "हार्डवेयर" },
      { en: "Software", hi: "सॉफ़्टवेयर" },
      { en: "History of computing", hi: "कंप्यूटिंग का इतिहास" },
    ],
  },
  {
    id: "gk",
    name: { en: "General Knowledge", hi: "सामान्य ज्ञान" },
    blurb: { en: "India, science, space and sports", hi: "भारत, विज्ञान, अंतरिक्ष और खेल" },
    icon: Globe2,
    accent: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300",
    topics: [
      { en: "India", hi: "भारत" },
      { en: "Science", hi: "विज्ञान" },
      { en: "Space", hi: "अंतरिक्ष" },
      { en: "Sports", hi: "खेल" },
      { en: "History", hi: "इतिहास" },
    ],
  },
  {
    id: "maths",
    name: { en: "Maths Fun", hi: "गणित मस्ती" },
    blurb: { en: "Mental maths and word problems", hi: "मानसिक गणित और शब्द समस्याएँ" },
    icon: Calculator,
    accent: "bg-orange-500/10 text-orange-600 dark:bg-orange-400/15 dark:text-orange-300",
    topics: [
      { en: "Mental maths", hi: "मानसिक गणित" },
      { en: "Percentages", hi: "प्रतिशत" },
      { en: "Time & speed", hi: "समय और चाल" },
      { en: "Word problems", hi: "शब्द समस्याएँ" },
    ],
  },
]

/** The category used for quizzes on a topic the user typed. */
export const CUSTOM_CATEGORY = "custom"

export function getFunCategory(id: string): FunCategory | undefined {
  return FUN_CATEGORIES.find((c) => c.id === id)
}

export const FUN_MODES: { id: FunMode; name: Bilingual; blurb: Bilingual; emoji: string }[] = [
  { id: "classic", name: { en: "Classic", hi: "क्लासिक" }, blurb: { en: "Your pace, learn from every answer", hi: "अपनी रफ़्तार से, हर जवाब से सीखें" }, emoji: "🎯" },
  { id: "timed", name: { en: "Speed Round", hi: "स्पीड राउंड" }, blurb: { en: "Beat the clock for bonus XP", hi: "घड़ी को हराएँ, बोनस XP पाएँ" }, emoji: "⚡" },
  { id: "survival", name: { en: "3 Lives", hi: "3 जीवन" }, blurb: { en: "Three mistakes and it's game over", hi: "तीन गलतियाँ और खेल ख़त्म" }, emoji: "❤️" },
  { id: "study", name: { en: "Flashcards", hi: "फ़्लैशकार्ड" }, blurb: { en: "Flip cards, no pressure", hi: "कार्ड पलटें, बिना दबाव" }, emoji: "🃏" },
]
