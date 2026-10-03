<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# LifeKit conventions

LifeKit is a **frontend-first** Next.js 16 PWA. Everything runs in the browser — no database, no auth, no server actions, no fake network calls. The **only** server code is the optional Google Gemini proxy (see "AI" below).

## UI kit: shadcn/ui on **Base UI** (not Radix)
Components in `src/components/ui` wrap `@base-ui/react`. Differences from Radix-era shadcn:
- Composition uses the `render` prop, **not** `asChild`: `<DialogTrigger render={<Button />}>Open</DialogTrigger>`, `<DropdownMenuItem render={<Link href="/x" />}>`.
- `Select`: pass `items` on the root so `<SelectValue />` shows labels: `<Select items={[{ value: "a", label: "A" }]} value={v} onValueChange={(v) => v && setV(v)}>`. `onValueChange(value, eventDetails)`; value can be `null`.
- `Slider`: `value={n}` (single number → one thumb) and `onValueChange={(v) => setN(v as number)}`.
- `Tabs`: `<Tabs value onValueChange>`; `TabsTrigger value=`; `TabsContent value=`.
- `DropdownMenuLabel` must sit inside `DropdownMenuGroup`.
- `Button` sizes: `default` h-10, `lg` h-12 (primary mobile actions), `sm` h-8, `icon` size-10, `icon-sm` size-8.

## Where things go
- Tool registry (names, icons, routes, accents): `src/data/tools.ts`. Pages use `<ToolPage toolId="...">` from `@/components/common/tool-page`.
- Shared components: `src/components/common` — `ToolPage`, `FileDropzone`, `EmptyState`, `Notice`/`UnsupportedNotice`, `CopyButton`/`copyText`, `ResponsiveSheet` (bottom sheet on mobile, dialog on desktop), `Logo`.
- Cards: `src/components/cards/tool-card.tsx`.
- Feature components: `src/components/tools/<feature>/…`. Route files under `src/app/...` stay thin.
- Persistence: **only** through `src/lib/storage/*` stores and `src/hooks/use-lifekit-data.ts` hooks (`useTasks`, `useRoutines`, `useCalendar`, `useReminders`, `useNotes`, `useBookmarks`, `useImportantInformation`, `useWellness`, `useSettings`). Never call `localStorage` from components. Collection stores expose `add/update/remove/upsert/set`.
- `useHydrated()` (`@/hooks/use-store`) returns false during SSR/hydration — use it to avoid flashing empty states before local data loads.
- Domain types: `src/types/index.ts`. Dates `yyyy-MM-dd`, times `HH:mm`, instants ISO strings. Date helpers: `src/lib/dates.ts` (`expandEvents`, `occursOn`, `combineDateTime`, `todayString`, `formatTime12`).
- File helpers: `src/lib/files.ts` (`checkFile`, `formatBytes`, `downloadBlob`, `downloadText`, `loadImage`, `canvasToBlob`, `canEncode`, `replaceExtension`).
- pdf.js: `src/lib/pdf/pdfjs.ts` (`loadPdfJs`, `openPdf`, `renderPdfPage`).
- Reminders logic: `src/lib/reminders.ts`; the global scheduler is mounted in `providers.tsx`.
- Service interfaces for future backend: `src/lib/services/*` (`FileService`, `TranslationService`, `UserService`). UI talks to interfaces, local adapters implement them.
- AI (Google Gemini): server-only code lives in `src/lib/ai/*.server.ts` (`import "server-only"`) and route handlers under `src/app/api/` (`/api/ai/status`, `/api/ai/text`, `/api/ai/assist`). The key is `GEMINI_API_KEY` in `.env` — never `NEXT_PUBLIC_`. Client code uses `src/lib/ai/client.ts`, `useAiStatus()`, `useTranslationService()` and `<AiTextActions>`; every AI feature must hide itself when `configured` is false and tell users their text goes to Google. New AI routes must call `assertSameOrigin` + `assertRateLimit`, validate with zod and cap input size.
- Structured AI jobs: add a kind to `ASSIST_OUTPUT` in `src/lib/ai/assist-schemas.ts` (zod output schema) plus its instruction in `src/app/api/ai/assist/route.ts`; call it with `aiAssist(kind, input)`. Convert AI output to records with `src/lib/ai/convert.ts`. Always show a preview the user confirms before saving AI-created items.
- Focus timer: engine in `src/lib/focus.ts` (state in `focusTimerStore`), finished by the global `<FocusTicker />`; UI only calls engine actions. Calendar event alerts and reminders are fired by `<ReminderScheduler />`.
- Learn Skills: progress API in `src/lib/learn/progress.ts` (`awardXp`, `completeLesson`, `recordBest`, `reviewCard`), hook `useLearn()`, header `<TrackHeader track>`. Tracks live in `src/components/learn/<track>/` with content in `src/data/learn/`.

## Rules
- Heavy libraries (`pdf-lib`, `pdfjs-dist`, `tesseract.js`, `html5-qrcode`, `jszip`, `browser-image-compression`, `qrcode`, `jsbarcode`) must be loaded with `await import(...)` inside handlers/effects or via `next/dynamic` — never top-level imports in route files.
- Every tool handles: loading, success, error, empty, invalid input, unsupported browser (`UnsupportedNotice` + alternative), unsupported file, large-file warning (`FileDropzone` `warnBytes`).
- Camera/microphone/notification permissions are requested only after an explicit user click.
- No `dangerouslySetInnerHTML`, no `eval`/`new Function`. Validate input with zod where there's a form.
- Say "processed in your browser" only where true. Never claim a file link is public/permanent.
- Mobile first: works at 360px with no horizontal scroll; touch targets ≥ 40px; tables become cards on mobile.
- Colours via tokens (`bg-card`, `bg-surface`, `bg-surface-muted`, `text-muted-foreground`, `text-primary`, `text-success`, `text-warning`, `text-destructive`, `border`) so dark mode works. Use `shadow-soft` for elevation.
