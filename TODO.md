# BookSync — Review TODO

## Security
- [x] Create `.gitignore` (excludes `settings.json`, `db.json`, `booksync.db`, `*.aax`, `*.m4b`)
- [x] Delete `settings.json` from project root (contains live Audible session cookies in plaintext)
- [x] Delete `booksync.db` from project root (unused SQLite remnant, ~278 KB)
- [x] Delete `src/main/python/get_activation.py` (dead code, never called)

## Performance
- [x] Atomic JSON writes in `DatabaseService` — write to `.tmp` then `rename` to prevent corruption on crash
- [x] Fix incremental NAS status updates — `updateBooksStatus()` now only writes when a status actually changed
- [x] Replace flat JSON persistence with `better-sqlite3` for large libraries (incremental writes, proper querying)
- [x] Concurrency throttling in `enrichLibrary` — already implemented (3 concurrent, 400ms batch delay)
- [x] `useMemo` dependency arrays in `App.tsx` — already correct; `selectedBook`/`downloadProgress` not in deps

## Architecture / Design
- [x] Break up `App.tsx` (1,952 lines → ~280 lines) into components and hooks:
  - [x] `components/Sidebar.tsx`
  - [x] `components/LibraryGrid.tsx`
  - [x] `components/LibraryList.tsx`
  - [x] `components/BookDetailPanel.tsx`
  - [x] `components/FilterPanel.tsx`
  - [x] `components/ControlsBar.tsx`
  - [x] `components/NotificationCenter.tsx`
  - [x] `components/SettingsTab.tsx`
  - [x] `components/NasScanProgress.tsx`
  - [x] `hooks/useFilters.ts` — all filter/sort state + computed values
  - [x] `hooks/useNotifications.ts` — notification state
  - [x] `types.ts` — shared Book, BookDetails, Notification, SortField interfaces
  - [x] `utils.ts` — parseDurationToMinutes, parseAudibleDate, sanitizePath (replaces duplicated inline logic)
- [x] Add Zustand for state management (eliminate remaining prop drilling, share download/enrichment state across components)
  - [x] `stores/useNotificationStore.ts` — notification list + panel visibility
  - [x] `stores/useFilterStore.ts` — all filter/sort/view state
  - [x] `stores/useLibraryStore.ts` — books, auth, downloads, settings, UI actions
  - [x] `hooks/useFilteredBooks.ts` — derived/computed values via useMemo
  - [x] All 9 components converted to zero-prop (read directly from stores)
- [x] Move path sanitization to shared `utils.ts` — was duplicated between `ExportService` and detail panel
- [x] Fix `env.d.ts` — added missing `auth.logout`, `auth.checkSession`, `library.getAllDetails`, `library.onEnrichProgress`, `library.onEnrichComplete`, `book.toggleIgnore`

## Bug Fixes
- [x] Release date parsing — now tries standard `new Date()` first (handles ISO), falls back to `MM-DD-YY` with a proper cutoff (yy >= 30 → 1900s, yy < 30 → 2000s)
- [x] `isEnriching` module-level boolean guard — replaced with `WeakSet<BrowserWindow>` so each window tracks its own enrichment state
- [x] Silent failure on login cancel — now shows `toast.info('Login cancelled')` instead of silently dismissing
- [x] `ExportService` TypeScript errors — `ffmpegPath!` non-null assertion (already guarded), explicit callback param types; project now compiles with zero errors

## Feature Additions

### Quick Fixes
- [x] Close activity popup when clicking outside of it (click-away dismiss)

### High Value / Lower Effort
- [x] Download queue with pause/cancel — downloads currently fire-and-forget with no queue management
- [x] Audiobookshelf auto-import trigger — after successful M4B export, call `POST /api/libraries/{id}/scan` on the ABS server to immediately trigger a library scan
- [x] Persistent activity log — notification center is in-memory only (resets on restart, capped at 50); persist last N events to DB
- [x] Bulk download — "Download All Missing" button to queue all books with `isDownloaded: false` for overnight batch processing
- [ ] Cover art fallback — if Audible cover URL 404s, fall back to cover embedded in M4B ID3 tags via `music-metadata`

### Medium Effort
- [ ] Progress persistence across restarts — write partial download progress to DB so interrupted downloads can be resumed or flagged on next launch
- [x] Audiobookshelf library comparison — call ABS API directly to compare ABS library vs. Audible library, instead of relying solely on NAS file scanning
- [ ] Series grouping view — third view mode (beyond grid/list) that groups books by series with series cover and download progress indicator
- [ ] Export format options — currently hardcoded M4B with `-c copy`; offer MP3 as an alternative (with re-encode warning)
