# Tarksh Inbox - Development Tracker

> Unified hospitality inbox: OTA messages (via Beds24 API) + WhatsApp + AI agent in one place.
> ~273 tasks | 4 phases | Phase 1 MVP = 10 sprints (~22 weeks)

## How to Use
- `[x]` = Done | `[ ]` = Pending | `[~]` = In Progress
- **P0** = Must have | **P1** = Should have | **P2** = Nice to have
- Effort: **S** (< 4hrs) | **M** (4-8hrs) | **L** (1-2 days) | **XL** (3-5 days)
- Dependencies noted as `Dep: T-XXX`

## Key Architecture Decision (Phase 1)

**Beds24 API** is the primary channel provider for all OTA messaging. Beds24 is the existing channel manager already connected to Airbnb, Booking.com, and Goibibo. This eliminates IMAP IDLE, Playwright browser pools, per-OTA email parsers, session management, and 2FA handling from Phase 1. IMAP/Playwright become Phase 2 fallbacks for non-Beds24 OTAs.

---

## Phase 1: Foundation (MVP) - Internal Tarksh Use
> Target: ~22 weeks | Single VPS ($60-120/mo) | Exit: Daily usable inbox for Tarksh properties
> Channels: All OTAs via Beds24 (Airbnb, Booking.com, Goibibo) + WhatsApp (Baileys)

---

### Sprint 0: Project Scaffolding & Infra (Week 1-2)

**0.1 - Monorepo & Tooling**
- [ ] T-001: Initialize pnpm monorepo (`apps/web`, `apps/api`, `packages/shared`) | P0 | M
- [ ] T-002: Setup TypeScript config (strict mode, path aliases, shared tsconfig) | P0 | S
- [ ] T-003: Setup ESLint + Prettier (shared config across packages) | P1 | S
- [ ] T-004: Setup Husky + lint-staged (pre-commit hooks) | P2 | S

**0.2 - Backend Scaffolding**
- [ ] T-005: Initialize Fastify server with TypeScript (`apps/api`) | P0 | M
- [ ] T-006: Setup pino structured logging | P0 | S
- [ ] T-007: Setup Zod validation middleware for Fastify | P0 | M
- [ ] T-008: Setup global error handler + Sentry integration | P0 | M
- [ ] T-009: Setup CORS + Helmet security middleware | P0 | S

**0.3 - Database & Cache**
- [ ] T-010: PostgreSQL Docker setup + connection pool | P0 | M
- [ ] T-011: Drizzle ORM setup (config, client, migration scripts) | P0 | M
- [ ] T-012: Redis Docker setup + ioredis connection | P0 | S
- [ ] T-013: Docker Compose for local dev (Postgres + Redis) | P0 | M

**0.4 - Frontend Scaffolding**
- [ ] T-014: Initialize Next.js 14+ App Router with TypeScript (`apps/web`) | P0 | M
- [ ] T-015: Setup Tailwind CSS + shadcn/ui component library | P0 | M
- [ ] T-016: Setup Zustand store boilerplate | P1 | S
- [ ] T-017: Setup TanStack Query provider + API client | P1 | S

**0.5 - Dev Infrastructure**
- [ ] T-018: Nginx reverse proxy config (Next.js :3000 + Fastify :4000) | P0 | M
- [ ] T-019: Environment variable management (.env schema + Zod validation) | P0 | S
- [ ] T-020: GitHub repo + branch strategy (main/develop/feature) + basic CI (lint + typecheck) | P1 | M

**Sprint 0 Total: 20 tasks**

---

### Sprint 1: Data Model & Auth (Week 3-4)

**1.1 - Core Schema**
> Source: `docs/architecture.md` data model + `packages/shared/src/types/database.ts` (already written)

- [ ] T-021: Organization table (`id`, `name`, `slug`, `plan` enum, `settings` JSONB, timestamps) | P0 | S
- [ ] T-022: User table (`id`, `name`, `email`, `password_hash` argon2, `role` enum admin/agent, `org_id` FK) | P0 | S
- [ ] T-023: Property table (`id`, `name`, `address`, `description`, `timezone`, `org_id` FK) | P0 | S
- [ ] T-024: Guest table (`id`, `name`, `email`, `phone`, `language`, `identifiers` JSONB, `merged_into_id` FK, `org_id` FK, `last_active_at`) | P0 | M
- [ ] T-025: Conversation table (`id`, `guest_id`, `property_id`, `booking_id`, `status` enum, `assigned_to`, `ai_enabled`, `locked_by`, `locked_at`, `last_message_at`, `last_message_preview`, `unread_count`, `primary_channel`) | P0 | M
- [ ] T-026: Message table (`id`, `conversation_id`, `content`, `sender_type` enum, `sender_id`, `channel`, `external_id`, `delivery_status` enum, `is_internal_note`, `attachments` JSONB) | P0 | M
- [ ] T-027: Booking table (`id`, `guest_id`, `property_id`, `channel`, `external_booking_id`, `check_in`, `check_out`, `num_guests`, `amount`, `currency`, `status`) | P0 | M
- [ ] T-028: ChannelConnection table (`channel_type` enum, `connection_method` enum incl. `beds24_api`, `credentials` encrypted, `status`, `property_id` FK, `beds24_property_id`, `last_sync_at`, `error_message`) | P0 | M
- [ ] T-029: KnowledgeBase table (`property_id` FK, `data` JSONB, `version` int for cache invalidation) | P0 | S
- [ ] T-030: AIEvaluation table (`message_id`, `conversation_id`, `property_id`, `detected_intent`, `detected_stage`, `kb_fields_used` TEXT[], `generated_response`, `routing_decision` enum auto_send/draft/route_to_human, `was_edited`, `was_cancelled`, `token_usage` JSONB, `latency_ms`) | P0 | M
- [ ] T-031: Template table (`id`, `property_id`, `name`, `category`, `content`, `variables` TEXT[]) | P0 | S
- [ ] T-032: Critical indexes — GIN on `guests.identifiers`, GIN FTS on `messages.content`, composite on `conversations(org_id, status)`, `messages(conversation_id, created_at)` | P0 | M
- [ ] T-033: Run Drizzle migration for all tables | P0 | M

**1.2 - Authentication**
- [ ] T-034: Argon2 password hashing utility (hash + verify) | P0 | S
- [ ] T-035: JWT access token (15min) + refresh token (7d) generation | P0 | M
- [ ] T-036: Login endpoint `POST /auth/login` (email + password -> tokens) | P0 | M
- [ ] T-037: Token refresh endpoint `POST /auth/refresh` | P0 | S
- [ ] T-038: Auth middleware (JWT verification, `org_id` + `user_id` injection into request) | P0 | M
- [ ] T-039: httpOnly secure cookie handling for refresh tokens | P0 | S
- [ ] T-040: Logout endpoint (refresh token invalidation via Redis blacklist) | P1 | S

**1.3 - Credential Encryption**
- [ ] T-041: AES-256-GCM encrypt/decrypt utility for channel credentials (Beds24 API key, etc.) | P0 | M
- [ ] T-042: Encryption key management (env-based, key rotation support) | P0 | S

**Sprint 1 Total: 22 tasks**

---

### Sprint 2: Property & Channel Management APIs (Week 5-6)

**2.1 - Property CRUD**
- [ ] T-043: `POST /properties` — create property (org-scoped) | P0 | M
- [ ] T-044: `GET /properties` — list properties (org-scoped, paginated) | P0 | S
- [ ] T-045: `GET /properties/:id` — get property detail | P0 | S
- [ ] T-046: `PATCH /properties/:id` — update property | P0 | S
- [ ] T-047: `DELETE /properties/:id` — soft delete property | P1 | S
- [ ] T-048: `GET/PUT /properties/:id/knowledge-base` — KB CRUD with Zod validation | P0 | M

**2.2 - Channel Connection Management**
- [ ] T-049: `POST /properties/:id/channels` — add channel connection (accepts `beds24_api`, `baileys`) | P0 | M
- [ ] T-050: `GET /properties/:id/channels` — list connections with status | P0 | S
- [ ] T-051: `PATCH /channels/:id` — update connection config | P0 | S
- [ ] T-052: `DELETE /channels/:id` — remove connection (cleanup sessions) | P1 | S
- [ ] T-053: `GET /channels/:id/health` — health status + last sync time | P0 | S

**Sprint 2 Total: 11 tasks**

---

### Sprint 3: Beds24 Integration (Week 7-8)

> Source: `docs/channel-integrations.md` Beds24 section, `docs/architecture.md` ChannelAdapter pattern

**3.1 - Beds24 API Client**
- [ ] T-054: Beds24 HTTP client (base URL, API key auth header, timeout, error handling, response typing) | P0 | M
- [ ] T-055: `get_messages(bookId)` method — fetch all messages for a booking | P0 | M
- [ ] T-056: `send_message(bookId, message)` method — send reply, return `DeliveryResult` | P0 | M
- [ ] T-057: `get_booking(bookId)` method — fetch booking details (dates, guest, status, channel) | P0 | M
- [ ] T-058: `get_property(query)` method — fetch property metadata from Beds24 | P0 | S
- [ ] T-059: Beds24 API rate limiter — shared Redis token bucket (respect 120 req/min across all properties) | P0 | M

**3.2 - Beds24 Property Sync & Setup**
- [ ] T-060: Beds24 property sync service — fetch properties from Beds24, map to Tarksh properties | P0 | M
- [ ] T-061: Beds24 connection setup UI (Settings > Integrations > Beds24: enter API key, view properties, map to Tarksh, show webhook URL) | P0 | L
- [ ] T-062: Beds24 channel identification — extract source OTA (`airbnb`/`booking_com`/`goibibo`/`direct`) from booking metadata | P0 | S

**3.3 - Beds24 Inbound**
- [ ] T-063: Webhook endpoint `POST /api/webhooks/beds24` — verify signature, extract `bookId`, respond 200 immediately | P0 | M
- [ ] T-064: Webhook processor — fetch full message via `get_messages(bookId)`, normalize, dedup, emit `message:received` | P0 | L
- [ ] T-065: Polling service — 60-second interval per property, fetch new messages, dedup via `external_id` | P0 | L
- [ ] T-066: Beds24 inbound normalizer — `Beds24Message` -> `NormalizedMessage` (set `channel` from booking source, `sourceAdapter = 'beds24'`) | P0 | M
- [ ] T-067: Booking context auto-fetch on first message — `get_booking(bookId)` -> create/update `Booking` record linked to conversation | P0 | M

**3.4 - Plug-and-Play Channel Architecture**
> Source: `docs/architecture.md` ChannelAdapter pattern, `docs/plug-and-play-review.md`

- [ ] T-068: `ChannelAdapter` + `ChannelCapabilities` + `ChannelOutboundSender` + `ChannelHealthCheck` interfaces (`/channels/interfaces.ts`) | P0 | M
- [ ] T-069: `ChannelRegistry` class — `register()`, `get()`, `getAll()`, auto-registers health checks | P0 | M
- [ ] T-070: `Beds24ChannelAdapter` implementation — implements `ChannelAdapter`, registers on startup, declares capabilities (text-only, no read receipts) | P0 | M
- [ ] T-071: `Beds24HealthCheck` — verify API key valid, last webhook received, last poll time, per-property sync status | P0 | S

**3.5 - Event Bus & Message Pipeline**
- [ ] T-072: Typed `EventBus` (`message:received`, `message:sent`, `message:delivery_updated`, `message:failed`, `conversation:*`, `ai:*`) | P0 | M
- [ ] T-073: `message:received` handler chain — save to DB -> create/update conversation -> link guest -> link booking -> WebSocket push -> queue AI evaluation | P0 | L
- [ ] T-074: `MessagePipeline` class + `MessageMiddleware` interface (hooks: `pre-save`, `post-save`, `pre-ai`) | P1 | M
- [ ] T-075: Message deduplication via `external_id` = `beds24_{bookId}_{messageTimestamp}`, UPSERT for enrichment | P0 | M

**Sprint 3 Total: 22 tasks**

---

### Sprint 4: Real-Time & WebSocket (Week 9-10)

**4.1 - Socket.io Server**
> Source: `docs/architecture.md` real-time section

- [ ] T-076: Socket.io server setup integrated with Fastify | P0 | M
- [ ] T-077: JWT validation on Socket.io handshake (reject invalid tokens) | P0 | M | Dep: T-035
- [ ] T-078: Room authorization (verify `org_id` before joining org room) | P0 | M
- [ ] T-079: Token refresh handling for long-lived WebSocket connections | P1 | M
- [ ] T-080: Redis Pub/Sub adapter for Socket.io (required for multi-process) | P0 | M

**4.2 - Real-Time Events**
> Source: `packages/shared/src/types/events.ts` (already defined)

- [ ] T-081: `new_message` event -> broadcast to org room on every inbound/outbound message | P0 | M
- [ ] T-082: `conversation_updated` event -> status changes, assignment changes | P0 | S
- [ ] T-083: `typing_indicator` event -> show who's typing in conversation | P1 | S
- [ ] T-084: `agent_replying` lock broadcast -> "Agent X is replying..." indicator | P0 | S

**4.3 - Frontend Socket Client**
- [ ] T-085: Socket.io client setup with JWT auth token on connect | P0 | M
- [ ] T-086: Zustand store: merge real-time events into conversation/message state | P0 | M
- [ ] T-087: Browser Notification API integration (new message alerts) | P1 | M
- [ ] T-088: Tab title unread count badge (`(3) Tarksh Inbox`) | P2 | S

**Sprint 4 Total: 13 tasks**

---

### Sprint 5: Inbox UI + Outbound Queue (Week 11-13)

**5.1 - Layout & Navigation**
- [ ] T-089: App shell layout (collapsible sidebar + main content area) | P0 | M
- [ ] T-090: Sidebar navigation (Inbox, Properties, Templates, Settings) | P0 | M
- [ ] T-091: Login page UI (email + password form, error states) | P0 | M
- [ ] T-092: Auth flow (login -> store token -> protected route redirect -> auto-refresh) | P0 | L

**5.2 - Conversation List (Feature F1.1)**
> Source: `docs/features.md` F1.1

- [ ] T-093: `GET /conversations` API (paginated, filterable by status/channel/property/assigned) | P0 | L
- [ ] T-094: Conversation list component (guest name, last message preview, channel icon, property tag, timestamp, unread dot) | P0 | L
- [ ] T-095: Conversation status badges (unread=blue, pending=yellow, replied=green, resolved=gray, starred=gold) | P0 | M
- [ ] T-096: Sort by recency + real-time push new messages to top via WebSocket | P0 | M
- [ ] T-097: Channel icon component (Airbnb, Booking.com, Goibibo, WhatsApp) | P0 | S

**5.3 - Conversation Detail Panel (Feature F1.2)**
> Source: `docs/features.md` F1.2

- [ ] T-098: `GET /conversations/:id/messages` API (paginated, chronological) | P0 | M
- [ ] T-099: Conversation header (guest name, channel badge, property name, status dropdown) | P0 | M
- [ ] T-100: Message thread (chronological, distinct styling per sender_type: guest/agent/ai/system) | P0 | L
- [ ] T-101: AI message visual distinction (labeled "AI-assisted" badge, lighter background) | P0 | S
- [ ] T-102: Reply composer (textarea, Ctrl/Cmd+Enter to send, channel indicator) | P0 | M
- [ ] T-103: `POST /conversations/:id/messages` API (create message with `status=queued`, add to outbound queue) | P0 | M

**5.4 - Booking Context Sidebar (Feature F1.3)**
> Source: `docs/features.md` F1.3 — booking data auto-populated from Beds24 API

- [ ] T-104: Booking context sidebar component (right panel in conversation view) | P0 | M
- [ ] T-105: Display: booking ID, property, check-in/out dates, guests, amount, currency, status, channel, special requests | P0 | M
- [ ] T-106: Guest-to-booking linking logic (match by guest name + channel identifier from Beds24 booking data) | P0 | M

**5.5 - Outbound Queue & Delivery State Machine**
> Source: `docs/phase1-state-machines.md` Machine #1 (Message Delivery)

- [ ] T-107: BullMQ connection to Redis + queue definitions (`channel-outbound`, `ai-evaluation`) | P0 | M
- [ ] T-108: `JobQueue` interface wrapping BullMQ (enables future swap to SQS/Cloud Tasks) | P0 | M
- [ ] T-109: Bull Board UI for queue monitoring (admin-only route) | P1 | M
- [ ] T-110: Message delivery state machine: `queued -> sending -> sent -> confirmed / failed` (implement `VALID_DELIVERY_TRANSITIONS`) | P0 | L
- [ ] T-111: Outbound queue worker: dequeue -> resolve `ChannelAdapter` from `channelRegistry` -> call `adapter.outboundSender.send()` -> update status | P0 | L
- [ ] T-112: Retry logic: 3 retries with exponential backoff (5s, 15s, 60s), then mark `failed`, emit `message:failed` | P0 | M
- [ ] T-113: Failed message UI: red banner alert in conversation — **never silent failure** — with Retry / Dismiss actions | P0 | M
- [ ] T-114: Delivery status real-time updates via WebSocket (`delivery_status_updated` event) | P0 | M

**Sprint 5 Total: 24 tasks**

---

### Sprint 6: WhatsApp Integration (Week 14-15)

> Source: `docs/channel-integrations.md` WhatsApp section

**6.1 - WhatsApp via Baileys**
- [ ] T-115: Baileys client setup (WebSocket connection to WhatsApp servers) | P0 | L
- [ ] T-116: QR code pairing flow (generate QR -> display in settings UI -> wait for scan) | P0 | L
- [ ] T-117: Auth state persistence (store session creds, survive process restart) | P0 | M
- [ ] T-118: Inbound message handler -> `NormalizedMessage` (phone, name, text, timestamp) | P0 | M
- [ ] T-119: Group message filtering (silently ignore all group messages) | P0 | S
- [ ] T-120: Outbound text message sending via Baileys | P0 | M
- [ ] T-121: Delivery status tracking (sent -> delivered -> read receipts) | P0 | M
- [ ] T-122: Typing indicator simulation before outbound send | P1 | S
- [ ] T-123: Health check every 5 minutes (verify connection alive) | P0 | M
- [ ] T-124: Auto-reconnect on disconnect with exponential backoff | P0 | M
- [ ] T-125: Rate limiting: max 1msg/10sec/number, max 20 msg/hr total | P0 | M
- [ ] T-126: WhatsApp connection status in settings UI (Disconnected -> QR Scan -> Connected) | P0 | M
- [ ] T-127: `WhatsAppChannelAdapter` implementation — implements `ChannelAdapter`, registers with `channelRegistry`, declares capabilities (text, read receipts, typing indicator) | P0 | M

**6.2 - Guest Matching**
> Source: `docs/architecture-review.md` P1.4 — manual only, no auto-merge

- [ ] T-128: Match WhatsApp phone number (E.164) to `guests.identifiers.whatsapp` | P0 | M
- [ ] T-129: Auto-create new guest record if no match found | P0 | S
- [ ] T-130: Manual "Link Guest" UI action (merge WhatsApp contact with existing guest/booking) | P0 | M

**Sprint 6 Total: 16 tasks**

---

### Sprint 7: AI Auto-Response (Week 16-17)

> Source: `docs/ai-agent.md`, `docs/phase1-ai-intent-taxonomy.md`, `docs/architecture-review.md` P0.1

**7.1 - LLM Abstraction & AI Service Core**
- [ ] T-131: `LLMProvider` interface (`classifyIntent()`, `generateResponse()`) + `ClaudeLLMProvider` implementation (wraps Anthropic SDK) | P0 | M
- [ ] T-132: Haiku intent classifier — structured JSON output `{ intent, stage }` using taxonomy from `phase1-ai-intent-taxonomy.md` Section 5 prompt | P0 | L
- [ ] T-133: `NEVER_AUTO_INTENTS` set (12 intents) + `INTENT_TO_KB_MAP` registry (17 auto-respondable mappings) — hard-coded, zero LLM cost | P0 | S
- [ ] T-134: KB field matching service — Step 3: map intent -> check property KB fields -> `high`/`medium`/`low` confidence | P0 | L
- [ ] T-135: Sonnet response generator — system prompt builder (KB data + guest context + conversation history + rules + 500 char cap) using prompt from `phase1-ai-intent-taxonomy.md` Section 6 | P0 | L
- [ ] T-136: Context truncation: last 10 messages max in prompt | P0 | S
- [ ] T-137: "Let me check with our team" fallback when no KB match | P0 | S

**7.2 - Response Caching**
- [ ] T-138: Redis response cache: key = `ai:response:{property_id}:{intent}:{kb_version}`, TTL 24h, invalidate on KB update | P1 | M
- [ ] T-139: Cache hit/miss logic in AI worker (skip Sonnet call on cache hit, adjust guest name) | P1 | S

**7.3 - AI Queue & Routing**
> Source: `docs/phase1-state-machines.md` Machine #5 (AI Evaluation)

- [ ] T-140: BullMQ `ai-evaluation` queue (concurrency: 5, rate limit: 50 req/min, retry: 3x exponential) | P0 | M
- [ ] T-141: AI evaluation worker: dequeue -> classify (Haiku) -> never-auto check -> KB match -> generate (Sonnet) -> route | P0 | L
- [ ] T-142: Routing logic: KB match + `auto_send` -> outbound queue; KB match + `draft_only` -> draft; no match / never_auto -> route_human | P0 | L
- [ ] T-143: `AIEvaluation` record creation on every evaluation (full audit trail, `was_cancelled` flag) | P0 | M
- [ ] T-144: AI cancellation: Redis `ai:cancel:{conversation_id}` key, checked between steps; set when human opens conversation | P0 | M

**7.4 - AI Controls UI**
> Source: `docs/features.md` F4.3

- [ ] T-145: AI enable/disable toggle per property (in property settings) | P0 | M
- [ ] T-146: Auto-send vs draft-only mode selector per property | P0 | M
- [ ] T-147: AI draft review UI: approve (send as-is) / edit (modify then send) / discard | P0 | L
- [ ] T-148: AI response label in message thread ("AI-assisted" badge, lighter background) | P0 | S

**Sprint 7 Total: 18 tasks**

---

### Sprint 8: Templates, Quick Actions & Concurrency (Week 18-19)

**8.1 - Response Templates (Feature F3.2)**
> Source: `docs/features.md` F3.2

- [ ] T-149: Template CRUD API (`POST/GET/PATCH/DELETE /templates`) | P0 | M
- [ ] T-150: Template categories: Check-in, Check-out, Amenities, Directions, House Rules, General | P0 | S
- [ ] T-151: Template variables: `{{guest_name}}`, `{{property_name}}`, `{{check_in_date}}`, `{{check_out_date}}`, `{{check_in_time}}`, `{{check_out_time}}`, `{{wifi_password}}`, `{{property_address}}` | P0 | M
- [ ] T-152: Variable resolution engine (replace variables with actual booking/property data) | P0 | M
- [ ] T-153: Template picker dropdown in reply composer | P0 | M
- [ ] T-154: Per-property template assignment | P1 | S

**8.2 - Quick Actions (Feature F3.3)**
- [ ] T-155: Mark conversation as resolved (status update + WebSocket broadcast) | P0 | S
- [ ] T-156: Star/unstar conversation toggle | P0 | S
- [ ] T-157: Internal notes (messages with `is_internal_note=true`, visible only to team) | P1 | M
- [ ] T-158: Conversation assignment to agent (dropdown in conversation header) | P1 | M

**8.3 - Concurrency Control**
> Source: `docs/phase1-state-machines.md` Machine #3 (Conversation Lock)

- [ ] T-159: Redis conversation lock: `conv:{id}:lock = {user_id, timestamp}`, 2-min TTL | P0 | M
- [ ] T-160: Lock refresh on typing activity (extend TTL every 30s while composing) | P0 | S
- [ ] T-161: "Agent X is replying..." indicator broadcast via WebSocket | P0 | S
- [ ] T-162: Human priority: opening conversation cancels any pending AI evaluation | P0 | S

**Sprint 8 Total: 14 tasks**

---

### Sprint 9: Filters, Search, Health, Users & Deployment (Week 20-22)

**9.1 - Filters & Search (Feature F1.4)**
> Source: `docs/features.md` F1.4

- [ ] T-163: Filter conversations by channel (Airbnb, Booking.com, Goibibo, WhatsApp) | P0 | M
- [ ] T-164: Filter conversations by property | P0 | S
- [ ] T-165: Filter by status (unread, pending, replied, resolved, starred) | P0 | M
- [ ] T-166: Filter by date range (last 7d, 30d, custom) | P1 | S
- [ ] T-167: Filter by assigned agent | P1 | S
- [ ] T-168: Full-text search across message content (PostgreSQL GIN + `ts_vector`) | P0 | L
- [ ] T-169: Guest name search (autocomplete) | P0 | M

**9.2 - Channel Health Dashboard (Feature F2.3)**
> Source: `docs/features.md` F2.3, `docs/channel-integrations.md` health section

- [ ] T-170: Channel health page — Beds24: Connected/Error + last webhook time + last poll time; WhatsApp: Connected/Disconnected/QR Scan | P0 | M
- [ ] T-171: Webhook vs polling mode indicator per property (auto-fallback detection) | P1 | S
- [ ] T-172: "Unsent messages" count indicator per channel | P0 | M
- [ ] T-173: Admin alert on Beds24 API failure (3 consecutive failures) or WhatsApp disconnect (> 5 min) | P1 | M

**9.3 - Observability**
- [ ] T-174: `/health` endpoint — DB, Redis, Beds24 API (key valid + last sync), WhatsApp (connected/disconnected), queue depths (outbound + ai-evaluation) | P0 | L
- [ ] T-175: Sentry error tracking integration (backend + frontend) | P0 | M
- [ ] T-176: UptimeRobot monitoring for `/health` endpoint | P1 | S

**9.4 - User Management (Feature F6)**
> Source: `docs/features.md` F6

- [ ] T-177: Admin vs Agent role enforcement (middleware + UI) | P0 | M
- [ ] T-178: Invite user by email (admin action, send invite link) | P1 | M
- [ ] T-179: Assign agents to properties (admin action) | P1 | M

**9.5 - Notifications (Feature F7)**
> Source: `docs/features.md` F7

- [ ] T-180: `NotificationProvider` interface (supports WebSocket push, email, future Slack/SMS) | P1 | M
- [ ] T-181: In-app notification bell with unread count + notification list | P1 | M

**9.6 - Production Deployment**
> Single VPS — no browser pool, no IMAP listeners needed

- [ ] T-182: Single VPS provision (Hetzner/DO 4GB): Nginx + Next.js + Fastify + PostgreSQL + Redis | P0 | L
- [ ] T-183: Docker Compose production config (single file: nginx, web, api, postgres, redis) | P0 | L
- [ ] T-184: SSL/TLS setup (Let's Encrypt via certbot, auto-renew) | P0 | M
- [ ] T-185: GitHub Actions CI/CD: lint -> typecheck -> build -> deploy to VPS | P0 | L
- [ ] T-186: Database backup strategy (pg_dump daily, 7-day retention, off-site) + log rotation | P0 | M

**9.7 - Security Hardening**
- [ ] T-187: Rate limiting on all API endpoints (per IP + per user) | P0 | M
- [ ] T-188: CORS configuration locked to production domains | P0 | S
- [ ] T-189: Input validation audit (verify Zod validation on every endpoint) | P0 | M
- [ ] T-190: `org_id` scoping audit (verify every DB query is tenant-filtered) | P0 | M
- [ ] T-191: Secrets management audit (no credentials in code, all in env vars) | P0 | S

**9.8 - End-to-End Testing**
- [ ] T-192: E2E test: Beds24 webhook -> conversation created -> AI evaluates -> draft shown -> agent approves -> Beds24 API sends -> delivery confirmed | P0 | XL
- [ ] T-193: E2E test: WhatsApp message -> conversation created -> reply sent via Baileys -> delivery tracked | P0 | L
- [ ] T-194: E2E test: Beds24 polling fallback -> poll detects message -> conversation created -> AI draft -> agent sends | P0 | L

**Sprint 9 Total: 33 tasks** (3-week sprint)

---

### Phase 1 Exit Criteria

- [ ] OTA messages received in real-time via Beds24 webhooks (< 30 sec latency)
- [ ] Beds24 polling fallback works (< 60 sec latency when webhooks not configured)
- [ ] Can send replies to Airbnb/Booking.com/Goibibo guests via Beds24 API
- [ ] Can receive and reply to WhatsApp messages via Baileys
- [ ] Conversations threaded by guest across channels
- [ ] Booking details auto-populated from Beds24 API alongside conversations
- [ ] AI auto-responds to KB-matched queries (Haiku classify -> Sonnet generate)
- [ ] Failed outbound messages show red alert in UI (never silent failure)
- [ ] Team can use daily for Tarksh/Zest Living properties

**Phase 1 Total: 193 tasks across 10 sprints (Sprint 0-9)**

---
---

## Phase 2: AI & Channels (5-10 Beta Customers)
> Target: ~12-16 weeks after Phase 1 | Exit: Full lifecycle AI + all OTAs + beta users

---

### Epic 2.1: Full Lifecycle AI
> Source: `docs/ai-agent.md` lifecycle stages + automated triggers

- [ ] T-195: Guest lifecycle stage detection engine (pre-booking -> post-booking -> pre-arrival -> during stay -> post-checkout) | P0 | L
- [ ] T-196: Stage-specific system prompt templates (5 stages x distinct instructions) | P0 | L
- [ ] T-197: Automated trigger: Welcome message on booking confirmed (immediate) | P0 | M
- [ ] T-198: Automated trigger: Check-in instructions 24h before arrival | P0 | M
- [ ] T-199: Automated trigger: Mid-stay check-in 24h after arrival | P1 | M
- [ ] T-200: Automated trigger: Pre-checkout reminder (evening before) | P1 | M
- [ ] T-201: Automated trigger: Post-checkout thank you + review request (2-4h after) | P1 | M
- [ ] T-202: Escalation detection improvements (sentiment-based, beyond keyword matching) | P0 | L
- [ ] T-203: AI cost tracking dashboard (token usage per property, Haiku + Sonnet breakdown) | P0 | M
- [ ] T-204: Per-property AI cost caps (hard limit, alert at 80%) | P1 | M
- [ ] T-205: Response caching improvements (expand cacheable intents, multi-language cache keys) | P1 | M

### Epic 2.2: WhatsApp Business API Migration
> Source: `docs/channel-integrations.md` — moved from Phase 4 to Phase 2

- [ ] T-206: WhatsApp Business API integration (Meta Cloud API setup, webhook registration) | P0 | XL
- [ ] T-207: WhatsApp message template creation + approval workflow | P0 | L
- [ ] T-208: Webhook handler for inbound WA Business API messages | P0 | L
- [ ] T-209: `WhatsAppBusinessAdapter` — new ChannelAdapter, registers alongside Baileys adapter | P0 | L
- [ ] T-210: Migration path: Baileys -> Business API (per-property, Baileys fallback if not approved) | P1 | M

### Epic 2.3: Additional OTAs via Beds24
> These are trivially simple — just adding channel identification mappings

- [ ] T-211: Enable Agoda channel identification in Beds24 adapter (if Beds24 has Agoda connected) | P1 | S
- [ ] T-212: Enable Expedia channel identification in Beds24 adapter | P1 | S
- [ ] T-213: Beds24 multi-property API key support (for orgs with multiple Beds24 accounts) | P1 | M
- [ ] T-214: Beds24 analytics integration — pull revenue/occupancy data for dashboard | P2 | L

### Epic 2.4: IMAP Fallback (for non-Beds24 OTAs)
> Moved from Phase 1 — only needed for properties NOT using Beds24

- [ ] T-215: ImapFlow connection manager (connect, authenticate, select INBOX, start IDLE) | P1 | L
- [ ] T-216: IMAP connection pool (one connection per property email, manage lifecycle) | P1 | L
- [ ] T-217: Auto-reconnect with exponential backoff (5s -> 15s -> 30s -> 60s) | P1 | M
- [ ] T-218: IDLE refresh every 25 minutes (RFC 2177 requirement) | P1 | S
- [ ] T-219: Health check per IMAP connection (alert on > 2 min disconnection) | P1 | M
- [ ] T-220: `OTAEmailParser` interface (`canParse`, `parse`, `isContentTruncated`) | P1 | S
- [ ] T-221: Airbnb email parser — extract guest name, message content, reservation ref | P1 | L
- [ ] T-222: Booking.com email parser — extract guest name, message, reservation ID, reply-to | P1 | L
- [ ] T-223: Goibibo email parser (`@goibibo.com` + `@makemytrip.com`) — India differentiator | P1 | L
- [ ] T-224: Channel detection regex patterns (airbnb, booking_com, goibibo, agoda, expedia) | P1 | S
- [ ] T-225: `IMAPChannelAdapter` implementation — registers with `channelRegistry` | P1 | M
- [ ] T-226: Email connection setup UI/API (`POST/GET/PATCH/DELETE /properties/:id/email`) | P1 | M
- [ ] T-227: Parser unit tests with real sample emails (5+ per channel) | P1 | L

### Epic 2.5: On-Demand Playwright Outbound (for non-Beds24 OTAs)
> Moved from Phase 1 — only needed for OTAs where Beds24 can't send

- [ ] T-228: Playwright browser pool manager (5-10 pooled browser contexts) | P1 | XL
- [ ] T-229: Browser acquire/release with timeouts (30s acquire, 5min max use) | P1 | L
- [ ] T-230: Airbnb session management (cookies encrypted in Redis, auto-re-auth on expiry) | P1 | L
- [ ] T-231: Airbnb message sender (navigate -> `/hosting/inbox/{thread_id}` -> type -> send -> verify) | P1 | XL
- [ ] T-232: Anti-detection (realistic browser fingerprint, randomized delays 2-5s, single concurrent session) | P1 | L
- [ ] T-233: Post-send verification (confirm message appears in thread, else retry) | P1 | L
- [ ] T-234: 2FA detection + admin alert (interactive relay via WebSocket) | P1 | L
- [ ] T-235: Booking.com email relay sender (`hotel-{id}-{res_id}@guest.booking.com`) + SMTP setup | P1 | L
- [ ] T-236: `PlaywrightChannelAdapter` implementation — registers with `channelRegistry` | P1 | M
- [ ] T-237: Workers VPS setup (4-8GB — browser pool + IMAP listeners, separate from app VPS) | P1 | L

### Epic 2.6: Enhanced Inbox Features
- [ ] T-238: Conversation assignment workflow (assign/unassign/reassign with notifications) | P1 | M
- [ ] T-239: Multi-language AI responses (detect guest language, respond in kind) | P2 | L
- [ ] T-240: Gmail OAuth connection (replace email forwarding for Gmail users) | P2 | L
- [ ] T-241: Outlook OAuth connection (Microsoft Graph API) | P2 | L
- [ ] T-242: Email notifications for missed messages (> 30 min no response) | P2 | M
- [ ] T-243: AI operating hours (auto-respond only outside business hours, or always) | P1 | M

### Phase 2 Exit Criteria

- [ ] All Beds24-connected OTA channels integrated (Airbnb, Booking.com, Goibibo, Agoda, Expedia)
- [ ] WhatsApp running on official Business API (no ban risk)
- [ ] AI handles full guest lifecycle with 6 automated triggers
- [ ] IMAP fallback available for non-Beds24 properties
- [ ] 5-10 beta customers actively using the product
- [ ] AI auto-resolution rate > 40%

**Phase 2 Total: 49 tasks**

---
---

## Phase 3: SaaS Launch (100+ Properties)
> Target: ~12-16 weeks after Phase 2 | Exit: Self-serve product with billing

---

### Epic 3.1: Multi-Tenancy
- [ ] T-244: PostgreSQL Row-Level Security (RLS) policies on all tables | P0 | XL
- [ ] T-245: Tenant isolation audit (every query, every API endpoint, every WebSocket room) | P0 | L
- [ ] T-246: Tenant-scoped Redis key namespacing (`org:{id}:*`) | P0 | M

### Epic 3.2: Self-Serve Onboarding
- [ ] T-247: Signup flow (create org -> create admin user -> email verify -> login) | P0 | L
- [ ] T-248: Guided onboarding wizard (step 1: add property -> step 2: connect Beds24 -> step 3: setup KB -> step 4: enable AI) | P0 | XL
- [ ] T-249: Email verification (send verification link, verify token) | P0 | M
- [ ] T-250: Password reset flow (forgot password -> email link -> reset form) | P0 | M

### Epic 3.3: Billing
> Source: `docs/roadmap.md` pricing tiers

- [ ] T-251: Stripe + Razorpay integration (dual gateway for global + India) | P0 | XL
- [ ] T-252: Pricing tiers: Starter (3 props, 2 channels, 500 AI msgs/mo) / Pro (15, all, 5000) / Business (50, all, 20000) / Enterprise (unlimited) | P0 | L
- [ ] T-253: Usage metering (track properties, channels, AI messages per billing period) | P0 | L
- [ ] T-254: Plan limits enforcement (block actions exceeding plan limits, show upgrade prompt) | P0 | L
- [ ] T-255: Billing dashboard (current plan, usage, invoices, payment method management) | P0 | L

### Epic 3.4: Analytics, Team & Mobile
- [ ] T-256: Analytics dashboard (avg response time, AI resolution rate, message volume by channel, conversations per property) | P1 | XL
- [ ] T-257: Team management (invite members, manage roles, deactivate users) | P1 | L
- [ ] T-258: Guest profiles (unified view: all conversations, all channels, booking history) | P1 | L
- [ ] T-259: Mobile/PWA responsive design (full inbox usable on phone) | P1 | XL
- [ ] T-260: Audit logs (who did what, when — admin visibility) | P2 | L
- [ ] T-261: Webhook API for external integrations (events: new_message, booking_created, etc.) | P2 | L
- [ ] T-262: GDPR compliance — data export, deletion, consent management | P1 | L

### Epic 3.5: Beds24 Scaling
- [ ] T-263: Per-organization Beds24 API key isolation (Phase 1 used shared key) | P0 | M
- [ ] T-264: Beds24 rate limit management across 100+ properties (per-org token bucket, request limit increase) | P0 | M

### Phase 3 Exit Criteria

- [ ] Self-serve signup -> onboarding -> first message within 15 minutes
- [ ] Billing processing payments via Stripe/Razorpay
- [ ] 100+ properties onboarded across multiple organizations
- [ ] RLS-enforced multi-tenancy (zero cross-org data leakage)
- [ ] Usable on mobile devices

**Phase 3 Total: 21 tasks**

---
---

## Phase 4: Scale & Differentiate (500+ Properties)
> Target: Ongoing after Phase 3 | Exit: Market leadership in Indian hospitality messaging

---

### Epic 4.1: Official API Migration
- [ ] T-265: Airbnb Partner API integration (supplement/replace Beds24 for direct API access) | P0 | XL
- [ ] T-266: Booking.com Connectivity Partner API (enriched data beyond Beds24) | P1 | XL
- [ ] T-267: Expedia Partner API | P1 | XL
- [ ] T-268: Agoda Partner API (if available) | P2 | L

### Epic 4.2: Advanced Features
- [ ] T-269: Review management (request + respond to reviews across channels) | P1 | XL
- [ ] T-270: Sentiment analysis on conversations (positive/neutral/negative tagging) | P1 | L
- [ ] T-271: Staff task management (create tasks from guest requests, assign to housekeeping/maintenance) | P1 | XL
- [ ] T-272: PMS integrations (Cloudbeds, Opera, Hostaway — sync bookings, availability) | P1 | XL
- [ ] T-273: Public REST API for third-party integrations | P2 | XL

### Epic 4.3: Platform
- [ ] T-274: White-labeling support (custom branding for enterprise customers) | P2 | XL
- [ ] T-275: AI fine-tuning per property (learn from approved/edited responses) | P2 | XL
- [ ] T-276: Voice/call integration (phone call transcription + AI response) | P2 | XL

### Phase 4 Exit Criteria

- [ ] 90%+ channels on official APIs or stable Beds24/email relay
- [ ] Advanced analytics driving demonstrable ROI
- [ ] Platform API available for third-party integrations
- [ ] 500+ properties across 50+ organizations

**Phase 4 Total: 12 tasks**

---
---

## Summary

| Phase | Description | Tasks | Duration | Target |
|-------|------------|-------|----------|--------|
| **Phase 1** | Foundation (MVP) — Beds24 + WhatsApp + AI | 193 | ~22 weeks | Internal Tarksh use |
| **Phase 2** | AI & Channels — Lifecycle AI + IMAP/Playwright fallback | 49 | ~12-16 weeks | 5-10 beta customers |
| **Phase 3** | SaaS Launch — Multi-tenant + billing + onboarding | 21 | ~12-16 weeks | 100+ properties |
| **Phase 4** | Scale — Direct APIs + PMS + platform | 12 | Ongoing | 500+ properties |
| **Total** | | **275** | | |

---

## Critical Path (Phase 1)

```
Sprint 0 (Scaffold) -> Sprint 1 (Schema+Auth) -> Sprint 2 (APIs) -> Sprint 3 (Beds24)
    -> Sprint 5 (UI+Outbound) -> Sprint 7 (AI) -> Sprint 9 (Deploy)

Parallel opportunities:
- Sprint 3 (Beds24) || Sprint 4 (WebSocket) — both depend on Sprint 2 only
- Sprint 5 (UI) || Sprint 6 (WhatsApp) — both depend on Sprint 3+4
- Sprint 7 (AI backend) || Sprint 8 (Templates) — both after Sprint 5
```

**With 2 engineers: ~16-18 weeks (vs 22 weeks sequential)**

---

## Infrastructure Cost Comparison

| | Old Architecture | New Architecture (Beds24) |
|---|---|---|
| **Phase 1** | 2 VPS ($300-600/mo) | 1 VPS ($60-120/mo) |
| Inbound | IMAP IDLE per OTA | Beds24 webhooks + polling |
| Outbound | Playwright browser pool + SMTP | Beds24 `send_message()` HTTP POST |
| Complexity | High (parsers, sessions, 2FA, anti-detection) | Low (REST API client) |

---

## Key Documentation Reference

| Document | Purpose |
|----------|---------|
| `docs/product-outline.md` | Product vision, target personas, principles |
| `docs/features.md` | Detailed feature specs (F1-F8) |
| `docs/architecture.md` | Tech stack, data model, ChannelAdapter/Registry, LLMProvider, JobQueue, MessagePipeline |
| `docs/architecture-review.md` | P0/P1/P2 fixes (deterministic AI, delivery guarantee, concurrency) |
| `docs/channel-integrations.md` | Beds24 API details, WhatsApp, channel adapter inventory |
| `docs/ai-agent.md` | LLMProvider interface, IntentKBRegistry, KB validation, prompts |
| `docs/phase1-ai-intent-taxonomy.md` | 17+12+4 intents, INTENT_TO_KB_MAP, Haiku/Sonnet prompts |
| `docs/phase1-state-machines.md` | 5 state machines (delivery, conversation, lock, channel, AI eval) |
| `docs/phase1-api-specifications.md` | REST API specs, error format, endpoint definitions |
| `docs/plug-and-play-review.md` | Abstraction fixes (channel registry, LLM provider, queue, notifications) |
| `docs/roadmap.md` | Phase definitions, exit criteria, pricing tiers, infra costs |
| `docs/risks-and-competition.md` | Risk mitigations, competitive analysis, GTM |

## Shared Types (Already Written)

| File | Contents |
|------|----------|
| `packages/shared/src/types/database.ts` | All table interfaces + enums (ChannelType, DeliveryStatus, AIRoutingDecision, etc.) |
| `packages/shared/src/types/api.ts` | API contracts, request/response types, RFC 7807 error format |
| `packages/shared/src/types/events.ts` | Internal EventMap, WebSocket events, BullMQ job types |
| `packages/shared/src/types/index.ts` | Barrel export for `@tarksh/shared` |
