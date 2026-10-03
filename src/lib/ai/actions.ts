/** AI text actions shared by the UI menu and the /api/ai/text route. */
export const AI_TEXT_ACTIONS = [
  { id: "summarize", label: "Summarize", description: "A short summary of the key points" },
  { id: "fix", label: "Fix spelling & grammar", description: "Corrects mistakes, keeps your wording" },
  { id: "bullets", label: "Turn into bullet points", description: "Clear, scannable list" },
  { id: "simplify", label: "Simplify", description: "Plain, easy-to-read language" },
] as const

export type AiTextActionId = (typeof AI_TEXT_ACTIONS)[number]["id"]

export const AI_TEXT_ACTION_IDS = AI_TEXT_ACTIONS.map((a) => a.id) as [AiTextActionId, ...AiTextActionId[]]

/** Character limits enforced on both client and server. */
export const AI_LIMITS = { translate: 5000, text: 12000 } as const
