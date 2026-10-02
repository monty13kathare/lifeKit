import type { TranslationRequest, TranslationResult, TranslationService } from "../translation-service"
import { DICTIONARY_ROWS } from "./dictionary-data"

/** A piece of output text; `translated: false` marks words the dictionary didn't know. */
export interface TranslationSegment {
  text: string
  translated: boolean
}

export interface DemoTranslationResult extends TranslationResult {
  /** Output split into translated / untranslated pieces for highlighting. */
  segments: TranslationSegment[]
}

export const DEMO_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
] as const

type DemoLang = (typeof DEMO_LANGUAGES)[number]["code"]
const COLUMNS: DemoLang[] = ["en", "hi", "es", "fr", "de"]

interface Row {
  values: Record<DemoLang, string>
  /** Reverse-only alias (never used as an English source). */
  alias: boolean
}

// Words may contain inner apostrophes or hyphens: don't, s'il, peut-être, कभी-कभी.
const WORD_RE = /[\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*/gu
const NUMBER_RE = /^\p{N}+$/u

const normalize = (w: string) => w.normalize("NFC").replace(/’/g, "'").toLocaleLowerCase()
const stripAccents = (w: string) => w.normalize("NFD").replace(/[̀-ͯ]/g, "")

function words(s: string): string[] {
  return s.match(WORD_RE) ?? []
}

interface LangIndex {
  exact: Map<string, number>
  /** Accent-insensitive fallback (Latin scripts): "tschuss" → "tschüss". */
  loose: Map<string, number>
}

let built: { rows: Row[]; index: Record<DemoLang, LangIndex>; maxPhrase: number } | null = null

function build() {
  if (built) return built
  const rows: Row[] = []
  for (const line of DICTIONARY_ROWS.split("\n")) {
    const cols = line.split("|")
    if (cols.length !== COLUMNS.length) continue
    const alias = cols[0].startsWith("~")
    const values = {} as Record<DemoLang, string>
    COLUMNS.forEach((lang, i) => (values[lang] = (i === 0 && alias ? cols[0].slice(1) : cols[i]).trim()))
    rows.push({ values, alias })
  }

  const index = {} as Record<DemoLang, LangIndex>
  let maxPhrase = 1
  for (const lang of COLUMNS) {
    const exact = new Map<string, number>()
    const loose = new Map<string, number>()
    rows.forEach((row, i) => {
      if (lang === "en" && row.alias) return
      const ws = words(row.values[lang])
      if (!ws.length) return
      maxPhrase = Math.max(maxPhrase, ws.length)
      const key = ws.map(normalize).join(" ")
      if (!exact.has(key)) exact.set(key, i)
      const looseKey = stripAccents(key)
      if (!loose.has(looseKey)) loose.set(looseKey, i)
    })
    index[lang] = { exact, loose }
  }
  built = { rows, index, maxPhrase }
  return built
}

/** Match the source's capitalisation: "HELLO" → "HOLA", "Hello" → "Hola". */
function matchCase(source: string, out: string): string {
  if (!out) return out
  const hasCase = source !== source.toLocaleLowerCase()
  if (!hasCase) return out
  if (source.length > 1 && source === source.toLocaleUpperCase()) return out.toLocaleUpperCase()
  const first = source[0]
  if (first !== first.toLocaleLowerCase()) return out[0].toLocaleUpperCase() + out.slice(1)
  return out
}

function punctuation(text: string, from: string, to: string): string {
  let t = text
  if (from === "hi" && to !== "hi") t = t.replace(/।/g, ".")
  if (to === "hi" && from !== "hi") t = t.replace(/\.(?=\s|$)/g, "।")
  if (from === "es" && to !== "es") t = t.replace(/[¿¡]/g, "")
  return t
}

interface Token {
  text: string
  word: boolean
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let last = 0
  for (const m of text.matchAll(WORD_RE)) {
    const i = m.index ?? 0
    if (i > last) tokens.push({ text: text.slice(last, i), word: false })
    tokens.push({ text: m[0], word: true })
    last = i + m[0].length
  }
  if (last < text.length) tokens.push({ text: text.slice(last), word: false })
  return tokens
}

/**
 * Translate with the built-in phrase/word list. Longest phrase match first,
 * then word by word. Not a real translator: no grammar, agreement or reordering.
 */
export function translateWithDictionary(text: string, from: string, to: string): DemoTranslationResult {
  const { rows, index, maxPhrase } = build()
  const src = index[from as DemoLang]
  const isLang = (l: string): l is DemoLang => (COLUMNS as string[]).includes(l)
  if (!src || !isLang(to)) throw new Error(`The demo dictionary doesn't support ${from} → ${to}.`)

  if (from === to) return { text, isDemo: true, untranslated: [], segments: [{ text, translated: true }] }

  const tokens = tokenize(text)
  const segments: TranslationSegment[] = []
  const untranslated: string[] = []
  const seen = new Set<string>()

  const push = (seg: TranslationSegment) => {
    const prev = segments[segments.length - 1]
    if (prev && prev.translated === seg.translated) prev.text += seg.text
    else segments.push({ ...seg })
  }

  let i = 0
  while (i < tokens.length) {
    const tok = tokens[i]
    if (!tok.word) {
      push({ text: punctuation(tok.text, from, to), translated: true })
      i++
      continue
    }
    if (NUMBER_RE.test(tok.text)) {
      push({ text: tok.text, translated: true })
      i++
      continue
    }

    // Collect up to `maxPhrase` consecutive words separated only by whitespace.
    const candidates: { words: string[]; end: number }[] = []
    const ws: string[] = []
    let j = i
    while (j < tokens.length && ws.length < maxPhrase) {
      if (!tokens[j].word) break
      ws.push(tokens[j].text)
      candidates.push({ words: [...ws], end: j })
      const sep = tokens[j + 1]
      if (!sep || sep.word || !/^\s+$/.test(sep.text)) break
      j += 2
    }

    let matched = false
    for (let c = candidates.length - 1; c >= 0; c--) {
      const key = candidates[c].words.map(normalize).join(" ")
      const rowIndex = src.exact.get(key) ?? src.loose.get(stripAccents(key))
      if (rowIndex === undefined) continue
      let out = matchCase(candidates[c].words[0], rows[rowIndex].values[to])
      // Caseless source script (Hindi): capitalise sentence starts in the output.
      if (out && from === "hi") {
        const soFar = segments.map((s) => s.text).join("").trimEnd()
        if (!soFar || /[.!?]$/.test(soFar)) out = out[0].toLocaleUpperCase() + out.slice(1)
      }
      if (out) {
        push({ text: out, translated: true })
        i = candidates[c].end + 1
      } else {
        // Omitted word (e.g. articles into Hindi): also drop the following space.
        i = candidates[c].end + 1
        if (tokens[i] && !tokens[i].word && /^\s+$/.test(tokens[i].text)) i++
      }
      matched = true
      break
    }

    if (!matched) {
      push({ text: tok.text, translated: false })
      const key = normalize(tok.text)
      if (!seen.has(key)) {
        seen.add(key)
        untranslated.push(tok.text)
      }
      i++
    }
  }

  return { text: segments.map((s) => s.text).join(""), isDemo: true, untranslated, segments }
}

export class DemoDictionaryTranslationService implements TranslationService {
  readonly id = "demo-dictionary"
  readonly name = "Demo dictionary"
  readonly isConfigured = true
  readonly isDemo = true

  supportedLanguages() {
    return DEMO_LANGUAGES.map((l) => ({ code: l.code, name: l.name }))
  }

  async translate(req: TranslationRequest): Promise<DemoTranslationResult> {
    return translateWithDictionary(req.text, req.from, req.to)
  }

  /** Number of dictionary entries (for UI copy). */
  get size() {
    return build().rows.length
  }
}
