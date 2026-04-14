---
name: gtm-pipeline
description: "Full Go-To-Market pipeline that orchestrates the complete marketing system build — from positioning to traffic. Chains skills in dependency order: positioning-angles → direct-response-copy → frontend-design → lead-magnet → keyword-research + dtc-ad → seo-content. Use when the user wants to build a complete marketing funnel end-to-end, or resume a partially completed pipeline."
---

# GTM Pipeline - Go-To-Market System Builder

Build a complete go-to-market system in one guided session. This skill chains all marketing skills in the correct dependency order, tracks progress, and lets the user control the pace.

---

## How It Works

This is a **guided pipeline**, not a fully autonomous runner. At each stage:

1. **Assess** — Check what artifacts already exist (from prior runs or manual work)
2. **Brief** — Show the user what the next skill will do and what inputs it needs
3. **Execute** — Run the skill (or skip if the user already has the output)
4. **Checkpoint** — Save outputs, confirm with user, then advance

The user can pause, skip stages, or re-run any stage at any time.

---

## Pipeline Stages

```
Stage 0: Market Research (optional, manual)
    │
    ▼
Stage 1: Positioning Angles ──────── /positioning-angles
    │
    ▼
Stage 2: Direct Response Copy ────── /direct-response-copy
    │
    ├──────────────────────┐
    ▼                      ▼
Stage 3: Landing Page    Stage 5: Keyword Research ── /keyword-research
  /frontend-design           │
    │                        ▼
    ▼                    Stage 7: SEO Content ──────── /seo-content
Stage 4: Lead Magnet
  /lead-magnet
    │
    ▼
Stage 6: Paid Traffic ────────────── /dtc-ad
```

### Parallel Opportunities

After Stage 2 (copy), two independent tracks can run in parallel:

- **Track A (Conversion):** frontend-design → lead-magnet
- **Track B (Traffic):** keyword-research + dtc-ad → seo-content

---

## Stage 0: Market Research (Pre-Pipeline)

**Purpose:** Gather competitive intelligence before positioning.

**Actions:**
- Use Perplexity MCP, Exa, or manual research to map the competitive landscape
- Identify key players, pricing models, positioning gaps
- Capture competitor screenshots via Playwright MCP if available

**Output:** Research brief (competitor list, market gaps, opportunity areas)

**Checkpoint:** "Here's what I found about the market. Ready to find your positioning angle?"

---

## Stage 1: Positioning Angles

**Skill:** `/positioning-angles`

**Input required:**
- What you're building/selling
- Target customer profile
- Market research from Stage 0 (if available)

**Sample prompt to pass:**
> "I'm building [description]. My target customer is [profile]. Based on the market research, use the positioning angles skill to find the optimal positioning."

**Output:** 3-5 positioning angles, scored and ranked. User selects the winner.

**Checkpoint:** "We've selected [angle name] as your primary positioning. Ready to write copy?"

---

## Stage 2: Direct Response Copy

**Skill:** `/direct-response-copy`

**Input required:**
- Selected positioning angle from Stage 1
- Target audience awareness level

**Sample prompt to pass:**
> "Based on the [angle name] positioning angle, generate direct response copy concepts for our landing page. Use the skill."

**Output:** Headlines, subheads, CTAs, value props, objection handling, email sequence drafts.

**Checkpoint:** "Copy assets are ready. Next: build the landing page or start traffic research?"

---

## Stage 3: Landing Page Build

**Skill:** `/frontend-design` (Anthropic official skill)

**Input required:**
- Copy from Stage 2
- Competitor screenshots (optional, via Playwright MCP)
- Brand guidelines or aesthetic direction

**Sample prompt to pass:**
> "Based on the competitive intelligence, our positioning angle, and our direct response copy, create a conversion-optimised landing page using the frontend-design skill. Aesthetic direction: [e.g., anti-corporate, brutalist, refined minimal]."

**Key instructions for the skill:**
- Must be conversion-optimised (clear CTA above fold)
- Mobile-first, responsive
- The design must NOT look like generic AI output
- Include social proof sections, objection handling, and clear value hierarchy

**Output:** Working HTML/CSS/JS or React landing page code.

**Checkpoint:** "Landing page is built. Want to add a lead capture mechanism?"

---

## Stage 4: Lead Magnet

**Skill:** `/lead-magnet`

**Input required:**
- Positioning angle from Stage 1
- Target audience pain points
- Landing page context from Stage 3

**Sample prompt to pass:**
> "Run the lead magnet skill to generate 3-5 concepts. Pick the best one and build it as an interactive element (modal/popup) for our landing page."

**Output:** Lead magnet concept + implementation spec. Optionally integrated into the landing page.

**Checkpoint:** "Lead capture is in place. Now let's drive traffic."

---

## Stage 5: Keyword Research

**Skill:** `/keyword-research`

**Input required:**
- Business category and target market
- Positioning angle (for topical relevance)

**Sample prompt to pass:**
> "Use the keyword research skill to identify programmatic SEO opportunities targeting [market/location]. Focus on long-tail keywords aligned with our [angle name] positioning."

**Output:** Keyword clusters, difficulty scores, quick-win opportunities.

**Can run in parallel with Stage 3/4** (no dependency on landing page).

**Checkpoint:** "Keywords identified. Ready to generate SEO content?"

---

## Stage 6: Paid Traffic Strategy

**Skill:** `/dtc-ad`

**Input required:**
- Positioning angle and copy from Stages 1-2
- Landing page URL or design from Stage 3
- Target audience definition

**Sample prompt to pass:**
> "Use the DTC ad skill to create an ad strategy. Include creative briefs for static and video ads using our brand style."

**Output:** Ad strategy, audience targeting, creative briefs, video scripts.

**Can run in parallel with Stage 5.**

**Checkpoint:** "Ad strategy is ready. Want to generate SEO pages from the keyword research?"

---

## Stage 7: SEO Content

**Skill:** `/seo-content`

**Input required:**
- Keyword clusters from Stage 5
- Positioning angle for brand voice consistency

**Sample prompt to pass:**
> "Use the SEO content skill to develop a page based on the top quick-win keyword opportunity from the research."

**Output:** SEO-optimised content pages ready for publishing.

**Checkpoint:** "First SEO page is ready. Pipeline complete!"

---

## State Tracking

Maintain a progress file at `docs/gtm-pipeline-state.md` with this format:

```markdown
# GTM Pipeline Progress

**Project:** [Project name]
**Started:** [Date]
**Last updated:** [Date]
**Current stage:** [Stage number and name]

## Completed Stages

### Stage 1: Positioning Angles - COMPLETE
- **Angle selected:** [Name]
- **Output file:** [Path]
- **Date:** [Date]

### Stage 2: Direct Response Copy - COMPLETE
- **Key headline:** [Headline]
- **Output file:** [Path]
- **Date:** [Date]

## In Progress

### Stage 3: Landing Page - IN PROGRESS
- **Status:** [Details]

## Not Started

- Stage 4: Lead Magnet
- Stage 5: Keyword Research
- Stage 6: Paid Traffic
- Stage 7: SEO Content
```

---

## Resuming a Pipeline

When invoked, ALWAYS check for an existing `docs/gtm-pipeline-state.md` first:

1. If it exists, read it and report current progress
2. Show what's completed, what's in progress, and what's next
3. Ask the user: "Resume from Stage [N] or start fresh?"

If no state file exists, start from Stage 0/1.

---

## User Control Commands

The user can say at any point:

- **"Skip this stage"** — Mark as skipped, move to next
- **"Go back to stage N"** — Re-run a previous stage
- **"Run stages 5 and 6 in parallel"** — Execute independent stages simultaneously
- **"Pause"** — Save state and stop
- **"Show progress"** — Display current pipeline state
- **"What's next?"** — Falls through to the orchestrator logic

---

## Consistency Checks

After every stage, verify:

- [ ] Does the new output align with the positioning angle from Stage 1?
- [ ] Is the brand voice consistent across all copy assets?
- [ ] Does the landing page copy match the ad copy?
- [ ] Does the lead magnet serve the same audience as the ads?

If inconsistency is detected, flag it to the user before proceeding.

---

## Key Principles

1. **Sequence matters** — Positioning before copy. Copy before design. Design before traffic.
2. **User controls the pace** — Never auto-advance without confirmation.
3. **State is persistent** — Pipeline can span multiple sessions.
4. **Each stage is independently valuable** — Even if the user stops at Stage 3, they have a working landing page.
5. **Parallel when possible** — Stages 5+6 can run alongside 3+4 to save time.
