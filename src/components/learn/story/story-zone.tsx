"use client"

import { useRef, useState } from "react"
import { BookOpen, Languages, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"
import { Notice } from "@/components/common/notice"
import { ToolPage } from "@/components/common/tool-page"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAiStatus } from "@/hooks/use-ai-status"
import { useSettings, useStories } from "@/hooks/use-lifekit-data"
import { useHydrated } from "@/hooks/use-store"
import { aiAssist } from "@/lib/ai/client"
import { createId } from "@/lib/storage/core"
import { cn } from "@/lib/utils"
import type { AiLanguage, StoryBook } from "@/types"
import type { Bilingual } from "@/data/learn/fun-categories"
import { LANGUAGES, tr } from "../fun/fun-utils"
import { cleanEmoji, SceneArt } from "./scene-art"
import { StoryReader } from "./story-reader"

const THEMES: { id: string; name: Bilingual }[] = [
  { id: "Panchatantra animal fable", name: { en: "Panchatantra", hi: "पंचतंत्र" } },
  { id: "Akbar and Birbal wit", name: { en: "Akbar & Birbal", hi: "अकबर-बीरबल" } },
  { id: "adventure", name: { en: "Adventure", hi: "रोमांच" } },
  { id: "mystery for young detectives", name: { en: "Mystery", hi: "रहस्य" } },
  { id: "space journey", name: { en: "Space", hi: "अंतरिक्ष" } },
  { id: "friendship", name: { en: "Friendship", hi: "दोस्ती" } },
  { id: "funny", name: { en: "Funny", hi: "मज़ेदार" } },
  { id: "kings and queens", name: { en: "Royal tale", hi: "राजा-रानी" } },
]
const LENGTHS = [
  { pages: 6, name: { en: "Short · 6 pages", hi: "छोटी · 6 पेज" } },
  { pages: 10, name: { en: "Long · 10 pages", hi: "लंबी · 10 पेज" } },
  { pages: 14, name: { en: "Extra long · 14", hi: "बहुत लंबी · 14" } },
]
const AGES = [
  { id: "kids", name: { en: "Kids", hi: "बच्चे" } },
  { id: "teens", name: { en: "Teens", hi: "किशोर" } },
  { id: "adults", name: { en: "Grown-ups", hi: "बड़े" } },
]
const MAX_STORIES = 15

const ideaSchema = z.string().trim().max(200, "Keep your idea under 200 characters.")

/** "Stories" tab: AI picture-book stories read page by page, with read aloud. */
export function StoryZone({ tabs }: { tabs?: React.ReactNode }) {
  const hydrated = useHydrated()
  const ai = useAiStatus()
  const aiEnabled = !!ai?.configured
  const { settings } = useSettings()
  const { stories, upsert, remove } = useStories()

  const [langChoice, setLangChoice] = useState<AiLanguage | null>(null)
  const lang: AiLanguage = langChoice ?? (hydrated && settings.aiLanguage === "hi" ? "hi" : "en")
  const [theme, setTheme] = useState(THEMES[0].id)
  const [pages, setPages] = useState(6)
  const [age, setAge] = useState("kids")
  const [idea, setIdea] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState<StoryBook | null>(null)
  const ctlRef = useRef<AbortController | null>(null)
  const t = (en: string, hi: string) => tr(lang, { en, hi })
  const saved = !!current && stories.some((s) => s.id === current.id)

  const create = async () => {
    const parsed = ideaSchema.safeParse(idea)
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    ctlRef.current?.abort()
    const ctl = new AbortController()
    ctlRef.current = ctl
    setLoading(true)
    setError(null)
    try {
      const out = await aiAssist("story-book", JSON.stringify({ theme, idea: parsed.data || undefined, age, pages, language: lang }), ctl.signal)
      const book: StoryBook = {
        id: createId(),
        title: out.title,
        moral: out.moral,
        theme,
        language: lang,
        createdAt: new Date().toISOString(),
        pages: out.pages.map((p) => ({ ...p, scene: { ...p.scene, characters: cleanEmoji(p.scene.characters, 3), props: cleanEmoji(p.scene.props, 3) } })),
      }
      setCurrent(book)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return
      const message = err instanceof Error ? err.message : "Couldn't write the story."
      setError(message)
      toast.error(t("Couldn't write the story", "कहानी नहीं बन पाई"), { description: message })
    } finally {
      if (ctlRef.current === ctl) setLoading(false)
    }
  }

  const save = (book: StoryBook) => {
    if (stories.length >= MAX_STORIES) {
      const oldest = [...stories].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
      remove(oldest.id)
    }
    upsert(book)
    toast.success(t("Story saved", "कहानी सहेजी गई"), { description: t("Read it again anytime, even offline.", "कभी भी दोबारा पढ़ें, ऑफ़लाइन भी।") })
  }

  const del = (book: StoryBook) => {
    remove(book.id)
    toast(t("Story deleted", "कहानी हटाई गई"), { description: book.title, action: { label: t("Undo", "वापस"), onClick: () => upsert(book) } })
  }

  if (current) {
    return (
      <ToolPage toolId="learn" hideBack>
        {tabs}
        <StoryReader
          story={current}
          saved={saved}
          aiEnabled={aiEnabled}
          onBack={() => setCurrent(null)}
          onSave={() => save(current)}
          onDelete={() => {
            del(current)
            setCurrent(null)
          }}
          onNewStory={() => setCurrent(null)}
          onPageImage={() => {}}
        />
      </ToolPage>
    )
  }

  return (
    <ToolPage toolId="learn" hideBack>
      {tabs}
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-3xl border bg-card p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-500/12 via-fuchsia-500/6 to-transparent" aria-hidden />
          <div className="relative space-y-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <BookOpen className="size-4" aria-hidden /> {t("Story Mode", "स्टोरी मोड")}
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{t("Read a story, page by page", "पेज-दर-पेज कहानी पढ़ें")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("A new illustrated story every time — swipe through it, or let it read aloud to you.", "हर बार नई चित्रों वाली कहानी — स्वाइप करके पढ़ें या सुनें।")}
              </p>
            </div>

            {!aiEnabled && ai ? (
              <Notice tone="warning" title={t("New stories need Google Gemini", "नई कहानी के लिए Google Gemini ज़रूरी है")}>
                {t("Add a GEMINI_API_KEY on the server to write stories. Saved stories below still open offline.", "कहानी बनाने के लिए सर्वर पर GEMINI_API_KEY जोड़ें। सहेजी गई कहानियाँ ऑफ़लाइन भी खुलती हैं।")}
              </Notice>
            ) : (
              <>
                <Field label={t("Theme", "थीम")}>
                  {THEMES.map((th) => (
                    <Chip key={th.id} active={theme === th.id} onClick={() => setTheme(th.id)}>
                      {tr(lang, th.name)}
                    </Chip>
                  ))}
                </Field>
                <div>
                  <label htmlFor="story-idea" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("Your idea (optional)", "आपका आइडिया (वैकल्पिक)")}
                  </label>
                  <input
                    id="story-idea"
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    maxLength={200}
                    placeholder={t("e.g. a shy elephant who wants to dance", "जैसे: एक शर्मीला हाथी जो नाचना चाहता है")}
                    className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("Length", "लंबाई")}>
                    {LENGTHS.map((l) => (
                      <Chip key={l.pages} active={pages === l.pages} onClick={() => setPages(l.pages)}>
                        {tr(lang, l.name)}
                      </Chip>
                    ))}
                  </Field>
                  <Field label={t("Reader", "पाठक")}>
                    {AGES.map((a) => (
                      <Chip key={a.id} active={age === a.id} onClick={() => setAge(a.id)}>
                        {tr(lang, a.name)}
                      </Chip>
                    ))}
                  </Field>
                </div>
                <Field label={t("Language", "भाषा")} icon={<Languages className="size-3.5" aria-hidden />}>
                  {LANGUAGES.map((l) => (
                    <Chip key={l.id} active={lang === l.id} onClick={() => setLangChoice(l.id as AiLanguage)} lang={l.lang}>
                      {l.label}
                    </Chip>
                  ))}
                </Field>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button size="lg" className="w-full" onClick={() => void create()} disabled={loading || !ai}>
                  <Sparkles aria-hidden /> {loading ? t("Writing your story…", "कहानी लिखी जा रही है…") : t("Create my story", "मेरी कहानी बनाएँ")}
                </Button>
                <p className="text-center text-xs text-muted-foreground">{t("Your choices are sent to Google Gemini to write the story.", "कहानी लिखने के लिए आपके विकल्प Google Gemini को भेजे जाते हैं।")}</p>
              </>
            )}
          </div>
        </section>

        {loading && (
          <div className="space-y-3" aria-busy="true" role="status">
            <Skeleton className="aspect-[4/3] w-full rounded-3xl" />
            <p className="text-center text-sm text-muted-foreground">{t("Drawing the scenes and writing the pages…", "दृश्य बनाए जा रहे हैं और पेज लिखे जा रहे हैं…")}</p>
            <div className="flex justify-center">
              <Button variant="ghost" onClick={() => ctlRef.current?.abort()}>
                {t("Cancel", "रद्द करें")}
              </Button>
            </div>
          </div>
        )}

        {hydrated && stories.length > 0 && (
          <section aria-labelledby="my-stories">
            <h2 id="my-stories" className="mb-3 text-lg font-semibold">
              {t("My stories", "मेरी कहानियाँ")}
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[...stories]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((s) => (
                  <li key={s.id} className="group relative overflow-hidden rounded-2xl border bg-card">
                    <button type="button" onClick={() => setCurrent(s)} className="block w-full text-left">
                      {s.pages[0]?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- local data URL
                        <img src={s.pages[0].imageUrl} alt="" className="w-full object-cover" style={{ aspectRatio: "16 / 11" }} />
                      ) : (
                        s.pages[0] && <SceneArt scene={s.pages[0].scene} className="rounded-none" />
                      )}
                      <span className="block p-2.5">
                        <span className="line-clamp-2 text-sm leading-snug font-semibold" lang={s.language}>
                          {s.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {s.pages.length} {t("pages", "पेज")} · {s.language === "hi" ? "हिन्दी" : "English"}
                        </span>
                      </span>
                    </button>
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => del(s)}
                      className="absolute top-1.5 right-1.5 bg-background/85 backdrop-blur"
                      aria-label={`${t("Delete", "हटाएँ")} ${s.title}`}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </li>
                ))}
            </ul>
          </section>
        )}
      </div>
    </ToolPage>
  )
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {icon} {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Chip({ active, onClick, lang, children }: { active: boolean; onClick: () => void; lang?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      lang={lang}
      onClick={onClick}
      className={cn("min-h-10 rounded-full border px-3.5 text-sm font-medium transition-colors", active ? "border-primary bg-primary text-primary-foreground" : "bg-background/70 hover:bg-muted")}
    >
      {children}
    </button>
  )
}
