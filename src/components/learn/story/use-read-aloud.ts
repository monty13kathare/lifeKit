"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import type { AiLanguage } from "@/types"

const subscribeVoices = (cb: () => void) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return () => {}
  window.speechSynthesis.addEventListener("voiceschanged", cb)
  return () => window.speechSynthesis.removeEventListener("voiceschanged", cb)
}
const getVoiceCount = () => (typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis.getVoices().length : 0)

function pickVoice(lang: AiLanguage): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  const want = lang === "hi" ? ["hi-IN", "hi"] : ["en-IN", "en-GB", "en-US", "en"]
  for (const w of want) {
    const v = voices.find((x) => x.lang.toLowerCase().replace("_", "-").startsWith(w.toLowerCase()))
    if (v) return v
  }
  return undefined
}

/**
 * Read text aloud with the browser's built-in voices (works offline on most
 * phones). `onWord` gets the character index of the word being spoken, when
 * the voice reports it.
 */
export function useReadAloud(lang: AiLanguage) {
  const supported = useSyncExternalStore(
    () => () => {},
    () => "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,
    () => false
  )
  // Re-render when voices load so `hasVoice` is accurate.
  const voiceCount = useSyncExternalStore(subscribeVoices, getVoiceCount, () => 0)
  const [speaking, setSpeaking] = useState(false)
  const tokenRef = useRef(0)

  const stop = useCallback(() => {
    tokenRef.current++
    if (supported) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  const speak = useCallback(
    (text: string, { onWord, onEnd, rate = 0.95 }: { onWord?: (charIndex: number) => void; onEnd?: () => void; rate?: number } = {}) => {
      if (!supported) return
      window.speechSynthesis.cancel()
      const token = ++tokenRef.current
      const u = new SpeechSynthesisUtterance(text)
      u.lang = lang === "hi" ? "hi-IN" : "en-IN"
      const voice = pickVoice(lang)
      if (voice) u.voice = voice
      u.rate = rate
      u.onboundary = (e) => {
        if (token === tokenRef.current && e.name !== "sentence") onWord?.(e.charIndex)
      }
      u.onend = () => {
        if (token !== tokenRef.current) return
        setSpeaking(false)
        onEnd?.()
      }
      u.onerror = () => {
        if (token === tokenRef.current) setSpeaking(false)
      }
      setSpeaking(true)
      window.speechSynthesis.speak(u)
    },
    [lang, supported]
  )

  // Stop talking when leaving the page.
  useEffect(() => () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel()
  }, [])

  const hasVoice = supported && voiceCount > 0 && !!pickVoice(lang)
  return { supported, hasVoice, speaking, speak, stop }
}
