"use client"

import { useEffect, useState } from "react"

const COLORS = ["#6d4aff", "#22c55e", "#f59e0b", "#ec4899", "#0ea5e9", "#f43f5e", "#a3e635"]

/** Falling CSS confetti (no canvas, no library). Purely decorative. */
export function Confetti({ pieces = 36 }: { pieces?: number }) {
  // Random layout is decided once per mount.
  const [bits] = useState(() =>
    Array.from({ length: pieces }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.9,
      duration: 2.2 + Math.random() * 1.8,
      drift: (Math.random() - 0.5) * 140,
      spin: 360 + Math.random() * 720,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 10,
      round: i % 4 === 0,
      color: COLORS[i % COLORS.length],
    }))
  )
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {bits.map((b, i) => (
        <span
          key={i}
          className="absolute -top-4 block"
          style={
            {
              left: `${b.left}%`,
              width: b.w,
              height: b.round ? b.w : b.h,
              borderRadius: b.round ? "9999px" : "2px",
              backgroundColor: b.color,
              animation: `lk-confetti ${b.duration}s cubic-bezier(0.25, 0.6, 0.5, 1) ${b.delay}s both`,
              "--drift": `${b.drift}px`,
              "--spin": `${b.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

/** Animate a number from 0 to `target` (instant when reduced motion is on). */
export function useCountUp(target: number, durationMs = 1100, delayMs = 0) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf = 0
    let start = 0
    const timer = window.setTimeout(() => {
      if (prefersReducedMotion()) {
        raf = requestAnimationFrame(() => setValue(target))
        return
      }
      const tick = (t: number) => {
        if (!start) start = t
        const p = Math.min(1, (t - start) / durationMs)
        setValue(Math.round(target * (1 - Math.pow(1 - p, 3))))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, delayMs)
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
  }, [target, durationMs, delayMs])
  return value
}

/** Short vibration on phones that support it; silently ignored elsewhere. */
export function haptic(pattern: number | number[]) {
  try {
    if (!prefersReducedMotion()) navigator.vibrate?.(pattern)
  } catch {
    /* not supported */
  }
}
