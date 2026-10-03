/**
 * Built-in content for the AI Prompting track: lessons, Prompt Lab scenarios,
 * quiz questions and reusable prompt templates. Plain data — rendered as React
 * text (never injected as HTML).
 */

export interface CheckQuestion {
  question: string
  options: string[]
  /** Index into `options`. */
  answer: number
  explanation: string
}

export interface PromptLesson {
  /** Globally unique (completed lessons are shared across tracks). */
  id: string
  title: string
  summary: string
  minutes: number
  sections: { heading: string; body: string; bullets?: string[] }[]
  bad: { prompt: string; why: string }
  good: { prompt: string; why: string }
  checks: [CheckQuestion, CheckQuestion]
}

export type Difficulty = "easy" | "medium" | "hard"

export interface PromptScenario {
  id: string
  title: string
  situation: string
  goal: string
  difficulty: Difficulty
  category: string
}

export interface QuizQuestion extends CheckQuestion {
  id: string
}

export type TemplateGroup = "Study" | "Work" | "Writing" | "Coding" | "Planning"

export interface PromptTemplate {
  id: string
  title: string
  group: TemplateGroup
  description: string
  /** Text with `{placeholder}` slots. */
  template: string
}

/* ------------------------------------------------------------------ lessons */

export const PROMPT_LESSONS: PromptLesson[] = [
  {
    id: "prompting:clear-specific",
    title: "Be clear and specific",
    summary: "Vague prompts get vague answers. Say exactly what you want.",
    minutes: 3,
    sections: [
      {
        heading: "Why specificity matters",
        body: "An AI model can't read your mind. When a prompt is vague, the model fills the gaps with the most generic, average answer. The more precisely you describe the task, the less it has to guess.",
      },
      {
        heading: "Name the task with a strong verb",
        body: "Start with what you want done: summarise, compare, rewrite, list, explain, draft, classify. \"Tell me about\" is weak; \"Compare X and Y on cost and speed\" is strong.",
      },
      {
        heading: "Answer the 5 W's",
        body: "Before sending, check whether your prompt covers:",
        bullets: ["What exactly should be produced?", "Who is it for?", "Why do you need it (the purpose)?", "How long or detailed should it be?", "What should it focus on or skip?"],
      },
      {
        heading: "Quantify when you can",
        body: "Numbers remove ambiguity: \"5 ideas\", \"under 120 words\", \"for a 30-minute class\". They turn a fuzzy wish into a target the model can hit.",
      },
    ],
    bad: { prompt: "Write something about healthy eating.", why: "No audience, length, format or angle — you'll get a generic essay." },
    good: {
      prompt: "Write 5 practical healthy-eating tips for busy college students who cook in a hostel. Each tip: one bold line plus one sentence of explanation. Keep the whole answer under 150 words.",
      why: "Clear task, audience, count, format and length.",
    },
    checks: [
      {
        question: "Which prompt is the most specific?",
        options: ["Tell me about dogs.", "Write about dog training.", "List 3 beginner tips for house-training a 10-week-old puppy, one sentence each."],
        answer: 2,
        explanation: "It names the task (list), count (3), audience/subject (10-week-old puppy) and length (one sentence each).",
      },
      {
        question: "Adding \"under 100 words\" to a prompt mainly helps by…",
        options: ["Making the model smarter", "Giving a measurable length target", "Making the answer more creative"],
        answer: 1,
        explanation: "Numbers remove guesswork about how long or detailed the answer should be.",
      },
    ],
  },
  {
    id: "prompting:give-context",
    title: "Give context",
    summary: "Background information turns a generic answer into a useful one.",
    minutes: 3,
    sections: [
      {
        heading: "The model only knows what you tell it",
        body: "It doesn't know your job, your level, your deadline or what you tried already. Context is everything the model needs to tailor the answer to your situation.",
      },
      {
        heading: "Useful context to include",
        body: "Pick what matters for the task:",
        bullets: ["Who you are and who the audience is", "What you're trying to achieve", "Relevant facts, numbers or constraints", "What you already tried and why it didn't work"],
      },
      {
        heading: "Paste the source material",
        body: "If you want something summarised, fixed or answered from a document, include the text itself (or the relevant part). Clearly separate it, e.g. with triple quotes or a heading like \"Text:\".",
      },
      {
        heading: "Don't overdo it",
        body: "Context should be relevant. Long, unrelated background can distract the model. Ask yourself: would a human expert need this detail to do the job well?",
      },
    ],
    bad: { prompt: "How do I fix my resume?", why: "The model doesn't know your field, experience, target job or what's wrong." },
    good: {
      prompt: "I'm a final-year B.Com student applying for entry-level financial analyst roles. My resume (below) lists coursework but no measurable results. Suggest 5 specific edits to make it stronger for this role.\n\nResume:\n\"\"\"\n[paste resume]\n\"\"\"",
      why: "States who you are, the goal, the problem, and includes the material clearly separated.",
    },
    checks: [
      {
        question: "Which is the best way to give a model a document to summarise?",
        options: ["Describe it from memory", "Paste the text, clearly separated with quotes or a label", "Just give the file name"],
        answer: 1,
        explanation: "The model can only use text it sees. Delimiters make it clear where the source starts and ends.",
      },
      {
        question: "Which detail is LEAST useful context for \"suggest a birthday gift for my dad\"?",
        options: ["He loves gardening", "Budget is ₹2,000", "The weather in Paris today"],
        answer: 2,
        explanation: "Relevant context helps; unrelated details just add noise.",
      },
    ],
  },
  {
    id: "prompting:assign-role",
    title: "Assign a role",
    summary: "Tell the model who to be, so it uses the right expertise and tone.",
    minutes: 3,
    sections: [
      {
        heading: "Roles set expertise and voice",
        body: "Starting with \"You are an experienced…\" nudges the model toward the vocabulary, priorities and tone of that role. A tax accountant and a kindergarten teacher explain things very differently.",
      },
      {
        heading: "Make the role concrete",
        body: "\"You are an expert\" is weak. \"You are a patient maths tutor who teaches 12-year-olds using everyday examples\" tells the model the field, the audience and the style.",
      },
      {
        heading: "Pair the role with an audience",
        body: "The role says who is speaking; the audience says who is listening. Both matter: \"You are a cardiologist explaining to a worried patient with no medical background.\"",
      },
      {
        heading: "A role is not a fact-checker",
        body: "Saying \"you are a lawyer\" doesn't make the answer legally reliable. Roles shape style and focus — always verify important facts.",
      },
    ],
    bad: { prompt: "Explain inflation.", why: "No perspective or audience, so the level and tone are a guess." },
    good: {
      prompt: "You are a friendly economics teacher. Explain inflation to a 15-year-old using an example about the price of samosas over 10 years. Keep it under 120 words.",
      why: "Concrete role, clear audience, a relatable example and a length limit.",
    },
    checks: [
      {
        question: "Which role instruction is most useful?",
        options: ["You are smart.", "You are an expert.", "You are a senior UX designer reviewing a mobile checkout screen for accessibility issues."],
        answer: 2,
        explanation: "It gives a specific field, seniority and focus.",
      },
      {
        question: "Assigning the role \"You are a doctor\" means…",
        options: ["The answer is medically guaranteed", "The model adopts a medical style and focus, but facts still need checking", "The model can access medical records"],
        answer: 1,
        explanation: "Roles shape style and focus — they don't add knowledge or guarantee accuracy.",
      },
    ],
  },
  {
    id: "prompting:output-format",
    title: "Specify the output format",
    summary: "Tables, bullets, JSON, steps — say how you want the answer shaped.",
    minutes: 3,
    sections: [
      {
        heading: "Format makes answers usable",
        body: "The same information is far more useful as a comparison table, a checklist or a JSON object, depending on what you'll do with it next.",
      },
      {
        heading: "Common formats to ask for",
        body: "Be explicit:",
        bullets: ["Bullet list or numbered steps", "Table with named columns", "JSON with specific keys", "Email with subject line", "Headings with short paragraphs"],
      },
      {
        heading: "Describe the structure precisely",
        body: "\"A table\" is good; \"a table with columns Day, Activity, Cost (₹)\" is better. For JSON, list the exact keys and value types.",
      },
      {
        heading: "Control length and tone too",
        body: "Format includes length (\"max 3 bullets\"), reading level (\"simple English\") and tone (\"formal\", \"friendly\"). These are cheap to add and save rewriting later.",
      },
    ],
    bad: { prompt: "Compare iPhone and Android.", why: "You'll get long paragraphs that are hard to scan." },
    good: {
      prompt: "Compare iPhone and Android for a first-time smartphone buyer in India. Use a table with columns: Factor, iPhone, Android. Cover price, app choice, updates, repairs and resale value. End with a one-sentence recommendation.",
      why: "Exact columns, rows to cover, audience and a closing instruction.",
    },
    checks: [
      {
        question: "You want to paste the result into code. Which format is best to request?",
        options: ["A friendly paragraph", "JSON with named keys", "A poem"],
        answer: 1,
        explanation: "JSON with defined keys is machine-readable and predictable.",
      },
      {
        question: "Which format instruction is most precise?",
        options: ["Make it nice.", "Use a table.", "Use a table with columns Task, Owner, Deadline."],
        answer: 2,
        explanation: "Naming the columns removes guesswork.",
      },
    ],
  },
  {
    id: "prompting:few-shot",
    title: "Show examples (few-shot)",
    summary: "One or two examples teach the model your style faster than a paragraph of rules.",
    minutes: 4,
    sections: [
      {
        heading: "Show, don't just tell",
        body: "Describing a style (\"short, punchy, playful\") is open to interpretation. Showing an example pins it down. This is called few-shot prompting.",
      },
      {
        heading: "How to structure examples",
        body: "Use a consistent pattern, then leave the last slot for the model:",
        bullets: ["Input: … → Output: …", "Input: … → Output: …", "Input: [your new case] → Output:"],
      },
      {
        heading: "Pick varied, high-quality examples",
        body: "The model copies what you show — including mistakes. Use 2–3 examples that differ in content but share the format and quality you want.",
      },
      {
        heading: "Watch for over-copying",
        body: "If your examples all mention the same topic or length, the model may copy that too. Say \"Follow the style, not the content\" if needed.",
      },
    ],
    bad: { prompt: "Write product taglines in my brand voice.", why: "The model has never seen your brand voice." },
    good: {
      prompt: "Write a tagline for each product in the same style as the examples.\n\nProduct: Ginger tea → Tagline: Warm hugs, one sip at a time.\nProduct: Wool socks → Tagline: Cosy toes, happy soul.\n\nProduct: Lavender candle → Tagline:\nProduct: Honey soap → Tagline:",
      why: "Two clear examples set the length, rhythm and tone; the pattern shows where answers go.",
    },
    checks: [
      {
        question: "What is \"few-shot\" prompting?",
        options: ["Sending the prompt a few times", "Including a few examples of input and desired output", "Using very short prompts"],
        answer: 1,
        explanation: "Few-shot means giving a small number of worked examples in the prompt.",
      },
      {
        question: "Your examples contain a spelling mistake. What's likely?",
        options: ["The model will fix it automatically", "The model may copy the mistake", "Examples are ignored"],
        answer: 1,
        explanation: "Models imitate examples closely — quality in, quality out.",
      },
    ],
  },
  {
    id: "prompting:constraints",
    title: "Add constraints",
    summary: "Limits on length, budget, tone and what to avoid keep answers on target.",
    minutes: 3,
    sections: [
      {
        heading: "Constraints are guardrails",
        body: "Without limits, the model chooses its own length, style and scope. Constraints tell it where the edges are.",
      },
      {
        heading: "Useful kinds of constraints",
        body: "Mix and match:",
        bullets: ["Length: word count, number of items", "Budget, time or resources", "Tone and reading level", "Must include / must avoid", "Scope: only use the text provided"],
      },
      {
        heading: "Say what to do, not only what not to do",
        body: "\"Don't be too technical\" is weaker than \"Use everyday words a 12-year-old knows.\" Positive instructions are easier to follow.",
      },
      {
        heading: "Keep constraints consistent",
        body: "\"Very detailed\" and \"under 50 words\" conflict. If constraints clash, the model has to pick one — usually not the one you wanted.",
      },
    ],
    bad: { prompt: "Plan a dinner party.", why: "No guest count, budget, diet or time — the plan won't fit your life." },
    good: {
      prompt: "Plan a vegetarian dinner for 6 friends on a ₹3,000 budget. I have 2 hours to cook and one stove. No mushrooms (allergy). Give a menu, shopping list with prices, and a cooking timeline.",
      why: "Constraints on diet, guests, budget, time, equipment and allergies make the plan realistic.",
    },
    checks: [
      {
        question: "Which instruction is easier for a model to follow?",
        options: ["Don't be boring.", "Open with a surprising fact and keep sentences under 15 words."],
        answer: 1,
        explanation: "Positive, concrete instructions beat vague negatives.",
      },
      {
        question: "\"Write a very detailed guide in under 40 words\" has what problem?",
        options: ["Conflicting constraints", "Too few constraints", "No problem"],
        answer: 0,
        explanation: "Detailed and very short pull in opposite directions.",
      },
    ],
  },
  {
    id: "prompting:break-steps",
    title: "Break big tasks into steps",
    summary: "Split complex work into smaller prompts or numbered steps.",
    minutes: 4,
    sections: [
      {
        heading: "Big asks produce shallow answers",
        body: "\"Write my whole business plan\" asks for too much at once. Each part gets a little attention and none gets enough.",
      },
      {
        heading: "Chain prompts",
        body: "Do the work in stages, reviewing each one:",
        bullets: ["1. Outline the sections", "2. Draft one section at a time", "3. Review and tighten", "4. Combine and format"],
      },
      {
        heading: "Or number the steps in one prompt",
        body: "For medium tasks, list the steps explicitly: \"First list the key facts. Then group them by theme. Finally write a 3-sentence summary of each theme.\"",
      },
      {
        heading: "You stay in control",
        body: "Stepwise work lets you catch mistakes early and steer the direction before the model builds on a wrong assumption.",
      },
    ],
    bad: { prompt: "Create a complete marketing strategy for my bakery.", why: "Too broad for one answer — it will be generic and shallow." },
    good: {
      prompt: "I run a small home bakery in Pune. Step 1: Ask me up to 5 questions about my customers, products and budget. Wait for my answers. Step 2: Then propose 3 marketing channels with reasons. We'll plan each channel in detail afterwards.",
      why: "Breaks the work into stages and lets the model gather context first.",
    },
    checks: [
      {
        question: "What's the main benefit of chaining prompts?",
        options: ["It uses fewer words", "Each part gets focused attention and you can correct course between steps", "It hides your goal from the model"],
        answer: 1,
        explanation: "Smaller steps mean deeper answers and earlier error-catching.",
      },
      {
        question: "Asking the model to \"ask me questions first\" is useful because…",
        options: ["It wastes time", "It gathers missing context before answering", "Models can't answer otherwise"],
        answer: 1,
        explanation: "It lets the model fill gaps in your context before producing a result.",
      },
    ],
  },
  {
    id: "prompting:reasoning",
    title: "Ask for reasoning and verification",
    summary: "Have the model think step by step and check its own work.",
    minutes: 4,
    sections: [
      {
        heading: "Thinking out loud improves accuracy",
        body: "For maths, logic and multi-step decisions, asking the model to \"work through it step by step\" often leads to better answers than asking for the result alone.",
      },
      {
        heading: "Ask it to show its work",
        body: "When you can see the steps, you can spot where the reasoning went wrong — much easier than judging a bare final answer.",
      },
      {
        heading: "Build in a self-check",
        body: "Add a verification step:",
        bullets: ["\"Then double-check each calculation.\"", "\"List any assumptions you made.\"", "\"Rate your confidence and say what could be wrong.\""],
      },
      {
        heading: "Verification is still on you",
        body: "A model can confidently check its own wrong answer. For anything important, verify key numbers and facts yourself.",
      },
    ],
    bad: { prompt: "Is it cheaper to buy or rent a ₹40 lakh flat?", why: "Asks for a verdict with no reasoning, assumptions or numbers to check." },
    good: {
      prompt: "Help me decide whether to buy or rent a ₹40 lakh flat. Rent is ₹15,000/month; loan interest is 8.5% for 20 years with 20% down payment. Work through the 10-year cost of each option step by step, list your assumptions, then double-check the maths before giving a recommendation.",
      why: "Gives the numbers, asks for step-by-step reasoning, assumptions and a self-check.",
    },
    checks: [
      {
        question: "For a tricky maths word problem, which addition helps most?",
        options: ["\"Be quick.\"", "\"Work through it step by step, then check your answer.\"", "\"Use emojis.\""],
        answer: 1,
        explanation: "Step-by-step reasoning plus a check improves accuracy and makes errors visible.",
      },
      {
        question: "Why ask the model to list its assumptions?",
        options: ["So you can see and correct hidden guesses", "To make the answer longer", "Models need it to run"],
        answer: 0,
        explanation: "Assumptions are often where answers go wrong — surfacing them lets you fix them.",
      },
    ],
  },
  {
    id: "prompting:iterate",
    title: "Iterate and refine",
    summary: "Your first prompt is a draft. Improve it based on what comes back.",
    minutes: 3,
    sections: [
      {
        heading: "Prompting is a conversation",
        body: "Even experts rarely get a perfect answer on the first try. Treat the first response as feedback on your prompt.",
      },
      {
        heading: "Diagnose what's off",
        body: "Is the answer too long, too generic, wrong tone, missing something? Name the problem precisely, then add the instruction that fixes it.",
      },
      {
        heading: "Useful follow-ups",
        body: "Try targeted refinements:",
        bullets: ["\"Make it half as long.\"", "\"More formal — this is for my manager.\"", "\"Replace the generic examples with ones from Indian cities.\"", "\"Keep points 1 and 3, rewrite point 2.\""],
      },
      {
        heading: "Save what works",
        body: "When you land on a great prompt, save it as a template with placeholders. Next time you start from a proven prompt instead of from scratch.",
      },
    ],
    bad: { prompt: "That's not good, try again.", why: "The model doesn't know what was wrong, so it just guesses differently." },
    good: {
      prompt: "Good structure, but it's too formal and too long for an Instagram caption. Rewrite it in a friendly tone, under 40 words, with one emoji and a question at the end to encourage comments.",
      why: "Keeps what worked and names exactly what to change.",
    },
    checks: [
      {
        question: "The answer is too technical. Which follow-up is best?",
        options: ["\"Try again.\"", "\"Rewrite using everyday words for someone with no tech background, max 5 sentences.\"", "\"Wrong.\""],
        answer: 1,
        explanation: "Specific feedback tells the model exactly what to fix.",
      },
      {
        question: "Why save successful prompts as templates?",
        options: ["To reuse proven structure next time", "Models remember them forever", "It's required"],
        answer: 0,
        explanation: "Templates let you start from something that already works.",
      },
    ],
  },
  {
    id: "prompting:ambiguity-hallucination",
    title: "Avoid ambiguity, bias and hallucinations",
    summary: "Ask neutral questions, ground answers in sources, and verify facts.",
    minutes: 4,
    sections: [
      {
        heading: "Ambiguous words cause wrong answers",
        body: "\"Recent\", \"short\", \"cheap\" and pronouns like \"it\" mean different things to different people. Replace them with specifics: \"since 2024\", \"under 100 words\", \"under ₹500\".",
      },
      {
        heading: "Leading questions get biased answers",
        body: "\"Why is remote work bad?\" invites a one-sided answer. Ask neutrally: \"What are the main pros and cons of remote work, with evidence for each?\"",
      },
      {
        heading: "Models can hallucinate",
        body: "AI models sometimes invent facts, quotes, statistics or references that sound real. Reduce the risk:",
        bullets: ["Provide the source text and say \"answer only from this text\"", "Allow \"I don't know\" as an answer", "Ask it to flag uncertain claims", "Verify names, numbers, dates and links yourself"],
      },
      {
        heading: "Protect private information",
        body: "Don't paste passwords, ID numbers or other people's private data into prompts. Replace them with placeholders.",
      },
    ],
    bad: { prompt: "Give me 5 studies proving coffee is bad for you, with links.", why: "Leading, and asking for links invites invented references." },
    good: {
      prompt: "Summarise what research generally says about coffee and health — both benefits and risks. Don't invent specific studies or links. If evidence is mixed or uncertain, say so clearly. I'll look up sources myself.",
      why: "Neutral framing, explicitly discourages fabrication and allows uncertainty.",
    },
    checks: [
      {
        question: "Which question is the most neutral?",
        options: ["Why are electric cars a scam?", "What are the main advantages and disadvantages of electric cars?", "Why are electric cars the best?"],
        answer: 1,
        explanation: "Neutral wording asks for a balanced answer rather than confirming a view.",
      },
      {
        question: "A model gives you a statistic with a source. What should you do?",
        options: ["Trust it — it cited a source", "Verify the source and number yourself before relying on it", "Ask it to repeat the number"],
        answer: 1,
        explanation: "Models can invent convincing sources. Always verify important facts.",
      },
    ],
  },
]

/* ---------------------------------------------------------------- scenarios */

export const PROMPT_SCENARIOS: PromptScenario[] = [
  {
    id: "goa-trip",
    title: "Plan a 3-day Goa trip on a ₹15,000 budget",
    situation: "You and a friend want a relaxed 3-day trip to Goa in December, travelling from Mumbai. You both prefer beaches and local food over parties.",
    goal: "Get a day-by-day itinerary with estimated costs that stays within ₹15,000 per person.",
    difficulty: "medium",
    category: "Planning",
  },
  {
    id: "recursion-kid",
    title: "Explain recursion to a 12-year-old",
    situation: "Your younger cousin is learning to code in Scratch and keeps asking what recursion means.",
    goal: "Get a simple, accurate explanation with an everyday analogy and a tiny example.",
    difficulty: "easy",
    category: "Study",
  },
  {
    id: "candle-description",
    title: "Write a product description for handmade candles",
    situation: "You sell soy-wax candles (lavender, sandalwood, mogra) on Instagram and a small website. Each costs ₹450 and burns for 30 hours.",
    goal: "Get a warm, persuasive product description that fits an online shop listing.",
    difficulty: "easy",
    category: "Writing",
  },
  {
    id: "meeting-actions",
    title: "Summarise a meeting into action items",
    situation: "You have rough notes from a 45-minute team meeting about launching a new app feature. Several people agreed to do things by different dates.",
    goal: "Turn the notes into a clear list of action items with owners and deadlines.",
    difficulty: "medium",
    category: "Work",
  },
  {
    id: "photosynthesis-notes",
    title: "Get study notes for photosynthesis",
    situation: "You're a Class 10 student with a biology test in 3 days. The textbook chapter feels long and confusing.",
    goal: "Get concise revision notes with key terms, the equation and likely exam questions.",
    difficulty: "easy",
    category: "Study",
  },
  {
    id: "rent-negotiation",
    title: "Draft a polite rent-increase negotiation",
    situation: "Your landlord wants to raise rent by 15%. You've been a reliable tenant for 3 years, always paid on time, and similar flats nearby cost about 8% more.",
    goal: "Get a polite, firm message proposing a smaller increase.",
    difficulty: "medium",
    category: "Writing",
  },
  {
    id: "beginner-workout",
    title: "Create a weekly workout for a beginner",
    situation: "You're 28, mostly sit at a desk, have no gym membership and can spare 30 minutes, 4 days a week. You have a mild knee issue.",
    goal: "Get a safe, home-based weekly plan with clear exercises and progressions.",
    difficulty: "medium",
    category: "Planning",
  },
  {
    id: "cover-letter",
    title: "Tailor a cover letter to a job post",
    situation: "You're applying for a junior data analyst role. You know Excel, SQL basics and have done one internship analysing sales data.",
    goal: "Get a short cover letter tailored to the role that highlights relevant experience.",
    difficulty: "medium",
    category: "Work",
  },
  {
    id: "budget-plan",
    title: "Make a monthly budget on a ₹35,000 salary",
    situation: "You just started your first job in Bengaluru, earning ₹35,000/month after tax. Rent is ₹12,000 and you want to start saving.",
    goal: "Get a realistic monthly budget split into categories with a savings target.",
    difficulty: "easy",
    category: "Planning",
  },
  {
    id: "bug-explain",
    title: "Debug a JavaScript error",
    situation: "Your web page shows \"TypeError: Cannot read properties of undefined (reading 'map')\" when loading a list of products from an API.",
    goal: "Understand the likely causes and get a fixed version of the code with an explanation.",
    difficulty: "hard",
    category: "Coding",
  },
  {
    id: "complaint-email",
    title: "Write a complaint email about a late refund",
    situation: "An online store promised a refund of ₹2,499 within 7 days. It has been 21 days and two support chats went nowhere.",
    goal: "Get a firm, professional email that gets the refund processed.",
    difficulty: "easy",
    category: "Writing",
  },
  {
    id: "interview-prep",
    title: "Prepare for a job interview",
    situation: "You have an interview for a customer-support team-lead role next week. You've worked in support for 2 years but never led a team.",
    goal: "Get likely interview questions with strong sample answers and tips.",
    difficulty: "medium",
    category: "Work",
  },
  {
    id: "birthday-party",
    title: "Plan a kid's birthday party at home",
    situation: "Your daughter turns 7 next month. 12 kids are coming, the party is at home on a Sunday afternoon, and the budget is ₹8,000.",
    goal: "Get a party plan with theme, games, food, schedule and a shopping list.",
    difficulty: "medium",
    category: "Planning",
  },
  {
    id: "sql-query",
    title: "Write an SQL query for monthly sales",
    situation: "You have a table orders(id, customer_id, amount, created_at) in PostgreSQL and need total sales per month for 2025.",
    goal: "Get a correct SQL query with a short explanation of how it works.",
    difficulty: "hard",
    category: "Coding",
  },
  {
    id: "essay-feedback",
    title: "Get feedback on an essay",
    situation: "You wrote a 600-word college application essay about moving cities as a teenager. You think it's too generic.",
    goal: "Get specific, honest feedback on structure, voice and impact — not a rewrite.",
    difficulty: "hard",
    category: "Writing",
  },
  {
    id: "news-summary",
    title: "Summarise a long article for a busy friend",
    situation: "You read a 2,000-word article about new electric-vehicle subsidies and want to share the key points with a friend who is thinking of buying an EV.",
    goal: "Get a short, neutral summary focused on what matters to a buyer.",
    difficulty: "easy",
    category: "Study",
  },
  {
    id: "social-calendar",
    title: "Create a month of social posts for a café",
    situation: "You manage Instagram for a small café that serves filter coffee and South Indian breakfast. You post 3 times a week.",
    goal: "Get a content calendar with post ideas, captions and hashtags.",
    difficulty: "hard",
    category: "Work",
  },
  {
    id: "language-plan",
    title: "Make a plan to learn basic Spanish",
    situation: "You're travelling to Spain in 3 months and can study 20 minutes a day. You know zero Spanish.",
    goal: "Get a week-by-week learning plan with free resources and milestones.",
    difficulty: "medium",
    category: "Study",
  },
]

/* --------------------------------------------------------------------- quiz */

export const PROMPT_QUIZ: QuizQuestion[] = [
  { id: "q1", question: "Which prompt is most likely to get a useful answer?", options: ["Write about exercise.", "Tell me fitness stuff.", "List 5 10-minute home exercises for office workers with back pain, with one safety tip each.", "Exercise?"], answer: 2, explanation: "It names the task, count, audience, time limit and extra detail to include." },
  { id: "q2", question: "What does assigning a role (e.g. \"You are a career coach\") mainly do?", options: ["Guarantees correct facts", "Shapes the expertise, focus and tone of the answer", "Gives the model internet access", "Makes the answer shorter"], answer: 1, explanation: "Roles steer style and perspective; they don't add knowledge or guarantee accuracy." },
  { id: "q3", question: "\"Few-shot\" prompting means…", options: ["Using few words", "Including a few input/output examples", "Asking a few questions at once", "Retrying a few times"], answer: 1, explanation: "Examples show the model exactly the pattern and style you want." },
  { id: "q4", question: "You need output you can paste straight into code. What should you ask for?", options: ["A detailed essay", "JSON with specific keys", "A story", "Bullet points with emojis"], answer: 1, explanation: "Structured formats like JSON with defined keys are predictable and machine-readable." },
  { id: "q5", question: "What is an AI \"hallucination\"?", options: ["A very creative answer", "A confident but made-up fact, quote or source", "A slow response", "An error message"], answer: 1, explanation: "Models can produce fluent text that isn't true. Always verify important facts." },
  { id: "q6", question: "Which is the best way to reduce hallucinations when summarising a report?", options: ["Ask for more detail", "Paste the report and say \"use only this text\"", "Use a longer role description", "Ask it to be confident"], answer: 1, explanation: "Grounding the answer in provided text limits invented content." },
  { id: "q7", question: "Which question is the least biased?", options: ["Why is social media ruining teens?", "What does research say about social media's positive and negative effects on teens?", "Isn't social media terrible?", "Prove social media is harmful."], answer: 1, explanation: "Neutral wording invites a balanced answer." },
  { id: "q8", question: "The first answer is too long. The best follow-up is…", options: ["\"Try again.\"", "\"Shorter.\"", "\"Cut this to 3 bullet points, max 15 words each, keep the main recommendation.\"", "\"Bad answer.\""], answer: 2, explanation: "Specific, measurable feedback gets a targeted fix." },
  { id: "q9", question: "Why break a big task into smaller prompts?", options: ["Models can only read short prompts", "Each step gets focused attention and you can fix issues early", "It's cheaper in all cases", "It hides the final goal"], answer: 1, explanation: "Chaining gives deeper answers and lets you steer between steps." },
  { id: "q10", question: "Which constraint is clearest?", options: ["Keep it short-ish.", "Not too long.", "Under 80 words.", "Brief but detailed."], answer: 2, explanation: "Numbers are unambiguous; \"brief but detailed\" even conflicts with itself." },
  { id: "q11", question: "What are delimiters (like triple quotes) used for in a prompt?", options: ["Decoration", "Clearly separating instructions from source text", "Making the model faster", "Hiding text from the model"], answer: 1, explanation: "Delimiters show where pasted material begins and ends so it isn't confused with instructions." },
  { id: "q12", question: "For a multi-step maths problem, which addition improves accuracy most?", options: ["\"Answer in one word.\"", "\"Work through it step by step and check your result.\"", "\"Be creative.\"", "\"Use a friendly tone.\""], answer: 1, explanation: "Step-by-step reasoning and self-checks reduce errors and make them visible." },
  { id: "q13", question: "\"Don't make it boring\" is weaker than…", options: ["\"Make it not boring.\"", "\"Open with a surprising question and use one real-life example.\"", "\"Please don't bore me.\"", "\"Avoid boredom.\""], answer: 1, explanation: "Positive, concrete instructions are easier to follow than vague negatives." },
  { id: "q14", question: "Which is the most useful context for \"help me write a leave application\"?", options: ["My favourite colour", "It's for 3 days next week for my sister's wedding, to my school principal", "I like writing", "Today is sunny"], answer: 1, explanation: "Relevant details (duration, reason, recipient) let the model tailor the letter." },
  { id: "q15", question: "What should you NOT paste into a prompt?", options: ["A public article", "Your bank password or someone's Aadhaar number", "Your own draft essay", "A recipe"], answer: 1, explanation: "Never share secrets or other people's private data. Use placeholders instead." },
  { id: "q16", question: "Your examples in a few-shot prompt are all about cats. What might happen?", options: ["Nothing", "The model may keep writing about cats even for new inputs", "The model refuses", "It ignores examples"], answer: 1, explanation: "Models copy patterns closely; vary your examples or say \"follow the style, not the topic\"." },
  { id: "q17", question: "Asking the model to \"ask me clarifying questions first\" is helpful when…", options: ["You know exactly what you want", "The task is complex and you're not sure what details matter", "You want a one-word answer", "Never"], answer: 1, explanation: "It lets the model collect missing context before producing a result." },
  { id: "q18", question: "Which output instruction is most precise?", options: ["Make a table.", "Organise it.", "Make a table with columns: Day, Meal, Calories, Prep time.", "Format it nicely."], answer: 2, explanation: "Named columns remove ambiguity about structure." },
  { id: "q19", question: "What's the main problem with \"Write a very detailed summary in one sentence\"?", options: ["Too polite", "Conflicting constraints", "Missing a role", "Nothing"], answer: 1, explanation: "Very detailed and one sentence pull in opposite directions." },
  { id: "q20", question: "Allowing the model to say \"I don't know\" helps because…", options: ["It makes answers shorter", "It reduces pressure to invent an answer", "It's polite", "It disables the model"], answer: 1, explanation: "Explicit permission to be uncertain lowers the chance of fabricated answers." },
  { id: "q21", question: "Which word is ambiguous and should be replaced with something specific?", options: ["\"5\"", "\"recent\"", "\"₹500\"", "\"2025\""], answer: 1, explanation: "\"Recent\" could mean last week or last decade. Say \"since January 2025\" instead." },
  { id: "q22", question: "A good prompt usually includes…", options: ["Only the task", "Task, context, and desired format (plus constraints/examples as needed)", "As many words as possible", "A role and nothing else"], answer: 1, explanation: "The core building blocks are task, context and format; constraints and examples sharpen them." },
  { id: "q23", question: "Why tell the model who the audience is?", options: ["So it chooses the right level, vocabulary and tone", "It's required by law", "So it writes longer", "It doesn't matter"], answer: 0, explanation: "Explaining to a child vs. an expert needs very different wording." },
  { id: "q24", question: "After getting a great result, what's a smart habit?", options: ["Delete the prompt", "Save it as a reusable template with placeholders", "Never use AI again", "Copy only the answer"], answer: 1, explanation: "Templates let you reuse a proven prompt structure." },
  { id: "q25", question: "The model cites a book that you can't find anywhere. Most likely…", options: ["The book is very rare", "The model hallucinated the reference", "Your search engine is broken", "It's a secret book"], answer: 1, explanation: "Invented citations are a common hallucination. Verify before using." },
  { id: "q26", question: "Which prompt best combines role, task and format?", options: ["Help with my diet.", "You are a nutritionist. Create a 3-day vegetarian meal plan for a diabetic adult as a table with Breakfast, Lunch, Dinner.", "Diet plan pls.", "You are a nutritionist."], answer: 1, explanation: "It has a role, a clear task with audience and constraints, and a defined output format." },
  { id: "q27", question: "When comparing two options, asking for \"pros and cons of each, then a recommendation with reasons\" helps because…", options: ["It forces balanced reasoning before a verdict", "It's shorter", "It confuses the model", "It skips the analysis"], answer: 0, explanation: "Reasoning before concluding leads to better-supported recommendations." },
  { id: "q28", question: "\"Translate this\" with no text pasted will most likely…", options: ["Translate your last email", "Fail or ask for the text — the model can only use what it sees", "Translate a random page", "Work perfectly"], answer: 1, explanation: "Models don't see your screen or files unless you include the content." },
]

/* ---------------------------------------------------------------- templates */

export const TEMPLATE_GROUPS: TemplateGroup[] = ["Study", "Work", "Writing", "Coding", "Planning"]

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  // Study
  { id: "t-explain-simple", group: "Study", title: "Explain a concept simply", description: "Plain-language explanation with an analogy.", template: "You are a patient teacher. Explain {concept} to a {audience} using one everyday analogy and one short example. Keep it under {word limit} words and end with a one-line summary." },
  { id: "t-study-notes", group: "Study", title: "Revision notes", description: "Concise notes plus likely exam questions.", template: "Create revision notes on {topic} for a {class or level} student. Include: key terms with one-line definitions, the 5 most important points as bullets, and {number} likely exam questions with short answers." },
  { id: "t-quiz-me", group: "Study", title: "Quiz me", description: "Interactive practice, one question at a time.", template: "Quiz me on {topic} at {difficulty} level. Ask one multiple-choice question at a time, wait for my answer, then tell me if I'm right with a short explanation. Stop after {number} questions and give my score." },
  { id: "t-feynman", group: "Study", title: "Check my understanding", description: "Find gaps in your explanation.", template: "Here is my explanation of {topic}:\n\"\"\"\n{my explanation}\n\"\"\"\nAct as a strict tutor. Point out anything incorrect or missing, then ask me 2 questions that test the weakest part." },
  { id: "t-study-plan", group: "Study", title: "Study plan", description: "Day-by-day plan before an exam.", template: "I have {days} days until my {exam} exam and can study {hours per day} hours a day. Topics: {topics}. Make a day-by-day study plan as a table with columns Day, Topic, Activity, Time. Include revision days." },
  // Work
  { id: "t-meeting-summary", group: "Work", title: "Meeting notes → actions", description: "Action items with owners and dates.", template: "Turn these meeting notes into: 1) a 3-sentence summary, 2) a table of action items with columns Task, Owner, Deadline, 3) open questions. Only use information in the notes.\n\nNotes:\n\"\"\"\n{meeting notes}\n\"\"\"" },
  { id: "t-pro-email", group: "Work", title: "Professional email", description: "Clear email with subject line.", template: "Write a {tone} email to {recipient} about {topic}. Goal: {goal}. Keep it under {word limit} words, include a clear subject line and end with a specific next step." },
  { id: "t-interview", group: "Work", title: "Interview practice", description: "Mock interview with feedback.", template: "You are an interviewer hiring for a {role} at a {company type}. Ask me one interview question at a time. After each answer, give brief feedback and a better sample answer. Focus on {focus area}." },
  { id: "t-feedback", group: "Work", title: "Give constructive feedback", description: "Kind, specific feedback for a colleague.", template: "Help me write constructive feedback for a {relationship} about {issue}. Use the situation–behaviour–impact format, keep a supportive tone, and suggest one concrete improvement. Under {word limit} words." },
  // Writing
  { id: "t-rewrite-tone", group: "Writing", title: "Rewrite in a new tone", description: "Keep meaning, change the voice.", template: "Rewrite the text below in a {tone} tone for {audience}. Keep the meaning, fix grammar, and keep it about the same length.\n\nText:\n\"\"\"\n{text}\n\"\"\"" },
  { id: "t-product-desc", group: "Writing", title: "Product description", description: "Persuasive listing copy.", template: "You are an e-commerce copywriter. Write a product description for {product} aimed at {target customer}. Highlight {key features}. Price: {price}. Format: a catchy headline, a 2-sentence intro, 3 benefit bullets, and a call to action. Under 120 words." },
  { id: "t-social-post", group: "Writing", title: "Social media post", description: "Platform-ready caption with hashtags.", template: "Write {number} {platform} post options about {topic} for {audience}. Tone: {tone}. Each under {word limit} words with a hook in the first line, one emoji at most, and 3 relevant hashtags." },
  { id: "t-essay-feedback", group: "Writing", title: "Essay feedback (no rewrite)", description: "Honest critique on structure and voice.", template: "Review my {essay type} essay below. Don't rewrite it. Give feedback on structure, clarity, voice and impact, each with one specific example from my text and one suggestion. Finish with the single most important change.\n\n\"\"\"\n{essay}\n\"\"\"" },
  { id: "t-complaint", group: "Writing", title: "Complaint letter", description: "Firm, polite, gets results.", template: "Write a firm but polite complaint to {company} about {problem}. Key facts: {facts}. I want {desired outcome} by {deadline}. Keep it under 180 words and professional." },
  // Coding
  { id: "t-debug", group: "Coding", title: "Debug an error", description: "Likely causes and a fix.", template: "I'm getting this error in {language}:\n\"\"\"\n{error message}\n\"\"\"\nRelevant code:\n\"\"\"\n{code}\n\"\"\"\nExplain the most likely cause in plain words, show the fixed code, and list 2 ways to prevent this in future." },
  { id: "t-explain-code", group: "Coding", title: "Explain this code", description: "Line-by-line walkthrough.", template: "Explain what this {language} code does for a {experience level} developer. Walk through it step by step, then point out any bugs or edge cases.\n\n\"\"\"\n{code}\n\"\"\"" },
  { id: "t-write-function", group: "Coding", title: "Write a function", description: "Spec → code with tests.", template: "Write a {language} function named {function name} that {behaviour}. Inputs: {inputs}. Output: {output}. Handle these edge cases: {edge cases}. Include 3 example test cases and keep it readable with brief comments." },
  { id: "t-code-review", group: "Coding", title: "Code review", description: "Prioritised review comments.", template: "Act as a senior {language} reviewer. Review this code for correctness, readability and performance. List issues as a table with columns Severity, Line/area, Issue, Suggested fix. Most important first.\n\n\"\"\"\n{code}\n\"\"\"" },
  // Planning
  { id: "t-trip", group: "Planning", title: "Trip itinerary", description: "Day-by-day plan within budget.", template: "Plan a {days}-day trip to {destination} for {travellers} in {month}, starting from {origin}. Budget: {budget} per person. We like {interests}. Give a day-by-day itinerary as a table with columns Day, Morning, Afternoon, Evening, Est. cost, then a total cost check." },
  { id: "t-meal-plan", group: "Planning", title: "Weekly meal plan", description: "Meals plus grocery list.", template: "Create a {days}-day {diet} meal plan for {people} people on a {budget} budget. Cooking time max {time} per meal. Avoid {avoid}. Give a table (Day, Breakfast, Lunch, Dinner) and a grouped grocery list." },
  { id: "t-workout", group: "Planning", title: "Workout plan", description: "Safe, progressive routine.", template: "You are a certified fitness coach. Create a {weeks}-week {goal} plan for a {fitness level} with {equipment}. {days per week} sessions a week, {minutes} minutes each. Note: {health notes}. Show each week as a table and explain how to progress safely." },
  { id: "t-decision", group: "Planning", title: "Make a decision", description: "Structured pros/cons and recommendation.", template: "Help me decide between {option A} and {option B}. My priorities are {priorities}. Compare them in a table on those priorities, list key assumptions, then give a recommendation with reasons and what would change your mind." },
  { id: "t-goal-breakdown", group: "Planning", title: "Break down a goal", description: "Milestones and weekly actions.", template: "My goal is {goal} within {timeframe}. I can spend {time per week} per week. Break it into monthly milestones and weekly actions, flag likely obstacles, and suggest one way to track progress." },
]

/** Extract unique `{placeholder}` names in order of appearance. */
export function templatePlaceholders(template: string): string[] {
  const seen = new Set<string>()
  for (const m of template.matchAll(/\{([^{}\n]+)\}/g)) seen.add(m[1])
  return [...seen]
}

/** Replace `{placeholder}` slots with values; unfilled slots are kept as-is. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{([^{}\n]+)\}/g, (whole, name: string) => values[name]?.trim() || whole)
}
