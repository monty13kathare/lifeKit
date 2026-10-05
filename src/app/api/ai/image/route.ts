import { z } from "zod"
import { generateImage } from "@/lib/ai/gemini.server"
import { assertRateLimit, assertSameOrigin, errorResponse, readJson } from "@/lib/ai/guard.server"

export const maxDuration = 60

const bodySchema = z.object({
  /** A short scene description written by the story job. */
  scene: z.string().trim().min(3).max(600),
  style: z.enum(["storybook", "cartoon", "watercolor"]).default("storybook"),
})

const STYLE: Record<z.infer<typeof bodySchema>["style"], string> = {
  storybook: "warm children's picture-book illustration, soft colours, friendly characters",
  cartoon: "bright, cheerful cartoon illustration with clean outlines",
  watercolor: "gentle watercolour illustration, soft textures",
}

/** One illustration for a Story Mode page. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    assertRateLimit(request)
    const parsed = bodySchema.safeParse(await readJson(request, 4_000))
    if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 })
    const { scene, style } = parsed.data
    const image = await generateImage({
      prompt:
        `Illustrate this scene from a family-friendly story: ${scene}\n` +
        `Style: ${STYLE[style]}. Landscape 4:3 composition. No text, letters, captions or watermarks in the image. ` +
        "Keep it wholesome and suitable for all ages.",
      signal: request.signal,
    })
    return Response.json(image)
  } catch (err) {
    return errorResponse(err)
  }
}
