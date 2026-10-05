export type PresetId =
  | "custom"
  | "ig-square"
  | "ig-portrait"
  | "ig-story"
  | "whatsapp"
  | "profile"
  | "passport"
  | "a4"
  | "hero"
  | "presentation"
  | "yt-thumbnail"
  | "tw-post"
  | "tw-header"
  | "fb-cover"
  | "li-banner"

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
  // 35 × 45 mm at 300 dpi
  { id: "passport", label: "Passport 35×45 mm · 413×531", width: 413, height: 531 },
  { id: "a4", label: "A4 Document (300dpi) · 2480×3508", width: 2480, height: 3508 },
  { id: "hero", label: "Website hero · 1920×1080", width: 1920, height: 1080 },
  { id: "presentation", label: "Presentation (16:9) · 1920×1080", width: 1920, height: 1080 },
  { id: "yt-thumbnail", label: "YouTube Thumbnail · 1280×720", width: 1280, height: 720 },
  { id: "tw-post", label: "X/Twitter Post · 1600×900", width: 1600, height: 900 },
  { id: "tw-header", label: "X/Twitter Header · 1500×500", width: 1500, height: 500 },
  { id: "fb-cover", label: "Facebook Cover · 820×312", width: 820, height: 312 },
  { id: "li-banner", label: "LinkedIn Banner · 1584×396", width: 1584, height: 396 },
]

export function getPreset(id: PresetId): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0]
}
