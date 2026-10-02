/**
 * Minimal Web Speech API (recognition) typings. TypeScript's DOM lib doesn't
 * ship these, and Chrome/Safari still expose the constructor as
 * `webkitSpeechRecognition`.
 */

export interface SpeechRecognitionAlternativeLike {
  readonly transcript: string
  readonly confidence: number
}

export interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: SpeechRecognitionAlternativeLike
}

export interface SpeechRecognitionResultListLike {
  readonly length: number
  [index: number]: SpeechRecognitionResultLike
}

export interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultListLike
}

export type SpeechRecognitionErrorCode =
  | "no-speech"
  | "aborted"
  | "audio-capture"
  | "network"
  | "not-allowed"
  | "service-not-allowed"
  | "bad-grammar"
  | "language-not-supported"

export interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: SpeechRecognitionErrorCode | string
  readonly message?: string
}

export interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: ((ev: Event) => void) | null
  onend: ((ev: Event) => void) | null
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null
  start(): void
  stop(): void
  abort(): void
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike

export function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Human-readable message for a recognition error, and whether it ends the session. */
export function describeRecognitionError(code: string): { message: string; fatal: boolean } {
  switch (code) {
    case "not-allowed":
      return {
        message:
          "Microphone access was blocked. Allow the microphone for this site (use the icon in the address bar or your browser's site settings), then try again.",
        fatal: true,
      }
    case "service-not-allowed":
      return {
        message:
          "Your browser refused to start its speech service. It may be disabled in settings, or unavailable in private browsing.",
        fatal: true,
      }
    case "audio-capture":
      return {
        message: "No microphone was found, or another app is using it. Connect a microphone or close other apps and try again.",
        fatal: true,
      }
    case "network":
      return {
        message:
          "The speech service couldn't be reached. This browser needs an internet connection for speech recognition — check your connection and try again.",
        fatal: true,
      }
    case "language-not-supported":
      return { message: "This language isn't supported by your browser's speech service. Pick another language.", fatal: true }
    case "no-speech":
      return { message: "No speech detected yet — still listening. Speak a little louder or closer to the microphone.", fatal: false }
    case "aborted":
      return { message: "", fatal: false }
    default:
      return { message: `Speech recognition stopped unexpectedly (${code}).`, fatal: true }
  }
}

export const RECOGNITION_LANGUAGES = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-IN", label: "English (India)" },
  { value: "hi-IN", label: "हिन्दी — Hindi" },
  { value: "bn-IN", label: "বাংলা — Bengali" },
  { value: "ta-IN", label: "தமிழ் — Tamil" },
  { value: "te-IN", label: "తెలుగు — Telugu" },
  { value: "mr-IN", label: "मराठी — Marathi" },
  { value: "gu-IN", label: "ગુજરાતી — Gujarati" },
  { value: "kn-IN", label: "ಕನ್ನಡ — Kannada" },
  { value: "ml-IN", label: "മലയാളം — Malayalam" },
  { value: "es-ES", label: "Español — Spanish (Spain)" },
  { value: "es-MX", label: "Español — Spanish (Mexico)" },
  { value: "fr-FR", label: "Français — French" },
  { value: "de-DE", label: "Deutsch — German" },
  { value: "it-IT", label: "Italiano — Italian" },
  { value: "pt-BR", label: "Português — Portuguese (Brazil)" },
  { value: "ru-RU", label: "Русский — Russian" },
  { value: "ja-JP", label: "日本語 — Japanese" },
  { value: "ko-KR", label: "한국어 — Korean" },
  { value: "zh-CN", label: "中文 — Chinese (Mandarin)" },
  { value: "ar-SA", label: "العربية — Arabic" },
  { value: "tr-TR", label: "Türkçe — Turkish" },
  { value: "id-ID", label: "Bahasa Indonesia — Indonesian" },
] as const
