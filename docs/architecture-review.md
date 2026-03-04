# Tarksh Inbox - Architecture & System Review

**Reviewer**: CTO / System Architect
**Date**: 2026-03-03
**Scope**: Full review of product outline, features, architecture, channel integrations, AI agent design, roadmap, and risks documentation.

---

## Overall Assessment

The documentation is well-thought-out for this stage. The problem statement is clear, the phased approach is pragmatic, and the scraping-first strategy makes sense for speed-to-market. However, there are several architectural flaws, design gaps, and risks that need attention before building begins.

---

## 1. CRITICAL: Confidence Scoring is a Fabrication

**Location**: `ai-agent.md` - Confidence Scoring section

The architecture says the AI will return a confidence score 0-100, but **Claude API does not return confidence scores**. The entire routing system (auto-send / draft / human) hinges on a confidence score that doesn't naturally exist. LLMs are notoriously bad at calibrating their own certainty.

### What to Do Instead

- **Intent classification first**: Use a cheaper, faster model (or even regex/keyword matching) to classify the query type (wifi, check-in, complaint, cancellation, etc.)
- **Deterministic confidence**: If the intent matches a KB field that has data, confidence is high. If it matches a KB field that's empty, confidence is low. If no intent matches, route to human. This is rule-based, not LLM-based.
- **Structured output**: Use Claude's tool-use / structured output to get the AI to select from predefined categories rather than generating a freeform number.
- **Never trust the LLM to score itself** - score based on what KB fields were referenced and whether the query fits known patterns.

---

## 2. CRITICAL: Single VPS + Playwright = Resource Bomb

**Location**: `architecture.md` - Deployment Architecture section

Running Playwright headless browsers on the same VPS as PostgreSQL, Redis, Next.js, and Socket.io is a recipe for resource starvation. Each Playwright instance consumes **150-300MB RAM** and significant CPU.

### Resource Estimates

| Scale | Scraping RAM | App RAM | Total Minimum |
|-------|-------------|---------|---------------|
| MVP (5 properties) | ~1.5GB | ~1.2GB | ~3-4GB |
| Phase 2 (50 properties) | ~10-15GB | ~2GB | ~12-17GB |
| Phase 3 (100+ properties) | ~30GB+ | ~4GB | Unviable on single VPS |

### What to Do

- Separate the scraper workers onto a different VPS/container from day 1.
- Use a browser pool with session reuse (don't spin up a new browser per poll).
- Consider a shared browser context approach - Playwright contexts are lighter than full browser instances.
- Budget at minimum a **4GB VPS for the app** and a separate **4-8GB VPS for scrapers** even at MVP.

---

## 3. HIGH: Missing Outbound Message Delivery Guarantee

**Location**: `architecture.md` - Message Flow (Outbound)

The outbound flow is:
```
Frontend -> API -> Database -> Channel Outbound Queue -> Scraper Worker -> OTA Dashboard
```

But there's no handling for **what happens when the scraper fails to send the reply**.

### Unhandled Scenarios

- Scraper sends the message but can't confirm it appeared (OTA page slow/changed)
- Session expired between queueing and sending
- OTA rate-limits the account right when you try to send
- Playwright crashes mid-send

The user thinks their reply was sent, but the guest never receives it. **This is the worst possible failure mode for an inbox product.**

### What to Do

- Implement a **message state machine**: `queued -> sending -> sent -> confirmed -> failed`
- After sending via Playwright, **verify** the message appears in the OTA conversation thread
- If verification fails, retry with backoff
- If retry fails 3x, mark as `failed` and **visually alert the agent in the UI** (red warning, not a silent log)
- Add a `delivery_status` column to the Message table
- Consider an "unsent messages" queue dashboard

### Proposed Message State Machine

```
              +--------+
              | queued |
              +---+----+
                  |
              +---v----+
              |sending |
              +---+----+
                  |
          +-------+-------+
          |               |
     +----v---+     +-----v----+
     |  sent  |     |  failed  |
     +----+---+     +-----+----+
          |               |
     +----v------+        |
     | confirmed |   (retry or alert)
     +-----------+
```

---

## 4. HIGH: Guest Identity Merging is Underspecified

**Location**: `architecture.md` - Guest entity

The Guest model uses a JSONB `identifiers` field to merge identities across channels. But the spec doesn't address:

- **How do you know the WhatsApp number +919876543210 is the same person as airbnb_user_123?** There's no automatic way. Airbnb doesn't expose phone numbers in messages.
- **Manual merge conflicts**: What if an agent merges wrong? Is there an unmerge?
- **Duplicate guest creation**: When a guest messages on WhatsApp first and then on Airbnb, you'll create two Guest records. The merge would have to happen later, which means you'll also need to **merge conversations**.
- **Conversation merging**: If Guest A (WhatsApp) and Guest B (Airbnb) get merged, what happens to their separate conversations? Do they merge into one thread? What about the booking links?

### What to Do

- For MVP, **don't auto-merge guests**. Keep them separate per channel.
- Add a manual "link guest" action where an agent can associate two guests as the same person.
- When linked, show a "cross-channel view" but keep conversations separate (don't try to merge message threads - it's too complex for MVP).
- Design the data model so that a Guest can have a `merged_into_id` (nullable FK to another Guest), creating a merge chain.

---

## 5. HIGH: No Concurrency Control for Conversations

**Location**: `features.md` - Response System, `architecture.md`

Two agents could be typing replies to the same conversation simultaneously. Two AI auto-responses could trigger for sequential messages. There's no mention of:

- Optimistic locking on conversations
- "Agent is typing" indicators visible to other agents
- Conversation locking (when Agent A is composing, Agent B sees a lock)
- Race condition between AI auto-send and human reply

### What to Do

- Add a `locked_by` / `locked_at` column to Conversation.
- When an agent opens a conversation and starts typing, lock it (with a 2-minute TTL).
- Show "Agent X is replying..." to other agents viewing the same conversation.
- **Critical**: When a human agent opens a conversation, **cancel any pending AI evaluation** for that conversation. Human takes priority.
- Use Redis for real-time lock state (faster than DB polling).

---

## 6. HIGH: Next.js App Server + Fastify Backend = Unclear Boundary

**Location**: `architecture.md` - Tech Stack

The tech stack lists both Next.js (with App Router, SSR, API routes) AND Fastify as the backend. This creates confusion:

- Will Next.js API routes handle some endpoints while Fastify handles others?
- Is the Next.js server the only process, with Fastify embedded?
- Or are they two separate servers?

### Recommendation

| Option | Architecture | Best For |
|--------|-------------|----------|
| **A** (Simpler) | Next.js for everything (frontend + API routes) | Quick MVP, small team |
| **B** (Better separation) | Next.js for frontend SSR only, Fastify as separate API server | WebSocket support, long-running workers, Phase 2+ |

**Recommended: Option B.** Long-running WebSocket connections and BullMQ workers don't play well with serverless-style Next.js API routes. Two processes behind Nginx gives cleaner separation.

---

## 7. MEDIUM: Data Model Missing Critical Fields

**Location**: `architecture.md` - Data Model

### Conversation Table - Missing Fields

| Field | Why Needed |
|-------|-----------|
| `last_message_at` | Sort conversations without JOIN to messages |
| `last_message_preview` | Inbox list view needs this without JOIN |
| `unread_count` | Badge display in UI |
| `channel` (primary) | Which channel was the first/most recent message from |

### Message Table - Missing Fields

| Field | Why Needed |
|-------|-----------|
| `is_internal_note` | Internal notes are a feature (F3.3) but schema doesn't support them |
| `attachments` / `media` | Even if deferred, the column should exist |
| `delivery_status` | See issue #3 - outbound delivery guarantee |

### Guest Table - Missing Fields

| Field | Why Needed |
|-------|-----------|
| `language` | Multi-language AI in Phase 2 |
| `last_active_at` | Activity tracking |
| `merged_into_id` | See issue #4 - guest merging |

### Organization Table - Missing Fields

| Field | Why Needed |
|-------|-----------|
| `settings` (JSONB) | Org-level preferences (timezone, business hours, notification prefs) |

### Missing Table: `ai_evaluations`

The audit trail requirement mentions logging every AI interaction, but there's no table for it. Don't overload the Message table with AI metadata.

```sql
CREATE TABLE ai_evaluations (
  id UUID PRIMARY KEY,
  message_id UUID REFERENCES messages(id),
  conversation_id UUID REFERENCES conversations(id),
  property_id UUID REFERENCES properties(id),
  intent TEXT,
  detected_stage TEXT,
  confidence_score FLOAT,
  kb_fields_used TEXT[],
  generated_response TEXT,
  routing_decision TEXT,  -- 'auto_send' | 'draft' | 'route_to_human'
  was_edited BOOLEAN DEFAULT false,
  edited_response TEXT,
  token_usage JSONB,      -- {input_tokens, output_tokens, model, cost}
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. MEDIUM: WhatsApp Connection Fragility Not Fully Addressed

**Location**: `channel-integrations.md` - WhatsApp section

Baileys / whatsapp-web.js are reverse-engineered libraries. Meta actively breaks them. Issues not addressed:

- **Library breaking**: WhatsApp updates their protocol and Baileys stops working entirely. Has happened multiple times historically.
- **Multi-device session limits**: WhatsApp Web allows ~4 linked devices. If the property owner links other devices, yours might get kicked.
- **QR code re-scanning frequency**: Sessions expire after ~14 days of phone inactivity.
- **Phone dependency**: If the phone's WhatsApp is uninstalled or number changes, all linked devices disconnect.

### What to Do

- Implement aggressive session health checks (every 5 minutes, send a lightweight ping).
- Build a clear re-authentication flow in the UI - make it dead simple to re-scan QR.
- Add a "WhatsApp health" indicator prominently in the dashboard.
- Document for customers that WhatsApp requires periodic re-connection.
- **Consider WhatsApp Business API from Phase 2, not Phase 4** - it's the only reliable path at scale.

---

## 9. MEDIUM: AI Cost Model is Optimistic

**Location**: `ai-agent.md` - Cost Management

The estimate of "$0.01-0.05 per message" assumes short conversations. But the system prompt includes:

```
Property knowledge base:  ~2000+ tokens
Conversation history:     grows with each message (could be 1000+ tokens)
Guest context + rules:    ~500 tokens
```

For a conversation with 15 back-and-forth messages, you're looking at **3000-5000 input tokens per AI call**.

### Realistic Cost Estimates

| Model | Cost per call (avg) | 1000 msgs/day | Monthly |
|-------|-------------------|---------------|---------|
| Claude Haiku | ~$0.002 | $2/day | ~$60 |
| Claude Sonnet | ~$0.01-0.02 | $10-20/day | ~$300-600 |
| Claude Opus | ~$0.05-0.10 | $50-100/day | ~$1500-3000 |

### What to Do

- Use **Claude Haiku for initial intent classification** (much cheaper).
- Only escalate to **Sonnet for generating the actual response**.
- **Truncate conversation history** - only include last 10 messages, not the full thread.
- Cache responses for identical queries (WiFi password asked 100x = 1 API call, 99 cache hits).
- Add a hard cost cap per property per month, alert when approaching.
- Track token usage per property in a `usage_tracking` table.

---

## 10. MEDIUM: No Rate Limiting Strategy for Outbound

**Location**: Missing from all docs

There's no mention of outbound message rate limiting across channels.

### Recommended Limits

| Channel | Max Rate | Rationale |
|---------|---------|-----------|
| Airbnb | 1 msg / 30 sec / account | Avoid automation detection |
| WhatsApp | 1 msg / 10 sec / number | Anti-spam compliance |
| Booking.com | 1 msg / 15 sec / property | Email relay tolerance |
| Other OTAs | 1 msg / 20 sec / account | Conservative default |

### What to Do

- Implement per-channel, per-property outbound rate limits in BullMQ.
- Make these configurable per channel connection.
- Add jitter to all outbound sends (don't send at exact intervals).

---

## 11. MEDIUM: Missing Observability / Logging Strategy

**Location**: Missing from all docs

No mention of structured logging, log aggregation, APM/tracing, error tracking, or uptime monitoring. For a real-time messaging system where **every missed message is a customer-impacting incident**, this is a significant gap.

### MVP Minimum

| Concern | Tool | Cost |
|---------|------|------|
| Structured logging | pino (JSON format, pairs with Fastify) | Free |
| Error tracking | Sentry | Free tier |
| Uptime monitoring | UptimeRobot or Better Uptime | Free tier |
| Health checks | `/health` endpoint (verifies DB, Redis, scrapers) | Free |
| Queue monitoring | Bull Board (BullMQ dashboard) | Free |
| Metrics (Phase 2+) | Prometheus + Grafana | Free (self-hosted) |

---

## 12. LOW: Drizzle vs Prisma Decision Needs Resolution

**Location**: `architecture.md` - Tech Stack

The doc says "Drizzle ORM (or Prisma)" - this needs to be decided before writing any code.

### Recommendation: Drizzle

| Factor | Drizzle | Prisma |
|--------|---------|--------|
| Binary size | Lightweight | ~15MB query engine binary |
| RAM usage | Lower | Higher (engine process) |
| SQL closeness | SQL-like API | Abstract query API |
| GIN indexes, FTS, RLS | Native support | Requires raw SQL |
| Migration story | Simple, SQL-based | Heavier, schema-based |
| N+1 risk | Low (explicit joins) | Higher (lazy loading) |

On a resource-constrained VPS with Playwright already eating RAM, Drizzle's lighter footprint matters. Its SQL-closer API is also better for the GIN indexes, full-text search, and eventual RLS policies this project needs.

---

## 13. LOW: CORS + WebSocket Security Gap

**Location**: `architecture.md` - Security Considerations

The doc mentions CORS for API security but doesn't address WebSocket authentication.

### What's Needed

- JWT validation on Socket.io handshake (not just on HTTP requests)
- Room authorization (verify user belongs to the org before joining the org's room)
- Reconnection with fresh token (not a stale one)
- Token refresh flow for long-lived WebSocket connections

Without this, anyone with a valid JWT from one org could potentially listen to another org's real-time events.

---

## 14. LOW: Monolith-to-Microservices Path is Vague

**Location**: `architecture.md` - Service Boundaries

The doc says "can be split into microservices later (Phase 4)" but the current module structure has tight cross-module dependencies that don't cleanly map to service boundaries.

### What to Do

Don't worry about microservices. The monolith is the right call for Phase 1-3 (probably 1-2 years). But do:

- Use **event-driven internal communication** (emit events when messages arrive, don't call between modules directly)
- Keep module boundaries clean (no circular imports)
- Avoid shared mutable state between modules
- Use a simple in-process EventEmitter pattern that can later be replaced with an external message bus

---

## Summary: Priority Fixes Before Building

| Priority | Issue | Action |
|----------|-------|--------|
| **P0** | Confidence scoring design | Replace LLM self-assessment with deterministic intent+KB matching |
| **P0** | Outbound delivery guarantee | Add message state machine + failure alerting |
| **P0** | Resource planning | Separate scrapers from app server |
| **P1** | Frontend/Backend boundary | Pick Next.js-only or Next.js+Fastify, not ambiguous |
| **P1** | Concurrency control | Add conversation locking + AI cancellation |
| **P1** | Data model gaps | Add denormalized fields, internal notes, AI evaluation table |
| **P1** | Observability | Add logging, error tracking, health checks |
| **P2** | Guest merging | Simplify to manual linking only for MVP |
| **P2** | AI cost control | Two-tier model (Haiku classify + Sonnet respond) + caching |
| **P2** | Outbound rate limiting | Per-channel rate limits in BullMQ |
| **P2** | WhatsApp Business API | Move to Phase 2, not Phase 4 |
| **P3** | ORM decision | Finalize Drizzle |
| **P3** | WebSocket security | Add JWT handshake + room authorization |
| **P3** | Microservices path | Ignore for now, use event-driven patterns internally |

---

## Final Notes

The foundation is solid. The product thinking is sharp - especially the Indian market positioning with Goibibo + WhatsApp. The risks doc shows good self-awareness. But the architecture docs are aspirational in places where they need to be precise (confidence scoring, delivery guarantees, resource planning). Fix the P0s in the docs before writing code, and you'll save significant rework.
