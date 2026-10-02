import { BottomNav } from "@/components/navigation/bottom-nav"
import { Header } from "@/components/navigation/header"
import { Sidebar } from "@/components/navigation/sidebar"
import { InstallBanner } from "./install-banner"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-h-dvh flex-col lg:pl-64">
        <Header />
        <main
          id="main"
          className="flex-1 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pt-8 lg:pb-12"
        >
          {children}
        </main>
      </div>
      <BottomNav />
      <InstallBanner />
    </div>
  )
}
