import { connection } from "next/server"
import { GEMINI_MODEL, isGeminiConfigured } from "@/lib/ai/gemini.server"

/** Whether Gemini is configured. Never exposes the key itself. */
export async function GET() {
  await connection() // read env at request time, not at build time
  const configured = isGeminiConfigured()
  return Response.json(
    { configured, provider: "Google Gemini", model: configured ? GEMINI_MODEL : null },
    { headers: { "Cache-Control": "no-store" } }
  )
}
