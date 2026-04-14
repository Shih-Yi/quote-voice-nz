---
name: seo-content
description: "Generate SEO-optimised page content for specific target keywords. Produces full page content with on-page SEO, semantic structure, internal linking, schema markup, and NZ localisation. Use this skill when the user has a target keyword (from keyword research) and needs the actual page content written — blog posts, landing pages, comparison pages, programmatic SEO templates, or resource pages."
---

# SEO Content - Search-Optimised Page Generator

Produce publication-ready page content that ranks. Takes a target keyword and outputs fully structured content with proper on-page SEO, semantic HTML heading hierarchy, internal linking strategy, and schema markup recommendations.

---

## Philosophy

SEO content that ranks in 2026 must be:
1. **Genuinely useful** — answers the searcher's question better than anything else on page 1
2. **Structurally sound** — proper heading hierarchy, schema, internal links
3. **Intent-matched** — the content format matches what Google already rewards for this query
4. **Differentiated** — has something the current top results don't (data, tools, specificity, freshness)

This is not about keyword stuffing or word count targets. It's about being the best result for the query.

---

## Phase 1: SERP Analysis

Before writing, analyse what currently ranks:

### 1A: Top Results Audit

For the target keyword, examine the current page 1:

| Position | Title | URL | Content Type | Word Count | Key Differentiator |
|----------|-------|-----|-------------|------------|-------------------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |

**Identify:**
- **Dominant content format:** Is Google rewarding listicles? Guides? Tools? Comparisons?
- **Content depth:** How comprehensive are the top results? What do they all include?
- **Content gaps:** What do ALL top results miss? This is your opportunity
- **Freshness signals:** Are dates prominent? Are results recent?
- **SERP features:** Featured snippets? People Also Ask? Video carousels? Image packs?

### 1B: Intent Confirmation

Confirm the search intent matches your planned content:

| Intent Type | SERP Signals | Your Content Should |
|-------------|-------------|-------------------|
| Informational | How-to articles, guides, Wikipedia | Educate thoroughly, answer comprehensively |
| Commercial | Comparison tables, "best of" lists, reviews | Compare options, make recommendations |
| Transactional | Product pages, pricing, CTAs | Sell directly, minimal friction to convert |
| Local | Map pack, local business listings | Include location-specific content and schema |

**If intent is mixed:** Create content that serves the dominant intent first, then naturally transitions to your conversion goal.

---

## Phase 2: Content Architecture

### 2A: Page Structure

```
## [H1 — Primary keyword, natural language]

[Opening paragraph — Hook + promise + keyword inclusion]

## [H2 — First major section]
### [H3 — Subsection if needed]

## [H2 — Second major section]

## [H2 — Third major section]

## [H2 — FAQ section (targets "People Also Ask")]

## [H2 — Conclusion / CTA section]
```

**Heading rules:**
- One H1 per page — contains the primary keyword naturally
- H2s should target secondary keywords or closely related queries
- H3s for subtopics within a section — don't skip heading levels
- Every heading should be scannable — a reader should understand the page from headings alone

### 2B: Content Blocks

Each section should use the appropriate content block:

| Block Type | When to Use | SEO Benefit |
|-----------|-------------|-------------|
| **Paragraph** | Explanations, context, narrative | Keyword density, featured snippet eligibility |
| **Bullet list** | Features, benefits, steps | Scanability, featured snippet (list type) |
| **Numbered list** | Sequential steps, rankings | Featured snippet (ordered list) |
| **Table** | Comparisons, data, specs | Featured snippet (table), rich result |
| **FAQ accordion** | Common questions | FAQ schema, People Also Ask |
| **Callout/Tip box** | Key takeaways, warnings | Engagement, time on page |
| **Image + alt text** | Visual explanations, screenshots | Image search, accessibility |
| **Embedded tool** | Calculators, interactive elements | Engagement, backlinks, dwell time |

---

## Phase 3: Content Writing

### 3A: Opening (First 100 Words)

The opening must:
- Include the primary keyword in the first sentence naturally
- State what the reader will get from this page (the promise)
- Match the search intent immediately — don't waste time with a preamble
- Hook with specificity: data, a bold claim, or a relatable pain point

**Anti-patterns:**
- "In today's fast-paced world..." — generic, adds no value
- "Are you looking for...?" — weak, delayed gratification
- Long throat-clearing before getting to the point
- Dictionary definitions ("A quote is defined as...")

### 3B: Body Content

**Writing rules:**
- **One idea per paragraph.** Short paragraphs (2-4 sentences max)
- **Front-load value.** Put the answer first, then expand. Don't bury the lead
- **Use the inverted pyramid.** Most important information first, details after
- **Include NZ context.** Localise every section where relevant — mention NZ regulations, pricing in NZD, Kiwi terminology
- **Natural keyword placement.** Primary keyword 3-5 times. Secondary keywords 1-2 times each. Never forced
- **Link internally.** Every page should link to 2-3 related pages on your site. Use descriptive anchor text (not "click here")
- **External references.** Link to authoritative sources where it adds credibility (government sites, industry bodies)

### 3C: Multimedia Directives

Specify what non-text elements the page needs:

```
### Image Requirements
- Hero image: [Description, purpose]
- Diagram/Infographic: [What it explains]
- Screenshot: [What to show]
- Alt text: [Descriptive, keyword-aware, not stuffed]

### Video (if applicable)
- Embed position: [Where in the content]
- Purpose: [Demo, explanation, testimonial]

### Interactive Element (if applicable)
- Type: [Calculator, quiz, template]
- Position: [Where in the content]
- Purpose: [Engagement, lead capture, utility]
```

---

## Phase 4: On-Page SEO Specification

### 4A: Meta Tags

```
### Meta Tags
- **Title tag:** [55-60 chars | Primary keyword front-loaded | Compelling to click]
- **Meta description:** [150-155 chars | Includes keyword | Includes CTA or benefit | Ends with action]
- **URL slug:** /[clean-hyphenated-keyword]
- **Canonical URL:** [Self-referencing or specify if consolidating]
```

**Title tag formula options:**
- `[Primary Keyword]: [Benefit] | [Brand]`
- `[Number] [Primary Keyword] [Modifier] ([Year]) | [Brand]`
- `[Primary Keyword] — [Unique angle] | [Brand]`
- `How to [Primary Keyword] in [Timeframe] | [Brand]`

### 4B: Schema Markup

Specify the appropriate structured data:

| Content Type | Schema Type | Key Properties |
|-------------|------------|----------------|
| How-to guide | HowTo | name, step[].text, totalTime |
| FAQ page | FAQPage | mainEntity[].name, .acceptedAnswer |
| Product page | Product | name, description, offers.price, offers.priceCurrency: NZD |
| Comparison | ItemList | itemListElement[].name, .position |
| Local service | LocalBusiness | name, address, areaServed |
| Article | Article | headline, datePublished, dateModified, author |

Provide the schema as JSON-LD ready to paste into `<head>`.

### 4C: Internal Linking Plan

```
### Internal Links
**From this page to:**
- [/page-1] — anchor text: "[descriptive text]"
- [/page-2] — anchor text: "[descriptive text]"
- [/page-3] — anchor text: "[descriptive text]"

**To this page from:**
- [/existing-page-1] — suggested anchor text: "[descriptive text]"
- [/existing-page-2] — suggested anchor text: "[descriptive text]"
```

---

## Phase 5: Content Quality Checks

### The Searcher Test
- [ ] If someone googled this keyword, would this page satisfy their query completely?
- [ ] Would they need to hit "back" and try another result? If yes, what's missing?
- [ ] Does the content match the dominant format Google rewards for this query?

### The Skimmer Test
- [ ] Can a reader understand the page from headings and bold text alone?
- [ ] Is the most important information above the fold?
- [ ] Are paragraphs short enough for mobile reading?

### The NZ Test
- [ ] All spelling follows NZ/British conventions?
- [ ] Currency in NZD where applicable?
- [ ] GST considerations mentioned where relevant?
- [ ] Local context and examples used?
- [ ] Date format DD/MM/YYYY?

### The SEO Test
- [ ] Primary keyword in: H1, first paragraph, one H2, meta title, meta description, URL?
- [ ] Secondary keywords included naturally?
- [ ] Internal links present (2-3 minimum)?
- [ ] Schema markup specified?
- [ ] Alt text for all images?
- [ ] No keyword stuffing — reads naturally?

### The Differentiation Test
- [ ] What does this page have that the current #1 result doesn't?
- [ ] Is there a specific reason to link to this page? (Original data, tool, template, unique insight)
- [ ] Would an expert in this field find this content accurate and useful?

---

## Phase 6: Programmatic Content Templates

For programmatic SEO pages (generated from keyword patterns), provide:

```
## Template: [Pattern Name]
### Variables
- {{variable_1}}: [Description, data source]
- {{variable_2}}: [Description, data source]

### Template Content

# [H1: {{variable_1}} Quote Template NZ — Free Download]

[Opening paragraph using {{variable_1}} naturally. Mention NZ context.
State what the reader will get.]

## What to Include in a {{variable_1}} Quote

[Bulleted list of common line items for {{variable_1}} work.
This section MUST be unique per variation — not generic filler.]

## Average {{variable_1}} Rates in NZ ({{current_year}})

[Table of rate ranges. Data must be NZ-specific.]

| Service | Rate Range (NZD) | Notes |
|---------|-----------------|-------|
| {{service_1}} | ${{min}}-${{max}} | {{note}} |

## Tips for Quoting {{variable_1}} Work

[3-5 practical tips specific to this trade type.]

## Free {{variable_1}} Quote Template

[CTA to use the product or download template.]

### Quality Rules
- Minimum {{X}} words unique content per page
- Each variation must have trade-specific line items (not generic)
- Rate data must be sourced or clearly estimated
- Do not generate pages for variations with insufficient unique content
```

---

## Output Format

```
## SERP Analysis
[Current top results, format, gaps]

## Content Architecture
[Full heading structure with keyword mapping]

## Full Page Content
[Publication-ready content with all sections]

## On-Page SEO Spec
[Meta tags, schema, internal links]

## Multimedia Directives
[Images, videos, interactive elements needed]

## Quality Check Results
[Pass/fail on each check]

## Programmatic Template
[If applicable — full template spec]
```

---

## Key Principles

- **Be the last click.** The page must fully satisfy the search query so the reader doesn't need to go back to Google.
- **Format matches intent.** Don't write a 3,000-word guide when Google rewards a comparison table. Match what's already winning.
- **NZ specificity is a moat.** Global content can't compete with genuinely localised NZ content. Include local data, terminology, and context in every piece.
- **Useful > Optimised.** A genuinely useful page with imperfect SEO will outrank a perfectly optimised page that adds no value.
- **Every page earns its existence.** If you can't articulate why this page deserves to rank above what's already there, don't publish it.
- **Programmatic doesn't mean low quality.** Template pages must have genuine unique content per variation. Thin pages will be deindexed.
