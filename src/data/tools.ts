import {
  Bell,
  Bookmark,
  Calculator,
  CalendarDays,
  Contact,
  FileImage,
  FilePen,
  FileScan,
  HeartPulse,
  KeyRound,
  Landmark,
  Brain,
  Gamepad2,
  ListTodo,
  Minimize2,
  Eraser,
  NotebookPen,
  Percent,
  QrCode,
  Receipt,
  Repeat2,
  Ruler,
  Scaling,
  Scan,
  ScanBarcode,
  ScanLine,
  ScanText,
  ShieldCheck,
  Sunrise,
  Timer,
  PenLine,
  Puzzle,
  Scale,
  Target,
  FileText,
  BookA,
  Sparkles,
  ListChecks,
  type LucideIcon,
} from "lucide-react"

export type ToolCategory =
  | "documents"
  | "images"
  | "scan"
  | "ai"
  | "finance"
  | "security"
  | "productivity"
  | "personal"
  | "learn"

/** Which top-level area of the app a tool belongs to. */
export type ToolSection = "tools" | "life" | "learn"

export interface Tool {
  id: string
  name: string
  description: string
  href: string
  icon: LucideIcon
  category: ToolCategory
  section: ToolSection
  /** Tailwind classes for the icon tile (bg + text), light & dark aware. */
  accent: string
}

export const CATEGORY_META: Record<ToolCategory, { label: string; description: string }> = {
  documents: { label: "Documents", description: "Create, edit and scan PDFs" },
  images: { label: "Images", description: "Resize, compress and convert" },
  scan: { label: "Scan", description: "QR codes, barcodes and text" },
  ai: { label: "AI Productivity", description: "Write, summarize, plan and decide with Gemini" },
  finance: { label: "Finance", description: "Everyday money maths" },
  security: { label: "Security", description: "Passwords and private sharing" },
  productivity: { label: "Productivity", description: "Plan your days" },
  personal: { label: "Personal", description: "Health, links and info" },
  learn: { label: "Learn Skills", description: "Practice prompting, English and logic" },
}

const A = {
  indigo: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300",
  sky: "bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300",
  amber: "bg-amber-500/10 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300",
  rose: "bg-rose-500/10 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300",
  violet: "bg-violet-500/10 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300",
  teal: "bg-teal-500/10 text-teal-600 dark:bg-teal-400/15 dark:text-teal-300",
  orange: "bg-orange-500/10 text-orange-600 dark:bg-orange-400/15 dark:text-orange-300",
} as const

export const TOOLS: Tool[] = [
  // Documents
  { id: "text-to-pdf", name: "Text to PDF", description: "Convert rich text and notes into a PDF.", href: "/tools/text-to-pdf", icon: FileText, category: "documents", section: "tools", accent: A.rose },
  { id: "image-to-pdf", name: "Image to PDF", description: "Convert multiple images into a PDF.", href: "/tools/image-to-pdf", icon: FileImage, category: "documents", section: "tools", accent: A.rose },
  { id: "pdf-editor", name: "PDF Editor", description: "Reorder, annotate, sign and watermark PDFs.", href: "/tools/pdf-editor", icon: FilePen, category: "documents", section: "tools", accent: A.rose },
  { id: "pdf-scanner", name: "PDF Scanner", description: "Scan paper documents into a clean PDF.", href: "/tools/pdf-scanner", icon: FileScan, category: "documents", section: "tools", accent: A.rose },
  // Images
  { id: "ocr", name: "OCR", description: "Extract text from images.", href: "/tools/ocr", icon: ScanText, category: "images", section: "tools", accent: A.violet },
  { id: "image-resizer", name: "Resize Image", description: "Change dimensions with handy presets.", href: "/tools/image-resizer", icon: Scaling, category: "images", section: "tools", accent: A.sky },
  { id: "image-compressor", name: "Compress Image", description: "Reduce image size quickly.", href: "/tools/image-compressor", icon: Minimize2, category: "images", section: "tools", accent: A.sky },
  { id: "image-converter", name: "Convert Image", description: "Switch between JPG, PNG and WebP.", href: "/tools/image-converter", icon: Repeat2, category: "images", section: "tools", accent: A.sky },
  { id: "bg-remover", name: "Remove Background", description: "AI-powered background removal for any photo.", href: "/tools/bg-remover", icon: Eraser, category: "images", section: "tools", accent: A.sky },

  // Scan
  { id: "scan", name: "Scan Everything", description: "One camera for QR, barcodes and text.", href: "/scan", icon: Scan, category: "scan", section: "tools", accent: A.indigo },
  { id: "qr-generator", name: "QR Generator", description: "Create QR codes for links and content.", href: "/tools/qr-generator", icon: QrCode, category: "scan", section: "tools", accent: A.indigo },

  // AI Productivity
  { id: "ai-writer", name: "AI Writer", description: "Draft, rewrite and translate emails and messages.", href: "/tools/ai-writer", icon: PenLine, category: "ai", section: "tools", accent: A.violet },
  { id: "summarizer", name: "Summarizer", description: "TL;DR, key points and action items from any text.", href: "/tools/summarizer", icon: FileText, category: "ai", section: "tools", accent: A.violet },
  { id: "goal-planner", name: "Goal Planner", description: "Turn a goal into milestones and tasks.", href: "/tools/goal-planner", icon: Target, category: "ai", section: "tools", accent: A.violet },

  // Finance
  { id: "smart-calculator", name: "Smart Calculator", description: "Type maths naturally, like “20% of 15000”.", href: "/tools/calculators/smart", icon: Calculator, category: "finance", section: "tools", accent: A.emerald },
  { id: "emi-calculator", name: "EMI Calculator", description: "Calculate monthly loan payments.", href: "/tools/calculators/emi", icon: Landmark, category: "finance", section: "tools", accent: A.emerald },
  { id: "gst-calculator", name: "GST Calculator", description: "Add or remove GST with CGST/SGST split.", href: "/tools/calculators/gst", icon: Receipt, category: "finance", section: "tools", accent: A.emerald },
  { id: "percentage-calculator", name: "Percentage Calculator", description: "Increases, discounts, marks and more.", href: "/tools/calculators/percentage", icon: Percent, category: "finance", section: "tools", accent: A.emerald },

  // Security
  { id: "password-generator", name: "Password Generator", description: "Strong, random passwords in one tap.", href: "/tools/password-generator", icon: KeyRound, category: "security", section: "tools", accent: A.amber },
  { id: "secure-share", name: "SecureShare", description: "Upload files & create secure zero-knowledge public links.", href: "/tools/secure-share", icon: ShieldCheck, category: "security", section: "tools", accent: A.amber },

  // My Life — productivity
  { id: "todo", name: "Tasks", description: "To-dos with priorities and subtasks.", href: "/tools/todo", icon: ListTodo, category: "productivity", section: "life", accent: A.indigo },
  { id: "routine-planner", name: "Daily Routine", description: "Build a daily timeline that sticks.", href: "/tools/routine-planner", icon: Sunrise, category: "productivity", section: "life", accent: A.orange },
  { id: "calendar", name: "Calendar", description: "Month, week, day and agenda views.", href: "/tools/calendar", icon: CalendarDays, category: "productivity", section: "life", accent: A.sky },
  { id: "reminders", name: "Reminders", description: "Never forget the important stuff.", href: "/tools/reminders", icon: Bell, category: "productivity", section: "life", accent: A.amber },
  { id: "notes", name: "Notes", description: "Quick notes, including text from OCR.", href: "/tools/notes", icon: NotebookPen, category: "productivity", section: "life", accent: A.violet },

  // My Life — personal
  { id: "wellness", name: "Wellness", description: "Your body numbers, daily tracking and an AI diet, workout & routine plan.", href: "/tools/wellness", icon: HeartPulse, category: "personal", section: "life", accent: A.rose },
  { id: "bookmarks", name: "Bookmarks", description: "Save useful links for later.", href: "/tools/bookmarks", icon: Bookmark, category: "personal", section: "life", accent: A.teal },


  // Learn Skills
  { id: "learn", name: "Learn with Fun", description: "Quiz games and AI lessons on any topic — in English & Hindi.", href: "/learn", icon: Gamepad2, category: "learn", section: "learn", accent: A.violet },
  { id: "learn-english", name: "English", description: "Vocabulary, grammar and writing practice.", href: "/learn/english", icon: BookA, category: "learn", section: "learn", accent: A.sky },
  { id: "learn-logic", name: "Logic & Reasoning", description: "Puzzles, patterns and mental maths.", href: "/learn/logic", icon: Puzzle, category: "learn", section: "learn", accent: A.amber },
]

export const TOOL_CATEGORY_ORDER: ToolCategory[] = [
  "documents",
  "images",
  "scan",
  "ai",
  "finance",
  "security",
]

export const LIFE_CATEGORY_ORDER: ToolCategory[] = ["productivity", "personal"]

export function getTool(id: string): Tool {
  const tool = TOOLS.find((t) => t.id === id)
  if (!tool) throw new Error(`Unknown tool: ${id}`)
  return tool
}

export function toolsByCategory(category: ToolCategory): Tool[] {
  return TOOLS.filter((t) => t.category === category)
}

