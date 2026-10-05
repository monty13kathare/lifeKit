import { BookA, Brain, Calculator, FlaskConical, Globe2, Lightbulb, Quote, ScrollText, SpellCheck, type LucideIcon } from "lucide-react"
import type { LessonLevel, LessonStyle } from "@/types"
import type { Bilingual } from "./fun-categories"

export interface LessonSubject {
  id: string
  name: Bilingual
  icon: LucideIcon
  /** Tailwind classes for the icon tile, light & dark aware. */
  accent: string
  topics: Bilingual[]
}

/** Subjects in the Learning Zone, each with suggested lessons. Any topic can also be typed in. */
export const LESSON_SUBJECTS: LessonSubject[] = [
  {
    id: "reasoning",
    name: { en: "Reasoning", hi: "रीज़निंग" },
    icon: Brain,
    accent: "bg-violet-500/12 text-violet-600 dark:text-violet-300",
    topics: [
      { en: "Blood relations", hi: "रक्त संबंध" },
      { en: "Direction sense", hi: "दिशा ज्ञान" },
      { en: "Syllogism", hi: "न्याय निगमन (Syllogism)" },
      { en: "Seating arrangement", hi: "बैठक व्यवस्था" },
      { en: "Coding-decoding", hi: "कोडिंग-डिकोडिंग" },
      { en: "Clock and calendar", hi: "घड़ी और कैलेंडर" },
    ],
  },
  {
    id: "logical",
    name: { en: "Logical thinking", hi: "तार्किक सोच" },
    icon: Lightbulb,
    accent: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
    topics: [
      { en: "Number series", hi: "संख्या श्रृंखला" },
      { en: "Analogies", hi: "सादृश्यता" },
      { en: "Odd one out", hi: "बेमेल पहचानें" },
      { en: "Puzzles and patterns", hi: "पहेलियाँ और पैटर्न" },
      { en: "Critical thinking", hi: "आलोचनात्मक सोच" },
    ],
  },
  {
    id: "english",
    name: { en: "English grammar", hi: "अंग्रेज़ी व्याकरण" },
    icon: SpellCheck,
    accent: "bg-sky-500/12 text-sky-600 dark:text-sky-300",
    topics: [
      { en: "Tenses", hi: "काल (Tenses)" },
      { en: "Articles: a, an, the", hi: "आर्टिकल्स: a, an, the" },
      { en: "Prepositions", hi: "प्रिपोज़िशन" },
      { en: "Active and passive voice", hi: "एक्टिव और पैसिव वॉइस" },
      { en: "Direct and indirect speech", hi: "डायरेक्ट और इनडायरेक्ट स्पीच" },
      { en: "Subject-verb agreement", hi: "सब्जेक्ट-वर्ब एग्रीमेंट" },
    ],
  },
  {
    id: "vocabulary",
    name: { en: "Vocabulary", hi: "शब्दावली" },
    icon: BookA,
    accent: "bg-teal-500/12 text-teal-600 dark:text-teal-300",
    topics: [
      { en: "Synonyms and antonyms", hi: "समानार्थी और विलोम" },
      { en: "Commonly confused words", hi: "अक्सर भ्रमित करने वाले शब्द" },
      { en: "Root words and prefixes", hi: "मूल शब्द और उपसर्ग" },
      { en: "Words for daily conversation", hi: "रोज़ की बातचीत के शब्द" },
    ],
  },
  {
    id: "idioms",
    name: { en: "Idioms & phrases", hi: "मुहावरे और वाक्यांश" },
    icon: Quote,
    accent: "bg-rose-500/12 text-rose-600 dark:text-rose-300",
    topics: [
      { en: "Common English idioms", hi: "आम अंग्रेज़ी मुहावरे" },
      { en: "Phrasal verbs", hi: "फ्रेज़ल वर्ब्स" },
      { en: "Hindi muhavare", hi: "हिंदी मुहावरे" },
      { en: "Proverbs", hi: "लोकोक्तियाँ" },
    ],
  },
  {
    id: "maths",
    name: { en: "Maths", hi: "गणित" },
    icon: Calculator,
    accent: "bg-orange-500/12 text-orange-600 dark:text-orange-300",
    topics: [
      { en: "Percentages", hi: "प्रतिशत" },
      { en: "Ratio and proportion", hi: "अनुपात और समानुपात" },
      { en: "Time, speed and distance", hi: "समय, चाल और दूरी" },
      { en: "Profit and loss", hi: "लाभ और हानि" },
      { en: "Simple and compound interest", hi: "साधारण और चक्रवृद्धि ब्याज" },
    ],
  },
  {
    id: "science",
    name: { en: "Science", hi: "विज्ञान" },
    icon: FlaskConical,
    accent: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
    topics: [
      { en: "How electricity works", hi: "बिजली कैसे काम करती है" },
      { en: "Photosynthesis", hi: "प्रकाश संश्लेषण" },
      { en: "The human digestive system", hi: "मानव पाचन तंत्र" },
      { en: "Gravity and motion", hi: "गुरुत्वाकर्षण और गति" },
    ],
  },
  {
    id: "gk",
    name: { en: "General knowledge", hi: "सामान्य ज्ञान" },
    icon: Globe2,
    accent: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-300",
    topics: [
      { en: "The Indian Constitution", hi: "भारतीय संविधान" },
      { en: "Solar system", hi: "सौरमंडल" },
      { en: "How the economy works", hi: "अर्थव्यवस्था कैसे काम करती है" },
      { en: "Indian freedom struggle", hi: "भारतीय स्वतंत्रता संग्राम" },
    ],
  },
  {
    id: "stories",
    name: { en: "Stories & values", hi: "कहानियाँ और मूल्य" },
    icon: ScrollText,
    accent: "bg-fuchsia-500/12 text-fuchsia-600 dark:text-fuchsia-300",
    topics: [
      { en: "Honesty", hi: "ईमानदारी" },
      { en: "Teamwork", hi: "मिलकर काम करना" },
      { en: "Patience and hard work", hi: "धैर्य और मेहनत" },
      { en: "Thinking before acting", hi: "सोच-समझकर काम करना" },
    ],
  },
]

export const getLessonSubject = (id: string) => LESSON_SUBJECTS.find((s) => s.id === id)

export const LEVELS: { id: LessonLevel; name: Bilingual }[] = [
  { id: "beginner", name: { en: "Beginner", hi: "शुरुआती" } },
  { id: "intermediate", name: { en: "Intermediate", hi: "मध्यम" } },
  { id: "advanced", name: { en: "Advanced", hi: "उन्नत" } },
]

export const STYLES: { id: LessonStyle; name: Bilingual; blurb: Bilingual }[] = [
  { id: "examples", name: { en: "Easy examples", hi: "आसान उदाहरण" }, blurb: { en: "Everyday examples", hi: "रोज़मर्रा के उदाहरण" } },
  { id: "story", name: { en: "Through a story", hi: "कहानी से" }, blurb: { en: "Learn it as a story", hi: "कहानी के ज़रिए सीखें" } },
  { id: "exam", name: { en: "Exam focus", hi: "परीक्षा फ़ोकस" }, blurb: { en: "Patterns and shortcuts", hi: "पैटर्न और शॉर्टकट" } },
]

export const MAX_SAVED_LESSONS = 30
