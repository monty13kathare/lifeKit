/**
 * Smart local task-notes generator and parser.
 * Provides instant client-side generation and an offline fallback when Gemini is unavailable.
 */

import type { AssistOutput } from "./assist-schemas"

export type TaskNotesOutput = AssistOutput<"task-notes">

export interface GenerateOptions {
  style?: "whatsapp" | "detailed" | "meeting" | "routine" | "standard"
  detailLevel?: "standard" | "deep"
  language?: "en" | "hi" | "hinglish"
}

interface KeywordRule {
  category: string
  emoji: string
  keywords: string[]
  subtasks: (taskName: string) => string[]
  timeEst: string
  defaultPriority: "high" | "medium" | "low"
}

const RULES: KeywordRule[] = [
  {
    category: "Finance & Bills",
    emoji: "⚡",
    keywords: ["bill", "pay", "electricity", "rent", "emi", "bank", "recharge", "fee", "tax", "transfer", "salary", "invoice"],
    subtasks: () => ["Check bill amount and due date", "Complete digital payment", "Save transaction receipt / reference"],
    timeEst: "15 mins",
    defaultPriority: "high",
  },
  {
    category: "Work & Projects",
    emoji: "💼",
    keywords: ["client", "project", "deadline", "pr", "pull request", "code", "deploy", "review", "bug", "feature", "presentation", "report", "office", "task"],
    subtasks: (name) => [`Review current status of ${name}`, "Execute core deliverables and test", "Share update with stakeholders or team"],
    timeEst: "45 mins",
    defaultPriority: "high",
  },
  {
    category: "Calls & Follow-ups",
    emoji: "📞",
    keywords: ["call", "phone", "contact", "message", "discuss", "reach out", "talk to", "ping", "email", "mail"],
    subtasks: () => ["Jot down key talking points before calling", "Make the call / send message", "Note down action items and next steps"],
    timeEst: "20 mins",
    defaultPriority: "medium",
  },
  {
    category: "Shopping & Errands",
    emoji: "🛒",
    keywords: ["buy", "groceries", "milk", "vegetables", "fruits", "market", "order", "amazon", "shop", "store", "purchase", "pick up"],
    subtasks: () => ["Make a checklist of exact items needed", "Visit store or place order online", "Verify items and check expiry dates"],
    timeEst: "35 mins",
    defaultPriority: "medium",
  },
  {
    category: "Health & Fitness",
    emoji: "🏋️",
    keywords: ["gym", "workout", "leg", "chest", "cardio", "run", "doctor", "medicine", "exercise", "walk", "yoga", "stretch", "diet"],
    subtasks: () => ["Warm up for 5-10 minutes", "Complete core workout / session", "Hydrate and do post-workout cool down"],
    timeEst: "50 mins",
    defaultPriority: "medium",
  },
  {
    category: "Home & Personal",
    emoji: "🏡",
    keywords: ["clean", "room", "cook", "laundry", "wash", "fix", "repair", "pack", "car", "service", "house"],
    subtasks: () => ["Gather necessary supplies", "Complete task systematically", "Inspect and organize area"],
    timeEst: "30 mins",
    defaultPriority: "low",
  },
]

export function generateLocalTaskNotes(
  roughInput: string,
  options: GenerateOptions = {}
): TaskNotesOutput {
  const { style = "whatsapp", detailLevel = "standard" } = options

  // 1. Split rough input by commas, newlines, semicolons, or numbered list indicators
  const rawSegments = roughInput
    .split(/[,\n;\r]+/)
    .map((s) => s.replace(/^[-*•\d.)\]\s]+/, "").trim())
    .filter((s) => s.length > 1)

  const itemsToProcess = rawSegments.length > 0 ? rawSegments : ["Review daily priority goals", "Check messages and emails"]

  // 2. Classify items into categories
  const categoryMap = new Map<
    string,
    {
      emoji: string
      items: {
        task: string
        details: string
        priority: "high" | "medium" | "low"
        timeEstimate: string
        subtasks: string[]
        completed: boolean
      }[]
    }
  >()

  for (const raw of itemsToProcess) {
    const lower = raw.toLowerCase()
    let matchedRule: KeywordRule | null = null

    for (const rule of RULES) {
      if (rule.keywords.some((kw) => lower.includes(kw))) {
        matchedRule = rule
        break
      }
    }

    const catName = matchedRule ? matchedRule.category : "General Action Items"
    const catEmoji = matchedRule ? matchedRule.emoji : "📌"
    const priority = matchedRule ? matchedRule.defaultPriority : (lower.includes("urgent") || lower.includes("important") ? "high" : "medium")
    const timeEst = matchedRule ? matchedRule.timeEst : "25 mins"
    const subtasks = detailLevel === "deep" && matchedRule ? matchedRule.subtasks(raw) : [`Prepare requirements for ${raw}`, `Complete and verify ${raw}`]

    // Capitalize first letter of task
    const cleanTask = raw.charAt(0).toUpperCase() + raw.slice(1)

    if (!categoryMap.has(catName)) {
      categoryMap.set(catName, { emoji: catEmoji, items: [] })
    }

    categoryMap.get(catName)!.items.push({
      task: cleanTask,
      details: `Action step derived from rough note: "${raw}". Focus on completing without distractions.`,
      priority,
      timeEstimate: timeEst,
      subtasks,
      completed: false,
    })
  }

  const categories = Array.from(categoryMap.entries()).map(([name, data]) => ({
    name,
    emoji: data.emoji,
    items: data.items,
  }))

  const title = "Daily Action Plan & Task Notes"
  const summary = `Structured ${itemsToProcess.length} actionable tasks across ${categories.length} categories. Prioritize high-impact items first.`

  // 3. Generate WhatsApp Formatted Text (Uses native WhatsApp markdown: - for bullet list, > for quotes, *bold*, ~strikethrough~)
  let wa = `*📋 ${title.toUpperCase()}*\n`
  wa += `> _${summary}_\n\n`

  for (const cat of categories) {
    wa += `*━━━━━━━━━━━━━━━━━━━━━*\n`
    wa += `*${cat.emoji} ${cat.name.toUpperCase()}*\n`
    wa += `*━━━━━━━━━━━━━━━━━━━━━*\n\n`

    for (let i = 0; i < cat.items.length; i++) {
      const item = cat.items[i]
      const prioEmoji = item.priority === "high" ? "🔴" : item.priority === "medium" ? "🟡" : "🟢"

      // WhatsApp native list item using - ◻️ for clean visual checkbox
      wa += `- ◻️ *${item.task}*\n`
      if (item.details) wa += `  > _${item.details}_\n`
      wa += `  > ⏱️ ${item.timeEstimate} | ${prioEmoji} Priority: *${item.priority?.toUpperCase()}*\n`

      if (item.subtasks && item.subtasks.length > 0) {
        for (const sub of item.subtasks) {
          wa += `  > ▫️ ${sub}\n`
        }
      }
      wa += `\n`
    }
  }

  wa += `*💡 PRODUCTIVITY TIPS:*\n`
  wa += `- Complete all 🔴 High priority tasks early in the morning.\n`
  wa += `- Group similar errands together to save commute & mental energy.\n`
  wa += `- Keep checking off items to maintain momentum!\n`

  // 4. Generate Markdown Formatted Text
  let md = `# 📋 ${title}\n\n`
  md += `> ${summary}\n\n`

  for (const cat of categories) {
    md += `## ${cat.emoji} ${cat.name}\n\n`
    for (const item of cat.items) {
      const prioLabel = item.priority === "high" ? "🔴 High" : item.priority === "medium" ? "🟡 Medium" : "🟢 Low"
      md += `- [ ] **${item.task}** *(⏱️ ${item.timeEstimate} · Priority: ${prioLabel})*\n`
      if (item.details) {
        md += `  - ${item.details}\n`
      }
      if (item.subtasks && item.subtasks.length > 0) {
        for (const sub of item.subtasks) {
          md += `  - [ ] ${sub}\n`
        }
      }
      md += `\n`
    }
  }

  md += `### 💡 Productivity Tips\n`
  md += `- Tackle 🔴 High priority items first.\n`
  md += `- Take a 5-minute breather between deep work sessions.\n`
  md += `- Share this note on WhatsApp or save it to your LifeKit Tasks.\n`

  return {
    title,
    summary,
    categories,
    whatsappFormatted: wa,
    markdownFormatted: md,
    tips: [
      "Complete all high-priority tasks before noon to beat decision fatigue.",
      "Check off each subtask as soon as finished to build positive momentum.",
      "Group quick phone calls and messages into one focused 20-minute block.",
    ],
  }
}
