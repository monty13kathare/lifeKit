export type PresetId =
  | "custom"
  | "ig-square"
  | "ig-portrait"
  | "ig-story"
  | "whatsapp"
  | "profile"
  | "passport"
  | "hero"
  | "thumbnail"

export interface Preset {
  id: PresetId
  label: string
  width?: number
  height?: number
}

export const PRESETS: Preset[] = [
  { id: "custom", label: "Custom size" },
  { id: "ig-square", label: "Instagram post · 1080×1080", width: 1080, height: 1080 },
  { id: "ig-portrait", label: "Instagram portrait · 1080×1350", width: 1080, height: 1350 },
  { id: "ig-story", label: "Instagram story · 1080×1920", width: 1080, height: 1920 },
  { id: "whatsapp", label: "WhatsApp DP · 500×500", width: 500, height: 500 },
  { id: "profile", label: "Profile photo · 400×400", width: 400, height: 400 },
  // 35 × 45 mm at 300 dpi: 35 / 25.4 × 300 ≈ 413, 45 / 25.4 × 300 ≈ 531
  { id: "passport", label: "Passport 35×45 mm · 413×531", width: 413, height: 531 },
  { id: "hero", label: "Website hero · 1920×1080", width: 1920, height: 1080 },
  { id: "thumbnail", label: "Thumbnail · 320×180", width: 320, height: 180 },
]

export function getPreset(id: PresetId): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0]
}
