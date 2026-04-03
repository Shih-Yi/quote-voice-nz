# ChurQuote Pricing Plan

## Overview

Three-tier SaaS pricing model for ChurQuote — the voice-to-quote app for NZ tradies.

```
┌─────────────────┬──────────────────┬──────────────────┐
│   Starter       │      Pro         │      Team        │
│   FREE          │   $29 NZD/mo     │   $49 NZD/mo     │
│   Forever free  │   $290/yr (save  │   $490/yr (save  │
│                 │    $58)          │    $98)           │
├─────────────────┼──────────────────┼──────────────────┤
│ Get started     │ Professional     │ Team             │
│ with voice      │ quoting tool     │ collaboration    │
│ quoting         │ for full-time    │ for crews of     │
│                 │ tradies          │ 2-5 people       │
└─────────────────┴──────────────────┴──────────────────┘
```

- Annual billing = 2 months free (16.7% discount)
- Pro & Team: **14-day free trial** on first subscription

---

## Feature Matrix

### Core Features

| Feature | Starter (Free) | Pro ($29/mo) | Team ($49/mo) |
|---------|:-:|:-:|:-:|
| Voice-to-Quote | 5/month | Unlimited | Unlimited |
| Quote editing / delete | Yes | Yes | Yes |
| Offline storage (IndexedDB) | Yes | Yes | Yes |
| GST calculation (15%) | Yes | Yes | Yes |
| Customer signature | Yes | Yes | Yes |
| NZ / Te Reo Maori bilingual | Yes | Yes | Yes |
| PWA install | Yes | Yes | Yes |

### Sharing & Export

| Feature | Starter | Pro | Team |
|---------|:-:|:-:|:-:|
| Public quote link `/q/[slug]` | Yes (**with watermark**) | Yes (no watermark) | Yes (no watermark) |
| Email quote sending | 3/month | 50/month | 200/month |
| PDF export | Yes (**with watermark**) | Yes (no watermark) | Yes (no watermark) |
| Web Share API | Yes | Yes | Yes |

### Quote Management

| Feature | Starter | Pro | Team |
|---------|:-:|:-:|:-:|
| Quote versioning | Max 2 versions | Unlimited | Unlimited |
| Version diff view | No | Yes | Yes |
| Item templates | 3 templates | Unlimited | Unlimited + team shared |
| Image attachments | 3/quote | 20/quote | 20/quote |
| Bulk operations (multi-select/delete) | No | Yes | Yes |
| CSV export | No | Yes | Yes |
| Quote status | Draft / Sent | Draft / Sent / Accepted | Draft / Sent / Accepted |

### Analytics & Admin

| Feature | Starter | Pro | Team |
|---------|:-:|:-:|:-:|
| Revenue dashboard | Current month total only | Full (monthly/trends/customers) | Full + team stats |
| Audit log retention | 7 days | 180 days | 365 days |
| Admin panel | No | Yes | Yes |

### Team Features (Team exclusive)

| Feature | Starter | Pro | Team |
|---------|:-:|:-:|:-:|
| Team members | — | — | Up to 5 |
| Role-based access (Owner/Manager/Tradie) | — | — | Yes |
| Shared template library | — | — | Yes |

### Roadmap Features (future add-on value)

| Feature | Starter | Pro | Team |
|---------|:-:|:-:|:-:|
| CRM customer management | — | Yes | Yes |
| AI auto follow-up | — | Yes | Yes |
| SMS integration | — | 100/month | 500/month |
| Xero accounting sync | — | Yes | Yes |
| Job scheduling | — | Yes | Yes |
| Invoice system | — | Yes | Yes |

---

## Upgrade Triggers (Why Free Users Upgrade)

1. **6th voice quote** — most common trigger ("You've used 5/5 this month")
2. **Watermark on public quotes** — affects professional image with customers
3. **4th email send** — can't share more quotes via email
4. **Revenue trends** — only see current month, can't analyse history
5. **Bulk management** — quotes pile up but no batch operations available

---

## Pricing Rationale

### Unit Economics

```
Cost per Pro user/month:
  AI (Groq + OpenAI):     $0.50
  Email (Resend):          $0.10
  Supabase (at scale):     $0.10
  Vercel:                  $0.05
  ─────────────────────────────
  Total:                  ~$0.75

Pro ARPU:     $29/month
Gross Margin: ~97%
LTV (24mo):   $29 x 24 x 0.97 = $675
Target CAC:   < $100
LTV:CAC:      ~6.7:1
```

### Revenue Projections

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| Free users | 2,000 | 10,000 | 30,000 |
| Pro users | 100 (5%) | 800 (8%) | 2,400 (8%) |
| Team users | — | 200 (2%) | 600 (2%) |
| ARR (NZD) | $34,800 | $396,000 | ~$1.2M |

### NZ Market Context

- ~200,000 tradies in New Zealand
- Competitors (Tradify, Fergus): $30-60 NZD/mo range
- ChurQuote's $29 Pro is deliberately positioned at the low end
- Free tier creates viral loop via watermarked quotes

---

## Watermark Strategy

Free tier quotes display a branded footer on both public quote pages and PDF exports:

```
─────────────────────────────────
Created with ChurQuote
The voice-to-quote app for NZ tradies
churquote.co.nz | Remove watermark → Upgrade to Pro
─────────────────────────────────
```

This serves as:
- **Viral marketing** — every customer who receives a quote sees ChurQuote branding
- **Upgrade motivation** — tradies want professional-looking quotes without third-party branding
- **Social proof** — normalises ChurQuote among the tradie community

---

## Quota Exceeded UX

When a Free user hits a limit:

1. API returns `{ error: "quota_exceeded", limit: 5, used: 5, tier: "free" }`
2. Client shows a friendly modal:
   ```
   ┌─────────────────────────────────┐
   │  You've used all 5 voice       │
   │  quotes this month             │
   │                                │
   │  Upgrade to Pro for unlimited  │
   │  voice quotes, no watermarks,  │
   │  and heaps more.               │
   │                                │
   │  [Upgrade to Pro - $29/mo]     │
   │  [Maybe later]                 │
   └─────────────────────────────────┘
   ```
3. All existing quotes remain accessible (read-only, no new creation)

---

## Downgrade Policy

When a user cancels their subscription:
- Access continues until current billing period ends
- After period ends, tier reverts to Free
- **All data is preserved** — nothing is deleted
- Features beyond Free limits become read-only (e.g., templates 4+ are viewable but not editable)
- Watermark reappears on public quotes and PDFs

---

## Implementation Phases

### Phase 1: Database Foundation (Week 1)
- Create `subscriptions` and `usage_stats` tables in Supabase
- Add `subscription_tier` column to `profiles` table
- Create `useSubscription` React hook
- Create `/api/subscription/tier` endpoint

### Phase 2: Feature Gates (Week 2)
- Add quota checks to `/api/transcribe`, `/api/extract`, `/api/send-quote`
- Add watermark to `/q/[slug]` public page and PDF export
- Create `<UpgradeCTA>`, `<UsageMeter>`, `<FeatureGate>` components
- Gate bulk operations, CSV export, version diff, admin panel

### Phase 3: Stripe Integration (Week 3)
- Set up Stripe products and prices
- Create `/api/checkout` and `/api/webhooks/stripe` endpoints
- Build `/pricing` page with 3-column comparison
- Build `/settings/billing` page for subscription management

### Phase 4: Route Protection & Polish (Week 4)
- Create `middleware.ts` for auth + tier-based route guards
- Add `<UsageMeter>` to dashboard
- Handle edge cases (trial expiry, payment failure, downgrade)
- E2E testing of full upgrade flow
