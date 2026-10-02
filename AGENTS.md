<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# LifeKit conventions

LifeKit is a **frontend-only** Next.js 16 PWA. No backend, no API routes, no server actions, no fake network calls. Everything runs in the browser.

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

## Rules
- Heavy libraries (`pdf-lib`, `pdfjs-dist`, `tesseract.js`, `html5-qrcode`, `jszip`, `browser-image-compression`, `qrcode`, `jsbarcode`) must be loaded with `await import(...)` inside handlers/effects or via `next/dynamic` — never top-level imports in route files.
- Every tool handles: loading, success, error, empty, invalid input, unsupported browser (`UnsupportedNotice` + alternative), unsupported file, large-file warning (`FileDropzone` `warnBytes`).
- Camera/microphone/notification permissions are requested only after an explicit user click.
- No `dangerouslySetInnerHTML`, no `eval`/`new Function`. Validate input with zod where there's a form.
- Say "processed in your browser" only where true. Never claim a file link is public/permanent.
- Mobile first: works at 360px with no horizontal scroll; touch targets ≥ 40px; tables become cards on mobile.
- Colours via tokens (`bg-card`, `bg-surface`, `bg-surface-muted`, `text-muted-foreground`, `text-primary`, `text-success`, `text-warning`, `text-destructive`, `border`) so dark mode works. Use `shadow-soft` for elevation.
