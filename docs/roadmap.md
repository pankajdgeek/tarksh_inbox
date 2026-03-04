# Tarksh Inbox - Product Roadmap

## Phased Delivery Plan

The product is delivered in 4 phases, progressing from internal tool to scalable SaaS.

---

## Phase 1: Foundation (MVP)

**Goal**: Working unified inbox with all OTA channels (via Beds24 API) + WhatsApp, basic AI, internal use.
**Users**: Tarksh team only (dogfooding)

### Key Decision: Beds24 API Integration

Instead of building IMAP IDLE email parsers + Playwright scrapers per OTA, Phase 1 uses **Beds24 API** as the primary channel provider for all OTA messaging. Beds24 is already connected to Airbnb, Booking.com, Goibibo, and handles message send/receive via its API. This eliminates:
- IMAP IDLE setup for OTAs
- Playwright browser pool for outbound sends
- Session management, cookie caching, 2FA handling
- Per-OTA email parsers

**What Beds24 API provides**:
- `get_messages(bookId)` — read all messages for a booking (inbound)
- `send_message(bookId, message)` — send a reply to a guest (outbound)
- `get_booking(bookId)` — booking details (guest name, dates, amount, status)
- `get_property(query)` — property metadata
- Webhook support for real-time notification of new messages/bookings

### Deliverables

| Feature | Description | Priority |
|---------|-------------|----------|
| **Beds24 API adapter** | Channel adapter wrapping Beds24 messaging API for all OTAs (Airbnb, Booking.com, Goibibo) | P0 |
| **Beds24 webhook listener** | Real-time inbound message notifications via Beds24 webhooks | P0 |
| **Beds24 message polling** | Fallback polling (every 60s) for properties without webhooks configured | P0 |
| **WhatsApp connector** | WhatsApp Web automation via Baileys for message send/receive | P0 |
| **Unified inbox UI** | Conversation list, message thread view, reply composer | P0 |
| **Conversation threading** | Group messages by guest across channels | P0 |
| **Real-time updates** | WebSocket push for new messages (Socket.io) | P0 |
| **Booking context** | Display booking details alongside conversations (via Beds24 API) | P1 |
| **Response templates** | Pre-built templates with variable substitution | P1 |
| **Basic AI responses** | Intent classification (Haiku) + KB-grounded response generation (Sonnet) | P1 |
| **Property knowledge base** | Configurable property info for AI grounding | P1 |
| **Channel health monitoring** | Beds24 API health, webhook status, WhatsApp connection status | P1 |
| **User auth** | Login, basic admin/agent roles, JWT with refresh rotation | P1 |
| **Outbound delivery guarantee** | Message state machine (queued → confirmed / failed) with UI alerts | P1 |
| **Conversation locking** | Redis-based concurrency control, "Agent X is replying..." | P2 |

### Technical Foundation

- Next.js (frontend SSR only) + Fastify (dedicated API server) + TypeScript
- PostgreSQL database schema + Drizzle ORM migrations
- Redis setup for queues, caching, conversation locks
- Beds24 API client (HTTP REST) for OTA messaging + bookings
- Beds24 webhook handler for real-time inbound
- Docker Compose for local development
- Single VPS deployment (no browser pool needed — much simpler)
- Basic CI/CD pipeline (GitHub Actions)
- Structured logging (pino) + error tracking (Sentry)
- Health check endpoint (`/health`)

### Exit Criteria

- Can receive OTA messages in real-time via Beds24 webhooks (< 30 sec latency)
- Can send replies to Airbnb/Booking.com/Goibibo guests via Beds24 API
- Can receive and reply to WhatsApp messages via Baileys
- Conversations are threaded by guest across channels
- Booking details displayed alongside conversations (from Beds24 API)
- AI auto-responds to basic guest queries with property-specific info
- Failed outbound messages show red alert in UI (never silent failure)
- Team can use it daily for Tarksh/Zest Living properties

---

## Phase 2: AI & Channels

**Goal**: Full AI agent with lifecycle awareness, expand Beds24-supported channels, WhatsApp Business API.
**Users**: Tarksh team + 5-10 beta customers

### Deliverables

| Feature | Description | Priority |
|---------|-------------|----------|
| **Agoda via Beds24** | Enable Agoda messaging through Beds24 API (if connected) | P1 |
| **Expedia via Beds24** | Enable Expedia messaging through Beds24 API (if connected) | P1 |
| **IMAP IDLE fallback** | Email-based ingestion for OTAs not connected via Beds24 | P1 |
| **WhatsApp Business API** | Migrate from Baileys to official Meta Cloud API | P0 |
| **Full lifecycle AI** | Stage-aware responses (pre-booking to post-checkout) | P0 |
| **Deterministic AI routing** | Intent classification → KB matching → auto-send / draft / human | P0 |
| **Automated triggers** | Proactive messages at lifecycle milestones (welcome, pre-arrival, etc.) | P1 |
| **AI controls** | Per-property AI mode, excluded topics, operating hours | P1 |
| **AI cost tracking** | Token usage per property, cost caps, usage dashboard | P1 |
| **Multi-language AI** | AI responds in guest's language | P2 |
| **Internal notes** | Team-only notes on conversations (not sent to guest) | P1 |
| **Conversation assignment** | Assign conversations to specific agents | P1 |
| **Beds24 analytics integration** | Pull revenue, occupancy, booking analytics from Beds24 | P2 |
| **Email notifications** | Notify team via email for important messages | P2 |

### Exit Criteria

- All Beds24-connected OTA channels integrated
- WhatsApp running on official Business API (no ban risk)
- AI handles full guest lifecycle with deterministic routing
- Automated messages sent at key lifecycle moments
- Beta customers actively using the product
- AI auto-resolution rate > 40%

---

## Phase 3: SaaS Launch

**Goal**: Multi-tenant SaaS product ready for public launch.
**Users**: Public launch targeting 100+ properties

### Deliverables

| Feature | Description | Priority |
|---------|-------------|----------|
| **Multi-tenancy** | Organization isolation, PostgreSQL Row-Level Security | P0 |
| **Onboarding flow** | Self-serve account creation, email connection wizard, channel setup | P0 |
| **Billing & subscriptions** | Plan tiers, payment processing (Stripe/Razorpay) | P0 |
| **User roles & permissions** | Owner, manager, agent, viewer roles | P0 |
| **Analytics dashboard** | Response times, AI resolution rate, channel performance | P1 |
| **Team management** | Invite users, assign to properties, activity logs | P1 |
| **Mobile app / PWA** | Responsive mobile experience for on-the-go management | P1 |
| **Guest profiles** | Unified guest view across channels, manual guest linking | P1 |
| **Canned responses library** | Shared template library across organization | P2 |
| **Webhook API** | Allow external systems to receive message events | P2 |
| **Audit logs** | Track all user and AI actions for compliance | P2 |
| **GDPR compliance** | Data export, deletion, consent management | P1 |

### Pricing Tiers (Draft)

| Plan | Properties | Channels | AI Messages/mo | Price |
|------|-----------|----------|----------------|-------|
| **Starter** | Up to 3 | 2 channels | 500 | Free / Low |
| **Pro** | Up to 15 | All channels | 5,000 | Mid |
| **Business** | Up to 50 | All channels | 20,000 | High |
| **Enterprise** | Unlimited | All + custom | Unlimited | Custom |

### Exit Criteria

- Self-serve signup and onboarding working
- Billing processing payments
- 100+ properties onboarded
- Stable multi-tenant architecture
- Mobile-friendly experience

---

## Phase 4: Scale & Differentiate

**Goal**: Replace scraping with official APIs where possible, advanced features, market leadership.
**Users**: 500+ properties, expanding market segments

### Deliverables

| Feature | Description | Priority |
|---------|-------------|----------|
| **Official OTA APIs** | Replace on-demand scraping with Airbnb, Expedia partner APIs | P0 |
| **Booking.com API** | Upgrade from email relay to Connectivity Partner API | P1 |
| **Review management** | Monitor and respond to reviews on Google, TripAdvisor, OTAs | P1 |
| **Sentiment analysis** | Detect guest satisfaction/frustration in messages | P1 |
| **Revenue attribution** | Track how fast responses impact booking conversion | P2 |
| **Staff task management** | Convert guest requests into staff tasks (housekeeping, maintenance) | P1 |
| **PMS integrations** | Connect with Cloudbeds, Opera, etc. for booking sync | P1 |
| **Public API** | REST API for third-party integrations | P2 |
| **White-labeling** | Allow large customers to brand the inbox as their own | P2 |
| **AI fine-tuning** | Property-specific AI improvements based on correction history | P2 |
| **Voice/call integration** | Handle phone calls through the inbox | P2 |

### Exit Criteria

- 90%+ of channels using official APIs or stable email relay
- Advanced analytics driving demonstrable ROI for customers
- Platform API enabling third-party integrations
- Market leadership in Indian hospitality messaging

---

## Timeline Visualization

```
Phase 1 (MVP)                 Phase 2 (AI+Channels)        Phase 3 (SaaS)              Phase 4 (Scale)
───────────────────────────── ──────────────────────────── ─────────────────────────── ───────────────►

Beds24 API adapter ████████   Agoda/Expedia (Beds24) ████  Multi-tenant ████████░      Direct OTA APIs █████
Beds24 webhooks ██████████   WA Business API ████████░    Billing ████████░           Review mgmt ████
WhatsApp (Baileys) ████████   Full AI Lifecycle ████████   User Roles ████████░        Sentiment AI ████
Inbox UI ████████████░         Deterministic Routing ████   Analytics ████████░         Staff Tasks ████
Booking Context ████████░     Auto Triggers ████░          Mobile ████░                PMS Integration █
Basic AI ████████░             Multi-language ████░         Onboarding ████████░        Public API ████
Templates ████░                AI Cost Tracking ████░       Guest Profiles ████░
Auth + Delivery ████░          IMAP Fallback ████░

Internal Use Only              Beta Customers (5-10)        Public Launch (100+ props)  Scale (500+)
```

---

## Key Dependencies & Risks Per Phase

### Phase 1
- **Dependency**: Beds24 API must support messaging for connected OTA channels
- **Risk**: Beds24 API rate limits (~120 req/min) may limit polling frequency
- **Mitigation**: Use Beds24 webhooks for real-time push; polling only as fallback
- **Dependency**: Beds24 webhook support must be configured per property
- **Risk**: Webhook setup may require manual Beds24 dashboard configuration
- **Mitigation**: Document setup steps; polling fallback ensures messages are never missed

### Phase 2
- **Dependency**: WhatsApp Business API approval from Meta
- **Risk**: Approval timeline (can take 2-4 weeks)
- **Mitigation**: Continue Baileys until API approved; apply early
- **Dependency**: Beds24 channel connections for Agoda/Expedia
- **Risk**: Property may not have these channels connected in Beds24
- **Mitigation**: IMAP IDLE fallback for OTAs not connected via Beds24

### Phase 3
- **Dependency**: Payment processing setup (India + international)
- **Risk**: Beds24 API scaling for 100+ properties (rate limits)
- **Mitigation**: Per-property API key isolation; request rate limit increase from Beds24
- **Risk**: Beds24 dependency — single point of failure for all OTA channels
- **Mitigation**: IMAP IDLE fallback ready; Beds24 has 99.9% uptime SLA

### Phase 4
- **Dependency**: Direct OTA API partner agreements
- **Risk**: Long approval timelines for partner APIs
- **Mitigation**: Beds24 continues working reliably; direct APIs are an upgrade, not a necessity

---

## Infrastructure Cost Projections

| Phase | Properties | VPS (Single) | Workers VPS | AI Costs | Beds24 | Total/mo |
|-------|-----------|-------------|-------------|----------|--------|----------|
| Phase 1 | 5-10 | $10-20 (4GB) | Not needed | $50-100 | $0 (existing) | ~$60-120 |
| Phase 2 | 20-50 | $20-40 (8GB) | $10-20 (4GB) | $200-500 | $0-50 | ~$250-600 |
| Phase 3 | 100+ | $40-80 (16GB) | $20-40 (8GB) | $500-1500 | $50-100 | ~$650-1700 |
| Phase 4 | 500+ | Managed services | Auto-scaling | $2000+ | Varies | Custom |

**Phase 1 is dramatically cheaper** — no Playwright browsers, no IMAP listeners, no separate workers VPS needed. Beds24 API is already paid for as part of the channel manager subscription. The entire MVP can run on a single $10-20/mo VPS.
