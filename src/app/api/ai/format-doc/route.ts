import { assertRateLimit, assertSameOrigin, errorResponse, readJson } from "@/lib/ai/guard.server"
import { generate } from "@/lib/ai/gemini.server"

export const maxDuration = 30

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    assertRateLimit(request)

    const body = (await readJson(request, 100_000)) as { text?: string; theme?: string }
    const { text, theme } = body

    if (!text || typeof text !== "string") {
      return Response.json({ error: "Missing text." }, { status: 400 })
    }

    const themeColors = theme || "blue"

    const system = `You are an expert document formatter. The user will provide some raw notes or text.
Your task is to convert this text into clean, professional, and beautifully structured HTML.
Use appropriate HTML tags like <h1>, <h2>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>.
Do NOT include <html>, <head>, or <body> tags. Just return the inner HTML content.
For styling, you MUST use inline CSS (e.g. style="color: #333; margin-bottom: 12px;"). Do NOT use Tailwind classes or external CSS, because this HTML will be exported directly to a PDF using html2pdf.
Make it look like a professional report or document. Add a title if one isn't obvious.
Use a color theme based on: ${themeColors}. Use this theme color for headings, strong tags, bullet points, or subtle backgrounds for blockquotes.
Do not wrap your response in markdown code blocks. Just output raw HTML.`

    const raw = await generate({
      system,
      prompt: `Please format this text:\n\n${text}`,
      temperature: 0.3,
      maxOutputTokens: 8192,
      signal: request.signal,
    })

    // Remove any potential markdown wrapping
    const cleanHtml = raw.replace(/^```html\s*/i, "").replace(/```\s*$/, "").trim()

    return Response.json({ html: cleanHtml })
  } catch (err) {
    return errorResponse(err)
  }
}
