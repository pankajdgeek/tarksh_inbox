# Tarksh Inbox - Architecture Mind Map

```
                                                    ┌─────────────┐
                                                    │  Airbnb     │
                                              ┌────▶│  Dashboard  │
                                              │     │ (Playwright)│
                                              │     └─────────────┘
                                              │     ┌─────────────┐
                            ┌──────────────┐  │     │ Booking.com │
                            │   Scraper    │──┼────▶│  Extranet   │
                            │   Workers    │  │     │ (Playwright)│
                            │              │  │     └─────────────┘
                            │  - Polling   │  │     ┌─────────────┐
                            │  - Sessions  │  ├────▶│  Goibibo    │
                            │  - Anti-det. │  │     │  Partner    │
                            └──────┬───────┘  │     └─────────────┘
                                   │          │     ┌─────────────┐
                                   │          ├────▶│  Agoda YCS  │
                                   │          │     └─────────────┘
                                   │          │     ┌─────────────┐
                                   │          └────▶│  Expedia    │
                                   │                │  Partner    │
                                   │                └─────────────┘
                                   │
                                   │          ┌─────────────────┐
                            ┌──────▼───────┐  │  WhatsApp Web   │
                            │  WhatsApp    │──▶  (Baileys /     │
                            │  Connector   │  │  whatsapp-web.js│
                            │              │  └─────────────────┘
                            └──────┬───────┘
                                   │
                                   │          ┌─────────────────┐
                            ┌──────▼───────┐  │  IMAP / SMTP    │
                            │  Email       │──▶  Webhooks       │
                            │  Parser      │  │  (SendGrid etc.)│
                            │  (Fallback)  │  └─────────────────┘
                            └──────┬───────┘
                                   │
                                   │
                                   │     NORMALIZED MESSAGE
                                   │     {channel, guest, content,
                                   │      timestamp, booking_ref}
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                        TARKSH INBOX CORE                                     │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         BACKEND API                                     │ │
│  │                    Node.js + Fastify + TypeScript                       │ │
│  │                                                                         │ │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐            │ │
│  │   │   Auth   │  │ Message  │  │ Property │  │  Channel  │            │ │
│  │   │  Module  │  │ Service  │  │ Service  │  │  Manager  │            │ │
│  │   │          │  │          │  │          │  │           │            │ │
│  │   │ - JWT    │  │ - CRUD   │  │ - Props  │  │ - Connect │            │ │
│  │   │ - Roles  │  │ - Thread │  │ - KB     │  │ - Health  │            │ │
│  │   │ - Sessions│ │ - Search │  │ - Config │  │ - Reconn. │            │ │
│  │   └──────────┘  └──────────┘  └──────────┘  └───────────┘            │ │
│  │                                                                         │ │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐                           │ │
│  │   │ Template │  │ Notif.   │  │  User    │                           │ │
│  │   │ Service  │  │ Service  │  │ Service  │                           │ │
│  │   │          │  │          │  │          │                           │ │
│  │   │ - CRUD   │  │ - Push   │  │ - Invite │                           │ │
│  │   │ - Vars   │  │ - Sound  │  │ - Roles  │                           │ │
│  │   │ - Render │  │ - Email  │  │ - Assign │                           │ │
│  │   └──────────┘  └──────────┘  └──────────┘                           │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌────────────────────┐  │
│  │     PostgreSQL       │  │       Redis          │  │    BullMQ Queues   │  │
│  │                      │  │                      │  │                    │  │
│  │  - Organizations     │  │  - Session cache     │  │  - Scraper jobs    │  │
│  │  - Users             │  │  - API cache         │  │  - AI evaluation   │  │
│  │  - Properties        │  │  - Pub/Sub events    │  │  - Outbound msgs   │  │
│  │  - Guests            │  │  - Rate limit        │  │  - Notifications   │  │
│  │  - Conversations     │  │    counters          │  │  - Email parsing   │  │
│  │  - Messages          │  │  - Socket.io         │  │  - Scheduled       │  │
│  │  - Bookings          │  │    adapter           │  │    triggers        │  │
│  │  - Channel Conns     │  │                      │  │                    │  │
│  │  - Knowledge Bases   │  │                      │  │                    │  │
│  │  - Templates         │  │                      │  │                    │  │
│  │                      │  │                      │  │                    │  │
│  │  Full-text search    │  │                      │  │  Retry + backoff   │  │
│  │  Row-level security  │  │                      │  │  Rate limiting     │  │
│  └─────────────────────┘  └─────────────────────┘  └────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
          │                        │                         │
          │                        │                         │
          ▼                        ▼                         ▼
┌──────────────────┐   ┌───────────────────┐   ┌──────────────────────────┐
│   AI SERVICE     │   │   REAL-TIME       │   │     FRONTEND             │
│                  │   │                   │   │                          │
│  Claude API      │   │  Socket.io        │   │  Next.js + React + TS   │
│  (Anthropic)     │   │  Server           │   │                          │
│                  │   │                   │   │  ┌────────┐ ┌────────┐  │
│  ┌────────────┐  │   │  - Org rooms      │   │  │ Inbox  │ │ Conv   │  │
│  │ Knowledge  │  │   │  - Event push     │   │  │ View   │ │ Detail │  │
│  │ Base       │  │   │  - New messages   │   │  └────────┘ └────────┘  │
│  │ Injection  │  │   │  - Status updates │   │  ┌────────┐ ┌────────┐  │
│  └────────────┘  │   │  - Typing         │   │  │Settings│ │Dash    │  │
│  ┌────────────┐  │   │    indicators     │   │  │ Pages  │ │board   │  │
│  │ Lifecycle  │  │   │                   │   │  └────────┘ └────────┘  │
│  │ Stage      │  │   │  Redis Pub/Sub    │   │                          │
│  │ Detection  │  │   │  ───────▶         │   │  Tailwind + shadcn/ui   │
│  └────────────┘  │   │  Backend publishes │   │  TanStack Query         │
│  ┌────────────┐  │   │  Socket.io pushes │   │  Zustand state          │
│  │ Confidence │  │   │                   │   │  Socket.io client       │
│  │ Scoring    │  │   └───────────────────┘   │                          │
│  └────────────┘  │                           └──────────────────────────┘
│  ┌────────────┐  │                                       │
│  │ Response   │  │                                       │
│  │ Routing    │  │                                       │
│  │            │  │                                       │
│  │  >90%:send │  │                           ┌───────────▼───────────┐
│  │ 70-89:draft│  │                           │    USER INTERFACE     │
│  │  <70:human │  │                           │                       │
│  └────────────┘  │                           │  - Message feed       │
│  ┌────────────┐  │                           │  - Reply composer     │
│  │ Auto       │  │                           │  - Template picker    │
│  │ Triggers   │  │                           │  - Booking sidebar    │
│  │            │  │                           │  - Channel filters    │
│  │ - Welcome  │  │                           │  - AI draft review    │
│  │ - Pre-arr. │  │                           │  - Search             │
│  │ - Mid-stay │  │                           │  - Notifications      │
│  │ - Checkout │  │                           │  - KB editor          │
│  │ - Review   │  │                           │  - Channel health     │
│  └────────────┘  │                           └───────────────────────┘
│                  │
└──────────────────┘


═══════════════════════════════════════════════════════════════════════════════


                         DATA FLOW MIND MAP


                        ┌─────────────────┐
                        │   GUEST sends   │
                        │   a message     │
                        └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
              ┌─────▼────┐ ┌────▼─────┐ ┌────▼──────┐
              │  Airbnb  │ │ WhatsApp │ │  Other    │
              │  Inbox   │ │  Chat    │ │  OTA      │
              └─────┬────┘ └────┬─────┘ └────┬──────┘
                    │           │            │
              ┌─────▼────┐ ┌────▼─────┐ ┌────▼──────┐
              │ Scraper  │ │ WA       │ │ Scraper / │
              │ (Playwr.)│ │ Listener │ │ Email     │
              └─────┬────┘ └────┬─────┘ └────┬──────┘
                    │           │            │
                    └───────────┼────────────┘
                                │
                     ┌──────────▼──────────┐
                     │  Message Normalizer │
                     │  + Deduplication    │
                     └──────────┬──────────┘
                                │
                     ┌──────────▼──────────┐
                     │  Save to Database   │
                     │  (PostgreSQL)       │
                     └──────────┬──────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
     ┌────────▼────────┐ ┌─────▼──────┐ ┌────────▼────────┐
     │  WebSocket Push │ │ AI Queue   │ │  Notification   │
     │  to Frontend    │ │ (BullMQ)   │ │  Service        │
     └─────────────────┘ └─────┬──────┘ └─────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  AI Agent Service   │
                    │  (Claude API)       │
                    │                     │
                    │  Injects:           │
                    │  - Property KB      │
                    │  - Guest lifecycle  │
                    │  - Conv. history    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Confidence Score   │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
       ┌──────▼──────┐ ┌──────▼──────┐ ┌───────▼─────┐
       │   > 90%     │ │  70 - 89%   │ │   < 70%     │
       │  AUTO-SEND  │ │  DRAFT      │ │  HUMAN      │
       └──────┬──────┘ └──────┬──────┘ └───────┬─────┘
              │               │                │
              ▼               ▼                ▼
       ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
       │ Outbound    │ │ Show draft  │ │ Highlight   │
       │ Queue       │ │ in composer │ │ for agent   │
       │   │         │ │ for review  │ │ attention   │
       │   ▼         │ └──────┬──────┘ └─────────────┘
       │ Send via    │        │
       │ OTA/WhatsApp│        ▼
       └─────────────┘ ┌─────────────┐
                       │ Agent edits │
                       │ & sends     │
                       └──────┬──────┘
                              │
                              ▼
                       ┌─────────────┐
                       │ Outbound    │
                       │ Queue       │
                       │   │         │
                       │   ▼         │
                       │ Send via    │
                       │ OTA/WhatsApp│
                       └─────────────┘


═══════════════════════════════════════════════════════════════════════════════


                     DEPLOYMENT MIND MAP


                    ┌────────────────────────┐
                    │      VPS Server        │
                    │  (Hetzner/DigitalOcean) │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │     Docker Compose     │
                    └───────────┬────────────┘
                                │
          ┌─────────┬───────────┼───────────┬──────────┐
          │         │           │           │          │
    ┌─────▼────┐ ┌──▼──────┐ ┌─▼────────┐ ┌▼────────┐│┌──────────┐
    │  Nginx   │ │ App     │ │PostgreSQL│ │ Redis   │││ Channel  │
    │          │ │ Server  │ │          │ │         │││ Workers  │
    │ - SSL    │ │         │ │ - Data   │ │ - Cache │││          │
    │ - Proxy  │ │ - Next  │ │ - Search │ │ - Queue │││-Playwright│
    │ - Route  │ │ - API   │ │ - RLS    │ │ - PubSub│││-WhatsApp │
    │          │ │ - WS    │ │          │ │         │││-Email    │
    └──────────┘ └─────────┘ └──────────┘ └─────────┘│└──────────┘
                                                      │
                                          ┌───────────▼──────┐
                                          │  External APIs   │
                                          │                  │
                                          │  - Claude API    │
                                          │  - OTA dashboards│
                                          │  - WhatsApp Web  │
                                          │  - Email (IMAP)  │
                                          │  - GitHub Actions│
                                          └──────────────────┘


═══════════════════════════════════════════════════════════════════════════════


                     DATA MODEL MIND MAP


                         ┌──────────────┐
                         │ Organization │
                         │              │
                         │ name, plan,  │
                         │ slug         │
                         └──────┬───────┘
                                │
                  ┌─────────────┼─────────────┐
                  │             │             │
           ┌──────▼──────┐ ┌───▼────┐ ┌──────▼──────┐
           │   Users     │ │Property│ │   Guests    │
           │             │ │        │ │             │
           │ name, email │ │ name,  │ │ name, email │
           │ role        │ │ addr,  │ │ phone       │
           │ (admin/     │ │ tz     │ │ identifiers │
           │  agent)     │ │        │ │ {airbnb:x,  │
           └─────────────┘ └───┬────┘ │  wa:y}      │
                               │      └──────┬──────┘
                 ┌─────────────┼──────┐      │
                 │             │      │      │
          ┌──────▼─────┐ ┌────▼───┐ ┌▼──────▼──────┐
          │  Channel   │ │Knowl.  │ │ Conversation  │
          │  Connection│ │ Base   │ │               │
          │            │ │        │ │ guest +       │
          │ type,      │ │ JSONB: │ │ property +    │
          │ creds(enc),│ │ checkin│ │ booking       │
          │ status,    │ │ wifi   │ │ status,       │
          │ last_sync  │ │ rules  │ │ assigned_to   │
          └────────────┘ │ faqs   │ └───────┬───────┘
                         │ nearby │         │
                         └────────┘   ┌─────▼──────┐
                                      │  Messages  │
          ┌──────────┐                │            │
          │ Template │                │ content    │
          │          │                │ sender_type│
          │ name,    │                │ channel    │
          │ category,│                │ confidence │
          │ body,    │                │ external_id│
          │ vars     │                └────────────┘
          └──────────┘
                              ┌──────────┐
                              │ Booking  │
                              │          │
                              │ dates    │
                              │ amount   │
                              │ status   │
                              │ ext_id   │
                              └──────────┘
```
