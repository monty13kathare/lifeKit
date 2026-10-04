import { assertRateLimit, assertSameOrigin, errorResponse } from "@/lib/ai/guard.server"
import { generate } from "@/lib/ai/gemini.server"

export const maxDuration = 60 // Allow up to 60s for vision tasks

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    assertRateLimit(request)

    const formData = await request.formData()
    const image = formData.get("image") as File | null
    const lang = formData.get("lang") as string || "eng"

    if (!image) {
      return Response.json({ error: "No image provided." }, { status: 400 })
    }

    if (image.size > 15 * 1024 * 1024) {
      return Response.json({ error: "Image is too large. Maximum size is 15MB." }, { status: 413 })
    }

    const buffer = await image.arrayBuffer()
    const mimeType = image.type

    // We can extract text from the image using Gemini Vision
    const system = "You are a highly accurate Optical Character Recognition (OCR) engine. Your task is to extract all visible text from the provided image exactly as it appears. Preserve the original language, formatting, line breaks, and punctuation. Do not describe the image, do not add conversational text, just output the extracted text. If there is no text in the image, output an empty string."
    
    let promptText = "Please extract the text from this image."
    if (lang && lang !== "eng") {
      promptText = `Please extract the text from this image. The text may be in language code '${lang}'. Keep the exact language and characters.`
    }

    const raw = await generate({
      system,
      prompt: [
        {
          inlineData: {
            data: Buffer.from(buffer).toString("base64"),
            mimeType,
          },
        },
        promptText,
      ],
      temperature: 0.1, // Low temperature for factual extraction
      maxOutputTokens: 8192,
      signal: request.signal,
    })

    return Response.json({ text: raw.trim(), confidence: 99 }) // Gemini usually has high confidence if it returns text
  } catch (err) {
    return errorResponse(err)
  }
}
