# KiwiSpeakQuote (KSQ) — Project TODO

> Last updated: 13/03/2026

---

## ✅ Completed (MVP)

### Core Voice Pipeline
- [x] Voice recording — Web Audio API, pause/resume, 2-min max, haptic feedback
- [x] Audio transcription — Groq Whisper API (`whisper-large-v3`, NZ English)
- [x] AI structured extraction — OpenAI `gpt-4o-mini` JSON extraction with confidence scoring
- [x] Offline-first architecture — IndexedDB (`idb-keyval`) local storage + pending sync queue

### Quote Management
- [x] Create quotes — from voice or manual entry
- [x] Edit quotes — full CRUD for drafts; "Create New Version" for sent/accepted
- [x] Quote statuses — draft / sent / accepted
- [x] Version tracking — parentId + version number
- [x] Quote filtering — All / Draft / Sent / Accepted tabs
- [x] Quote deletion — draft-only

### NZ Business Logic
- [x] 15% GST calculation — inclusive/exclusive toggle
- [x] NZD currency formatting
- [x] DD/MM/YYYY date format
- [x] NZ English spelling — labour, colour, centre
- [x] Kiwi slang recognition — "grand" ($1,000), "bucks", "mate"

### PDF & Sharing
- [x] Professional PDF export — jsPDF with branding, itemised table, GST breakdown
- [x] Public quote URLs — `/q/[slug]` unique links
- [x] Web Share API — native share (SMS / WhatsApp / Email)
- [x] Clipboard fallback — copy link

### Authentication
- [x] Email/password auth — Supabase Auth
- [x] Google OAuth — one-click social login
- [x] Session management — persisted across pages
- [x] Auto-bind — device quotes linked to user on login

### Business Profile
- [x] Settings page — business name, phone, email, address, bank account
- [x] Cloud sync — Supabase profile
- [x] Quote snapshots — provider details captured at creation time

### UI/UX
- [x] Mobile-first design — thumb-friendly controls
- [x] PWA manifest — installable on mobile
- [x] Dark mode — next-themes
- [x] Toast notifications — Sonner
- [x] shadcn/ui component library — ~55 React components

---

## ✅ TODO (All Implemented!)

### High Priority
- [x] **Testing** — 101 tests across 11 files (Vitest + React Testing Library)
- [x] **Service Worker** — offline caching with precache + runtime strategies
- [x] **Audio compression** — client-side MP3 conversion via lamejs before upload
- [x] **API rate limiting** — in-memory rate limiter on all API routes

### Medium Priority
- [x] **Email delivery** — Resend integration with branded HTML email template
- [x] **"Accept Quote" flow** — customer-facing accept button on public quote URL
- [x] **Version diff view** — field, item, and total diff between quote versions
- [x] **Error monitoring** — Sentry integration (client + server, PII-stripped)

### Low Priority
- [x] **Signature capture** — canvas-based touch signature pad with data URL storage
- [x] **Image attachments** — site photos (up to 10, 5MB each) stored as data URLs in IndexedDB
- [x] **Custom item templates** — pre-defined + user-saved line item templates with categories
- [x] **Bulk quote operations** — select, batch delete, CSV export on quotes page
- [x] **Revenue dashboard** — monthly chart, conversion rate, top customers, status breakdown
- [x] **Admin panel** — system stats, audit log with filters, management links
- [x] **i18n** — framework with en-NZ + te reo Maori (mi-NZ), language switcher in Settings

---

## 📊 Project Stats

| Metric            | Value              |
| ----------------- | ------------------ |
| Lines of code     | ~10,000+           |
| React components  | ~68                |
| API routes        | 3 (transcribe, extract, send-quote) |
| Pages             | 9                  |
| Custom hooks      | 5                  |
| npm packages      | 24                 |
| i18n locales      | 2 (en-NZ, mi-NZ)  |
