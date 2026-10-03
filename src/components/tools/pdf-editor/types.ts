export type Tool = "select" | "edit-text" | "text" | "draw" | "highlight"

export interface ToolSettings {
  textColor: string
  fontSize: number
  penColor: string
  penWidth: number
  highlightColor: string
  fontFamily?: "sans" | "serif" | "mono"
  fontWeight?: "normal" | "bold"
}

export const DEFAULT_TOOL_SETTINGS: ToolSettings = {
  textColor: "#111827",
  fontSize: 16,
  penColor: "#1d4ed8",
  penWidth: 2.5,
  highlightColor: "#facc15",
}

export const INK_COLORS = [
  { value: "#111827", label: "Black" },
  { value: "#1d4ed8", label: "Blue" },
  { value: "#dc2626", label: "Red" },
  { value: "#16a34a", label: "Green" },
  { value: "#ffffff", label: "White" },
]

export const HIGHLIGHT_COLORS = [
  { value: "#facc15", label: "Yellow" },
  { value: "#4ade80", label: "Green" },
  { value: "#f472b6", label: "Pink" },
  { value: "#60a5fa", label: "Blue" },
  { value: "#fb923c", label: "Orange" },
]

export const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 72]

/** Zoom levels in percent, where 100% = 96 CSS px per inch (4/3 px per PDF point). */
export const ZOOM_LEVELS = [25, 33, 50, 67, 75, 90, 100, 125, 150, 175, 200, 250, 300, 400]
export const PX_PER_POINT = 96 / 72
