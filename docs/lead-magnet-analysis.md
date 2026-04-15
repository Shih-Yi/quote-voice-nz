# ChurQuote — Lead Magnet Analysis

*Framework: Lead Magnet Concept Generator & Scorer*
*Date: 2026-04-15*

---

## Context Summary

| Element | Detail |
|---------|--------|
| **Target audience** | NZ sole trader / small team tradie (plumber, sparky, landscaper, builder). Problem-aware (Stage 2). Hates paperwork. Does admin at night. |
| **Core product** | ChurQuote — Voice-to-quote tool. 60-second quotes from the job site. |
| **Primary pain point** | Hours wasted each week typing up quotes at the kitchen table instead of being with family. Losing jobs to faster quoters. |
| **Desired outcome** | Send professional, GST-calculated quotes in 60 seconds. Get evenings back. Win more work by quoting first. |
| **Delivery channel** | Embedded on landing page (React/Next.js). No third-party tools. |
| **Technical constraints** | Next.js 16 + React 19 + Tailwind CSS 4. Can build fully interactive client-side tools. |

---

## 5 Concepts

### Concept 1: Quote Time Calculator

- **Type:** Calculator / Estimator
- **Hook:** "How many hours are you wasting on quotes every week? Find out in 60 seconds."
- **What they get:** Personalised report showing: weekly hours lost to quoting, annual cost in lost jobs (dollar figure), and how much time they'd save with voice quoting.
- **What we get:** Email, trade type, weekly quote volume, average job value — high-quality segmentation + qualification data.
- **Time to consume:** 60–90 seconds
- **Build complexity:** Medium
- **Product bridge:** Calculator output directly shows the gap ChurQuote fills. "You're spending 4.5 hours/week on quotes. ChurQuote cuts that to 20 minutes. Want to try it?"

### Concept 2: Trade Business Health Check Quiz

- **Type:** Assessment / Quiz
- **Hook:** "Is your quoting process costing you jobs? Take the 2-minute health check."
- **What they get:** A score out of 100 across 5 dimensions (speed, accuracy, professionalism, follow-up, pricing) with personalised recommendations.
- **What we get:** Email, trade type, operational data, specific pain points — deep segmentation for email nurture.
- **Time to consume:** 2–3 minutes
- **Build complexity:** Medium-High
- **Product bridge:** Low scores in speed/professionalism directly map to ChurQuote features. Recommendations include "try voice quoting" as the fix.

### Concept 3: NZ Trade Rates Benchmark

- **Type:** Data Report / Benchmark
- **Hook:** "What do NZ tradies actually charge per hour in 2026? See how your rates compare."
- **What they get:** Interactive benchmark showing hourly rates by trade, region, and experience level. Compare their own rate against the market.
- **What we get:** Email, trade type, hourly rate, region — pricing data is gold for product development and content marketing.
- **Time to consume:** 60 seconds
- **Build complexity:** Medium (need benchmark data — can seed with NZ industry averages from Stats NZ / trade associations)
- **Product bridge:** Moderate. "Now that you know your rate is competitive, make sure you're quoting fast enough to win the work."

### Concept 4: Professional Quote Template Pack

- **Type:** Template / Swipe File
- **Hook:** "Download 5 professional quote templates designed for NZ tradies. GST-ready."
- **What they get:** 5 trade-specific quote templates (plumber, sparky, builder, landscaper, painter) formatted for NZ with GST, professional layout, terms & conditions.
- **What we get:** Email, trade type.
- **Time to consume:** Instant (download)
- **Build complexity:** Low
- **Product bridge:** Templates show what "good" looks like — but using them still requires manual work. ChurQuote generates these automatically from voice. "Like these templates? ChurQuote fills them in for you — from your voice."

### Concept 5: 3 Free Voice Quotes (Product Trial)

- **Type:** Mini-Tool / Free Version
- **Hook:** "Send 3 professional voice quotes — completely free. No sign-up required."
- **What they get:** Actual use of the product. 3 voice-to-quote conversions with full GST calculation, PDF generation, and share link.
- **What we get:** Email (after first quote), trade type (inferred from quote content), usage data, conversion signal.
- **Time to consume:** 2–5 minutes (actual usage)
- **Build complexity:** Low (product already exists — just gate it)
- **Product bridge:** Maximum. They've already used the product. The lead magnet IS the product. Upgrade path: "You've used 3 of 3 free quotes. Unlock unlimited quoting."

---

## Scoring Matrix

| Concept | Perceived Value | Specificity | Speed to Value | Lead Quality | Product Bridge | Build Effort | **Total** |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 1. Quote Time Calculator | 4 | 5 | 5 | 4 | 5 | 4 | **27** |
| 2. Health Check Quiz | 4 | 4 | 3 | 5 | 4 | 3 | **23** |
| 3. Trade Rates Benchmark | 5 | 5 | 4 | 3 | 3 | 3 | **23** |
| 4. Quote Template Pack | 3 | 4 | 5 | 2 | 3 | 5 | **22** |
| 5. 3 Free Voice Quotes | 5 | 5 | 3 | 5 | 5 | 5 | **28** |

### Analysis

**Concept 5 (3 Free Voice Quotes)** scores highest at 28/30 — the product IS the lead magnet. However, this is essentially the existing free tier (Starter plan: 5 quotes/month). It doesn't create a distinct lead magnet moment on the landing page.

**Concept 1 (Quote Time Calculator)** scores 27/30 and is the best *dedicated lead magnet* — it's fast, personalised, creates an emotional "I'm wasting HOW much?!" moment, and bridges directly to the product. It also captures the highest-quality data for segmentation.

**Winner: Concept 1 — Quote Time Calculator**

Tiebreaker applied: Both score 5 on Product Bridge. But Concept 1 creates a standalone conversion moment on the landing page that Concept 5 doesn't — it works for pre-launch (waitlist) AND post-launch (trial). Concept 5 becomes the natural next step AFTER the calculator result.

**Runner-up: Concept 5** — deploy as the secondary CTA ("Try 3 free quotes") once the product is live. Concept 3 (Trade Rates) is the best content marketing play for SEO/social — build it as a separate page later.

---

## Winner: Quote Time Calculator

### Overview

- **Type:** Calculator / Estimator
- **Format:** Interactive multi-step form embedded on landing page
- **Delivery:** Inline on landing page (between Social Proof and FAQ sections) + dedicated `/tools/quote-calculator` page
- **Estimated build time:** 1 day

### User Flow

1. User sees "How much time are you wasting on quotes?" section on landing page
2. Step 1: Select trade type (plumber, electrician, builder, landscaper, painter, other)
3. Step 2: Enter number of quotes per week (slider: 1–20)
4. Step 3: Enter average minutes per quote (slider: 10–60 mins, default 30)
5. Step 4: Enter average job value ($) — with NZD input
6. Email gate: "Enter your email to see your full results"
7. Results page shows:
   - Weekly hours wasted on quoting
   - Monthly hours wasted
   - Annual revenue at risk (jobs lost to slow quoting — estimated at 15% of quotes)
   - "With ChurQuote" comparison (1 minute per quote)
   - Time saved per week / month / year
   - Dollar value of time saved (at their hourly rate)
8. CTA: "Join the Waitlist" or "Try 3 Free Quotes"

### Data Captured

| Field | Type | Purpose |
|-------|------|---------|
| Trade type | Select | Segmentation — personalise email nurture |
| Quotes per week | Number | Qualification — high-volume = high-value lead |
| Minutes per quote | Number | Pain severity signal |
| Average job value | Currency | Revenue potential — prioritise outreach |
| Email | Email | Required for results delivery |

### Calculation Logic

**Inputs:**
- `trade`: string (for display only)
- `quotesPerWeek`: number (1–20)
- `minsPerQuote`: number (10–60)
- `avgJobValue`: number (NZD)

**Calculations:**
```
weeklyHoursWasted = (quotesPerWeek * minsPerQuote) / 60
monthlyHoursWasted = weeklyHoursWasted * 4.33
annualHoursWasted = weeklyHoursWasted * 52

// Assume 15% of quotes lost to slow response
annualJobsLost = quotesPerWeek * 52 * 0.15
annualRevenueLost = annualJobsLost * avgJobValue

// With ChurQuote: 1 min per quote
churquoteWeeklyMins = quotesPerWeek * 1
timeSavedWeeklyHours = weeklyHoursWasted - (churquoteWeeklyMins / 60)
timeSavedAnnualHours = timeSavedWeeklyHours * 52
```

**Output Ranges:**
- Weekly hours: 0.2 – 20 hrs (most tradies: 2–8 hrs)
- Annual revenue at risk: $500 – $200,000+ (attention-grabbing number)
- Time saved: displayed in hours + "That's X evenings back with your family"

### Results Display

**Before/After Comparison Card:**
```
┌─────────────────────────────────────┐
│  YOUR QUOTING COST                  │
│                                     │
│  ⏱ 6.5 hrs/week on quotes          │
│  📅 338 hrs/year (that's 42 days!)  │
│  💸 $18,720/year in lost jobs       │
│                                     │
│  WITH CHURQUOTE                     │
│                                     │
│  ⏱ 15 min/week on quotes           │
│  📅 13 hrs/year                     │
│  ✅ 325 hours saved per year        │
│  ✅ That's 40 evenings back         │
│                                     │
│  [Join the Waitlist — Free]         │
└─────────────────────────────────────┘
```

### Key UX Requirements

- Progress indicator: Step X of 4
- Mobile-first: large touch targets, big sliders, thumb-friendly
- No page reloads — all client-side React state
- Animated number transitions on results page
- Email gate BEFORE results (they've invested time — completion bias kicks in)
- Share button: "Share your results" for organic social distribution
- NZ formatting: dollar amounts with $ prefix, commas for thousands

---

## Landing Page Section Copy

**Headline:**
> How Much Is Slow Quoting Costing You?

**Subheadline:**
> Most tradies don't realise how many hours — and jobs — they lose to manual quoting. Find out in 60 seconds.

**3 bullet points:**
> - See exactly how many hours you waste on quotes each week
> - Calculate the dollar cost of losing jobs to faster quoters
> - Get a personalised comparison: your current process vs. voice quoting

**CTA button text:**
> Calculate My Quote Cost

**Trust element:**
> Free. Takes 60 seconds. No sign-up required to start.

---

## Promotion Plan

**Primary channel:** Embedded on landing page — every visitor sees it. Also runs as a standalone page at `/tools/quote-calculator` for direct ad traffic.

**Ad integration:** Facebook ad variation: "NZ tradies: how much is slow quoting costing your business? Free calculator →" drives directly to the tool page.

**Email follow-up (after completion):**
1. **Immediate:** Results summary email with PDF attachment + "Join the waitlist" CTA
2. **Day 2:** "Remember those X hours you're losing? Here's how one plumber fixed it" (case study / mechanism email)
3. **Day 5:** "Your waitlist spot is ready" (early access offer)

**Retargeting:** Anyone who starts but doesn't finish → retarget with "You left your results behind. Finish the calculation →"

**Organic distribution:** Results page includes "Share your results" button (Web Share API / copy link). Social copy: "I just found out I waste [X] hours a week on quotes. 😳 Check yours →"

---

## Runner-Up: 3 Free Voice Quotes

If the calculator underperforms, deploy Concept 5 as the primary lead magnet. This requires no new build — gate the existing free tier at 3 quotes (currently 5) and position it as a lead magnet rather than a pricing tier. The advantage: zero build time, maximum product exposure. The risk: requires the product to be live, which the calculator doesn't.
