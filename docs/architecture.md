# Tarksh Inbox - System Architecture

## Overview

Tarksh Inbox is a real-time messaging platform that aggregates guest communications from multiple channels (OTAs + WhatsApp), provides a unified inbox UI, and powers AI-assisted responses. The architecture must support:

- Real-time message delivery (< 30 second latency via Beds24 webhooks, < 60 second via polling fallback)
- Beds24 API as the primary channel provider for all OTA messaging (Phase 1)
- IMAP IDLE + on-demand scraping as fallback tiers for OTAs not connected via Beds24 (Phase 2+)
- WhatsApp via Baileys (channel-native, independent of Beds24)
- Deterministic AI routing with intent classification + knowledge base matching
- Outbound delivery guarantees with message state machine
- Multi-tenant SaaS (Phase 3, but designed for from day 1)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND                                    │
│                                                                      │
│  Next.js App (React + TypeScript) — SSR + Static                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │  Inbox   │ │ Conv     │ │ Settings │ │ Dashboard│              │
│  │  View    │ │ Detail   │ │  Pages   │ │  / Stats │              │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │
│                        │                                             │
│              WebSocket + REST API                                    │
└───────────────────────┬─────────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────────┐
│                    BACKEND API SERVER                                 │
│                                                                      │
│  Node.js + TypeScript + Fastify (dedicated API server)              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │  Auth    │ │ Message  │ │ Property │ │ AI Agent │              │
│  │  Module  │ │ Service  │ │ Service  │ │ Service  │              │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │ Channel  │ │ Template │ │ Notif.   │ │ Beds24   │              │
│  │ Manager  │ │ Service  │ │ Service  │ │ Service  │              │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │
│                        │                                             │
│              Database + Cache + Queue                                │
└───────────┬────────────┬──────────┬──────────────────────────────────┘
            │            │          │
   ┌────────▼───┐ ┌──────▼────┐ ┌──▼──────────────────────────────┐
   │ PostgreSQL │ │   Redis   │ │  Channel Ingestion               │
   │            │ │           │ │                                   │
   │ - Users    │ │ - Cache   │ │  PRIMARY: Beds24 API (Phase 1)  │
   │ - Orgs     │ │ - Sessions│ │  ┌────────────────────────────┐ │
   │ - Props    │ │ - Pub/Sub │ │  │ Beds24 REST API Client     │ │
   │ - Convos   │ │ - Queues  │ │  │ - Webhook listener (push)  │ │
   │ - Messages │ │ - Locks   │ │  │ - Polling fallback (60s)   │ │
   │ - Bookings │ │ (BullMQ)  │ │  │ - get/send messages        │ │
   │ - Templates│ │           │ │  │ - get bookings/properties  │ │
   │ - AI Evals │ │           │ │  └────────────────────────────┘ │
   │            │ │           │ │                                  │
   │            │ │           │ │  CHANNEL-NATIVE: WhatsApp       │
   │            │ │           │ │  ┌────────────────────────────┐ │
   │            │ │           │ │  │ WhatsApp (Baileys)         │ │
   │            │ │           │ │  │ - Event-driven WebSocket   │ │
   │            │ │           │ │  │ - Real-time inbound        │ │
   │            │ │           │ │  └────────────────────────────┘ │
   │            │ │           │ │                                  │
   │            │ │           │ │  FALLBACK (Phase 2+)            │
   │            │ │           │ │  ┌────────────────────────────┐ │
   │            │ │           │ │  │ IMAP IDLE (email parsing)  │ │
   │            │ │           │ │  │ Playwright (on-demand)     │ │
   │            │ │           │ │  │ For OTAs not on Beds24     │ │
   │            │ │           │ │  └────────────────────────────┘ │
   └────────────┘ └───────────┘ └──────────────────────────────────┘
                                         │
                                ┌────────▼────────┐
                                │  AI Service     │
                                │  Claude API +   │
                                │  Intent Classif.│
                                │  + Knowledge DB │
                                └─────────────────┘
```

---

## Tech Stack

### Frontend

| Technology | Purpose |
|-----------|---------|
| **Next.js 14+** | React framework with App Router, SSR (frontend only — no API routes) |
| **TypeScript** | Type safety across frontend and shared types with backend |
| **Tailwind CSS** | Utility-first styling |
| **shadcn/ui** | Pre-built accessible UI components |
| **Socket.io Client** | Real-time message updates |
| **Zustand** | Lightweight state management |
| **TanStack Query** | Server state management, caching, optimistic updates |

### Backend

| Technology | Purpose |
|-----------|---------|
| **Node.js + TypeScript** | API server, shared types with frontend |
| **Fastify** | HTTP framework (dedicated API server, separate from Next.js) |
| **Socket.io** | WebSocket server for real-time push (runs on Fastify) |
| **BullMQ** | Job queue for AI evaluation, outbound sends, scheduled triggers |
| **Beds24 API client** | HTTP REST client for all OTA messaging, bookings, properties (Phase 1 primary) |
| **Baileys** | WhatsApp Web automation |
| **Zod** | Runtime validation for API inputs and parsed data |
| **pino** | Structured JSON logging |
| **ImapFlow** | IMAP IDLE connections for email ingestion (Phase 2+ fallback for non-Beds24 OTAs) |
| **mailparser** | Email parsing and content extraction (Phase 2+ fallback) |
| **Playwright** | On-demand headless browser for outbound sends (Phase 2+ fallback for non-Beds24 OTAs) |

### Data

| Technology | Purpose |
|-----------|---------|
| **PostgreSQL** | Primary database — relational data, full-text search, multi-tenant |
| **Drizzle ORM** | Type-safe database queries (SQL-close, lightweight, supports GIN/RLS) |
| **Redis** | Caching, session storage, BullMQ backend, Pub/Sub, conversation locks |

### AI

| Technology | Purpose |
|-----------|---------|
| **Claude Haiku** | Fast intent classification (cheap, low-latency) |
| **Claude Sonnet** | Response generation (only when intent is matched) |
| **Structured output / tool use** | Deterministic intent + KB field extraction |

### Observability

| Technology | Purpose |
|-----------|---------|
| **pino** | Structured JSON logging (pairs with Fastify) |
| **Sentry** | Error tracking and alerting |
| **Bull Board** | BullMQ dashboard for queue monitoring |
| **UptimeRobot** | Uptime monitoring + `/health` endpoint |

### Infrastructure

| Technology | Purpose |
|-----------|---------|
| **Docker** | Containerization for all services |
| **Docker Compose** | Local development + deployment orchestration |
| **Single VPS** (Hetzner/DO, 4GB) | App server: Nginx + Next.js + Fastify API + PostgreSQL + Redis + WhatsApp + BullMQ workers. No separate workers VPS needed — Beds24 API eliminates IMAP listeners and browser pool for Phase 1. |
| **Nginx** | Reverse proxy, SSL termination |
| **GitHub Actions** | CI/CD pipeline |

---

## Channel Ingestion Architecture

### Phase 1: Beds24 API (Primary for All OTAs)

Phase 1 uses **Beds24 API** as the single integration point for all OTA channels. Beds24 is already connected as the channel manager to Airbnb, Booking.com, Goibibo, and handles message send/receive via its REST API. This eliminates IMAP IDLE, Playwright, email parsers, session management, and 2FA handling entirely for Phase 1.

| Method | Role | Latency | Resource Usage |
|--------|------|---------|----------------|
| **Beds24 Webhooks** | Primary inbound push | < 30 sec | HTTP endpoint |
| **Beds24 Polling** | Fallback inbound (if webhooks not configured) | 60 sec | HTTP request every 60s per property |
| **Beds24 API** | Outbound sends + booking data | On trigger | HTTP request |
| **WhatsApp (Baileys)** | Channel-native | Real-time | WebSocket connection |

**What Beds24 API provides**:
- `get_messages(bookId)` — read all messages for a booking (inbound)
- `send_message(bookId, message)` — send a reply to a guest (outbound)
- `get_booking(bookId)` — booking details (guest name, dates, amount, status)
- `get_property(query)` — property metadata
- Webhook support for real-time notification of new messages/bookings

**What Beds24 eliminates (vs scraping/IMAP)**:
- No IMAP IDLE connections to manage
- No Playwright browser pool
- No OTA email parsers to maintain
- No session/cookie management per OTA
- No 2FA handling
- No anti-detection measures
- No second VPS for workers

```
                    INBOUND (Guest → Tarksh) — Phase 1
                    ═══════════════════════════════════

Guest messages on Airbnb / Booking.com / Goibibo
        │
        ▼
Beds24 receives message via channel manager connection
        │
        ├──────── Webhook push (if configured)
        │              │
        │              ▼
        │         Tarksh webhook endpoint
        │         POST /api/webhooks/beds24
        │
        └──────── Polling fallback (every 60s)
                       │
                       ▼
                  Tarksh polls Beds24 API
                  GET get_messages(bookId)
                       │
                       ▼
              ┌────────────────────────────┐
              │  Beds24 Message Normalizer │
              │  - Map to NormalizedMessage│
              │  - Resolve guest identity  │
              │  - Link to booking         │
              │  - Dedup via external_id   │
              └────────────┬───────────────┘
                           │
                           ▼
              Save → WebSocket Push → AI Queue


                    OUTBOUND (Tarksh → Guest) — Phase 1
                    ════════════════════════════════════

Agent sends reply in Tarksh Inbox
        │
        ▼
Save to DB (delivery_status: queued)
        │
        ▼
Channel Outbound Queue (BullMQ)
        │
        ▼
┌───────────────────────────────────┐
│  Beds24 API Sender               │
│  send_message(bookId, message)   │
│                                  │
│  - No browser needed             │
│  - No session management         │
│  - Simple HTTP POST              │
│                                  │
│  Returns: success / error        │
│  Update DB (confirmed / failed)  │
└───────────────────────────────────┘
```

**Beds24 API rate limits**: ~120 requests/minute. Webhooks preferred for inbound to stay within limits; polling only as fallback for properties without webhooks configured.

### Phase 2+: Three-Tier Fallback (For Non-Beds24 OTAs)

For OTA channels NOT connected through Beds24 (e.g., a property that uses a different channel manager), Phase 2 introduces the three-tier fallback architecture:

| Tier | Role | Latency | Resource Usage |
|------|------|---------|----------------|
| **IMAP IDLE** | Inbound email ingestion | 2-10 sec | ~5KB per connection |
| **On-Demand Scraping** | Outbound sending + enrichment | On trigger | Pooled browsers |
| **Channel-Native** | WhatsApp, email relay, APIs | Real-time | Per-channel |

This fallback only activates for properties where the OTA channel is not available via Beds24. The adapter pattern (see Plug-and-Play Architecture below) makes it transparent — the inbox doesn't care whether a message came from Beds24 API or IMAP IDLE.

### WhatsApp: Channel-Native (Independent of Beds24)

WhatsApp is not routed through Beds24. It uses Baileys (Phase 1) / WhatsApp Business API (Phase 2) directly:

| Phase | Method | Details |
|-------|--------|---------|
| **Phase 1** | Baileys library | Event-driven WebSocket, real-time, no polling |
| **Phase 2** | WhatsApp Business API | Official Meta Cloud API, eliminates ban risk |

---

## Data Model

### Entity Relationship Diagram

```
┌──────────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Organization    │──┐  │    User      │     │    Property      │
│──────────────────│  │  │──────────────│     │──────────────────│
│ id (PK)          │  ├──│ id (PK)      │  ┌──│ id (PK)          │
│ name             │  │  │ name         │  │  │ name             │
│ slug             │  │  │ email        │  │  │ address          │
│ plan             │  │  │ password_hash│  │  │ description      │
│ settings (JSONB) │  │  │ role         │  │  │ timezone         │
│ created_at       │  │  │ org_id (FK)  │  │  │ org_id (FK)      │
│ updated_at       │  │  │ created_at   │  │  │ created_at       │
└──────────────────┘  │  └──────────────┘  │  └──────────────────┘
                      │                    │           │
                      └────────────────────┘           │
                                                       │
                      ┌────────────────────────────────┤
                      │                    │            │
    ┌─────────────────▼──┐  ┌──────────────▼──┐  ┌─────▼────────────┐
    │ ChannelConnection  │  │ KnowledgeBase   │  │    Template      │
    │────────────────────│  │─────────────────│  │──────────────────│
    │ id (PK)            │  │ id (PK)         │  │ id (PK)          │
    │ channel_type       │  │ property_id(FK) │  │ property_id (FK) │
    │ credentials (enc.) │  │ data (JSONB)    │  │ name             │
    │ status             │  │ updated_at      │  │ category         │
    │ connection_method  │  └─────────────────┘  │ body             │
    │ property_id (FK)   │                       │ variables (JSON) │
    │ last_sync_at       │  ┌─────────────────┐  │ created_at       │
    │ error_message      │  │ EmailConnection │  └──────────────────┘
    │ created_at         │  │─────────────────│
    └────────────────────┘  │ id (PK)         │
                            │ property_id(FK) │
                            │ email_address   │
                            │ imap_host       │
                            │ imap_port       │
                            │ credentials(enc)│
                            │ status          │
                            │ last_connected  │
                            │ created_at      │
                            └─────────────────┘

    ┌──────────────┐     ┌──────────────────────┐
    │    Guest     │     │  Conversation        │
    │──────────────│     │──────────────────────│
    │ id (PK)      │──┐  │ id (PK)              │
    │ name         │  ├──│ guest_id (FK)        │
    │ email        │  │  │ property_id (FK)     │
    │ phone        │  │  │ booking_id (FK)      │
    │ language     │  │  │ status               │
    │ identifiers  │  │  │ assigned_to (FK)     │
    │  (JSONB)     │  │  │ ai_enabled           │
    │ merged_into  │  │  │ locked_by (FK)       │
    │  _id (FK)    │  │  │ locked_at            │
    │ org_id (FK)  │  │  │ last_message_at      │
    │ last_active  │  │  │ last_message_preview │
    │  _at         │  │  │ unread_count         │
    │ created_at   │  │  │ primary_channel      │
    └──────────────┘  │  │ created_at           │
                      │  │ updated_at           │
                      │  └──────────────────────┘
                      │           │
                      │  ┌────────▼──────────────┐
                      │  │    Message            │
                      │  │──────────────────────│
                      │  │ id (PK)               │
                      │  │ conversation_id (FK)  │
                      │  │ content               │
                      │  │ sender_type           │
                      │  │  (guest/agent/ai/     │
                      │  │   system/internal)    │
                      │  │ sender_id             │
                      │  │ channel               │
                      │  │ external_id           │
                      │  │ delivery_status       │
                      │  │  (queued/sending/     │
                      │  │   sent/confirmed/     │
                      │  │   failed)             │
                      │  │ is_internal_note      │
                      │  │ attachments (JSONB)   │
                      │  │ sent_at               │
                      │  │ delivered_at          │
                      │  │ read_at               │
                      │  │ created_at            │
                      │  └──────────────────────┘
                      │
    ┌─────────────────▼──┐     ┌────────────────────────┐
    │     Booking        │     │    AIEvaluation        │
    │────────────────────│     │────────────────────────│
    │ id (PK)            │     │ id (PK)                │
    │ guest_id (FK)      │     │ message_id (FK)        │
    │ property_id (FK)   │     │ conversation_id (FK)   │
    │ channel            │     │ property_id (FK)       │
    │ external_booking_id│     │ detected_intent        │
    │ check_in           │     │ detected_stage         │
    │ check_out          │     │ kb_fields_used (TEXT[])│
    │ num_guests         │     │ generated_response     │
    │ amount             │     │ routing_decision       │
    │ currency           │     │  (auto_send/draft/     │
    │ status             │     │   route_to_human)      │
    │ special_requests   │     │ was_edited             │
    │ created_at         │     │ edited_response        │
    │                    │     │ token_usage (JSONB)    │
    └────────────────────┘     │ latency_ms             │
                               │ created_at             │
                               └────────────────────────┘
```

### Key Schema Details

**Organization**
- Top-level tenant entity
- `plan`: free / starter / pro / enterprise (for SaaS billing later)
- `slug`: URL-friendly identifier
- `settings`: JSONB for org-level preferences (timezone, business hours, notification prefs)

**User**
- `role`: admin / agent (MVP); expand to owner / manager / agent / viewer in Phase 3
- `org_id`: belongs to one organization
- Password hashed with argon2

**Property**
- Belongs to an organization
- Has its own channel connections, email connection, knowledge base, and templates
- `timezone`: for displaying times correctly and AI operating hours

**ChannelConnection**
- `channel_type`: enum — airbnb / booking_com / whatsapp / goibibo / agoda / expedia
- `connection_method`: enum — beds24_api / imap_idle / scraping / email_relay / websocket / api
- `beds24_property_id`: Beds24 property ID (when connection_method = beds24_api)
- `credentials`: AES-256-GCM encrypted JSON blob (session tokens, cookies, etc.) — null for Beds24-connected channels (Beds24 API key is org-level, not per-channel)
- `status`: connected / disconnected / error / reconnecting
- `last_sync_at`: timestamp of last successful message sync
- `error_message`: last error for debugging

**EmailConnection**
- Separate table for IMAP IDLE connections (one per property)
- `imap_host` / `imap_port`: email server details (e.g., imap.gmail.com:993)
- `credentials`: AES-256-GCM encrypted (email password or OAuth tokens)
- `status`: connected / disconnected / error
- `last_connected`: timestamp of last successful IMAP connection

**KnowledgeBase**
- `data`: JSONB field containing structured property knowledge
  ```json
  {
    "check_in_time": "14:00",
    "check_out_time": "11:00",
    "check_in_instructions": "...",
    "wifi_name": "...",
    "wifi_password": "...",
    "address": "...",
    "directions": { "from_airport": "...", "from_station": "..." },
    "amenities": ["..."],
    "house_rules": ["..."],
    "parking": "...",
    "nearby": ["..."],
    "emergency_contact": "...",
    "faqs": [{ "question": "...", "answer": "..." }]
  }
  ```

**Guest**
- `identifiers`: JSONB mapping channel identifiers
  ```json
  {
    "airbnb": "airbnb_user_123",
    "whatsapp": "+919876543210",
    "booking_com": "booking_guest_456"
  }
  ```
- `merged_into_id`: nullable FK to another Guest (for manual guest linking)
- `language`: detected or configured guest language
- `last_active_at`: last message timestamp from this guest
- For MVP: no auto-merging. Manual "link guest" action only.

**Conversation**
- Links a guest to a property
- `status`: unread / pending / replied / resolved / starred
- `assigned_to`: user_id of the assigned agent (nullable)
- `ai_enabled`: whether AI auto-response is active for this conversation
- `locked_by` / `locked_at`: concurrency control — which agent is currently composing a reply (2-min TTL via Redis)
- `last_message_at`: denormalized for sort performance (updated on every new message)
- `last_message_preview`: truncated last message text for inbox list view
- `unread_count`: denormalized unread badge count
- `primary_channel`: which channel the conversation is primarily on

**Message**
- `sender_type`: guest / agent / ai / system / internal
  - `system`: automated lifecycle messages (welcome, pre-arrival, etc.)
  - `internal`: team-only internal notes (not sent to guest)
- `sender_id`: user_id for agents, null for guests, 'ai' for AI, null for system
- `channel`: which channel this specific message was sent/received on
- `external_id`: message ID in the source system (for deduplication)
- `delivery_status`: queued / sending / sent / confirmed / failed (see Message State Machine)
- `is_internal_note`: boolean, true for team-only notes
- `attachments`: JSONB array for future media support

**Booking**
- `external_booking_id`: booking ID in the OTA system
- `status`: confirmed / cancelled / checked_in / checked_out / no_show

**AIEvaluation**
- Separate audit table for every AI interaction (not overloading Message)
- `detected_intent`: classified intent (e.g., wifi_query, check_in_info, complaint)
- `detected_stage`: lifecycle stage (pre_booking, post_booking, pre_arrival, during_stay, post_checkout)
- `kb_fields_used`: which knowledge base fields informed the response
- `routing_decision`: auto_send / draft / route_to_human
- `was_edited`: did a human edit the AI draft before sending?
- `edited_response`: the human-edited version (for learning)
- `token_usage`: JSONB with input_tokens, output_tokens, model, estimated_cost
- `latency_ms`: time to generate response

### Indexes

```sql
-- Performance-critical indexes
CREATE INDEX idx_conversations_org_status ON conversations(org_id, status);
CREATE INDEX idx_conversations_property ON conversations(property_id);
CREATE INDEX idx_conversations_guest ON conversations(guest_id);
CREATE INDEX idx_conversations_assigned ON conversations(assigned_to);
CREATE INDEX idx_conversations_last_msg ON conversations(org_id, last_message_at DESC);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, sent_at);
CREATE INDEX idx_messages_external ON messages(external_id);  -- dedup
CREATE INDEX idx_messages_delivery ON messages(delivery_status) WHERE delivery_status IN ('queued', 'sending', 'failed');
CREATE INDEX idx_guests_identifiers ON guests USING GIN(identifiers);  -- JSONB search
CREATE INDEX idx_bookings_guest ON bookings(guest_id);
CREATE INDEX idx_bookings_property_dates ON bookings(property_id, check_in, check_out);
CREATE INDEX idx_channel_connections_property ON channel_connections(property_id);
CREATE INDEX idx_email_connections_property ON email_connections(property_id);
CREATE INDEX idx_ai_evaluations_message ON ai_evaluations(message_id);
CREATE INDEX idx_ai_evaluations_property ON ai_evaluations(property_id, created_at DESC);

-- Full-text search on messages
CREATE INDEX idx_messages_content_search ON messages USING GIN(to_tsvector('english', content));
```

---

## Key Architectural Patterns

### 1. Message Flow (Inbound) — Phase 1

```
                   ┌─────────────────────────────┐
                   │     GUEST SENDS MESSAGE      │
                   └──────────────┬──────────────┘
                                  │
              ┌───────────────────┼───────────────┐
              │                   │               │
    ┌─────────▼────────┐ ┌───────▼──────┐        │
    │  OTA (Airbnb,    │ │  WhatsApp    │        │
    │  Booking.com,    │ │  (Baileys)   │        │
    │  Goibibo)        │ │  Real-time   │        │
    └─────────┬────────┘ └───────┬──────┘        │
              │                   │               │
    ┌─────────▼────────┐         │               │
    │  Beds24 receives │         │               │
    │  via channel mgr │         │               │
    └─────────┬────────┘         │               │
              │                   │               │
      ┌───────┴───────┐         │               │
      │               │         │               │
  ┌───▼────┐    ┌─────▼──┐     │     ┌─────────▼────────┐
  │Webhook │    │Polling │     │     │  IMAP IDLE       │
  │ push   │    │(60s)   │     │     │  (Phase 2+       │
  │(< 30s) │    │fallback│     │     │   fallback)      │
  └───┬────┘    └────┬───┘     │     └─────────┬────────┘
      │              │         │               │
      └──────┬───────┘         │               │
             │                 │               │
             └─────────────────┼───────────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Message Normalizer  │
                    │ + Deduplication     │
                    │ (check external_id) │
                    └──────────┬──────────┘
                               │
               ┌───────────────┼─────────────────┐
               │               │                 │
               ▼               ▼                 ▼
      ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
      │ Save to DB   │ │ WebSocket    │ │ AI Eval      │
      │ (PostgreSQL) │ │ Push to      │ │ Queue        │
      │              │ │ Frontend     │ │ (BullMQ)     │
      └──────────────┘ └──────────────┘ └──────────────┘
```

**Steps (Phase 1 — Beds24)**:
1. Guest sends message on OTA (Airbnb, Booking.com, Goibibo)
2. **Beds24** receives the message via its channel manager connection
3. **Beds24 webhook** pushes notification to Tarksh (< 30 sec latency), OR **polling** fetches new messages every 60 seconds as fallback
4. **Beds24 Message Normalizer** converts to common `NormalizedMessage` schema, deduplicates via `external_id`
5. Message saved to **PostgreSQL**
6. **WebSocket event** pushed to connected frontend clients
7. Message placed on **AI Evaluation Queue** (BullMQ)
8. **Notification Service** triggers browser push / sound
9. **Booking context** fetched from Beds24 API (`get_booking(bookId)`) and linked to conversation

### 2. Message Flow (Outbound) — With Delivery Guarantee

```
Frontend ──► API ──► Database (status: queued)
                         │
                         ├──► WebSocket Push ("sending...")
                         │
                         ▼
                  Channel Outbound Queue (BullMQ)
                         │
              ┌──────────┼──────────┐
              │          │          │
    ┌─────────▼───┐ ┌────▼──────┐  │
    │ OTA via     │ │ WhatsApp  │  │
    │ Beds24 API  │ │ (Baileys) │  │
    │             │ │           │  │
    │ send_message│ │ Send via  │  │
    │ (bookId,    │ │ WA API    │  │
    │  message)   │ └────┬──────┘  │
    │             │      │         │
    │ Simple HTTP │      │    ┌────▼──────────┐
    │ POST — no   │      │    │ IMAP/Playwright│
    │ browser     │      │    │ (Phase 2+     │
    │ needed      │      │    │  fallback)    │
    └──────┬──────┘      │    └────┬──────────┘
           │             │         │
           └─────────────┼─────────┘
                         │
              ┌──────────▼──────────┐
              │ Update DB status    │
              │ (sent / confirmed   │
              │  / failed)          │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │ WebSocket Push      │
              │ delivery status     │
              │ to frontend         │
              └─────────────────────┘
```

#### Message State Machine

Every outbound message follows this state machine:

```
              ┌────────┐
              │ queued │ ← message saved to DB, added to outbound queue
              └───┬────┘
                  │
              ┌───▼────┐
              │sending │ ← worker picked up the job, browser/API executing
              └───┬────┘
                  │
          ┌───────┴───────┐
          │               │
     ┌────▼───┐     ┌─────▼────┐
     │  sent  │     │  failed  │ ← browser crashed, session expired, OTA error
     └────┬───┘     └─────┬────┘
          │               │
     ┌────▼──────┐   ┌────▼──────────┐
     │ confirmed │   │ retry (3x)    │
     │ (verified │   │ then alert    │
     │  on OTA)  │   │ agent in UI   │
     └───────────┘   └───────────────┘
```

**On failure**: After 3 retries with exponential backoff, message is marked `failed` and the agent sees a **red warning banner** in the conversation. Never silently fail.

### 3. AI Response Flow — Deterministic Routing

```
New Message ──► AI Queue ──► Intent Classifier (Haiku, fast + cheap)
                                       │
                                       ▼
                              ┌────────────────┐
                              │ Classified     │
                              │ Intent:        │
                              │ wifi_query,    │
                              │ checkin_info,  │
                              │ complaint,     │
                              │ cancellation,  │
                              │ unknown, ...   │
                              └───────┬────────┘
                                      │
                         ┌────────────┼────────────┐
                         │            │            │
                    NEVER-AUTO    KB-MATCHED    NO KB MATCH
                    (complaint,   (wifi, addr,  (unknown,
                     cancel,      checkin,      vague)
                     refund,      amenities,
                     emergency)   directions)
                         │            │            │
                    ┌────▼────┐  ┌────▼────┐  ┌───▼─────┐
                    │ ROUTE   │  │GENERATE │  │ ROUTE   │
                    │ TO      │  │RESPONSE │  │ TO      │
                    │ HUMAN   │  │(Sonnet) │  │ HUMAN   │
                    └─────────┘  └────┬────┘  └─────────┘
                                      │
                              ┌───────▼───────┐
                              │ Property      │
                              │ AI Settings   │
                              └───────┬───────┘
                                      │
                              ┌───────┼──────────┐
                              │       │          │
                        auto_send  draft_only  outside_hours
                              │       │          │
                        ┌─────▼──┐ ┌──▼─────┐ ┌──▼──────┐
                        │Outbound│ │Show in │ │Queue for│
                        │Queue   │ │composer│ │next     │
                        │        │ │for     │ │business │
                        └────────┘ │review  │ │hours    │
                                   └────────┘ └─────────┘
```

**Key difference from previous design**: Confidence is no longer an LLM self-assessment. Instead:
1. **Haiku classifies intent** (fast, cheap, deterministic via structured output)
2. **Intent maps to KB fields** — if the KB has data for that intent, it's answerable
3. **Never-auto list is hard-coded** — complaints, cancellations, refunds always go to human
4. **Sonnet generates response** only when the intent is matched and KB has data

### 4. Concurrency Control

```
Agent opens conversation
        │
        ▼
Set Redis lock: conv:{id}:lock = {user_id, timestamp}
(TTL: 2 minutes, refresh on typing)
        │
        ▼
WebSocket broadcast to org room:
"Agent X is replying to conversation Y"
        │
        ▼
Other agents see: "🔒 Agent X is replying..."
        │
        ▼
Cancel any pending AI evaluation for this conversation
(human takes priority over AI)
```

**Rules**:
- When an agent opens a conversation and starts typing, lock it via Redis (2-min TTL)
- Show "Agent X is replying..." to other agents viewing the same conversation
- When a human agent opens a conversation, cancel any pending AI evaluation for it
- Lock is released on send, navigate away, or TTL expiry

### 5. Multi-Tenant Data Isolation

- **Row-level security**: Every table has `org_id` column
- All queries scoped by `org_id` from the authenticated user's session
- API middleware automatically injects `org_id` filter
- Prepared for PostgreSQL Row-Level Security policies (Phase 3)

### 6. Real-Time Architecture

```
Backend ──► Redis Pub/Sub ──► Socket.io Server ──► Connected Clients
```

- When a message is created/updated, backend publishes event to Redis
- Socket.io server subscribes to relevant channels
- Events pushed to clients in the same organization
- Room-based: each org has a Socket.io room, only members receive events
- **WebSocket auth**: JWT validated on Socket.io handshake, room membership verified against org_id
- **Token refresh**: Long-lived connections refresh JWT via Socket.io middleware

---

## Service Boundaries

For Phase 1, the system runs as a **single deployable unit** on one VPS with logical module separation:

```
/src
  /modules
    /auth             - Authentication, session management, JWT
    /inbox            - Conversation and message CRUD, locking
    /channels         - Channel registry, adapter interfaces, connection management
      /adapters
        /beds24       - Beds24 API: unified adapter for all OTA channels (Airbnb, Booking.com, Goibibo)
        /whatsapp     - WhatsApp: Baileys connector (inbound + outbound)
    /beds24           - Beds24 API client, webhook handler, polling service
    /ai               - LLM provider abstraction, intent classification, response generation
    /properties       - Property and knowledge base management
    /templates        - Response template management
    /notifications    - Notification provider registry (push, email, webhook)
    /users            - User management
    /pipeline         - Message processing pipeline (middleware hooks)
  /shared
    /db               - Drizzle client, migrations, schema
    /queue            - Queue abstraction (BullMQ implementation)
    /websocket        - Socket.io setup, auth middleware
    /events           - Internal event emitter (decouples modules)
    /health           - Health check registry (providers register their own checks)
    /utils            - Shared utilities
    /types            - Shared TypeScript types

  # Phase 2+ additions (when needed for non-Beds24 OTAs):
  # /modules
  #   /channels/adapters
  #     /airbnb       - Airbnb: email parser + Playwright sender + 2FA (fallback)
  #     /booking-com  - Booking.com: email parser + email relay sender (fallback)
  #     /goibibo      - Goibibo: email parser + Playwright sender (fallback)
  #     /agoda        - Agoda: email parser + Playwright sender
  #     /expedia      - Expedia: email parser + Playwright sender
  #   /email-ingest   - IMAP IDLE connections, channel detection, parser dispatch
  #   /browser-pool   - On-demand Playwright browser pool management
```

**Internal event-driven communication**: Modules communicate via an in-process EventEmitter, not direct imports. This keeps boundaries clean and enables future service extraction.

```typescript
// Example: email-ingest module emits event, pipeline processes it
eventBus.emit('message:received', normalizedMessage);

// pipeline module orchestrates the processing chain
eventBus.on('message:received', async (msg) => {
  const processed = await messagePipeline.run(msg); // runs all registered middleware
  await saveMessage(processed);
  await pushWebSocket(processed);
  await queueAIEvaluation(processed);
});
```

---

## Plug-and-Play Architecture

The system is designed around interfaces and registries so that new channels, AI providers, notification methods, and processing steps can be added without modifying core code.

### Channel Registry & Adapter Pattern

Every channel is a self-contained adapter that implements a common interface. Adding a new channel = create a folder under `/channels/adapters/`, implement the interface, register it.

```typescript
// --- Core interfaces (in /channels/interfaces.ts) ---

interface ChannelAdapter {
  /** Unique channel identifier */
  readonly id: string;
  /** Human-readable channel name */
  readonly name: string;
  /** Which ingestion tiers this channel uses */
  readonly tiers: {
    inbound: 'imap' | 'native' | 'api';
    outbound: 'playwright' | 'email_relay' | 'native' | 'api';
  };
  /** What this channel supports */
  readonly capabilities: ChannelCapabilities;
  /** Rate limits for outbound sends */
  readonly rateLimits: OutboundRateLimits;

  /** Email parser (required if inbound tier is 'imap') */
  emailParser?: OTAEmailParser;
  /** Outbound sender */
  outboundSender: ChannelOutboundSender;
  /** 2FA handling config (null if channel doesn't need login) */
  tfaConfig?: TFAConfig;
  /** Health check provider */
  healthCheck: ChannelHealthCheck;
}

interface ChannelCapabilities {
  readReceipts: boolean;
  typingIndicator: boolean;
  mediaMessages: boolean;
  deliveryConfirmation: 'native' | 'scrape_verify' | 'email_bounce' | 'none';
  maxMessageLength: number | null;     // null = unlimited
  supportsThreading: boolean;
  supportsRichText: boolean;
}

interface OTAEmailParser {
  /** Email sender patterns that identify this channel */
  readonly senderPatterns: RegExp[];
  /** Can this parser handle this email? */
  canParse(email: ParsedEmail): boolean;
  /** Extract normalized message from the email */
  parse(email: ParsedEmail): NormalizedMessage;
  /** Was the message content truncated in the email? */
  isContentTruncated(email: ParsedEmail): boolean;
}

interface ChannelOutboundSender {
  /** Send a message to the guest */
  send(message: OutboundMessage, session: ChannelSession): Promise<DeliveryResult>;
  /** Verify a previously sent message was delivered */
  verifyDelivery?(message: OutboundMessage, session: ChannelSession): Promise<boolean>;
  /** Check if the current session is still valid */
  getSessionStatus(session: ChannelSession): Promise<'valid' | 'expiring' | 'expired' | 'error'>;
  /** Refresh an expiring session */
  refreshSession?(session: ChannelSession): Promise<ChannelSession>;
}

interface DeliveryResult {
  success: boolean;
  externalMessageId?: string;
  error?: string;
  retryable: boolean;
  updatedSession?: ChannelSession;  // if session was refreshed during send
}

interface ChannelHealthCheck {
  /** Returns health status for this channel adapter */
  check(): Promise<HealthCheckResult>;
}

interface OutboundRateLimits {
  maxPerSecond: number;
  burstSize: number;                   // max concurrent sends
  jitterMs: [number, number];          // [min, max] random delay range
}
```

```typescript
// --- Channel registry (in /channels/registry.ts) ---

class ChannelRegistry {
  private adapters = new Map<string, ChannelAdapter>();

  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.id, adapter);
    healthRegistry.register(`channel:${adapter.id}`, adapter.healthCheck);
  }

  get(channelId: string): ChannelAdapter | undefined {
    return this.adapters.get(channelId);
  }

  getAll(): ChannelAdapter[] {
    return Array.from(this.adapters.values());
  }

  /** Find which channel adapter can parse this email */
  findParserForEmail(email: ParsedEmail): OTAEmailParser | undefined {
    for (const adapter of this.adapters.values()) {
      if (adapter.emailParser?.canParse(email)) {
        return adapter.emailParser;
      }
    }
    return undefined;
  }

  /** Get all channels that use IMAP for inbound */
  getImapChannels(): ChannelAdapter[] {
    return this.getAll().filter(a => a.tiers.inbound === 'imap');
  }

  /** Get all channels that use Playwright for outbound */
  getPlaywrightChannels(): ChannelAdapter[] {
    return this.getAll().filter(a => a.tiers.outbound === 'playwright');
  }
}

export const channelRegistry = new ChannelRegistry();
```

```typescript
// --- Example: Beds24 adapter (Phase 1 — covers Airbnb, Booking.com, Goibibo) ---
// In /channels/adapters/beds24/index.ts

import { channelRegistry } from '../../registry';

const beds24Adapter: ChannelAdapter = {
  id: 'beds24',
  name: 'Beds24 (All OTAs)',
  tiers: { inbound: 'api', outbound: 'api' },
  capabilities: {
    readReceipts: false,
    typingIndicator: false,
    mediaMessages: false,
    deliveryConfirmation: 'native',   // Beds24 API confirms delivery
    maxMessageLength: null,
    supportsThreading: false,
    supportsRichText: false,
  },
  rateLimits: { maxPerSecond: 2, burstSize: 5, jitterMs: [0, 0] },  // ~120 req/min limit
  emailParser: undefined,             // no email parsing needed — API-based
  outboundSender: new Beds24APISender(),
  tfaConfig: undefined,               // no login needed — API key auth
  healthCheck: new Beds24HealthCheck(),
};

channelRegistry.register(beds24Adapter);
```

```typescript
// --- Beds24 API Sender (in /channels/adapters/beds24/outbound-sender.ts) ---

class Beds24APISender implements ChannelOutboundSender {
  async send(message: OutboundMessage): Promise<DeliveryResult> {
    const result = await beds24Client.sendMessage(message.bookingRef, message.content);
    return {
      success: result.ok,
      externalMessageId: result.messageId,
      error: result.error,
      retryable: result.error ? true : false,
    };
  }

  async getSessionStatus(): Promise<'valid' | 'expiring' | 'expired' | 'error'> {
    // Beds24 uses API key auth — always valid if key is configured
    const health = await beds24Client.checkHealth();
    return health.ok ? 'valid' : 'error';
  }
}
```

```typescript
// --- Phase 2+ fallback example: Airbnb direct adapter (IMAP + Playwright) ---
// Only used when property's Airbnb is NOT connected via Beds24

const airbnbDirectAdapter: ChannelAdapter = {
  id: 'airbnb_direct',
  name: 'Airbnb (Direct)',
  tiers: { inbound: 'imap', outbound: 'playwright' },
  capabilities: {
    readReceipts: false,
    typingIndicator: false,
    mediaMessages: false,
    deliveryConfirmation: 'scrape_verify',
    maxMessageLength: 2000,
    supportsThreading: true,
    supportsRichText: false,
  },
  rateLimits: { maxPerSecond: 1 / 30, burstSize: 1, jitterMs: [2000, 5000] },
  emailParser: new AirbnbEmailParser(),
  outboundSender: new AirbnbPlaywrightSender(),
  tfaConfig: {
    selectors: { detect: '...', input: '...', submit: '...' },
    supportedMethods: ['sms', 'email', 'totp'],
  },
  healthCheck: new AirbnbHealthCheck(),
};

// Only register if needed (Phase 2+ fallback):
// channelRegistry.register(airbnbDirectAdapter);
```

**Adding a new channel** (e.g., HostelWorld):
1. Create `/channels/adapters/hostelworld/`
2. Implement `ChannelAdapter` interface
3. Call `channelRegistry.register(hostelWorldAdapter)` in the adapter's index file
4. Done. No other files need to change.

### Message Processing Pipeline

Instead of a fixed process chain, the message pipeline uses middleware hooks. New processing steps (translate, spam filter, PII redaction) can be added without modifying core code.

```typescript
// --- Pipeline interfaces (in /pipeline/interfaces.ts) ---

type PipelineStage = 'pre-save' | 'post-save' | 'pre-ai' | 'post-ai' | 'pre-send' | 'post-send';

interface MessageMiddleware {
  readonly name: string;
  readonly stage: PipelineStage;
  readonly priority: number;          // lower = runs first (0-100)
  process(message: PipelineMessage, context: PipelineContext): Promise<PipelineMessage>;
}

interface PipelineContext {
  conversation: Conversation;
  property: Property;
  channel: ChannelAdapter;
  metadata: Record<string, unknown>;  // middleware can attach data for later stages
}

class MessagePipeline {
  private middleware: MessageMiddleware[] = [];

  use(mw: MessageMiddleware): void {
    this.middleware.push(mw);
    this.middleware.sort((a, b) => a.priority - b.priority);
  }

  async run(stage: PipelineStage, message: PipelineMessage, context: PipelineContext): Promise<PipelineMessage> {
    let result = message;
    for (const mw of this.middleware.filter(m => m.stage === stage)) {
      result = await mw.process(result, context);
    }
    return result;
  }
}
```

```typescript
// --- Example middleware: auto-translate ---
const autoTranslateMiddleware: MessageMiddleware = {
  name: 'auto-translate',
  stage: 'pre-ai',
  priority: 10,
  async process(message, context) {
    if (message.detectedLanguage !== context.property.defaultLanguage) {
      message.translatedContent = await translateService.translate(
        message.content, context.property.defaultLanguage
      );
    }
    return message;
  },
};

// --- Example middleware: spam detection ---
const spamDetectionMiddleware: MessageMiddleware = {
  name: 'spam-detection',
  stage: 'pre-save',
  priority: 5,
  async process(message, context) {
    const spamScore = await spamDetector.check(message.content);
    if (spamScore > 0.9) {
      message.metadata.spam = true;
      message.metadata.skipAI = true;
    }
    return message;
  },
};

messagePipeline.use(autoTranslateMiddleware);
messagePipeline.use(spamDetectionMiddleware);
```

### Queue Abstraction

BullMQ is the implementation, but modules depend on the `JobQueue` interface — not BullMQ directly. This enables swapping to SQS, Cloud Tasks, or an in-memory queue for tests.

```typescript
// --- Queue interface (in /shared/queue/interfaces.ts) ---

interface JobQueue {
  add<T>(name: string, data: T, opts?: JobOptions): Promise<JobHandle>;
  process<T>(name: string, handler: (job: Job<T>) => Promise<void>, opts?: ProcessOptions): void;
  schedule<T>(name: string, cron: string, data: T, handler: (job: Job<T>) => Promise<void>): void;
  getStatus(name: string): Promise<QueueStatus>;
}

interface JobOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: { type: 'exponential' | 'fixed'; delay: number };
  removeOnComplete?: boolean;
}

interface QueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

// --- BullMQ implementation (in /shared/queue/bullmq.ts) ---
class BullMQJobQueue implements JobQueue { /* ... */ }

// --- In-memory implementation for tests (in /shared/queue/memory.ts) ---
class InMemoryJobQueue implements JobQueue { /* ... */ }
```

### Notification Provider Registry

Notifications are delivered through pluggable providers. New notification channels (Slack, SMS, webhook) can be added without modifying core code.

```typescript
// --- Notification interfaces (in /notifications/interfaces.ts) ---

interface NotificationProvider {
  readonly id: string;
  readonly name: string;
  send(notification: Notification, recipient: NotificationRecipient): Promise<void>;
  isAvailable(): Promise<boolean>;
}

interface Notification {
  title: string;
  body: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  category: 'message' | 'tfa' | 'channel_health' | 'ai_alert' | 'system';
  data?: Record<string, unknown>;
}

class NotificationRegistry {
  private providers: NotificationProvider[] = [];

  register(provider: NotificationProvider): void {
    this.providers.push(provider);
  }

  async sendAll(notification: Notification, recipient: NotificationRecipient): Promise<void> {
    const available = await Promise.all(
      this.providers.map(async p => ({ provider: p, ok: await p.isAvailable() }))
    );
    await Promise.allSettled(
      available.filter(a => a.ok).map(a => a.provider.send(notification, recipient))
    );
  }
}

// Built-in providers:
// - WebPushNotificationProvider (browser push)
// - EmailNotificationProvider (email alerts)
// - WebSocketNotificationProvider (in-app real-time)
// Phase 2+:
// - SlackNotificationProvider
// - WebhookNotificationProvider
// - SMSNotificationProvider
```

### Health Check Registry

Channel adapters and services auto-register their health checks. The `/health` endpoint aggregates results dynamically.

```typescript
// --- Health registry (in /shared/health/registry.ts) ---

interface HealthCheckProvider {
  check(): Promise<HealthCheckResult>;
}

interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'error';
  details?: Record<string, unknown>;
}

class HealthRegistry {
  private checks = new Map<string, HealthCheckProvider>();

  register(name: string, provider: HealthCheckProvider): void {
    this.checks.set(name, provider);
  }

  async checkAll(): Promise<Record<string, HealthCheckResult>> {
    const results: Record<string, HealthCheckResult> = {};
    await Promise.allSettled(
      Array.from(this.checks.entries()).map(async ([name, provider]) => {
        try {
          results[name] = await provider.check();
        } catch (err) {
          results[name] = { status: 'error', details: { error: String(err) } };
        }
      })
    );
    return results;
  }
}

export const healthRegistry = new HealthRegistry();

// Core services register on startup:
healthRegistry.register('database', new PostgresHealthCheck());
healthRegistry.register('redis', new RedisHealthCheck());
healthRegistry.register('queue', new QueueHealthCheck());
// Channel adapters auto-register via channelRegistry.register()
```

---

## Security Considerations

| Concern | Approach |
|---------|----------|
| **OTA credentials** | AES-256-GCM encryption at rest, decrypted only in worker memory |
| **Email credentials** | AES-256-GCM encrypted, or OAuth tokens (Gmail/Outlook) |
| **Authentication** | JWT tokens with refresh rotation, httpOnly cookies |
| **WebSocket auth** | JWT validated on Socket.io handshake, room membership verified |
| **API security** | Rate limiting, input validation (Zod), CORS, helmet headers |
| **Data isolation** | org_id scoping on all queries, middleware enforcement |
| **Conversation locks** | Redis-based with TTL, prevents race conditions |
| **Secrets management** | Environment variables, never committed to repo |
| **HTTPS** | Enforced via Nginx + Let's Encrypt |
| **Error tracking** | Sentry (scrubbed of PII before sending) |

---

## Deployment Architecture (MVP)

```
┌──────────────────────────────────────────────┐
│        Single VPS: All-in-One (4GB)          │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │           Docker Compose               │  │
│  │                                        │  │
│  │  ┌──────────┐ ┌────────────┐           │  │
│  │  │  Nginx   │ │ Next.js    │           │  │
│  │  │  (proxy) │ │ (frontend) │           │  │
│  │  └──────────┘ └────────────┘           │  │
│  │  ┌────────────────────────────────┐    │  │
│  │  │ Fastify API Server             │    │  │
│  │  │ + Socket.io                    │    │  │
│  │  │ + Beds24 webhook endpoint      │    │  │
│  │  └────────────────────────────────┘    │  │
│  │  ┌──────────┐ ┌────────────┐           │  │
│  │  │PostgreSQL│ │   Redis    │           │  │
│  │  └──────────┘ └────────────┘           │  │
│  │  ┌────────────────────────────────┐    │  │
│  │  │ BullMQ Workers                 │    │  │
│  │  │ - AI evaluation                │    │  │
│  │  │ - Beds24 outbound sends        │    │  │
│  │  │ - Beds24 polling service       │    │  │
│  │  │ - WhatsApp (Baileys)           │    │  │
│  │  │ - Notifications                │    │  │
│  │  └────────────────────────────────┘    │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

**Single VPS (Phase 1)**: Beds24 API eliminates the need for Playwright browsers and IMAP listeners, so everything fits on one 4GB VPS. No separate workers VPS needed.

**Why single VPS works**: Beds24 API calls are lightweight HTTP requests (no memory-hungry browsers). WhatsApp (Baileys) uses a single WebSocket connection. BullMQ workers process AI evaluations and outbound sends as simple HTTP calls to Beds24/Claude APIs.

**Scaling path (Phase 2+)**: If direct OTA adapters (Playwright) are added, split into two VPS (app + workers). If traffic grows further, move to managed services (RDS, ElastiCache) or container orchestration.

---

## Health Check & Monitoring

### `/health` Endpoint

```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "beds24_api": { "status": "ok", "response_time_ms": 120, "last_poll": "2024-01-15T10:30:00Z" },
    "beds24_webhooks": { "status": "active", "last_received": "2024-01-15T10:29:45Z" },
    "whatsapp": { "connected": 1, "disconnected": 0 },
    "queues": {
      "ai_evaluation": { "waiting": 3, "active": 2 },
      "outbound": { "waiting": 1, "active": 1, "failed": 0 }
    }
  },
  "uptime_seconds": 86400
}
```

### Alerting Rules

| Alert | Trigger | Action |
|-------|---------|--------|
| Beds24 API unreachable | 3 consecutive failed API calls | Red alert + email to admin |
| Beds24 webhook silent | No webhook for 1 hour | Switch to polling + warning |
| Beds24 rate limited | 429 response | Back off + queue sends |
| Outbound failed | Message failed after 3 retries | Alert agent in UI (red banner) |
| WhatsApp disconnected | Session lost | Prompt re-scan QR in dashboard |
| AI queue backed up | > 50 pending evaluations | Increase concurrency |
