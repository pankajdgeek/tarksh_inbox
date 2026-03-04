# Phase 1: Sprint Analysis & Execution Plan

> **CTO Review** | 207 tasks | 11 sprints | ~24 weeks
> Document version: 1.0 | Date: 2026-03-03

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Work Stream Architecture](#2-work-stream-architecture)
3. [Dependency Graph & Critical Path](#3-dependency-graph--critical-path)
4. [Sprint-by-Sprint Execution Plan](#4-sprint-by-sprint-execution-plan)
5. [Task-Level Documentation](#5-task-level-documentation)
6. [Parallel Execution Matrix](#6-parallel-execution-matrix)
7. [Risk Register](#7-risk-register)
8. [Definition of Done](#8-definition-of-done)
9. [Resource Allocation Model](#9-resource-allocation-model)

---

## 1. Executive Summary

### Key Findings

**Parallelism Opportunity**: Phase 1 can be organized into **6 independent work streams** that run concurrently after Sprint 0, reducing calendar time significantly. The original 24-week sequential plan can potentially compress to **16-18 weeks** with 2-3 engineers.

**Critical Path**: Sprint 0 (infra) → Sprint 1 (schema + auth) → Sprint 3 (IMAP) → Sprint 6 (outbound) → Sprint 11 (E2E + deploy). This is the longest chain and defines the minimum timeline.

**Highest Risk Items**:
- T-115 to T-121 (Playwright browser pool + Airbnb outbound) - XL effort, high complexity
- T-057 to T-062 (IMAP IDLE engine) - L effort, reliability-critical
- T-142 to T-155 (AI service) - depends on well-formed KB + intent taxonomy

**Architectural Prerequisites** (must resolve BEFORE Sprint 1):
1. Finalize the deterministic AI routing flow (not LLM confidence)
2. Confirm message delivery state machine transitions
3. Define API contract interfaces between frontend and backend
4. Lock the database schema (all P0 field fixes from architecture-review.md)

---

## 2. Work Stream Architecture

Phase 1 decomposes into **6 parallel work streams** after the shared foundation (Sprint 0 + Sprint 1):

```
Sprint 0-1 (Foundation - Sequential, everyone)
    │
    ├─── WS-1: Backend APIs ──────────────── Sprint 2, 5.API, 9, 10
    │     (Property CRUD, Conversation APIs,
    │      Templates, Filters, User Mgmt)
    │
    ├─── WS-2: Email Ingestion Pipeline ──── Sprint 3
    │     (IMAP IDLE, OTA Parsers,
    │      Normalization, Dedup, Event Bus)
    │
    ├─── WS-3: Real-Time & WebSocket ─────── Sprint 4
    │     (Socket.io, Events, Frontend Client)
    │
    ├─── WS-4: Frontend UI ──────────────── Sprint 5.UI, 8.UI, 9.UI, 10.UI
    │     (Layout, Inbox, Conversation Detail,
    │      Booking Sidebar, AI Controls, Search)
    │
    ├─── WS-5: Outbound & Channels ──────── Sprint 6, 7
    │     (BullMQ, Playwright Pool, Airbnb Send,
    │      Booking.com Relay, WhatsApp Baileys)
    │
    └─── WS-6: AI Service ──────────────── Sprint 8
          (Intent Classifier, KB Matching,
           Response Generator, Queue, Routing)
```

### Work Stream Dependencies

```
WS-1 (APIs) ←── depends on ── Sprint 1 (schema + auth)
WS-2 (Email) ←── depends on ── Sprint 1 (schema), T-074/075 (event bus)
WS-3 (WebSocket) ←── depends on ── Sprint 1 (auth/JWT)
WS-4 (Frontend) ←── depends on ── WS-1 (API endpoints exist), WS-3 (WebSocket)
WS-5 (Outbound) ←── depends on ── WS-2 (messages exist in DB), WS-1 (channel config APIs)
WS-6 (AI) ←── depends on ── WS-2 (inbound messages), WS-5 (outbound queue), WS-1 (KB API)
```

---

## 3. Dependency Graph & Critical Path

### Critical Path (longest chain, defines minimum timeline)

```
T-001 (monorepo) → T-005 (Fastify) → T-010/011 (DB/ORM) → T-021-033 (schema)
→ T-034-038 (auth) → T-049 (channel connections API) → T-057-062 (IMAP engine)
→ T-064-069 (OTA parsers) → T-074-075 (event bus + handler chain)
→ T-107-109 (BullMQ) → T-110-114 (outbound state machine)
→ T-115-121 (Playwright pool + Airbnb sender)
→ T-203-207 (E2E tests) → T-191-197 (production deploy)
```

**Estimated critical path duration: ~18-20 weeks** (assuming 1 engineer on the critical path)

### Dependency Map (Key Inter-Task Dependencies)

| Task | Depends On | Blocks |
|------|-----------|--------|
| T-005 (Fastify) | T-001 (monorepo) | All backend work |
| T-011 (Drizzle ORM) | T-010 (Postgres) | All DB operations |
| T-014 (Next.js) | T-001 (monorepo) | All frontend work |
| T-033 (migrations) | T-021–T-032 (all tables) | All CRUD APIs |
| T-035 (JWT) | T-005 (Fastify) | T-036–T-040 (auth endpoints), T-077 (WS auth) |
| T-038 (auth middleware) | T-035 (JWT) | All protected API endpoints |
| T-041 (encryption) | — | T-049 (channel connections), T-118 (session mgmt) |
| T-049 (channel API) | T-038 (auth), T-041 (encryption) | T-057 (IMAP start) |
| T-057 (IMAP engine) | T-011 (ORM), T-029 (EmailConnection table) | T-064 (parsers) |
| T-074 (event bus) | T-005 (Fastify) | T-075 (handler chain), T-081 (WS events) |
| T-075 (handler chain) | T-074, T-026 (Message table) | T-081, T-151 (AI queue) |
| T-076 (Socket.io) | T-005 (Fastify) | T-077–T-084 (all WS features) |
| T-077 (WS JWT) | T-035 (JWT), T-076 (Socket.io) | T-085 (frontend client) |
| T-085 (frontend socket) | T-077 (WS auth) | T-086–T-088 (real-time UI) |
| T-093 (conversations API) | T-038 (auth), T-025 (Conversation table) | T-094 (conversation list UI) |
| T-107 (BullMQ) | T-012 (Redis) | T-108–T-109, T-110–T-114, T-151 |
| T-110 (state machine) | T-107 (BullMQ), T-026 (Message table) | T-111 (outbound worker) |
| T-115 (Playwright pool) | T-107 (BullMQ) | T-119 (Airbnb sender) |
| T-118 (session mgmt) | T-041 (encryption), T-012 (Redis) | T-119 (Airbnb sender) |
| T-119 (Airbnb sender) | T-115 (pool), T-118 (session) | T-121 (verification), T-203 (E2E) |
| T-127 (Baileys) | T-012 (Redis), T-074 (event bus) | T-128–T-138 (WhatsApp features) |
| T-142 (Claude API) | T-019 (env vars) | T-143–T-150 (AI features) |
| T-151 (AI queue) | T-107 (BullMQ), T-142 (Claude API) | T-152–T-155 (AI routing) |
| T-191 (VPS 1) | All app-side tasks complete | T-193 (Docker prod) |
| T-203 (E2E Airbnb) | T-119, T-066, T-152 | Phase 1 exit |

---

## 4. Sprint-by-Sprint Execution Plan

### Sprint 0: Project Scaffolding & Infra (Week 1-2)
> **Goal**: Zero-to-runnable dev environment. Everyone works on this together.
> **Parallel tracks**: 4 (monorepo, backend, DB, frontend can overlap after T-001)

#### Track A: Monorepo & Tooling (Day 1-2)
| Task | Description | Effort | Priority | Parallel? |
|------|------------|--------|----------|-----------|
| T-001 | Initialize monorepo (pnpm workspaces) | M | P0 | Start here |
| T-002 | TypeScript config (strict, aliases, shared) | S | P0 | After T-001 |
| T-003 | ESLint + Prettier shared config | S | P1 | After T-001, parallel with T-002 |
| T-004 | Husky + lint-staged | S | P2 | After T-003 |

#### Track B: Backend Scaffolding (Day 2-4) — starts after T-001
| Task | Description | Effort | Priority | Parallel? |
|------|------------|--------|----------|-----------|
| T-005 | Fastify server with TypeScript | M | P0 | After T-001 |
| T-006 | pino structured logging | S | P0 | After T-005 |
| T-007 | Zod validation middleware | M | P0 | After T-005, parallel with T-006 |
| T-008 | Global error handler + Sentry | M | P0 | After T-005, parallel with T-006/007 |
| T-009 | CORS + Helmet security | S | P0 | After T-005 |

#### Track C: Database & Cache (Day 3-6) — starts after T-001
| Task | Description | Effort | Priority | Parallel? |
|------|------------|--------|----------|-----------|
| T-010 | PostgreSQL Docker + connection pool | M | P0 | After T-001 |
| T-011 | Drizzle ORM setup (config, client, migrations) | M | P0 | After T-010 |
| T-012 | Redis Docker + ioredis connection | S | P0 | Parallel with T-010 |
| T-013 | Docker Compose (Postgres + Redis + Mailhog) | M | P0 | Parallel with T-010/012 |

#### Track D: Frontend Scaffolding (Day 2-5) — starts after T-001
| Task | Description | Effort | Priority | Parallel? |
|------|------------|--------|----------|-----------|
| T-014 | Next.js 14+ App Router with TypeScript | M | P0 | After T-001 |
| T-015 | Tailwind CSS + shadcn/ui setup | M | P0 | After T-014 |
| T-016 | Zustand store boilerplate | S | P1 | After T-014 |
| T-017 | TanStack Query + API client | S | P1 | After T-014, parallel with T-016 |

#### Track E: Dev Infrastructure (Day 4-8)
| Task | Description | Effort | Priority | Parallel? |
|------|------------|--------|----------|-----------|
| T-018 | Nginx reverse proxy (Next.js :3000 + Fastify :4000) | M | P0 | After T-005, T-014 |
| T-019 | Environment variable management (.env + Zod) | S | P0 | After T-005 |
| T-020 | GitHub repo + branch strategy + basic CI | M | P1 | Parallel with anything |

**Sprint 0 Gantt (2 weeks)**:
```
Week 1:
  Day 1-2: T-001 → T-002, T-003 (parallel)
  Day 2-3: T-005, T-014, T-010, T-012 (all parallel after T-001)
  Day 3-4: T-006, T-007, T-008, T-009 (parallel, after T-005)
  Day 3-4: T-011 (after T-010), T-015 (after T-014)
  Day 4-5: T-013, T-016, T-017, T-004 (parallel)

Week 2:
  Day 1-2: T-018 (after T-005 + T-014), T-019, T-020 (parallel)
  Day 3-5: Buffer + integration testing of full stack
```

---

### Sprint 1: Data Model & Auth (Week 3-4)
> **Goal**: All DB tables created, auth working, encryption ready.
> **Parallel tracks**: 3 (schema, auth, encryption)

#### Track A: Core Schema (Week 3) — all parallel once T-011 done
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-021 | Organization table | S | No deps within track |
| T-022 | User table | S | FK → Organization |
| T-023 | Property table | S | FK → Organization |
| T-024 | Guest table | M | Includes JSONB identifiers, merged_into FK |
| T-025 | Conversation table | M | FKs → Guest, Property, User. Many denormalized fields |
| T-026 | Message table | M | FK → Conversation. delivery_status enum, attachments JSONB |
| T-027 | Booking table | M | FK → Guest, Property. Status enum |
| T-028 | ChannelConnection table | M | Encrypted credentials, FK → Property |
| T-029 | EmailConnection table | S | FK → ChannelConnection or Property |
| T-030 | KnowledgeBase table | S | JSONB data structure, FK → Property |
| T-031 | AIEvaluation table | M | FK → Message, Conversation, Property. Full audit fields |
| T-032 | Critical indexes (GIN, FTS, composite) | M | After all tables |
| T-033 | Run Drizzle migration | M | After T-021–T-032 |

**Schema parallelism**: T-021 through T-031 can ALL be written in parallel (they're just Drizzle schema definitions). T-032 and T-033 must come after all tables are defined.

**Recommended approach**: One engineer writes all schema files, another reviews. These are small individual tasks but tightly coupled — splitting across engineers creates merge conflicts.

#### Track B: Authentication (Week 3-4) — after T-022 (User table) + T-005 (Fastify)
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-034 | Argon2 password hashing utility | S | Pure utility, no deps |
| T-035 | JWT access + refresh token generation | M | Pure utility, no deps |
| T-036 | Login endpoint POST /auth/login | M | After T-034, T-035, T-022 |
| T-037 | Token refresh endpoint | S | After T-035 |
| T-038 | Auth middleware (JWT verify → inject org_id/user_id) | M | After T-035, blocks all protected routes |
| T-039 | httpOnly secure cookie for refresh tokens | S | After T-036 |
| T-040 | Logout endpoint (Redis blacklist) | S | After T-035, T-012 |

**Auth parallelism**: T-034 and T-035 are pure utilities — can be done in parallel. T-036–T-040 depend on them but can be done in parallel with each other (except T-036 depends on T-034+T-035).

#### Track C: Credential Encryption (Week 3) — no deps
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-041 | AES-256-GCM encrypt/decrypt utility | M | Pure utility |
| T-042 | Encryption key management | S | After T-041, uses env vars |

**Can run fully parallel with Track A and B.**

**Sprint 1 Gantt (2 weeks)**:
```
Week 3:
  Day 1-3: Track A (T-021–T-031, all schema definitions in parallel)
  Day 1-2: Track C (T-041, T-042 — independent)
  Day 1-2: Track B start (T-034, T-035 — independent utilities)
  Day 3-4: Track A (T-032 indexes, T-033 migration)
  Day 3-5: Track B (T-036, T-037, T-038 — after schema migrated)

Week 4:
  Day 1-2: Track B finish (T-039, T-040)
  Day 3-5: Integration testing: full auth flow, DB operations, encrypted credentials
```

---

### Sprint 2: Property & Channel Management APIs (Week 5-6)
> **Goal**: All CRUD APIs for properties, channels, email connections.
> **Parallel tracks**: 3 (property, channel, email)
> **Dependencies**: Sprint 1 complete (schema + auth + encryption)

#### Track A: Property CRUD
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-043 | POST /properties | M | Auth middleware required |
| T-044 | GET /properties (paginated) | S | Standard list endpoint |
| T-045 | GET /properties/:id | S | Standard detail endpoint |
| T-046 | PATCH /properties/:id | S | Standard update |
| T-047 | DELETE /properties/:id (soft) | S | P1, can defer |
| T-048 | GET/PUT /properties/:id/knowledge-base | M | JSONB operations |

#### Track B: Channel Connection Management — parallel with Track A
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-049 | POST /properties/:id/channels | M | Uses T-041 encryption |
| T-050 | GET /properties/:id/channels | S | List with status |
| T-051 | PATCH /channels/:id | S | Update config |
| T-052 | DELETE /channels/:id | S | Cleanup sessions |
| T-053 | GET /channels/:id/health | S | Last sync, status |

#### Track C: Email Connection Setup — parallel with Track A/B
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-054 | Email connection CRUD | M | Encrypted IMAP credentials |
| T-055 | POST /email/test (IMAP test) | M | Connect → verify → disconnect |
| T-056 | Email forwarding validation | S | Verify routing works |

**Sprint 2 is fully parallelizable** — all 3 tracks are independent. With 2 engineers: one takes Track A+C, other takes Track B.

---

### Sprint 3: IMAP Ingestion & Email Parsing (Week 7-8)
> **Goal**: Real-time email ingestion working for Airbnb + Booking.com.
> **This is the heart of the system. Highest technical complexity in Phase 1.**
> **Dependencies**: Sprint 1 (schema), Sprint 2 (channel/email connection APIs)

#### Track A: IMAP IDLE Engine — sequential, high complexity
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-057 | ImapFlow connection manager | L | Core IMAP IDLE, most complex task |
| T-058 | IMAP connection pool (1 per property email) | L | Lifecycle management |
| T-059 | Auto-reconnect with exponential backoff | M | 5s → 15s → 30s → 60s |
| T-060 | IDLE refresh every 25 min (RFC 2177) | S | Timer management |
| T-061 | Health check per connection | M | Alert on > 2 min disconnection |
| T-062 | Message catch-up on reconnect | M | Fetch UIDs since last_sync_at |
| T-063 | Raw email archival (30-day, P1) | M | Disk/S3 storage |

**T-057 and T-058 are tightly coupled** — same engineer. T-059–T-063 can be parallelized after T-057/058 are done.

#### Track B: OTA Email Parsers — can start parallel with Track A
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-064 | OTAEmailParser interface | S | Interface definition |
| T-065 | Channel detection regex patterns | S | Router logic |
| T-066 | Airbnb email parser | L | Extract guest, message, reservation, thread |
| T-067 | Booking.com email parser | L | Extract guest, message, reservation, reply-to |
| T-068 | Unparseable email alert | M | Logging + notification |
| T-069 | Parser unit tests (5+ samples per channel) | L | Need real email samples |

**T-064/065 first, then T-066/067 in parallel.** T-069 runs as each parser is complete.

#### Track C: Normalization & Dedup — after Track B starts producing output
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-070 | NormalizedMessage interface | S | TypeScript types |
| T-071 | Message normalizer service | M | Parsed email → NormalizedMessage → DB |
| T-072 | Deduplication via external_id hash | M | hash(channel + booking_ref + timestamp) |
| T-073 | UPSERT for enrichment updates | S | Don't duplicate, update |

#### Track D: Event Bus — can start in parallel with everything
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-074 | Typed EventEmitter bus | M | message:received, message:sent, etc. |
| T-075 | message:received handler chain | L | Save → conversation → WebSocket → AI queue |

**Sprint 3 Gantt (2 weeks)**:
```
Week 7:
  Engineer 1: T-057, T-058 (IMAP engine — full week)
  Engineer 2: T-064, T-065, T-066 (parser interface + Airbnb parser)
  Engineer 2 (parallel): T-070, T-074 (interfaces + event bus)

Week 8:
  Engineer 1: T-059, T-060, T-061, T-062 (IMAP resilience)
  Engineer 2: T-067, T-068, T-069 (Booking.com parser + tests)
  Either: T-071, T-072, T-073, T-075 (normalizer + handler chain)
  Optional: T-063 (archival, P1)
```

---

### Sprint 4: Real-Time & WebSocket (Week 9-10)
> **Goal**: Live updates in the browser. New messages appear instantly.
> **Dependencies**: Sprint 1 (JWT auth), Sprint 3 (event bus)
> **CAN RUN PARALLEL WITH Sprint 3** — Socket.io server setup is independent of IMAP

#### Track A: Socket.io Server
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-076 | Socket.io server setup with Fastify | M | Independent of IMAP |
| T-077 | JWT validation on handshake | M | Dep: T-035 |
| T-078 | Room authorization (org_id check) | M | After T-077 |
| T-079 | Token refresh for long-lived WS | M | P1 |
| T-080 | Redis Pub/Sub adapter | M | For multi-process |

#### Track B: Real-Time Events — after Track A
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-081 | new_message event broadcast | M | Dep: T-075 (handler chain) |
| T-082 | conversation_updated event | S | Status/assignment changes |
| T-083 | typing_indicator event | S | P1 |
| T-084 | agent_replying lock broadcast | S | Concurrency UX |

#### Track C: Frontend Socket Client — after Track A
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-085 | Socket.io client with JWT auth | M | After T-077 |
| T-086 | Zustand store: merge real-time events | M | After T-085 |
| T-087 | Browser Notification API | M | P1 |
| T-088 | Tab title unread count badge | S | P2 |

**Key insight**: Sprint 4 Tracks A and B (server-side) can run in parallel with Sprint 3. Only Track C (frontend client) has a hard dependency on Track A being done.

---

### Sprint 5: Inbox UI - Core (Week 11-12)
> **Goal**: Usable inbox interface — list conversations, read messages, send replies.
> **Dependencies**: Sprint 2 (APIs), Sprint 4 (WebSocket client)
> **CAN START Track A (layout) in parallel with Sprint 4**

#### Track A: Layout & Navigation — independent
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-089 | App shell layout (sidebar + main) | M | Pure UI, no API deps |
| T-090 | Sidebar navigation | M | Pure UI |
| T-091 | Login page UI | M | Pure UI |
| T-092 | Auth flow (login → store → redirect → refresh) | L | After T-036 (login API) |

#### Track B: Conversation List — needs conversation API
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-093 | GET /conversations API | L | Backend, paginated + filterable |
| T-094 | Conversation list component | L | After T-093 |
| T-095 | Status badges (unread, pending, etc.) | M | After T-094 |
| T-096 | Sort by recency + real-time push to top | M | After T-094, T-086 |
| T-097 | Channel icon component | S | Pure UI, independent |

#### Track C: Conversation Detail — needs message API
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-098 | GET /conversations/:id/messages API | M | Backend |
| T-099 | Conversation header | M | After T-098 |
| T-100 | Message thread (chronological, styled per sender) | L | Core UI, after T-098 |
| T-101 | AI message visual distinction | S | After T-100 |
| T-102 | Reply composer (textarea, Cmd+Enter) | M | Core UI |
| T-103 | POST /conversations/:id/messages API | M | Outbound entry point |

#### Track D: Booking Context Sidebar
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-104 | Booking sidebar component | M | Right panel |
| T-105 | Display booking details | M | After T-104 |
| T-106 | Guest-to-booking linking logic | M | Match by name + channel identifier |

**Sprint 5 Gantt (2 weeks)**:
```
Week 11:
  Engineer 1 (Backend): T-093, T-098, T-103 (APIs)
  Engineer 2 (Frontend): T-089, T-090, T-091, T-097 (layout + icons)
  Engineer 2: T-092 (auth flow)

Week 12:
  Engineer 1 (Frontend): T-094, T-095, T-096 (conversation list)
  Engineer 2 (Frontend): T-099, T-100, T-101, T-102 (conversation detail)
  Either: T-104, T-105, T-106 (booking sidebar)
```

---

### Sprint 6: Outbound Messaging & Delivery Guarantee (Week 13-14)
> **Goal**: Agents can send replies. Messages are guaranteed delivered or visibly failed.
> **This sprint has the HIGHEST EFFORT density in Phase 1.**
> **Dependencies**: Sprint 3 (messages in DB), Sprint 5 (reply composer)

#### Track A: BullMQ Infrastructure
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-107 | BullMQ connection + queue definitions | M | channel-outbound, ai-evaluation |
| T-108 | Bull Board UI (admin monitoring) | M | P1 |
| T-109 | Queue worker process infrastructure | M | Separate from API process |

#### Track B: Outbound State Machine — after Track A
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-110 | Message delivery state machine | L | queued → sending → sent → confirmed/failed |
| T-111 | Outbound queue worker | L | Dequeue → route → send → update |
| T-112 | Retry logic (3x exponential backoff) | M | 5s, 15s, 60s then fail |
| T-113 | Failed message UI (red banner) | M | NEVER silent failure |
| T-114 | Delivery status WebSocket updates | M | Real-time to frontend |

#### Track C: Airbnb Outbound (Playwright) — can start parallel with Track B
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-115 | Playwright browser pool manager | XL | 5-10 pooled contexts |
| T-116 | Browser acquire/release with timeouts | L | 30s acquire, 5min max use |
| T-117 | Priority queue (high/medium/low) | M | Agent replies = high |
| T-118 | Airbnb session management | L | Cookies in Redis, auto-re-auth |
| T-119 | Airbnb message sender | XL | Navigate → type → send → verify |
| T-120 | Anti-detection (fingerprint, delays) | L | Realistic browser behavior |
| T-121 | Post-send verification | L | Confirm message in thread |
| T-122 | 2FA detection + admin alert | M | P1 |

#### Track D: Booking.com Outbound — parallel with Track C, much simpler
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-123 | Booking.com email relay sender | L | Reply to guest relay address |
| T-124 | SMTP client setup (nodemailer) | M | Outbound email |

#### Track E: Rate Limiting
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-125 | Per-channel rate limits in BullMQ | M | Airbnb 1/30s, Booking 1/15s |
| T-126 | Randomized jitter | S | P1 |

**Sprint 6 Gantt (2 weeks — this is tight, consider 3 weeks)**:
```
Week 13:
  Engineer 1: T-107, T-109, T-110 (BullMQ + state machine)
  Engineer 2: T-115, T-116 (Playwright pool — XL effort)
  Engineer 2 (parallel): T-124 (SMTP client — quick)

Week 14:
  Engineer 1: T-111, T-112, T-113, T-114 (outbound worker + failure UI)
  Engineer 2: T-117, T-118, T-119 (priority queue + session + sender — XL)
  Either: T-120, T-121, T-122, T-123 (anti-detection + verification + Booking relay)
  Either: T-125, T-126 (rate limiting)
  Overflow: T-108 (Bull Board, P1 — can defer)
```

**CTO Note**: Sprint 6 is the densest sprint. T-115/T-119 alone are XL each. **Budget 3 weeks** or ensure 2 engineers are fully dedicated. Airbnb outbound is the highest-risk component.

---

### Sprint 7: WhatsApp Integration (Week 15-16)
> **Goal**: WhatsApp messages flow in and out via Baileys.
> **CAN RUN PARALLEL WITH Sprint 6** — completely independent channel
> **Dependencies**: Sprint 3 (event bus, normalizer), Sprint 1 (schema)

#### Track A: Baileys Core
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-127 | Baileys client setup | L | WebSocket to WA servers |
| T-128 | QR code pairing flow | L | Generate → display → scan |
| T-129 | Auth state persistence | M | Survive process restart |
| T-130 | Inbound handler → NormalizedMessage | M | Phone, name, text |
| T-131 | Group message filtering | S | Silently ignore groups |

#### Track B: Outbound & Status — after Track A core
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-132 | Outbound text message sending | M | Via Baileys |
| T-133 | Delivery status tracking | M | Sent → delivered → read |
| T-134 | Typing indicator simulation | S | P1 |

#### Track C: Resilience & UI
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-135 | Health check every 5 min | M | Verify connection alive |
| T-136 | Auto-reconnect with backoff | M | On disconnect |
| T-137 | Rate limiting (1/10sec, 20/hr) | M | Per number |
| T-138 | WhatsApp status in settings UI | M | Disconnected → QR → Connected |

#### Track D: Guest Matching
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-139 | Match phone to guests.identifiers.whatsapp | M | GIN index lookup |
| T-140 | Auto-create guest if no match | S | New guest record |
| T-141 | Manual "Link Guest" UI | M | Merge WA contact with existing |

---

### Sprint 8: AI Auto-Response (Week 17-18)
> **Goal**: AI evaluates incoming messages and generates responses.
> **Dependencies**: Sprint 3 (inbound messages exist), Sprint 6 (outbound queue)
> **CAN START Track A in parallel with Sprint 6** — AI service is independent until routing

#### Track A: AI Service Core
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-142 | Claude API client (Anthropic SDK) | M | API key from env |
| T-143 | Deterministic intent classifier (Haiku) | L | NOT confidence-based |
| T-144 | Never-auto-respond list (hard-coded) | S | complaint, cancellation, refund, etc. |
| T-145 | KB field mapping (intent → KB data check) | L | Rule-based confidence |
| T-146 | Response generator (Sonnet) | L | Only when intent + KB match |
| T-147 | System prompt builder | L | KB + context + history + rules |
| T-148 | Context truncation (last 10 messages) | S | Token budget management |
| T-149 | Response length cap (500 chars) | S | Guard rail |
| T-150 | Fallback response | S | "Let me check with our team..." |

#### Track B: AI Queue & Routing — after Track A + Sprint 6 (BullMQ)
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-151 | BullMQ ai-evaluation queue | M | Concurrency: 5, rate: 50/min |
| T-152 | AI evaluation worker | L | Classify → KB check → generate → route |
| T-153 | Routing logic (auto-send/draft/human) | L | Based on KB match + property mode |
| T-154 | AIEvaluation record creation | M | Audit trail |
| T-155 | Cancel AI when human opens conversation | M | Human priority |

#### Track C: AI Controls UI — parallel with Track A
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-156 | AI enable/disable toggle per property | M | Settings UI |
| T-157 | Auto-send vs draft-only selector | M | Mode toggle |
| T-158 | AI draft review UI (approve/edit/discard) | L | In-composer workflow |
| T-159 | AI response label in message thread | S | Badge + styling |

---

### Sprint 9: Templates, Quick Actions & Concurrency (Week 19-20)
> **Goal**: Polish the agent workflow — templates, quick actions, conversation locks.
> **All tracks independent of each other. Fully parallelizable.**

#### Track A: Response Templates
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-160 | Template CRUD API | M | Standard REST |
| T-161 | Template categories | S | Enum values |
| T-162 | Template variables definition | M | {{guest_name}}, etc. |
| T-163 | Variable resolution engine | M | Replace with actual data |
| T-164 | Template picker in reply composer | M | Frontend dropdown |
| T-165 | Per-property template assignment | S | P1 |

#### Track B: Quick Actions — independent
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-166 | Mark resolved (status update + WS) | S | Quick action |
| T-167 | Star/unstar toggle | S | Quick action |
| T-168 | Internal notes | M | P1, is_internal_note flag |
| T-169 | Conversation assignment to agent | M | P1, dropdown in header |

#### Track C: Concurrency Control — independent
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-170 | Redis conversation lock (2-min TTL) | M | conv:{id}:lock = user_id |
| T-171 | Lock refresh on typing | S | Extend TTL |
| T-172 | "Agent X is replying..." indicator | S | WS broadcast |
| T-173 | Human priority: cancel pending AI | S | On conversation open |

---

### Sprint 10: Filters, Search, Health & Users (Week 21-22)
> **Goal**: Production-grade search, monitoring, and user management.
> **All 4 tracks are independent. Fully parallelizable.**

#### Track A: Filters & Search
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-174 | Filter by channel | M | Query parameter |
| T-175 | Filter by property | S | Query parameter |
| T-176 | Filter by status | M | Enum filter |
| T-177 | Filter by date range | S | P1 |
| T-178 | Filter by assigned agent | S | P1 |
| T-179 | Full-text search (GIN + ts_vector) | L | PostgreSQL FTS |
| T-180 | Guest name search (autocomplete) | M | LIKE or trigram |

#### Track B: Channel Health Dashboard
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-181 | Channel health status page | M | Per-channel status |
| T-182 | Auto-recovery indicator | S | P1, backoff timer |
| T-183 | Unsent messages count per channel | M | Queue depth query |
| T-184 | Admin email alert on disconnect (> 5 min) | M | P1 |

#### Track C: Observability
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-185 | /health endpoint | L | DB, Redis, IMAP, browser, WA, queues |
| T-186 | Sentry integration (backend + frontend) | M | Error tracking |
| T-187 | UptimeRobot monitoring | S | P1 |

#### Track D: User Management
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-188 | Admin vs Agent role enforcement | M | Middleware + UI |
| T-189 | Invite user by email | M | P1 |
| T-190 | Assign agents to properties | M | P1 |

---

### Sprint 11: Deployment & Hardening (Week 23-24)
> **Goal**: Production deployment, security audit, E2E testing.
> **Dependencies**: All previous sprints complete.

#### Track A: Production Deployment
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-191 | VPS 1 provision (app server) | L | Nginx + Next + Fastify + PG + Redis |
| T-192 | VPS 2 provision (workers) | L | IMAP + Playwright + WA + BullMQ |
| T-193 | Docker Compose production config | L | Separate compose per VPS |
| T-194 | SSL/TLS (Let's Encrypt + auto-renew) | M | certbot |
| T-195 | CI/CD pipeline (GitHub Actions) | L | lint → typecheck → test → build → deploy |
| T-196 | Database backup (pg_dump daily, 7-day) | M | Off-site storage |
| T-197 | Log aggregation (pino + rotation) | M | P1 |

#### Track B: Security Hardening — parallel with Track A
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-198 | Rate limiting on all API endpoints | M | Per IP + per user |
| T-199 | CORS locked to production domains | S | Quick config |
| T-200 | Input validation audit (Zod on every endpoint) | M | Audit pass |
| T-201 | org_id scoping audit | M | Every DB query tenant-filtered |
| T-202 | Secrets management audit | S | No creds in code |

#### Track C: E2E Testing — after systems integrated
| Task | Description | Effort | Notes |
|------|------------|--------|-------|
| T-203 | E2E: Airbnb full flow | XL | Email → convo → AI → draft → send → confirm |
| T-204 | E2E: WhatsApp full flow | L | Message → convo → reply → track |
| T-205 | E2E: Booking.com full flow | L | Email → reply via relay → confirm |
| T-206 | Load test: 50 properties concurrent | L | P1 |
| T-207 | Failure mode tests | L | IMAP disconnect, Playwright fail, Redis crash |

---

## 5. Task-Level Documentation

### Effort Estimation Guide

| Size | Hours | Examples |
|------|-------|---------|
| S | < 4h | Pure utility, simple endpoint, config change |
| M | 4-8h | Standard CRUD, middleware, UI component with API |
| L | 1-2 days | Complex service, parser with edge cases, multi-part UI |
| XL | 3-5 days | Playwright pool, Airbnb sender, E2E test suite |

### Task Categorization by Type

**Infrastructure (17 tasks)**: T-001–004, T-010–013, T-018–020, T-107–109, T-191–197
**Schema/Data (13 tasks)**: T-021–033
**Auth/Security (12 tasks)**: T-034–042, T-198–202
**REST APIs (22 tasks)**: T-043–056, T-093, T-098, T-103, T-160
**Email Ingestion (19 tasks)**: T-057–075
**WebSocket (13 tasks)**: T-076–088
**Frontend UI (25 tasks)**: T-089–097, T-099–106, T-138, T-141, T-156–159, T-164
**Outbound Delivery (18 tasks)**: T-110–126
**WhatsApp (15 tasks)**: T-127–141
**AI Service (18 tasks)**: T-142–159
**Templates/Actions (10 tasks)**: T-160–169
**Concurrency (4 tasks)**: T-170–173
**Search/Filters (7 tasks)**: T-174–180
**Monitoring (7 tasks)**: T-181–187
**User Mgmt (3 tasks)**: T-188–190
**E2E Testing (5 tasks)**: T-203–207

### High-Risk Tasks (require spike/prototype first)

| Task | Risk | Mitigation |
|------|------|-----------|
| T-057/058 (IMAP IDLE engine) | ImapFlow stability, connection leaks | Build prototype first, test with 10 concurrent connections |
| T-066/067 (OTA email parsers) | Need real email samples, format variations | Collect 20+ sample emails per OTA before starting |
| T-115 (Playwright pool) | Memory leaks, browser crashes, pool exhaustion | Stress test with 10 concurrent browsers, implement monitoring |
| T-119 (Airbnb sender) | UI changes break selectors, anti-bot detection | Use data-testid where possible, implement selector healing |
| T-143 (Intent classifier) | Classification accuracy, edge cases | Define intent taxonomy upfront, test with 100+ real messages |
| T-127 (Baileys) | Library stability, WA protocol changes | Pin version, have fallback connection strategy |

---

## 6. Parallel Execution Matrix

### With 2 Engineers (Recommended Minimum)

```
         Week:  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24
                ┌─────┐
Eng 1:   Sprint 0 (shared)
Eng 2:          │     │
                └─────┘
                      ┌─────┐
Eng 1:         Sprint 1: Schema + Auth
Eng 2:         Sprint 1: Encryption + Auth helpers
                      └─────┘
                            ┌─────┐
Eng 1:               Sprint 2 (APIs) ───────────────┐
Eng 2:               Sprint 3 (IMAP) START ──────────┤
                            └─────┘                  │
                                  ┌─────┐            │
Eng 1:                     Sprint 4 (WebSocket) ─────┤
Eng 2:                     Sprint 3 (IMAP) FINISH ───┤
                                  └─────┘            │
                                        ┌─────┐     │
Eng 1:                           Sprint 5 (UI) ─────┤
Eng 2:                           Sprint 7 (WA) ─────┤
                                        └─────┘     │
                                              ┌──────┤
Eng 1:                                 Sprint 6 (Outbound)
Eng 2:                                 Sprint 8 (AI) ──────┐
                                              └─────┘      │
                                                    ┌─────┐│
Eng 1:                                       Sprint 9 (Templates)
Eng 2:                                       Sprint 9 (Concurrency)
                                                    └─────┘│
                                                          ┌─┤
Eng 1:                                             Sprint 10 (Search)
Eng 2:                                             Sprint 10 (Health)
                                                          └─┤
                                                            ┌┤
Eng 1:                                               Sprint 11 (Deploy)
Eng 2:                                               Sprint 11 (E2E)
                                                            └┘
```

### Revised Sprint Schedule (Optimized for 2 Engineers)

| Week | Engineer 1 | Engineer 2 | Notes |
|------|-----------|-----------|-------|
| 1-2 | Sprint 0: Backend + Infra | Sprint 0: Frontend + DB | Shared foundation |
| 3-4 | Sprint 1: Schema + Migrations | Sprint 1: Auth + Encryption | Schema is one person's job |
| 5-6 | Sprint 2: All CRUD APIs | Sprint 3 Start: IMAP Engine | **Overlap starts here** |
| 7-8 | Sprint 4: WebSocket Server | Sprint 3 Finish: Parsers + Event Bus | WS server is independent |
| 9-10 | Sprint 5: Inbox UI (APIs + Frontend) | Sprint 7: WhatsApp (Baileys) | **Major parallel gain** |
| 11-12 | Sprint 5 Finish + Sprint 6 Start: BullMQ | Sprint 8 Start: AI Service Core | UI polish + queue infra |
| 13-14 | Sprint 6: Airbnb Outbound (Playwright) | Sprint 8 Finish: AI Routing + Controls | **Highest risk sprint** |
| 15-16 | Sprint 6 Overflow + Sprint 9: Templates | Sprint 9: Quick Actions + Concurrency | Polish sprint |
| 17-18 | Sprint 10: Search + Filters | Sprint 10: Health + Users | All parallel |
| 19-20 | Sprint 11: Deployment + CI/CD | Sprint 11: E2E Tests + Security | Final sprint |

**Result: ~20 weeks with 2 engineers** (vs 24 weeks sequential)

### With 3 Engineers (Optimal)

Add a third engineer who focuses on:
- Week 1-4: DevOps (Docker, CI/CD, infra) — T-013, T-018, T-020
- Week 5-8: Email parsers + event bus (Track B/C/D of Sprint 3)
- Week 9-12: Frontend UI (Sprint 5) while Eng 1 does APIs and Eng 2 does WA
- Week 13-16: AI service (Sprint 8) while Eng 1 does outbound and Eng 2 does WhatsApp overflow
- Week 17-20: E2E tests + deployment (Sprint 11)

**Result: ~16-18 weeks with 3 engineers**

---

## 7. Risk Register

### Schedule Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| Airbnb outbound breaks (UI changes) | 2-week delay | Medium | Build selector healing, have manual fallback |
| IMAP IDLE flaky at scale | 1-week delay | Low | Test with 50 concurrent connections early |
| Baileys library breaking change | 1-week delay | Medium | Pin version, monitor releases |
| Claude API latency spikes | Minor | Low | Timeout + fallback response |
| Sprint 6 overflow (Playwright complexity) | 2-week delay | High | Budget 3 weeks, not 2 |

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| No real OTA email samples | Parser development blocked | **Action: Collect 20+ emails per OTA BEFORE Sprint 3** |
| Airbnb session management fragile | Outbound unreliable | Start with manual cookie import, automate later |
| AI intent taxonomy incomplete | Poor auto-response accuracy | Define taxonomy with 50+ example messages before Sprint 8 |
| Memory leaks in Playwright pool | Server crashes | Implement hard memory limits + browser recycling |

### Process Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Schema changes mid-sprint | Cascading rework | Freeze schema after Sprint 1, use migrations for changes |
| API contract mismatches (FE/BE) | Integration delays | Define OpenAPI specs before Sprint 2, use shared types |
| Insufficient test coverage | Bugs in production | Enforce unit tests for parsers (T-069), E2E for flows (T-203–207) |

---

## 8. Definition of Done

### Per-Task DoD
- [ ] Code written, linted, type-checked
- [ ] Unit tests for business logic (parsers, services, utilities)
- [ ] API endpoint tested manually (Postman/HTTPie)
- [ ] Frontend components reviewed in browser
- [ ] No TypeScript errors, no ESLint warnings
- [ ] PR reviewed by at least 1 other engineer

### Per-Sprint DoD
- [ ] All P0 tasks complete
- [ ] Integration between tracks verified
- [ ] No regressions in existing functionality
- [ ] Sprint demo recorded or shown live

### Phase 1 Exit DoD
- [ ] Airbnb messages ingested via IMAP IDLE in < 10 seconds
- [ ] Airbnb replies sent via Playwright with post-send verification
- [ ] Booking.com messages ingested via IMAP, replies sent via email relay
- [ ] WhatsApp messages via Baileys (inbound + outbound + delivery tracking)
- [ ] Conversations correctly threaded by guest + property
- [ ] AI auto-responds to KB-matched queries
- [ ] Failed outbound messages show red alert in UI (never silent)
- [ ] Tarksh team using daily for their own properties

---

## 9. Resource Allocation Model

### Infrastructure Costs (Phase 1)

| Resource | Spec | Monthly Cost |
|----------|------|-------------|
| VPS 1 (App) | 4GB RAM, 2 vCPU | ~$20-40 |
| VPS 2 (Workers) | 4-8GB RAM, 2-4 vCPU | ~$30-60 |
| Domain + SSL | Let's Encrypt (free) | $12/yr |
| Sentry | Free tier (5K events) | $0 |
| Claude API (dev) | Haiku + Sonnet | ~$50-100/mo |
| GitHub | Free tier | $0 |
| **Total** | | **~$100-200/mo** |

### Pre-Sprint Prerequisites Checklist

Before Sprint 1 starts, these must be complete:

- [ ] **Collect 20+ real OTA email samples** (Airbnb, Booking.com) for parser development
- [ ] **Define intent taxonomy** (list of all intents for AI classifier) with 50+ example messages
- [ ] **Design API contract** (OpenAPI spec or shared TypeScript interfaces for all major endpoints)
- [ ] **Define shared TypeScript types** (NormalizedMessage, ConversationStatus, MessageSenderType, etc.)
- [ ] **Create Figma wireframes** (or at minimum, ASCII mockups) for inbox UI
- [ ] **Set up property email accounts** for IMAP testing (Gmail/Zoho with app passwords)
- [ ] **Create Airbnb test account** for Playwright development (or use existing Tarksh account)
- [ ] **Finalize the AI routing flowchart** (intent → KB match → route decision tree)

---

## Appendix A: Task Count Summary

| Sprint | Tasks | P0 | P1 | P2 | Effort (S/M/L/XL) |
|--------|-------|----|----|----|-------------------|
| Sprint 0 | 20 | 15 | 3 | 2 | 7S / 10M / 0L / 0XL |
| Sprint 1 | 22 | 20 | 2 | 0 | 7S / 11M / 0L / 0XL |
| Sprint 2 | 14 | 12 | 2 | 0 | 7S / 7M / 0L / 0XL |
| Sprint 3 | 19 | 16 | 3 | 0 | 4S / 8M / 5L / 0XL |
| Sprint 4 | 13 | 9 | 3 | 1 | 3S / 10M / 0L / 0XL |
| Sprint 5 | 18 | 17 | 1 | 0 | 3S / 10M / 4L / 0XL |
| Sprint 6 | 20 | 17 | 3 | 0 | 1S / 10M / 7L / 2XL |
| Sprint 7 | 15 | 13 | 2 | 0 | 3S / 10M / 2L / 0XL |
| Sprint 8 | 18 | 16 | 2 | 0 | 5S / 6M / 6L / 0XL |
| Sprint 9 | 14 | 8 | 6 | 0 | 5S / 7M / 0L / 0XL |
| Sprint 10 | 17 | 10 | 6 | 1 | 4S / 8M / 2L / 0XL |
| Sprint 11 | 17 | 12 | 4 | 1 | 2S / 6M / 7L / 2XL |
| **Total** | **207** | **165** | **37** | **5** | **55S / 103M / 33L / 4XL** |

### Effort Distribution

- **Small (< 4h)**: 55 tasks → ~165 hours
- **Medium (4-8h)**: 103 tasks → ~618 hours
- **Large (1-2 days)**: 33 tasks → ~396 hours
- **XL (3-5 days)**: 4 tasks → ~120 hours
- **Total estimated**: ~1,299 hours → ~162 working days → ~32 engineer-weeks

With 2 engineers: ~16-20 weeks calendar time (accounting for integration overhead).

---

## Appendix B: P1/P2 Tasks That Can Be Deferred

If timeline pressure exists, these P1/P2 tasks can move to post-MVP polish:

| Task | Sprint | Priority | Impact of Deferral |
|------|--------|----------|-------------------|
| T-003 | 0 | P1 | Low — manual linting ok temporarily |
| T-004 | 0 | P2 | None — pre-commit hooks are nice-to-have |
| T-016 | 0 | P1 | Low — can use Context API initially |
| T-017 | 0 | P1 | Low — can use fetch + useState initially |
| T-040 | 1 | P1 | Low — logout can clear client token only |
| T-047 | 2 | P1 | Low — can delete via DB directly |
| T-052 | 2 | P1 | Low — manual cleanup |
| T-063 | 3 | P1 | Medium — lose debugging capability |
| T-068 | 3 | P1 | Medium — silent failures on unknown emails |
| T-079 | 4 | P1 | Medium — WebSocket drops after token expiry |
| T-083 | 4 | P1 | Low — typing indicators are polish |
| T-087 | 4 | P1 | Low — browser notifications are polish |
| T-088 | 4 | P2 | None — tab badge is pure polish |
| T-108 | 6 | P1 | Medium — lose queue monitoring UI |
| T-122 | 6 | P1 | Medium — 2FA blocks outbound silently |
| T-126 | 6 | P1 | Low — rate limiting still works without jitter |
| T-134 | 7 | P1 | Low — typing simulation is polish |
| T-165 | 9 | P1 | Low — all templates visible to all properties |
| T-168 | 9 | P1 | Low — use Slack for internal comms initially |
| T-169 | 9 | P1 | Low — manual assignment via DB |
| T-177/178 | 10 | P1 | Low — basic filters sufficient |
| T-182 | 10 | P1 | Low — check logs for recovery status |
| T-184 | 10 | P1 | Medium — admin unaware of disconnects |
| T-187 | 10 | P1 | Low — manual health checks |
| T-189/190 | 10 | P1 | Low — single admin for MVP |
| T-197 | 11 | P1 | Low — check logs on VPS |
| T-206/207 | 11 | P1 | Medium — no load/failure testing |

**Deferring all P1/P2 tasks saves ~37 tasks (~60-80 hours), compressing timeline by ~2 weeks.**
