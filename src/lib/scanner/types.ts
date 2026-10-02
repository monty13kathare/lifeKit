/** Shared types for the document scanner. Pure data — safe to import in a Web Worker. */

export interface Point {
  x: number
  y: number
}

/** Four corners in order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point]

/** Raw RGBA pixels (structurally compatible with ImageData). */
export interface Pixels {
  width: number
  height: number
  data: Uint8ClampedArray
}

export type FilterMode = "original" | "auto" | "grayscale" | "bw"

export interface EnhanceSettings {
  filter: FilterMode
  /** -100..100 */
  brightness: number
  /** -100..100 */
  contrast: number
  sharpen: boolean
  /** Clockwise rotation in degrees. */
  rotation: 0 | 90 | 180 | 270
}

export const DEFAULT_ENHANCE: EnhanceSettings = {
  filter: "auto",
  brightness: 0,
  contrast: 0,
  sharpen: false,
  rotation: 0,
}

export interface DetectResult {
  /** Normalised (0..1) corners relative to the analysed image. */
  quad: Quad
  /** 0..1 heuristic confidence. Below ~0.5 the quad is a full-image fallback. */
  confidence: number
}
