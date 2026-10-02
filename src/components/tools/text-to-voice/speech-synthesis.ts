/** Helpers for the Web Speech API synthesis side (`speechSynthesis`). */

const EMPTY: SpeechSynthesisVoice[] = []
let cachedKey = ""
let cachedVoices: SpeechSynthesisVoice[] = EMPTY

export function isSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined"
}

/**
 * `useSyncExternalStore` adapter for the voice list. Browsers load voices
 * asynchronously and fire `voiceschanged`; `getVoices()` returns a new array
 * each call, so the snapshot is cached by content.
 */
export const voicesStore = {
  subscribe(onChange: () => void) {
    if (!isSynthesisSupported()) return () => {}
    window.speechSynthesis.addEventListener("voiceschanged", onChange)
    return () => window.speechSynthesis.removeEventListener("voiceschanged", onChange)
  },
  getSnapshot(): SpeechSynthesisVoice[] {
    if (!isSynthesisSupported()) return EMPTY
    const voices = window.speechSynthesis.getVoices()
    const key = voices.map((v) => `${v.voiceURI}|${v.lang}`).join(",")
    if (key !== cachedKey) {
      cachedKey = key
      cachedVoices = voices
    }
    return cachedVoices
  },
  getServerSnapshot(): SpeechSynthesisVoice[] {
    return EMPTY
  },
}

export const baseLang = (lang: string) => lang.split(/[-_]/)[0]?.toLowerCase() ?? ""

let displayNames: Intl.DisplayNames | null | undefined
export function languageName(code: string): string {
  if (displayNames === undefined) {
    try {
      displayNames = new Intl.DisplayNames(["en"], { type: "language" })
    } catch {
      displayNames = null
    }
  }
  try {
    return displayNames?.of(code) ?? code
  } catch {
    return code
  }
}

export interface TextChunk {
  text: string
  /** Offset of `text` within the full input. */
  start: number
}

const MAX_CHUNK = 200

/**
 * Split text into sentence-sized chunks. Chrome silently stops utterances
 * after ~15 seconds, so long sentences are split again at commas or spaces.
 */
export function chunkText(input: string): TextChunk[] {
  const sentences: TextChunk[] = []
  const Segmenter = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter
  if (Segmenter) {
    const seg = new Segmenter(undefined, { granularity: "sentence" })
    for (const s of seg.segment(input)) sentences.push({ text: s.segment, start: s.index })
  } else {
    const re = /[^.!?।\n]+[.!?।]*\s*|\n+/g
    let m: RegExpExecArray | null
    while ((m = re.exec(input))) sentences.push({ text: m[0], start: m.index })
  }

  const out: TextChunk[] = []
  for (const s of sentences) {
    let text = s.text
    let start = s.start
    while (text.length > MAX_CHUNK) {
      const window = text.slice(0, MAX_CHUNK)
      let cut = Math.max(window.lastIndexOf(", "), window.lastIndexOf("; "), window.lastIndexOf(": "))
      if (cut < MAX_CHUNK / 3) cut = window.lastIndexOf(" ")
      if (cut < MAX_CHUNK / 3) cut = MAX_CHUNK - 1
      out.push({ text: text.slice(0, cut + 1), start })
      start += cut + 1
      text = text.slice(cut + 1)
    }
    out.push({ text, start })
  }
  return out.filter((c) => c.text.trim().length > 0)
}
