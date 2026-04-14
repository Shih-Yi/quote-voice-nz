---
name: lead-magnet
description: "Generate, score, and select high-converting lead magnet concepts for any business. Produces 3-5 lead magnet ideas with automated scoring across desirability, deliverability, and lead quality. Outputs the winning concept with full implementation spec — including embedded interactive tools (quizzes, calculators, assessments) that replace paid tools like Typeform or Tally."
---

# Lead Magnet - Concept Generator & Scorer

Generate lead magnet concepts that actually convert. This skill produces 3-5 distinct concepts, scores them objectively, selects the winner, and outputs an implementation-ready spec — including interactive embeddable tools built directly into the landing page.

---

## Philosophy

Most lead magnets fail because they optimise for volume over quality. A PDF checklist gets downloads but attracts tyre-kickers. The best lead magnets:

1. **Solve a real micro-problem** — not "educate" in the abstract
2. **Demonstrate the product's value** — the lead magnet IS the first taste of what you sell
3. **Qualify the lead** — the act of consuming it reveals buying intent
4. **Create an open loop** — completing it makes the reader want the full solution

---

## Phase 1: Lead Magnet Context

Extract from the user (or infer from prior positioning/copy work):

- **Target audience** — Who specifically? (Job title, pain level, awareness stage)
- **Core product/service** — What are we ultimately selling?
- **Primary pain point** — What problem keeps them up at night?
- **Desired outcome** — What does the "after" state look like?
- **Delivery channel** — Where will this live? (Landing page, social, email, in-app)
- **Technical constraints** — Can we build interactive tools? Static PDF only? Budget?

---

## Phase 2: Lead Magnet Archetypes

Generate concepts from these proven archetypes. Not all will fit — select the 3-5 most relevant:

### Archetype 1: The Calculator / Estimator
- User inputs their data, gets a personalised result
- Examples: "Quote Time Calculator — How many hours do you waste on quotes per week?", "Pricing Sanity Check — Are you charging enough for your trade?"
- Why it works: Immediate personalised value. High engagement. Natural product bridge
- Best for: SaaS, services, financial products
- Build: Embed directly in landing page using React components. No third-party tools needed

### Archetype 2: The Assessment / Quiz
- Series of questions that diagnose the user's situation
- Examples: "Is Your Quoting Process Costing You Jobs?", "Trade Business Health Check — Score Your Operations"
- Why it works: Self-discovery is compelling. Results create urgency. Segmentation data is gold
- Best for: Any B2B service, coaching, consulting, SaaS
- Build: Multi-step form with conditional logic, progress bar, results page — all client-side

### Archetype 3: The Template / Swipe File
- Ready-to-use resource the reader can deploy immediately
- Examples: "NZ Tradie Quote Template Pack", "Professional Invoice Templates for Kiwi Trades"
- Why it works: Instant utility. Low friction to consume. Shows what "good" looks like
- Best for: Productised services, tools, platforms
- Build: Downloadable PDF/Doc or interactive template within the app

### Archetype 4: The Checklist / Scorecard
- Step-by-step list that simplifies a complex process
- Examples: "The 10-Point Quote Checklist — Never Miss a Line Item Again", "Job Handover Checklist for Trade Teams"
- Why it works: Reduces overwhelm. Immediately actionable. Shareable
- Best for: Process-heavy industries, compliance, operations
- Build: Interactive checklist with progress tracking, or simple PDF

### Archetype 5: The Mini-Tool / Free Version
- Stripped-down version of the core product
- Examples: "Send 3 Free Voice Quotes — No Sign-Up Required", "Try the Quote Builder — Free for Your First Job"
- Why it works: The product IS the lead magnet. Highest-quality leads. Shortest path to conversion
- Best for: SaaS, apps, tools with clear trial mechanics
- Build: Gated feature within the existing product

### Archetype 6: The Data Report / Benchmark
- Original data or industry benchmarks the audience can't get elsewhere
- Examples: "2026 NZ Trade Rates Report — What Tradies Actually Charge Per Hour", "Average Quote Response Times by Trade — NZ Data"
- Why it works: Curiosity-driven. Shareable. Positions you as the authority
- Best for: Marketplaces, platforms with data, industry-specific SaaS
- Build: Interactive data visualisation or PDF report

### Archetype 7: The Challenge / Email Course
- Multi-day structured programme delivered via email
- Examples: "5-Day Quote Speed Challenge — Cut Your Quote Time in Half", "The 7-Day Trade Business Tune-Up"
- Why it works: Extended engagement window. Multiple touchpoints. Builds habit
- Best for: High-consideration purchases, coaching, complex products
- Build: Automated email sequence with daily actions

---

## Phase 3: Concept Generation

For each selected archetype, develop a specific concept:

**Concept format:**
```
### Concept [N]: [Name]
- **Type:** [Archetype name]
- **Hook:** [One-sentence pitch to the audience]
- **What they get:** [Specific deliverable]
- **What we get:** [Data captured, qualification signal, next step]
- **Time to consume:** [How long it takes the user]
- **Build complexity:** [Low / Medium / High]
- **Product bridge:** [How this naturally leads to the paid product]
```

Generate 3-5 concepts. Ensure variety across archetypes — don't generate 5 PDFs.

---

## Phase 4: Scoring Matrix

Score each concept on these 6 dimensions (1-5):

| Dimension | Question |
|-----------|----------|
| **Perceived value** | Would the audience stop scrolling and want this immediately? |
| **Specificity** | Is this clearly for THEM, not everyone? |
| **Speed to value** | How fast do they get the payoff? (Instant = 5, Days = 1) |
| **Lead quality** | Does consuming this signal buying intent? |
| **Product bridge** | How naturally does this lead to the paid offering? |
| **Build effort** | Can we ship this in days, not months? (Easy = 5, Hard = 1) |

**Scoring rules:**
- Total possible: 30 points
- **25-30:** Ship it immediately
- **20-24:** Strong candidate, minor refinements needed
- **15-19:** Viable but has gaps — consider combining elements
- **Below 15:** Discard

**Tiebreaker:** If two concepts score within 2 points, prefer the one with higher "Product bridge" score — the lead magnet should make the sale easier, not just grow the list.

---

## Phase 5: Winner Expansion

For the top-scoring concept, produce:

### 5A: Full Specification

```
## Lead Magnet: [Name]
### Overview
- Type: [Archetype]
- Format: [Interactive tool / PDF / Email course / etc.]
- Delivery: [Embedded on landing page / Email / Download / In-app]
- Estimated build time: [Days]

### User Flow
1. [Step 1 — e.g. User lands on page, sees the tool]
2. [Step 2 — e.g. Inputs their trade type and weekly quote volume]
3. [Step 3 — e.g. Gets personalised result with benchmark comparison]
4. [Step 4 — e.g. CTA to try the full product]

### Data Captured
- [Field 1 — e.g. Trade type (segmentation)]
- [Field 2 — e.g. Email (required for results)]
- [Field 3 — e.g. Weekly quote volume (qualification)]

### Content Outline
[Detailed outline of the lead magnet content/questions/sections]
```

### 5B: Interactive Tool Spec (if applicable)

For calculator/quiz/assessment types, provide:

**Component structure:**
```
- Container: Multi-step form or single-page tool
- Step 1: [Input fields, labels, validation]
- Step 2: [Input fields, labels, validation]
- ...
- Results page: [What's shown, how it's calculated, CTA placement]
```

**Key UX requirements:**
- Progress indicator (step X of Y)
- Mobile-first: thumb-friendly inputs, large tap targets (44x44px minimum)
- No page reloads — client-side state management
- Email gate: collect email BEFORE showing results (or after, based on strategy)
- Results should feel personalised — reference their inputs in the output
- Share mechanic: "Share your results" for organic distribution

**Calculation logic (if calculator):**
- Input variables and their types
- Formula or scoring logic
- Output format and ranges
- Benchmark data for comparison

### 5C: Landing Page Section Copy

Write the copy for the lead magnet CTA section on the main landing page:

- **Headline:** What they get
- **Subheadline:** Why it matters / what they'll learn
- **3 bullet points:** Specific outcomes from using it
- **CTA button text:** Action-oriented, first-person
- **Trust element:** "Free", "No sign-up required", "Takes 2 minutes"

### 5D: Promotion Plan

- **Primary channel:** Where to drive traffic to this lead magnet
- **Email follow-up:** What happens after they opt in (sequence outline)
- **Retargeting:** How to re-engage those who started but didn't finish
- **Organic distribution:** How the lead magnet can spread without paid ads

---

## Phase 6: Anti-Patterns to Avoid

- **The generic eBook** — "10 Tips for Growing Your Business" attracts nobody specific
- **The gated blog post** — Don't gate content that should be free. Gate tools and data
- **Over-promising** — "This FREE guide will 10x your revenue" destroys trust, especially in NZ
- **Asking too much** — Name + email is the maximum for initial capture. More fields = fewer leads
- **No product bridge** — If the lead magnet doesn't create desire for the paid product, it's just charity
- **Fake scarcity** — "Only 100 copies left!" on a digital PDF. Kiwis see through this instantly
- **Typeform/Tally dependency** — Build it natively. Third-party tools add friction, cost money, and break brand consistency

---

## Output Format

```
## Context Summary
[Audience, product, pain point, delivery channel]

## 3-5 Concepts
[Each with full concept format from Phase 3]

## Scoring Matrix
[Table with all concepts scored]

## Winner: [Concept Name]
[Full specification from Phase 5]

## Runner-Up
[Brief note on which concept to test second if the winner underperforms]
```

---

## Key Principles

- **The best lead magnet is a free taste of the product.** If your product solves the problem, let them experience solving it.
- **Interactive beats static.** A calculator that gives personalised results outperforms a PDF every time.
- **Gate the result, not the tool.** Let them play with the tool — collect the email when they want their results.
- **One lead magnet, one audience.** Don't try to serve everyone. A lead magnet for plumbers will outperform a generic "tradie" one.
- **Speed to value is everything.** If it takes more than 2 minutes to get value, most people won't finish.
- **Build it yourself.** Embedded tools > third-party forms. Better UX, better data, better brand, zero recurring cost.
