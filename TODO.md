# KiwiSpeakQuote (KSQ) — Project TODO

> Last updated: 10/02/2026

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

## ❌ TODO (Not Yet Implemented)

### High Priority
- [x] **Testing** — 101 tests across 11 files (Vitest + React Testing Library)
- [ ] **Service Worker** — offline caching (currently PWA manifest only)
- [ ] **Audio compression** — client-side MP3 conversion before upload
- [ ] **API rate limiting** — middleware on API routes

### Medium Priority
- [ ] **Email delivery** — automated quote sending (currently manual share only)
- [ ] **"Accept Quote" flow** — customer-facing confirmation/completion logic
- [ ] **Version diff view** — compare changes between quote versions
- [ ] **Error monitoring/analytics** — usage metrics, error rate tracking

### Low Priority
- [ ] **Signature capture** — customer signature on quotes
- [ ] **Image attachments** — site photos in quotes
- [ ] **Custom item templates** — frequently used line items
- [ ] **Bulk quote operations** — batch delete/export
- [ ] **Revenue dashboard** — income stats, customer history
- [ ] **Admin panel** — user management, audit logs
- [ ] **i18n** — internationalisation beyond NZ English

---

## 📊 Project Stats

| Metric            | Value              |
| ----------------- | ------------------ |
| Lines of code     | ~6,000+            |
| React components  | ~55                |
| API routes        | 2 (transcribe, extract) |
| Pages             | 6                  |
| Custom hooks      | 4                  |
| npm packages      | 22                 |
