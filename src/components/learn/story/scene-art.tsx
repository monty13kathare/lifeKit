"use client"

import { cn } from "@/lib/utils"
import type { StoryScene, StorySetting } from "@/types"

/*
 * Instant, free picture for a story page, drawn from the page's scene
 * description: sky by time of day, weather, a backdrop for the setting and the
 * characters/props. Colours here are illustration colours, not UI tokens.
 */

const SKY: Record<StoryScene["time"], string> = {
  morning: "linear-gradient(180deg,#ffd6a5 0%,#fdf2c4 45%,#bde0fe 100%)",
  day: "linear-gradient(180deg,#5ec5ff 0%,#a8e1ff 60%,#e3f6ff 100%)",
  evening: "linear-gradient(180deg,#3d2c8d 0%,#c4458e 45%,#ff9a62 100%)",
  night: "linear-gradient(180deg,#0b1026 0%,#1c2459 60%,#2e3a7a 100%)",
}

interface Backdrop {
  ground: string
  /** Decorations along the horizon: [emoji, left %, size rem, bottom %]. */
  decor: [string, number, number, number][]
  /** Draw a water band instead of grass. */
  water?: boolean
  noGround?: boolean
  mountains?: boolean
}

const BACKDROPS: Record<StorySetting, Backdrop> = {
  forest: { ground: "#4c9a4a", decor: [["🌲", 4, 3.4, 26], ["🌳", 20, 2.6, 27], ["🌲", 74, 3.6, 25], ["🌳", 88, 2.8, 27], ["🍄", 62, 1.1, 14]] },
  jungle: { ground: "#2f7d32", decor: [["🌴", 3, 3.4, 25], ["🌿", 22, 2, 26], ["🌴", 80, 3.6, 24], ["🌺", 66, 1.2, 15], ["🌿", 92, 2, 27]] },
  village: { ground: "#8bb85c", decor: [["🛖", 6, 2.6, 27], ["🌾", 24, 1.6, 26], ["🛖", 78, 2.4, 28], ["🌳", 90, 2.4, 27], ["🌾", 64, 1.4, 16]] },
  farm: { ground: "#9cc35c", decor: [["🌾", 4, 1.8, 26], ["🌾", 14, 1.6, 27], ["🚜", 78, 2.2, 27], ["🌻", 90, 1.6, 26], ["🌾", 64, 1.4, 15]] },
  city: { ground: "#8c96a8", decor: [["🏢", 2, 3.6, 26], ["🏬", 18, 2.8, 27], ["🏙️", 72, 3.6, 26], ["🌳", 90, 2, 26]] },
  market: { ground: "#d8b98a", decor: [["🏪", 4, 2.8, 27], ["⛱️", 22, 2, 26], ["🏪", 76, 2.8, 27], ["🧺", 64, 1.2, 15], ["⛱️", 90, 2, 27]] },
  home: { ground: "#c9a27a", decor: [["🏠", 6, 3, 27], ["🪴", 26, 1.6, 26], ["🌳", 82, 2.6, 27], ["🪟", 70, 1.6, 34]] },
  school: { ground: "#9ccf74", decor: [["🏫", 4, 3.2, 26], ["🌳", 24, 2.2, 27], ["📚", 64, 1.2, 15], ["🌳", 86, 2.6, 26]] },
  palace: { ground: "#d9c58f", decor: [["🏰", 4, 3.6, 25], ["🌴", 24, 2.2, 27], ["⛲", 70, 1.8, 26], ["🌴", 88, 2.4, 27]] },
  garden: { ground: "#6dbf5e", decor: [["🌷", 4, 1.6, 26], ["🌳", 14, 2.6, 27], ["🌻", 70, 1.8, 26], ["🌹", 84, 1.4, 25], ["🌼", 92, 1.4, 16]] },
  river: { ground: "#5ea85b", water: true, decor: [["🌳", 3, 2.8, 30], ["🌾", 20, 1.4, 31], ["🪷", 60, 1.2, 9], ["🌳", 86, 2.8, 30]] },
  sea: { ground: "#f1dca2", water: true, decor: [["🌴", 4, 2.8, 30], ["⛵", 70, 1.8, 22], ["🐚", 22, 1, 6], ["🌊", 86, 1.4, 14]] },
  mountain: { ground: "#7fae6d", mountains: true, decor: [["🌲", 6, 2.2, 26], ["🌲", 86, 2.4, 26], ["🪨", 66, 1.2, 15]] },
  desert: { ground: "#e8c27a", decor: [["🌵", 6, 2.4, 26], ["🐪", 76, 2, 26], ["🌵", 90, 1.8, 27], ["🪨", 30, 1, 16]] },
  space: { ground: "transparent", noGround: true, decor: [["🪐", 8, 2.6, 62], ["🌍", 80, 2.6, 18], ["☄️", 64, 1.4, 70], ["🛸", 30, 1.6, 30]] },
}

const MOOD: Record<StoryScene["mood"], string> = {
  happy: "rgba(255,220,120,0.10)",
  calm: "rgba(120,200,255,0.06)",
  exciting: "rgba(255,120,80,0.10)",
  tense: "rgba(30,10,60,0.28)",
  sad: "rgba(40,60,110,0.30)",
}

const STARS = Array.from({ length: 22 }, (_, i) => ({ left: (i * 37) % 100, top: (i * 23) % 45, size: i % 3 === 0 ? 3 : 2 }))

export function SceneArt({ scene, className }: { scene: StoryScene; className?: string }) {
  const bd = BACKDROPS[scene.setting] ?? BACKDROPS.forest
  const dark = scene.time === "night" || scene.setting === "space"
  const chars = scene.characters.slice(0, 3)

  return (
    <div
      className={cn("relative isolate aspect-[4/3] w-full overflow-hidden rounded-2xl select-none", className)}
      style={{ background: scene.setting === "space" ? SKY.night : SKY[scene.time] }}
      role="img"
      aria-label={`Picture: ${scene.setting}, ${scene.time}`}
    >
      {/* Stars */}
      {dark && STARS.map((s, i) => <span key={i} className="absolute animate-pulse rounded-full bg-white" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${(i % 5) * 0.4}s` }} />)}

      {/* Sun / moon */}
      {scene.setting !== "space" && scene.weather !== "rain" && (
        <span
          className="absolute rounded-full"
          style={
            scene.time === "night"
              ? { right: "12%", top: "10%", width: "11%", aspectRatio: "1", background: "#f4f1de", boxShadow: "0 0 30px 8px rgba(244,241,222,.35)" }
              : { right: "12%", top: scene.time === "evening" ? "38%" : scene.time === "morning" ? "24%" : "8%", width: "13%", aspectRatio: "1", background: scene.time === "evening" ? "#ff8a3d" : "#ffd23f", boxShadow: "0 0 40px 12px rgba(255,210,63,.45)" }
          }
        />
      )}

      {/* Clouds */}
      {(scene.weather !== "clear" || scene.time === "day") && scene.setting !== "space" && (
        <>
          <Cloud left="8%" top="10%" w="26%" dark={scene.weather === "rain"} />
          <Cloud left="52%" top="5%" w="22%" dark={scene.weather === "rain"} delay="1.5s" />
        </>
      )}

      {/* Mountains */}
      {bd.mountains && (
        <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-[22%] h-[38%] w-full" aria-hidden>
          <polygon points="0,120 70,30 140,120" fill="#6b7a99" />
          <polygon points="90,120 190,10 290,120" fill="#56668a" />
          <polygon points="170,40 190,10 210,40" fill="#fff" opacity=".85" />
          <polygon points="240,120 330,40 400,120" fill="#6b7a99" />
        </svg>
      )}

      {/* Ground / water */}
      {!bd.noGround && (
        <div className="absolute inset-x-0 bottom-0 h-[30%]" style={{ background: bd.ground }}>
          {bd.water && <div className="absolute inset-x-0 bottom-0 h-[55%]" style={{ background: "linear-gradient(180deg,#4fb3e8,#2a7fc4)" }} />}
        </div>
      )}

      {/* Decorations */}
      {bd.decor.map(([e, left, size, bottom], i) => (
        <span key={i} className="absolute leading-none" style={{ left: `${left}%`, bottom: `${bottom}%`, fontSize: `clamp(${size * 0.6}rem, ${size * 2.4}vw, ${size}rem)` }} aria-hidden>
          {e}
        </span>
      ))}

      {/* Characters */}
      <div className="absolute inset-x-0 bottom-[8%] flex items-end justify-center gap-[6%]">
        {chars.map((c, i) => (
          <span
            key={`${c}-${i}`}
            className="animate-lk-bob leading-none drop-shadow-[0_6px_6px_rgba(0,0,0,0.25)]"
            style={{ fontSize: "clamp(2.6rem, 13vw, 4.6rem)", animationDelay: `${i * 0.35}s`, transform: i === 1 ? "scaleX(-1)" : undefined }}
          >
            {c}
          </span>
        ))}
      </div>

      {/* Props */}
      {scene.props.slice(0, 3).map((p, i) => (
        <span key={`${p}-${i}`} className="absolute bottom-[6%] leading-none" style={{ left: `${[10, 80, 64][i]}%`, fontSize: "clamp(1.4rem, 6vw, 2.2rem)" }} aria-hidden>
          {p}
        </span>
      ))}

      {/* Rain */}
      {scene.weather === "rain" && (
        <div className="lk-rain pointer-events-none absolute inset-0" aria-hidden />
      )}

      {/* Mood tint */}
      <div className="pointer-events-none absolute inset-0" style={{ background: MOOD[scene.mood] }} aria-hidden />
    </div>
  )
}

function Cloud({ left, top, w, dark, delay }: { left: string; top: string; w: string; dark?: boolean; delay?: string }) {
  return (
    <span className="animate-lk-drift absolute" style={{ left, top, width: w, aspectRatio: "3 / 1", animationDelay: delay }} aria-hidden>
      <span className="absolute inset-x-0 bottom-0 h-[60%] rounded-full" style={{ background: dark ? "#8a94a6" : "#fff" }} />
      <span className="absolute bottom-[25%] left-[18%] h-[80%] w-[40%] rounded-full" style={{ background: dark ? "#8a94a6" : "#fff" }} />
      <span className="absolute bottom-[20%] left-[45%] h-[95%] w-[38%] rounded-full" style={{ background: dark ? "#9aa3b4" : "#fff" }} />
    </span>
  )
}

/** Keep only real emoji (the AI occasionally sends words); one glyph each. */
export function cleanEmoji(list: string[], max: number): string[] {
  const seg = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null
  const out: string[] = []
  for (const raw of list) {
    const first = seg ? [...seg.segment(raw.trim())][0]?.segment : raw.trim()
    if (first && /\p{Extended_Pictographic}/u.test(first)) out.push(first)
    if (out.length === max) break
  }
  return out
}
