import Link from "next/link"
import { Compass } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Compass className="size-7" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-1 text-muted-foreground">That tool or page doesn&apos;t exist in LifeKit.</p>
      <div className="mt-6 flex gap-2">
        <Button nativeButton={false} render={<Link href="/" />}>Go home</Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/tools" />}>
          Browse tools
        </Button>
      </div>
    </div>
  )
}
