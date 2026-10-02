export interface TranslationRequest {
  text: string
  /** BCP-47 code, or "auto" where the provider supports detection. */
  from: string
  to: string
}

export interface TranslationResult {
  text: string
  /** True when the output is a word-by-word demo lookup, not a real translation. */
  isDemo: boolean
  /** Words the provider could not translate (demo mode). */
  untranslated?: string[]
  detectedLanguage?: string
}

/**
 * Pluggable translation provider. The app ships with a local demo dictionary;
 * a real provider must be proxied through a backend so API keys never reach
 * the browser.
 */
export interface TranslationService {
  readonly id: string
  readonly name: string
  /** False when the provider needs configuration (e.g. a backend endpoint) it doesn't have. */
  readonly isConfigured: boolean
  readonly isDemo: boolean
  supportedLanguages(): { code: string; name: string }[]
  translate(req: TranslationRequest, options?: { signal?: AbortSignal }): Promise<TranslationResult>
}
