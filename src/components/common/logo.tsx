import { cn } from "@/lib/utils"

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden className={cn("size-8", className)}>
      <rect width="512" height="512" rx="112" fill="#4f46e5" />
      <rect x="128" y="128" width="118" height="118" rx="28" fill="#fff" />
      <rect x="266" y="128" width="118" height="118" rx="28" fill="#fff" />
      <rect x="128" y="266" width="118" height="118" rx="28" fill="#fff" />
      <circle cx="325" cy="325" r="59" fill="#c7d2fe" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-lg font-semibold tracking-tight">LifeKit</span>
    </span>
  )
}
