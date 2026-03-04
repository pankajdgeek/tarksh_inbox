# Tarksh Inbox - Channel Integration Strategy

## Overview

Tarksh Inbox uses **Beds24 API** as the primary channel provider for all OTA messaging in Phase 1. Beds24 is the existing channel manager already connected to Airbnb, Booking.com, and Goibibo. Its REST API handles message send/receive, booking data, and property metadata — eliminating the need for IMAP IDLE, Playwright scrapers, email parsers, session management, and 2FA handling.

| Method | Role | Used For | Phase |
|--------|------|----------|-------|
| **Beds24 API** | Primary OTA integration | All OTA messaging (Airbnb, Booking.com, Goibibo) via REST API | Phase 1 |
| **Beds24 Webhooks** | Real-time inbound push | Instant notification of new messages/bookings | Phase 1 |
| **Beds24 Polling** | Fallback inbound | Properties without webhooks configured (every 60s) | Phase 1 |
| **WhatsApp (Baileys)** | Channel-native | WhatsApp messaging (independent of Beds24) | Phase 1 |
| **IMAP IDLE** | Fallback inbound | OTAs not connected via Beds24 (email parsing) | Phase 2+ |
| **On-Demand Scraping** | Fallback outbound | OTA outbound for non-Beds24 channels (Playwright) | Phase 2+ |

**Phase 1 channels**: All OTAs via Beds24 (Airbnb, Booking.com, Goibibo) + WhatsApp
**Phase 2 channels**: Agoda, Expedia (via Beds24 if connected), IMAP fallback for others

### Plug-and-Play Channel Architecture

All channels are self-contained adapters implementing the `ChannelAdapter` interface (defined in `architecture.md`). Each adapter lives in `/src/modules/channels/adapters/{channel}/` and registers itself with the `ChannelRegistry` on startup. Adding a new channel = implement the interface + register. No other files change.

**Current adapter inventory**:

| Channel | Adapter Location | Inbound Method | Outbound Method | 2FA? | Phase |
|---------|-----------------|---------------|----------------|------|-------|
| Beds24 (all OTAs) | `/channels/adapters/beds24/` | Beds24 API (webhook + polling) | Beds24 API | No | 1 |
| WhatsApp | `/channels/adapters/whatsapp/` | Native (Baileys) | Native (Baileys) | No (QR) | 1 |
| Airbnb (direct) | `/channels/adapters/airbnb/` | IMAP (email parser) | Playwright | Yes | 2+ fallback |
| Booking.com (direct) | `/channels/adapters/booking-com/` | IMAP (email parser) | Email relay | No | 2+ fallback |
| Goibibo (direct) | `/channels/adapters/goibibo/` | IMAP (email parser) | Playwright | Yes | 2+ fallback |
| Agoda | `/channels/adapters/agoda/` | IMAP (email parser) | Playwright | Yes | 2+ |
| Expedia | `/channels/adapters/expedia/` | IMAP (email parser) | Playwright | Yes | 2+ |

---

## Integration Architecture

### Phase 1: Beds24 API — All OTA Channels

In Phase 1, all OTA channels (Airbnb, Booking.com, Goibibo) are integrated via the **Beds24 REST API**. Beds24 is the existing channel manager already connected to these OTAs. Tarksh talks to Beds24, not to OTAs directly.

```
                    INBOUND (Guest → Tarksh) — Phase 1
                    ═══════════════════════════════════

Guest messages on Airbnb / Booking.com / Goibibo
        │
        ▼
Beds24 receives message via channel manager connection
        │
        ├──────── Webhook push (< 30 sec)
        │              │
        │              ▼
        │         POST /api/webhooks/beds24
        │         Tarksh receives notification
        │
        └──────── Polling fallback (every 60s)
                       │
                       ▼
                  Beds24 API: get_messages(bookId)
                       │
                       ▼
              ┌────────────────────────────────┐
              │  Beds24 Message Normalizer     │
              │  - Map Beds24 message →        │
              │    NormalizedMessage            │
              │  - Identify source channel     │
              │    (airbnb / booking_com /      │
              │     goibibo) from booking data  │
              │  - Resolve guest identity      │
              │  - Link to booking             │
              │  - Dedup via external_id       │
              └────────────┬───────────────────┘
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
│  Resolve ChannelAdapter from      │
│  channelRegistry.get('beds24')    │
│  Call adapter.outboundSender      │
│    .send(message)                 │
│                                   │
│  Beds24 API:                      │
│  send_message(bookId, message)    │
│                                   │
│  - Simple HTTP POST               │
│  - No browser, no session mgmt   │
│  - No 2FA, no anti-detection     │
│                                   │
│  Returns DeliveryResult           │
│  Update DB (confirmed / failed)   │
└───────────────────────────────────┘
```

### Beds24 API Details

**Available endpoints used by Tarksh**:

| Endpoint | Purpose | Phase 1 Usage |
|----------|---------|---------------|
| `get_messages(bookId)` | Read all messages for a booking | Inbound polling + message history |
| `send_message(bookId, message)` | Send reply to guest | Outbound sends |
| `get_booking(bookId)` | Booking details (dates, guest, status) | Booking context for AI + sidebar |
| `get_property(query)` | Property metadata | Property setup + sync |
| `get_availability(...)` | Room availability | AI responses to availability queries |
| `get_price_availability(...)` | Pricing info | AI responses to pricing queries |
| Webhooks | Real-time push notifications | Inbound message detection |

**Beds24 API characteristics**:
- Rate limit: ~120 requests/minute
- Authentication: API key (org-level, not per-channel)
- Message format: Plain text
- Booking ID is the primary key for all message operations

**Beds24 webhook setup**:
1. Configure webhook URL in Beds24 dashboard: `https://inbox.tarksh.com/api/webhooks/beds24`
2. Beds24 sends POST on new message, new booking, booking update
3. Tarksh validates webhook signature, fetches full message from API
4. If webhook not configured, polling fallback activates (60-second interval per property)

### Beds24 Channel Identification

Beds24 is a unified API for multiple OTA channels. Tarksh identifies the **source OTA channel** from booking metadata:

```typescript
// Beds24 booking data includes the source channel
function identifySourceChannel(beds24Booking: Beds24Booking): string {
  // Beds24 provides channel info in booking data
  // Maps to: 'airbnb', 'booking_com', 'goibibo', 'direct'
  return beds24Booking.channel || 'direct';
}
```

This means the inbox UI can still show "Airbnb" or "Booking.com" channel icons on messages, even though they all come through Beds24.

### Normalized Message Schema

All channels normalize messages to this common format before storage. The `channel` field is a `string` (not a hardcoded union) — the channel registry validates it at runtime.

```typescript
interface NormalizedMessage {
  channel: string;               // Source OTA channel (e.g., 'airbnb', 'booking_com', 'goibibo')
  sourceAdapter: string;         // Which adapter provided it (e.g., 'beds24', 'whatsapp')
  externalId: string;            // Unique ID in source system (for dedup)
  guestName: string;
  guestIdentifier: string;       // Channel-specific guest ID
  content: string;               // Message text
  timestamp: Date;               // When the message was sent
  bookingRef?: string;           // Associated booking reference (Beds24 bookId)
  direction: 'inbound' | 'outbound';
  metadata: Record<string, any>; // Channel-specific extra data
}
```

The `channel` value is always a registered adapter ID. Runtime validation:
```typescript
const adapter = channelRegistry.get(message.sourceAdapter);
if (!adapter) throw new UnknownChannelError(message.sourceAdapter);
```

---

## Channel 1: Beds24 OTAs (Phase 1 — Airbnb, Booking.com, Goibibo)

### How It Works

All OTA messaging goes through Beds24. No direct OTA connections needed.

**Inbound**: Beds24 webhook or polling → Tarksh fetches messages via API → normalize → save → AI queue

**Outbound**: Tarksh sends reply via `send_message(bookId, message)` → Beds24 delivers to guest on the OTA

### Booking Context (Auto-Populated)

On first message from a guest, Tarksh fetches booking details from Beds24:

```
Beds24 API: get_booking(bookId)
        │
        ▼
┌────────────────────────────────┐
│  Booking data extracted:       │
│  ├── Guest name                │
│  ├── Check-in / check-out      │
│  ├── Number of guests          │
│  ├── Total amount              │
│  ├── Property / room type      │
│  ├── Booking status            │
│  ├── Source channel (Airbnb,   │
│  │   Booking.com, Goibibo)     │
│  └── Special requests          │
└────────────────────────────────┘
```

This data populates the booking context sidebar and feeds into AI response generation.

### Beds24 Connection Setup

1. Admin navigates to Settings > Integrations > Beds24
2. Enter Beds24 API key (from Beds24 account settings)
3. Tarksh fetches property list from Beds24 API
4. Map Beds24 properties to Tarksh properties (auto-match by name or manual)
5. Configure webhooks in Beds24 dashboard (with provided URL)
6. Status: Connected (API key valid, properties mapped)

### What Beds24 Eliminates vs Direct Scraping

| Concern | Direct Scraping | Beds24 API |
|---------|----------------|------------|
| Airbnb login / session | Playwright + cookies + 2FA | Not needed |
| Booking.com login | Playwright or email relay | Not needed |
| Goibibo login | Playwright + session | Not needed |
| Email parser maintenance | Per-OTA parser, breaks on template changes | Not needed |
| IMAP IDLE connections | 1 per property, reconnect logic | Not needed |
| Browser pool | 5-10 Playwright browsers, ~3 GB RAM | Not needed |
| Anti-detection | Human-like delays, fingerprinting | Not needed |
| 2FA handling | SMS/email/TOTP forwarding UX | Not needed |
| Second VPS | Workers VPS for browsers + IMAP | Single VPS |

---

## Channel 2: WhatsApp (Phase 1)

### Integration Approach

**Method**: Baileys library (channel-native, Tier 3)
**Future**: WhatsApp Business API (Phase 2)

WhatsApp is already event-driven — no IMAP IDLE needed. Baileys maintains a persistent WebSocket connection to WhatsApp servers.

### Connection Setup

1. Property navigates to Settings > Channels > WhatsApp
2. QR code displayed for WhatsApp Web pairing
3. User scans with their WhatsApp app
4. System establishes persistent WebSocket connection
5. Auth state saved to avoid re-scanning on restart

### Message Handling

**Inbound**:
- Real-time message reception (event-driven, no polling)
- Extract: sender phone number, name (from contacts), message text, timestamp
- Media messages (images, documents): store reference, download on demand (Phase 2)
- Group messages: ignored for MVP (only 1:1 conversations)

**Outbound**:
- Send text messages to guest's phone number
- Message delivery status tracking (sent / delivered / read)
- Typing indicator before sending (human-like behavior)

### Guest Identification

- Match incoming WhatsApp messages to existing guests by phone number
- If phone number matches a guest's `identifiers.whatsapp`, link to existing conversation
- If no match, create new guest record and conversation
- Allow manual linking: agent can manually link a WhatsApp conversation to an existing guest/booking

### WhatsApp-Specific Considerations

- **Ban risk**: WhatsApp may ban numbers used for automation
  - Mitigation: use the property's own WhatsApp number, not a separate bot number
  - Rate limit outbound: max 20 messages/hour per number
  - Never send bulk/unsolicited messages
  - Only respond to guest-initiated conversations
- **Multi-device**: WhatsApp Web multi-device allows connection without phone being online
- **Session persistence**: Store auth state to avoid re-scanning QR on restart
- **Session health**: Health check every 5 minutes (lightweight ping)
- **Re-auth UX**: Make QR re-scanning dead simple in the dashboard (prominent "Reconnect" button)
- **Number format**: Normalize phone numbers to E.164 format (+country code)

### WhatsApp Business API (Phase 2)

Move WhatsApp Business API migration from Phase 4 to Phase 2:
- Eliminates ban risk entirely
- Official Meta Cloud API with proper message delivery guarantees
- Supports message templates, rich media, interactive buttons
- Requires Facebook Business Manager setup + number verification
- Cost: per-conversation pricing from Meta

---

## Phase 2+ Channels: Direct OTA Integration (Fallback)

For OTAs NOT connected via Beds24 (e.g., Agoda, Expedia, or properties using a different channel manager), Phase 2 introduces direct OTA integration using the three-tier fallback architecture.

### Channel 3: Agoda (Phase 2+)

**Inbound**: IMAP IDLE — parse Agoda notification emails from `@agoda.com`
**Outbound**: On-demand Playwright — automate YCS portal
**Future**: YCS API (limited availability) or connect via Beds24

### Channel 4: Expedia (Phase 2+)

**Inbound**: IMAP IDLE — parse Expedia notification emails from `@expedia.com`, `@hotels.com`
**Outbound**: On-demand Playwright — automate Partner Central
**Future**: EPS API or connect via Beds24

### Adding New OTAs via Beds24

If a property connects a new OTA to Beds24 (e.g., Agoda), Tarksh automatically picks it up — no new adapter needed. The Beds24 adapter handles all channels that Beds24 supports. Only OTAs NOT on Beds24 need their own direct adapter (IMAP + Playwright).

---

## Outbound Rate Limiting

Rate limits are defined in each channel adapter's `rateLimits` config (see `ChannelAdapter` interface in `architecture.md`).

**Default adapter rate limits**:

| Channel | `maxPerSecond` | `burstSize` | `jitterMs` | Rationale |
|---------|---------------|-------------|-----------|-----------|
| Beds24 (all OTAs) | 2 | 5 | [0, 0] | ~120 req/min API limit |
| WhatsApp | 1/10 | 1 | [1000, 3000] | Anti-spam compliance |
| Airbnb (direct, Phase 2+) | 1/30 | 1 | [2000, 5000] | Avoid automation detection |
| Booking.com (direct, Phase 2+) | 1 | 5 | [0, 0] | Email relay — no rate limits |

The outbound queue worker reads rate limits from `channelRegistry.get(channel).rateLimits` and applies them automatically.

---

## Channel Health Monitoring

### Registry-Based Health Checks

Each channel adapter registers its own `ChannelHealthCheck` implementation with the global `healthRegistry` (see `architecture.md`). The `/health` endpoint aggregates all registered checks dynamically — no hardcoded health check list.

### Health Dashboard (Phase 1)

| Metric | Source |
|--------|--------|
| **Beds24 API Status** | Connected / Error (API key valid, response time) |
| **Beds24 Webhook Status** | Active / Not configured / Last received |
| **Last Beds24 poll** | Timestamp of last successful poll |
| **Last outbound sent** | Timestamp of last successful reply via Beds24 |
| **WhatsApp Status** | Connected / Disconnected |
| **Error log** | Last N errors with timestamps |

### Alerting Rules

Alerts are delivered via the `NotificationRegistry` (see `architecture.md`) — supports WebSocket push, email, and future providers (Slack, SMS, webhook).

| Alert | Trigger | Action |
|-------|---------|--------|
| Beds24 API unreachable | 3 consecutive failed API calls | Red alert + email to admin |
| Beds24 webhook silent | No webhook received for 1 hour | Switch to polling mode + warning |
| Beds24 rate limit hit | 429 response from API | Back off + queue outbound |
| Outbound failed | 3 consecutive send failures | Red alert in UI + email to admin |
| WhatsApp disconnected | Session lost | Prompt QR re-scan in dashboard |

### Error Recovery

1. **Beds24 API retry**: On API failure, retry 3x with exponential backoff (1s, 5s, 15s). If persistent, alert admin.
2. **Webhook → polling fallback**: If webhooks stop arriving, automatically switch to polling mode until webhooks resume.
3. **Outbound retry**: On send failure (from `ChannelOutboundSender.send()` returning `{ success: false, retryable: true }`), retry 3x with exponential backoff. Then mark `failed` and alert.
4. **Rate limit handling**: On Beds24 429 response, back off for the specified retry-after duration. Queue outbound sends and process when limit resets.

---

## Migration Path

| Channel | Phase 1 Method | Future Method | Migration Complexity | Priority |
|---------|---------------|---------------|---------------------|----------|
| Airbnb | Beds24 API | Beds24 API (stable) | None | Already done |
| Booking.com | Beds24 API | Beds24 API (stable) | None | Already done |
| Goibibo | Beds24 API | Beds24 API (stable) | None | Already done |
| WhatsApp | Baileys | WhatsApp Business API | Low | **Phase 2** |
| Agoda | Beds24 (if connected) or IMAP | Beds24 API or YCS API | Low-Medium | Phase 2 |
| Expedia | Beds24 (if connected) or IMAP | Beds24 API or EPS API | Low-Medium | Phase 2 |

**Key insight**: Beds24 as channel manager already has official API partnerships with OTAs. Tarksh benefits from these partnerships indirectly — no need for Tarksh to pursue its own OTA API partnerships in Phase 1.

---

## Deduplication Strategy

With Beds24 webhooks + polling, the same message might arrive from both sources. Deduplication is critical:

```
Message arrives (webhook or poll) → Generate external_id
                                          │
                                          ▼
                             Check: Does message with this external_id exist?
                                          │
                             ├── YES → Skip (already ingested)
                             └── NO  → Save to database
```

**External ID generation**:
- Beds24 OTAs: `beds24_{bookId}_{messageTimestamp}` (unique per message per booking)
- WhatsApp: `message_id` from Baileys (native)
- Phase 2+ direct OTAs: `{channel}_{bookingRef}_{timestampHash}`
