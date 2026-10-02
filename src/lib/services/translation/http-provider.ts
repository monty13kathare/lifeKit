import { z } from "zod"
import type { TranslationRequest, TranslationResult, TranslationService } from "../translation-service"

/**
 * Calls a backend proxy you control (e.g. a small serverless function that
 * holds the real provider's API key). The browser only ever sees your proxy
 * URL — never put provider API keys in `NEXT_PUBLIC_*` variables.
 *
 * Contract: `POST <endpoint>` with JSON `{ text, from, to }` →
 * `{ text: string, detectedLanguage?: string }`.
 */
const responseSchema = z.object({
  text: z.string(),
  detectedLanguage: z.string().optional(),
})

export const HTTP_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "Hindi" },
  { code: "bn", name: "Bengali" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "mr", name: "Marathi" },
  { code: "gu", name: "Gujarati" },
  { code: "kn", name: "Kannada" },
  { code: "ml", name: "Malayalam" },
  { code: "pa", name: "Punjabi" },
  { code: "ur", name: "Urdu" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "nl", name: "Dutch" },
  { code: "ru", name: "Russian" },
  { code: "uk", name: "Ukrainian" },
  { code: "pl", name: "Polish" },
  { code: "tr", name: "Turkish" },
  { code: "ar", name: "Arabic" },
  { code: "fa", name: "Persian" },
  { code: "zh", name: "Chinese (Simplified)" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "id", name: "Indonesian" },
  { code: "vi", name: "Vietnamese" },
  { code: "th", name: "Thai" },
  { code: "sw", name: "Swahili" },
]

export class HttpTranslationService implements TranslationService {
  readonly id = "http"
  readonly name = "Translation server"
  readonly isDemo = false
  readonly isConfigured: boolean

  constructor(
    private readonly endpoint: string | undefined,
    private readonly timeoutMs = 15_000
  ) {
    this.isConfigured = Boolean(endpoint && /^https?:\/\//i.test(endpoint))
  }

  supportedLanguages() {
    return HTTP_LANGUAGES
  }

  async translate(req: TranslationRequest, options?: { signal?: AbortSignal }): Promise<TranslationResult> {
    if (!this.isConfigured || !this.endpoint) {
      throw new Error("No translation server is configured.")
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    const onAbort = () => controller.abort()
    options?.signal?.addEventListener("abort", onAbort)
    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: req.text, from: req.from, to: req.to }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`The translation server responded with an error (${res.status}).`)
      const parsed = responseSchema.safeParse(await res.json())
      if (!parsed.success) throw new Error("The translation server sent an unexpected response.")
      return { text: parsed.data.text, isDemo: false, detectedLanguage: parsed.data.detectedLanguage }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        throw new Error(options?.signal?.aborted ? "Translation cancelled." : "The translation server took too long to respond.")
      }
      if (err instanceof TypeError) throw new Error("Couldn't reach the translation server. Check your connection.")
      throw err
    } finally {
      clearTimeout(timer)
      options?.signal?.removeEventListener("abort", onAbort)
    }
  }
}
