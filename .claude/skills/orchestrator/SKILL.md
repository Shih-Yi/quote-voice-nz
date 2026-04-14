---
name: orchestrator
description: "Meta-coordination skill that assesses current project state and recommends the optimal next skill to run. Use this skill when the user isn't sure what to do next, wants a strategic overview of progress, or needs help deciding which marketing/growth skill to activate. Evaluates completed work, identifies gaps, and produces a prioritised action plan with specific skill invocations."
---

# Orchestrator - Marketing System Coordinator

Assess where you are, decide what's next. This skill evaluates the current state of your marketing system and recommends the highest-leverage next action — including which specific skill to invoke.

---

## When to Use This Skill

- "What should I do next?"
- "I've done positioning, now what?"
- "Give me an overview of where things stand"
- "What's the highest priority right now?"
- "I'm stuck — what's missing?"

---

## The Marketing System Stack

A complete go-to-market system has these layers. Each maps to a specific skill:

```
┌─────────────────────────────────────────────────────┐
│  LAYER 1: RESEARCH & POSITIONING                     │
│  Status: [Not started / In progress / Complete]      │
│  Skills: positioning-angles                          │
│  Output: Primary positioning angle, competitive map  │
├─────────────────────────────────────────────────────┤
│  LAYER 2: MESSAGING & COPY                           │
│  Status: [Not started / In progress / Complete]      │
│  Skills: direct-response-copy                        │
│  Output: Landing page copy, ad copy, email sequence  │
├─────────────────────────────────────────────────────┤
│  LAYER 3: DESIGN & BUILD                             │
│  Status: [Not started / In progress / Complete]      │
│  Skills: frontend-design                              │
│  Output: Landing page, product pages, design system  │
├─────────────────────────────────────────────────────┤
│  LAYER 4: LEAD CAPTURE                               │
│  Status: [Not started / In progress / Complete]      │
│  Skills: lead-magnet                                 │
│  Output: Lead magnet, quiz/calculator, email gate    │
├─────────────────────────────────────────────────────┤
│  LAYER 5: ORGANIC TRAFFIC                            │
│  Status: [Not started / In progress / Complete]      │
│  Skills: keyword-research → seo-content              │
│  Output: Keyword clusters, SEO pages, blog content   │
├─────────────────────────────────────────────────────┤
│  LAYER 6: PAID TRAFFIC                               │
│  Status: [Not started / In progress / Complete]      │
│  Skills: dtc-ad                                      │
│  Output: Ad strategy, creative briefs, video scripts │
└─────────────────────────────────────────────────────┘
```

---

## Phase 1: State Assessment

Evaluate what exists by checking:

### 1A: Completed Assets Audit

| Asset | Exists? | Quality | Location |
|-------|---------|---------|----------|
| Positioning angle defined | Yes/No | Strong/Weak/Untested | [file/doc] |
| Competitive landscape mapped | Yes/No | Current/Outdated | [file/doc] |
| Landing page copy written | Yes/No | Draft/Final/Tested | [file/doc] |
| Ad copy variations | Yes/No | [count] variations | [file/doc] |
| Email sequence | Yes/No | [count] emails | [file/doc] |
| Landing page designed/built | Yes/No | Live/Staging/Mockup | [URL] |
| Lead magnet created | Yes/No | Concept/Built/Live | [file/URL] |
| Keyword research done | Yes/No | Seed/Expanded/Clustered | [file/doc] |
| SEO content published | Yes/No | [count] pages | [URLs] |
| Ad campaigns running | Yes/No | Testing/Scaling | [platform] |
| Analytics tracking | Yes/No | Basic/Full | [tool] |

### 1B: Dependency Check

Some skills depend on outputs from others:

```
positioning-angles ──→ direct-response-copy ──→ frontend-design
                                              ──→ dtc-ad
                   ──→ lead-magnet
                   ──→ keyword-research ──→ seo-content
```

**Hard dependencies (must complete first):**
- `direct-response-copy` requires a positioning angle (from `positioning-angles`)
- `seo-content` requires target keywords (from `keyword-research`)
- `dtc-ad` benefits greatly from having copy and landing page ready

**Soft dependencies (better with, but can start without):**
- `frontend-design` can start with rough copy and refine later
- `lead-magnet` can run with just the positioning angle
- `keyword-research` can run independently at any time

---

## Phase 2: Gap Analysis

Identify the biggest gaps in the current system:

### Critical Gaps (Blocking Revenue)
These prevent the system from generating any results:
- No positioning → Everything downstream is unfocused
- No landing page → Nowhere to send traffic
- No conversion mechanism → Traffic has no way to become leads/customers

### Growth Gaps (Limiting Scale)
These cap the system's growth potential:
- No SEO content → Missing free organic traffic
- No ad strategy → Dependent on single channel
- No lead magnet → Only capturing high-intent visitors, missing the 97%
- No email sequence → No nurturing, one-shot conversion only

### Optimisation Gaps (Leaving Money on the Table)
These reduce efficiency of existing assets:
- Copy not tested → Unknown if messaging resonates
- No retargeting → Losing warm visitors
- No A/B tests running → Flying blind
- Analytics not configured → Can't measure what works

---

## Phase 3: Priority Recommendation

### Decision Framework

Use this priority matrix to determine the next action:

```
IF no positioning angle exists:
  → RUN positioning-angles FIRST
  → Nothing else matters until you know your angle

ELSE IF positioning exists BUT no copy:
  → RUN direct-response-copy
  → You need messaging before building anything

ELSE IF copy exists BUT no landing page:
  → RUN frontend-design to design and build
  → You need somewhere to send people

ELSE IF landing page exists BUT no lead capture:
  → RUN lead-magnet
  → You're losing 97% of visitors without a capture mechanism

ELSE IF landing page exists BUT no traffic:
  → DECISION POINT: Organic vs Paid (or both)
  
  IF budget available AND need quick results:
    → RUN dtc-ad for paid traffic strategy
    
  IF limited budget OR building for long-term:
    → RUN keyword-research → then seo-content
    
  IF both are feasible:
    → RUN keyword-research (background) + dtc-ad (foreground)
    → Paid gives immediate feedback, SEO builds compounding asset

ELSE IF everything exists:
  → OPTIMISATION MODE
  → Review metrics, identify weakest link, improve it
  → A/B test headlines, offers, audiences
  → Expand content, scale winning ads
```

### Output: The Recommendation

```
## Current State
[Summary of what exists and what's missing]

## Biggest Gap
[The single most impactful thing that's missing]

## Recommended Next Action
**Skill to run:** [skill-name]
**Why this, why now:** [1-2 sentences explaining the rationale]
**Expected output:** [What this will produce]
**Time estimate:** [How long the skill takes to run]

## After That
**Second priority:** [Next skill after the first is done]
**Third priority:** [Following action]

## Full Roadmap
[Ordered list of all remaining actions to complete the system]
```

---

## Phase 4: Progress Tracking

Maintain a simple progress tracker:

```
## Marketing System Progress

### Layer 1: Positioning
- [x] Run positioning-angles skill
- [x] Select primary angle
- [x] Validate with customer language
- [ ] Test angle in ad copy

### Layer 2: Messaging
- [x] Run direct-response-copy skill
- [ ] Write landing page copy
- [ ] Write ad copy variations
- [ ] Write email sequence
- [ ] Write lead magnet copy

### Layer 3: Design & Build
- [ ] Design landing page (frontend-design)
- [ ] Build and deploy landing page
- [ ] Set up analytics tracking
- [ ] Mobile responsiveness check

### Layer 4: Lead Capture
- [ ] Run lead-magnet skill
- [ ] Build lead magnet (quiz/calculator/template)
- [ ] Integrate email capture
- [ ] Set up email automation

### Layer 5: Organic Traffic
- [ ] Run keyword-research skill
- [ ] Prioritise keyword clusters
- [ ] Run seo-content for Tier 1 keywords
- [ ] Publish first batch of SEO pages
- [ ] Build internal linking structure

### Layer 6: Paid Traffic
- [ ] Run dtc-ad skill
- [ ] Create ad creative (static + video)
- [ ] Set up funnel (cold → warm → hot)
- [ ] Launch test campaigns
- [ ] Analyse and optimise
```

---

## Phase 5: Cross-Skill Insights

When reviewing outputs from multiple skills, look for:

### Consistency Check
- Does the ad copy match the landing page copy?
- Does the positioning angle flow through ALL copy assets?
- Is the lead magnet aligned with the primary positioning?
- Do SEO pages reinforce the brand positioning or contradict it?

### Amplification Opportunities
- Can the lead magnet be used as an ad creative? (Quiz ads perform well)
- Can SEO content be repurposed as email nurture content?
- Can customer testimonials from the proof angle feed both ads and landing page?
- Can the keyword research inform ad targeting keywords?

### Warning Signs
- Messaging drift: each asset uses a slightly different angle (pick one and align)
- Feature creep: landing page tries to sell everything instead of one thing
- Audience mismatch: ad targets one persona, landing page speaks to another
- Premature scaling: running ads before the landing page converts organically

---

## Output Format

```
## System State Assessment
[What exists, what's missing, dependency status]

## Gap Analysis
[Critical → Growth → Optimisation gaps]

## Recommended Next Action
[Specific skill to run, with rationale]

## Roadmap
[Ordered sequence of remaining actions]

## Progress Tracker
[Checkbox format, updated with current state]
```

---

## Key Principles

- **Sequence matters.** Positioning before copy. Copy before design. Design before traffic. Breaking this sequence wastes effort.
- **One thing at a time.** Don't try to do everything in parallel. Complete each layer before moving to the next (exception: keyword research can run alongside anything).
- **The bottleneck is rarely what you think.** Usually it's not "we need more traffic" — it's "our landing page doesn't convert." Fix conversion before scaling traffic.
- **Done is better than perfect.** Ship the landing page with 80% copy. Run the first ad with imperfect creative. Data from a live campaign beats hypothetical optimisation.
- **Revisit positioning regularly.** As you learn from real market feedback (ad performance, customer conversations, conversion data), your positioning should sharpen. It's not a one-time exercise.
- **Measure everything.** If you can't tell which skill's output is driving results, you can't improve. Set up tracking before scaling.
