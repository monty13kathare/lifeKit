/** Options for AI Writer. Values are sent to the `write` assist job as-is. */

export type WriterMode = "draft" | "rewrite" | "reply" | "translate"
export type WriterFormat = "email" | "message" | "post" | "paragraph" | "bullets" | "cover-letter"
export type WriterTone = "professional" | "friendly" | "formal" | "casual" | "confident" | "polite" | "persuasive" | "concise"
export type WriterLength = "short" | "medium" | "long"

/** Max characters of source text (matches the `write` job's input limit). */
export const WRITER_TEXT_LIMIT = 16000
export const WRITER_INSTRUCTIONS_LIMIT = 1000
/** mailto: links get unreliable beyond a couple of thousand characters. */
export const MAILTO_BODY_LIMIT = 1800
export const HISTORY_SIZE = 5

export const MODES: { value: WriterMode; label: string; hint: string; inputLabel: string; placeholder: string }[] = [
  {
    value: "draft",
    label: "Draft",
    hint: "Write something new from notes or instructions.",
    inputLabel: "What should it say?",
    placeholder: "e.g. Ask my manager for Friday off for a family function, offer to finish the report on Thursday.",
  },
  {
    value: "rewrite",
    label: "Rewrite",
    hint: "Improve text you've already written.",
    inputLabel: "Text to rewrite",
    placeholder: "Paste the text you want to improve…",
  },
  {
    value: "reply",
    label: "Reply",
    hint: "Reply to a message or email you received.",
    inputLabel: "Message you received",
    placeholder: "Paste the message you want to reply to…",
  },
  {
    value: "translate",
    label: "Translate",
    hint: "Translate text into another language.",
    inputLabel: "Text to translate",
    placeholder: "Paste or type the text to translate…",
  },
]

export const FORMATS: { value: WriterFormat; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "message", label: "Message / chat" },
  { value: "post", label: "Social post" },
  { value: "paragraph", label: "Paragraph" },
  { value: "bullets", label: "Bullet list" },
  { value: "cover-letter", label: "Cover letter" },
]

export const TONES: { value: WriterTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
  { value: "confident", label: "Confident" },
  { value: "polite", label: "Polite" },
  { value: "persuasive", label: "Persuasive" },
  { value: "concise", label: "Concise" },
]

export const LENGTHS: { value: WriterLength; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
]

export const LANGUAGES = [
  "English",
  "Hindi",
  "Spanish",
  "French",
  "German",
  "Arabic",
  "Bengali",
  "Tamil",
  "Telugu",
  "Marathi",
  "Gujarati",
  "Kannada",
  "Malayalam",
  "Punjabi",
  "Urdu",
  "Chinese (Simplified)",
  "Japanese",
  "Korean",
  "Portuguese",
  "Russian",
  "Italian",
  "Dutch",
  "Indonesian",
  "Turkish",
  "Vietnamese",
  "Thai",
].map((l) => ({ value: l, label: l }))

export interface DraftTemplate {
  id: string
  label: string
  format: WriterFormat
  tone: WriterTone
  instructions: string
}

export const DRAFT_TEMPLATES: DraftTemplate[] = [
  {
    id: "leave",
    label: "Leave application",
    format: "email",
    tone: "formal",
    instructions: "Write a leave application to my manager. Mention the dates, the reason briefly, and how my work will be covered.",
  },
  {
    id: "follow-up",
    label: "Follow-up email",
    format: "email",
    tone: "polite",
    instructions: "Write a polite follow-up on an earlier email or conversation that hasn't had a reply yet. Restate the request and suggest a next step.",
  },
  {
    id: "thanks",
    label: "Thank-you note",
    format: "message",
    tone: "friendly",
    instructions: "Write a warm, sincere thank-you note. Mention specifically what I'm thankful for.",
  },
  {
    id: "apology",
    label: "Apology",
    format: "message",
    tone: "polite",
    instructions: "Write a genuine apology. Acknowledge what went wrong, take responsibility and say what I'll do differently. No excuses.",
  },
  {
    id: "meeting",
    label: "Meeting request",
    format: "email",
    tone: "professional",
    instructions: "Write a short meeting request. State the purpose, propose two or three time slots and the expected duration.",
  },
  {
    id: "complaint",
    label: "Complaint",
    format: "email",
    tone: "formal",
    instructions: "Write a firm but polite complaint. Describe the problem, relevant dates or order numbers, and the resolution I expect.",
  },
]

export const isMode = (v: string | null): v is WriterMode => MODES.some((m) => m.value === v)
export const modeLabel = (m: WriterMode) => MODES.find((x) => x.value === m)!.label
