import { Suspense } from "react"
import type { Metadata } from "next"
import { ToolPage } from "@/components/common/tool-page"
import { Skeleton } from "@/components/ui/skeleton"
import { TranslatorWithParams } from "@/components/tools/translator/translator"
import { getTranslationService } from "@/lib/services/translation"

export const metadata: Metadata = {
  title: "Translator",
  description: "Translate between languages. Ships with a demo dictionary; plug in a translation server for full translation.",
}

export default function TranslatorPage() {
  const demo = getTranslationService().isDemo
  return (
    <ToolPage toolId="translator" width="default" privacy={demo ? "Demo mode runs entirely in your browser" : undefined}>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <TranslatorWithParams />
      </Suspense>
    </ToolPage>
  )
}
