# Tarksh AI POC - Implementation Plan

## Context

Before building the full 193-task Tarksh Inbox, we need to validate the AI brain. This POC connects to real Beds24 data and runs the 5-step AI routing pipeline (Haiku classify → never-auto check → KB match → Sonnet generate → route) to measure accuracy and learn what works before committing to the full build.

## What It Does

A standalone Next.js app with a simple web UI that:
1. **Auto-generates the Knowledge Base** from 3 sources:
   - Beds24 API (property metadata, booking data)
   - OTA listing pages (Airbnb/Booking.com descriptions, amenities, house rules, check-in instructions)
   - Historical guest-host messages (analyze patterns — what does the host typically reply about wifi, directions, etc.)
   - Claude (Sonnet) structures all this raw data into our KB format → human reviews and edits
2. Fetches real guest messages from Beds24 API
3. Runs each message through the AI pipeline
4. Shows intent, KB match, generated response, and routing decision
5. Lets you rate results (good/needs-edit/bad) and tracks success metrics

## Tech Stack

- **Next.js 14+ (App Router)** — single project for UI + API routes
- **Anthropic SDK** (`@anthropic-ai/sdk`) — Haiku for classification, Sonnet for response generation + KB generation
- **Beds24 API** — direct HTTP calls to fetch properties, bookings, messages
- **cheerio** — parse OTA listing HTML (Airbnb, Booking.com) to extract property details
- **JSON files** — KB data + results persistence (no database)
- **Tailwind + shadcn/ui** — quick UI
- **recharts** — dashboard charts

## Project Structure

```
poc/
├── .env.local                    # ANTHROPIC_API_KEY, BEDS24_API_KEY
├── package.json
├── data/
│   ├── kb/sample-property.json   # Pre-filled KB (from docs/ai-agent.md Sunset Villa)
│   ├── results/test-results.json # Evaluation results + ratings
│   └── test-suite/batch-messages.json  # 72 test examples from taxonomy doc
├── src/
│   ├── lib/
│   │   ├── types.ts              # POC types (PipelineResult, KnowledgeBase, etc.)
│   │   ├── constants.ts          # Model IDs, pricing
│   │   ├── ai/
│   │   │   ├── intent-map.ts     # INTENT_TO_KB_MAP + NEVER_AUTO_INTENTS (from taxonomy doc)
│   │   │   ├── prompts.ts        # Haiku + Sonnet system prompts (verbatim from taxonomy doc)
│   │   │   ├── classifier.ts     # Haiku intent classification
│   │   │   ├── kb-matcher.ts     # Deterministic KB field lookup
│   │   │   ├── generator.ts      # Sonnet response generation
│   │   │   ├── pipeline.ts       # Full 5-step orchestrator
│   │   │   └── kb-generator.ts   # AI-powered KB generation from raw data sources
│   │   ├── scraper/
│   │   │   ├── airbnb.ts         # Scrape Airbnb listing page → extract description, amenities, rules
│   │   │   ├── booking-com.ts    # Scrape Booking.com listing → extract facilities, policies
│   │   │   └── index.ts          # Unified scraper: takes URL, detects platform, returns raw data
│   │   ├── beds24/client.ts      # Beds24 HTTP client
│   │   └── storage/
│   │       ├── results.ts        # Read/write test-results.json
│   │       └── kb.ts             # Read/write KB JSON files
│   ├── components/               # UI components (sidebar, cards, badges, charts)
│   └── app/
│       ├── layout.tsx            # App shell with sidebar
│       ├── dashboard/page.tsx    # Stats: success rate, intent distribution, cost
│       ├── test/page.tsx         # Single message testing (Beds24 fetch + manual input)
│       ├── batch/page.tsx        # Batch test runner (72 examples)
│       ├── kb/page.tsx           # Knowledge base editor + AI generator
│       └── api/
│           ├── ai/pipeline/route.ts      # POST: full pipeline
│           ├── ai/generate-kb/route.ts   # POST: AI KB generation from raw data
│           ├── scrape/route.ts           # POST: scrape OTA listing URL
│           ├── beds24/properties/route.ts # GET: list properties
│           ├── beds24/bookings/route.ts   # GET: bookings for property
│           ├── beds24/messages/route.ts   # GET: messages for booking
│           ├── beds24/history/route.ts    # GET: all historical messages for a property
│           ├── results/route.ts           # GET all, POST rating
│           ├── results/stats/route.ts     # GET dashboard stats
│           └── kb/[propertyId]/route.ts   # GET/PUT KB
```

---

## KB Auto-Generation Pipeline

Before testing AI responses, we auto-build the Knowledge Base from real data:

```
Step 1: Gather raw data from 3 sources
    ├── Beds24 API → property name, address, rooms, booking data
    ├── OTA listings → user pastes Airbnb/Booking.com URL
    │   ├── Airbnb: description, amenities, house rules, check-in, location
    │   └── Booking.com: facilities, policies, description, location
    └── Historical messages → fetch all bookings for property from Beds24
        └── Analyze guest questions + host replies (what does host say about wifi, etc.)
            │
            ▼
Step 2: Claude (Sonnet) structures raw data into KB format
    │   System prompt: "Given this property data from multiple sources,
    │   generate a structured KB in our exact JSON format.
    │   Fill in: check_in, check_out, wifi, amenities, house_rules,
    │   directions, parking, nearby, emergency, custom_faqs, response_preferences.
    │   Only include information that's clearly stated in the sources.
    │   Mark uncertain fields as null."
    │
    ▼
Step 3: Show generated KB in editor UI for human review
    │   - Pre-filled form with all sections
    │   - Highlight AI-generated vs empty fields
    │   - User edits, adds missing info, corrects errors
    │
    ▼
Step 4: Save finalized KB → data/kb/{propertyId}.json
```

**Historical Message Analysis**: Fetches all bookings for a property via Beds24, gets messages for each, then sends the full message history to Claude with a prompt like:
> "Analyze these guest-host conversations. Extract information the host commonly provides: WiFi details, check-in instructions, directions, house rules, nearby recommendations, etc. Return structured data."

This captures knowledge that exists in the host's past replies but isn't documented anywhere.

---

## AI Pipeline (5 Steps)

```
Guest message
    │
    ▼
Step 1: Haiku intent classification → { intent, stage }
    │   (claude-haiku-4-5-20251001, ~$0.002/call)
    ▼
Step 2: Never-auto check → is intent in NEVER_AUTO_INTENTS set?
    │   (deterministic, zero cost)
    │   YES → route_to_human, STOP
    ▼
Step 3: KB field match → check property KB has data for required fields
    │   (deterministic, zero cost, uses INTENT_TO_KB_MAP)
    │   NO DATA → no_kb_match, generate fallback "Let me check with our team", STOP
    ▼
Step 4: Sonnet response generation → generate reply using KB data
    │   (claude-sonnet-4-6, ~$0.01-0.02/call, max 500 chars)
    ▼
Step 5: Routing → high confidence = auto_send, medium = draft
```

---

## UI Pages

### 1. Dashboard (`/dashboard`)
- Stat cards: success rate, total tested, total cost, avg latency
- Intent distribution pie chart
- Routing decision bar chart

### 2. Test Messages (`/test`)
- **Beds24 tab**: Property → Booking → Message cascade dropdowns, click to test
- **Manual tab**: Paste/type any guest message, optional guest name
- **Result display**: Step-by-step pipeline breakdown with intent badge, KB match details, generated response, routing decision
- **Rating buttons**: Good / Needs Edit / Bad + notes

### 3. Batch Test (`/batch`)
- Pre-loaded 72 test messages (from taxonomy doc with expected intents)
- Select KB to test against, click "Run All"
- Results table: message, expected intent, classified intent, match?, routing, response preview
- Aggregate accuracy stats

### 4. KB Generator & Editor (`/kb`)
- **Generate KB tab**:
  - Select property from Beds24
  - Paste Airbnb listing URL (optional)
  - Paste Booking.com listing URL (optional)
  - "Fetch & Analyze" button → scrapes listings + fetches historical messages from Beds24
  - "Generate KB" button → Claude structures all raw data into KB format
  - Shows raw data sources (collapsible) so you can see what was extracted
- **Editor tab**:
  - Structured form for each section (check_in, wifi, amenities, etc.)
  - Fields pre-filled from AI generation, with markers showing source (Beds24/Airbnb/Booking.com/Messages)
  - Raw JSON toggle for power users
  - Save button persists to `data/kb/{propertyId}.json`

---

## Implementation Steps

### Phase A: Project Setup
1. Create `poc/` directory, init Next.js with TypeScript + Tailwind
2. Install deps: `@anthropic-ai/sdk`, `cheerio`, `uuid`, `recharts`
3. Set up `.env.local` (ANTHROPIC_API_KEY, BEDS24_API_KEY), `data/` directory structure

### Phase B: Core AI Library
4. `types.ts` — PipelineResult, ClassificationResult, KBMatchResult, GenerationResult, KnowledgeBase, ScrapedData
5. `constants.ts` — model IDs, pricing calculation
6. `intent-map.ts` — INTENT_TO_KB_MAP (17 mappings) + NEVER_AUTO_INTENTS (16 intents)
7. `prompts.ts` — Haiku classification + Sonnet generation + KB generation prompts
8. `classifier.ts` — Haiku intent classification via Anthropic SDK
9. `kb-matcher.ts` — Deterministic KB field lookup with dot-notation resolution
10. `generator.ts` — Sonnet response generation via Anthropic SDK
11. `pipeline.ts` — Full 5-step orchestrator
12. `kb-generator.ts` — Sonnet-powered KB generation (takes raw data → outputs structured KB JSON)

### Phase C: Scrapers + Beds24 + Storage
13. `scraper/airbnb.ts` — fetch Airbnb listing HTML, extract description/amenities/rules/check-in via cheerio
14. `scraper/booking-com.ts` — fetch Booking.com listing HTML, extract facilities/policies
15. `scraper/index.ts` — detect platform from URL, dispatch to correct scraper
16. `beds24/client.ts` — fetch properties, bookings, messages, bulk historical messages
17. `storage/results.ts` — JSON file read/write for results
18. `storage/kb.ts` — JSON file read/write for KB data

### Phase D: API Routes
19. `/api/scrape` — POST: scrape OTA listing URL, return extracted data
20. `/api/beds24/history` — GET: fetch ALL historical messages for a property (across all bookings)
21. `/api/ai/generate-kb` — POST: takes raw data (Beds24 + scraped + messages), Claude generates KB
22. `/api/ai/pipeline` — POST: full 5-step AI pipeline
23. `/api/beds24/*` — proxy routes for properties, bookings, messages
24. `/api/results` + `/api/results/stats` — results CRUD + dashboard stats
25. `/api/kb/[propertyId]` — KB CRUD

### Phase E: UI
26. Root layout with sidebar navigation
27. **KB Generator page** — property selector, listing URL inputs, fetch & analyze, generate KB, editor form
28. Dashboard page with stat cards + charts
29. Test page with Beds24 fetcher + manual input + result card
30. Batch test page with runner + results table

### Phase F: Data + Polish
31. Create batch-messages.json with 72 test examples from taxonomy doc
32. Test full flow: generate KB → test messages → rate results → check dashboard
33. Error handling for API failures, scraping edge cases

---

## Key Source Files to Reference

| File | What to extract |
|------|----------------|
| `docs/phase1-ai-intent-taxonomy.md` | INTENT_TO_KB_MAP, NEVER_AUTO_INTENTS, 72 examples, Haiku + Sonnet prompts |
| `docs/ai-agent.md` | KB structure, Sunset Villa sample data, LLMProvider pattern |
| `packages/shared/src/types/database.ts` | KnowledgeBaseData, AIRoutingDecision types to mirror |

---

## Verification

1. Run `npm run dev` in `poc/` — app loads at localhost:3000
2. Go to `/kb` → select property from Beds24 → paste Airbnb/Booking.com URLs → click "Fetch & Analyze"
3. Verify scraped data is shown → click "Generate KB" → verify Claude produces structured KB
4. Review and edit the generated KB → save
5. Go to `/test` → type "What's the wifi password?" → verify correct intent (wifi_query) + correct response
6. Fetch real Beds24 messages → verify pipeline handles real-world guest queries
7. Go to `/batch` → run all 72 test examples → check accuracy stats
8. Go to `/dashboard` → verify stats reflect all tests run
