import "server-only"
import { ApiError, GoogleGenAI, type PartUnion } from "@google/genai"

/**
 * Server-only access to Google Gemini. The API key is read from `GEMINI_API_KEY`
 * (set in `.env`, never prefixed with NEXT_PUBLIC_), so it stays on the server
 * and is never included in any browser bundle. Importing this file from a
 * client component fails the build thanks to `server-only`.
 */

/** Fast, low-cost model by default; override with GEMINI_MODEL in .env. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite"

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim())
}

let client: GoogleGenAI | null = null
function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!.trim() })
  return client
}

/** An error whose message is safe to show users and whose status maps to the HTTP response. */
export class AiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

interface GenerateOptions {
  system: string
  /** Plain text, or parts (e.g. an inline image plus text). */
  prompt: string | PartUnion[]
  /** JSON schema for structured output; the result is then JSON text. */
  jsonSchema?: Record<string, unknown>
  temperature?: number
  maxOutputTokens?: number
  signal?: AbortSignal
}

export async function generate({ system, prompt, jsonSchema, temperature = 0.2, maxOutputTokens = 2048, signal }: GenerateOptions): Promise<string> {
  if (!isGeminiConfigured()) {
    throw new AiError("Gemini isn't configured. Add GEMINI_API_KEY to the .env file and restart the server.", 503)
  }
  try {
    const response = await getClient().models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: system,
        temperature,
        maxOutputTokens,
        abortSignal: signal,
        ...(jsonSchema ? { responseMimeType: "application/json", responseJsonSchema: jsonSchema } : {}),
      },
    })
    const text = response.text?.trim()
    if (!text) throw new AiError("Gemini returned an empty response. Try again or shorten the text.", 502)
    return text
  } catch (err) {
    throw toAiError(err)
  }
}

function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err
  if (err instanceof ApiError) {
    // Log details server-side only; never echo provider messages (they can include request data).
    console.error(`[gemini] ${err.status}: ${err.message}`)
    if (err.status === 400 && /api key/i.test(err.message)) return new AiError("Gemini rejected the API key. Check GEMINI_API_KEY in .env.", 502)
    if (err.status === 401 || err.status === 403) return new AiError("Gemini rejected the API key. Check GEMINI_API_KEY in .env.", 502)
    if (err.status === 404) return new AiError(`The Gemini model "${GEMINI_MODEL}" isn't available for this API key. Set GEMINI_MODEL in .env.`, 502)
    if (err.status === 429) return new AiError("Gemini's rate limit or quota was reached. Please wait a moment and try again.", 429)
    if (err.status >= 500) return new AiError("Gemini is temporarily unavailable. Please try again shortly.", 502)
    return new AiError("Gemini couldn't process this request.", 502)
  }
  if ((err as Error)?.name === "AbortError") return new AiError("The request was cancelled.", 499)
  console.error("[gemini] unexpected error", err)
  return new AiError("Something went wrong while contacting Gemini.", 500)
}

/** Image model for story illustrations; override with GEMINI_IMAGE_MODEL in .env. */
export const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image"

/** Generate one image from a text prompt. Returns base64 data and its MIME type. */
export async function generateImage({ prompt, signal }: { prompt: string; signal?: AbortSignal }): Promise<{ data: string; mimeType: string }> {
  if (!isGeminiConfigured()) {
    throw new AiError("Gemini isn't configured. Add GEMINI_API_KEY to the .env file and restart the server.", 503)
  }
  try {
    const response = await getClient().models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: prompt,
      config: { responseModalities: ["IMAGE"], abortSignal: signal },
    })
    const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
    if (!part?.inlineData?.data) throw new AiError("Gemini didn't return a picture. Try again.", 502)
    return { data: part.inlineData.data, mimeType: part.inlineData.mimeType || "image/png" }
  } catch (err) {
    // Free-tier keys have zero image quota ("limit: 0"): say so instead of "try again later".
    if (err instanceof ApiError && err.status === 429 && /limit:\s*0\b/.test(err.message)) {
      throw new AiError("Real pictures need a Gemini API key with image generation enabled (a paid plan). The drawn pictures still work.", 403)
    }
    if (err instanceof ApiError && err.status === 404) {
      throw new AiError(`The image model "${GEMINI_IMAGE_MODEL}" isn't available for this API key. Set GEMINI_IMAGE_MODEL in .env.`, 502)
    }
    throw toAiError(err)
  }
}
