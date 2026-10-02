import type { TranslationService } from "../translation-service"
import { DemoDictionaryTranslationService } from "./demo-dictionary"
import { HttpTranslationService } from "./http-provider"

let instance: TranslationService | null = null

/**
 * The active translation provider: the HTTP proxy when
 * `NEXT_PUBLIC_TRANSLATION_ENDPOINT` is set (it holds the real API key
 * server-side), otherwise the local demo dictionary.
 */
export function getTranslationService(): TranslationService {
  if (instance) return instance
  // Referenced literally so Next.js inlines it at build time.
  const http = new HttpTranslationService(process.env.NEXT_PUBLIC_TRANSLATION_ENDPOINT)
  instance = http.isConfigured ? http : new DemoDictionaryTranslationService()
  return instance
}

export { DemoDictionaryTranslationService, translateWithDictionary, DEMO_LANGUAGES } from "./demo-dictionary"
export type { DemoTranslationResult, TranslationSegment } from "./demo-dictionary"
export { HttpTranslationService } from "./http-provider"
