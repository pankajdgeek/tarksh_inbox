# State Machines: Message Delivery & Conversation Lifecycle

> Sprint 6 prerequisite: T-110 (delivery state machine), T-111 (outbound worker)
> Sprint 5 prerequisite: T-093 (conversation API needs status transitions)
> Source: docs/architecture-review.md P0.3 (delivery guarantee), P1.5 (concurrency)

---

## 1. Message Delivery State Machine

### Why This Exists (P0.3 Critical Fix)

**The #1 UX disaster for an inbox product is a silent failure**: an agent thinks a reply was sent, but it never reached the guest. The guest waits. The property looks unresponsive. Reviews tank.

Every outbound message follows a strict state machine. The UI MUST reflect the current state. A failed message MUST show a red alert. There is NO "maybe sent" state.

### State Diagram

```
                    ┌──────────┐
     POST /messages │  QUEUED  │  Message saved to DB, added to BullMQ queue
        ────────────┤          │  UI shows: ⏳ "Sending..."
                    └────┬─────┘
                         │
                    Worker dequeues
                    Browser/SMTP acquired
                         │
                         ▼
                    ┌──────────┐
                    │ SENDING  │  Worker is actively sending via channel
                    │          │  UI shows: ⏳ "Sending..."
                    └────┬─────┘
                         │
                    ┌────┴────────────────────────────┐
                    │                                  │
            Send succeeds                       Send fails
                    │                                  │
                    ▼                                  ▼
              ┌──────────┐                     ┌─────────────┐
              │   SENT   │                     │  RETRY (1)  │ 5s backoff
              │          │                     └──────┬──────┘
              └────┬─────┘                            │
                   │                          ┌───────┴────────┐
            Post-send verify                  │                │
              (Airbnb only)            Retry succeeds    Retry fails
                   │                          │                │
              ┌────┴────┐                     ▼                ▼
              │         │               ┌──────────┐   ┌─────────────┐
         Verified    Not found          │   SENT   │   │  RETRY (2)  │ 15s
              │         │               └────┬─────┘   └──────┬──────┘
              ▼         ▼                    │                 │
        ┌──────────┐   retry           Verify...        ┌─────┴──────┐
        │CONFIRMED │   (re-enter                        │            │
        │    ✓     │    QUEUED)                   Succeeds      Fails
        └──────────┘                                    │            │
                                                        ▼            ▼
              UI shows: ✓ "Sent"                  ┌──────────┐ ┌─────────────┐
                                                  │   SENT   │ │  RETRY (3)  │ 60s
                                                  └──────────┘ └──────┬──────┘
                                                                      │
                                                               ┌──────┴──────┐
                                                               │             │
                                                          Succeeds       FINAL FAIL
                                                               │             │
                                                               ▼             ▼
                                                         ┌──────────┐ ┌──────────┐
                                                         │   SENT   │ │  FAILED  │
                                                         └──────────┘ │    ✗     │
                                                                      └──────────┘

                                                              UI shows: 🔴 RED ALERT
                                                              "Message failed to send.
                                                               Tap to retry."
```

### State Definitions

| State | DB Value | UI Indicator | Description |
|-------|----------|-------------|-------------|
| **QUEUED** | `queued` | ⏳ Clock icon, "Sending..." | Message saved, waiting in BullMQ |
| **SENDING** | `sending` | ⏳ Spinner, "Sending..." | Worker acquired channel, actively sending |
| **SENT** | `sent` | ✓ Single check (gray) | Channel accepted the message (Playwright typed + clicked send, SMTP accepted) |
| **CONFIRMED** | `confirmed` | ✓✓ Double check (blue) | Post-send verified (Airbnb: message visible in thread. WhatsApp: delivered receipt) |
| **FAILED** | `failed` | 🔴 Red alert banner | All retries exhausted. NEVER SILENT. Agent must see this. |
| **DELIVERED** | `delivered` | ✓✓ Double check (blue) | WhatsApp-specific: server confirmed delivery to recipient device |
| **READ** | `read` | ✓✓ Double check (blue, filled) | WhatsApp-specific: recipient opened the message |

### Valid Transitions

```typescript
export const VALID_DELIVERY_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  queued:     ['sending', 'failed'],       // Failed if can't acquire browser/connection
  sending:   ['sent', 'queued', 'failed'], // queued = retry, failed = immediate fail
  sent:      ['confirmed', 'failed'],      // failed = post-send verification failed
  confirmed: ['delivered'],                // WhatsApp only
  delivered: ['read'],                     // WhatsApp only
  failed:    ['queued'],                   // Manual retry by agent
  read:      [],                           // Terminal state
};
```

### Retry Policy

```typescript
export const OUTBOUND_RETRY_CONFIG = {
  max_attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delays_ms: [5_000, 15_000, 60_000],  // 5s, 15s, 1min
  },
  // After max_attempts → mark FAILED, emit message:failed event
  on_max_retries: 'fail' as const,

  // Per-channel timeout (max time for a single send attempt)
  channel_timeouts_ms: {
    airbnb: 120_000,       // 2 min (browser automation slow)
    booking_com: 30_000,   // 30s (SMTP)
    whatsapp: 30_000,      // 30s (Baileys)
  },
};
```

### Failure UI Specification (T-113)

When a message reaches `FAILED` status:

```
┌─────────────────────────────────────────────────────────┐
│  ⚠️ Message failed to send                              │
│                                                         │
│  "Your reply to John could not be delivered via         │
│   Airbnb. Error: Session expired."                      │
│                                                         │
│  [Retry]  [Send via WhatsApp]  [Dismiss]               │
│                                                         │
│  Last attempted: 2 minutes ago                          │
└─────────────────────────────────────────────────────────┘
```

Rules:
- Red background, high contrast
- ALWAYS visible — no auto-dismiss
- Shows error reason in human-readable form
- "Retry" re-queues the message (resets to QUEUED)
- "Send via WhatsApp" offers channel switch (if guest has WA)
- "Dismiss" only hides the alert, does NOT delete the message
- Failed messages stay in the conversation thread with red ✗ indicator

### Per-Channel Send Flow

**Airbnb (Playwright)**:
```
1. Acquire browser from pool (30s timeout)
2. Load cached Airbnb session (cookies from Redis)
3. Navigate to /hosting/inbox/{thread_id}
4. Wait for message input to be interactable
5. Type message with human-like delays (50-150ms per char)
6. Click send button
7. Wait 3s, then verify: scroll to bottom, check if message text appears
8. If verified → CONFIRMED
9. If not found → SENT (assume it went, don't retry send)
10. Release browser to pool
```

**Booking.com (Email Relay)**:
```
1. Build email:
   - To: hotel-{property_id}-{reservation_id}@guest.booking.com
   - From: property configured email
   - Subject: Re: Booking {reservation_id}
   - Body: agent's reply text
2. Send via SMTP (nodemailer)
3. SMTP 250 OK → SENT
4. No post-send verification available → stays SENT (never CONFIRMED)
5. SMTP error → retry
```

**WhatsApp (Baileys)**:
```
1. Check Baileys connection is alive
2. Send message via sendMessage(jid, { text: content })
3. Baileys returns message ID → SENT
4. Wait for delivery receipt → DELIVERED
5. Wait for read receipt → READ
```

---

## 2. Conversation Status State Machine

### State Diagram

```
                 ┌──────────┐
  New message    │  UNREAD  │  Conversation created or new message received
  from guest ──▶ │          │  unread_count > 0
                 └────┬─────┘
                      │
              Agent opens conversation
              (mark_read event)
                      │
                      ▼
                 ┌──────────┐
                 │ PENDING  │  Agent has seen the message but hasn't replied
                 │          │  unread_count = 0
                 └────┬─────┘
                      │
                ┌─────┴──────┐
                │            │
          Agent replies    Starred
                │            │
                ▼            ▼
          ┌──────────┐  ┌──────────┐
          │ REPLIED  │  │ STARRED  │  Bookmarked for follow-up
          │          │  │          │  (can also be REPLIED + starred)
          └────┬─────┘  └──────────┘
               │
               │
         ┌─────┴──────┐
         │            │
  Guest replies   Agent resolves
  (new message)   (manual action)
         │            │
         ▼            ▼
    ┌──────────┐  ┌──────────┐
    │  UNREAD  │  │ RESOLVED │  Archived, hidden from default view
    │ (again)  │  │          │
    └──────────┘  └────┬─────┘
                       │
                 Guest replies
                 (re-opens)
                       │
                       ▼
                  ┌──────────┐
                  │  UNREAD  │  Resolved → Unread on new guest message
                  └──────────┘
```

### Valid Transitions

```typescript
export const VALID_CONVERSATION_TRANSITIONS: Record<ConversationStatus, ConversationStatus[]> = {
  unread:   ['pending', 'replied', 'resolved', 'starred'],
  pending:  ['replied', 'resolved', 'starred', 'unread'],
  replied:  ['unread', 'resolved', 'starred'],  // unread = guest replied
  resolved: ['unread'],                          // unread = guest replied after resolution
  starred:  ['unread', 'pending', 'replied', 'resolved'],
};
```

### Automatic Transitions

| Trigger | From | To | Action |
|---------|------|----|--------|
| Inbound guest message | Any | `unread` | Set unread_count++, update last_message_* |
| Agent opens conversation | `unread` | `pending` | Set unread_count=0 |
| Agent sends reply | `pending`/`unread` | `replied` | — |
| Agent clicks "Resolve" | Any | `resolved` | Set resolved_at, hide from default list |
| Agent clicks "Star" | Any | `starred` | Toggle is_starred=true |
| Agent clicks "Unstar" | `starred` | Previous status | Toggle is_starred=false |

### Conversation Denormalized Field Updates

On every message (inbound or outbound), update these fields atomically:

```typescript
export interface ConversationFieldUpdates {
  // Always update on ANY new message
  last_message_at: Date;              // = message.sent_at
  last_message_preview: string;       // = message.content.substring(0, 100)
  updated_at: Date;                   // = now()

  // Update on INBOUND guest message only
  unread_count: number;               // INCREMENT by 1
  status: 'unread';                   // Force to unread

  // Update on OUTBOUND agent/AI message only
  // (no unread_count change, status may change to 'replied')

  // Update primary_channel on first message or if guest uses new channel
  primary_channel?: ChannelType;      // = message.channel
}
```

---

## 3. Conversation Lock State Machine (Concurrency Control)

### Why This Exists (P1.5)

Multiple agents + AI might try to respond to the same conversation simultaneously:
- Agent A opens conversation, starts typing
- Agent B opens same conversation, also starts typing
- AI evaluator generates a draft at the same time
- Result: duplicate/conflicting replies

### Lock Mechanism

```
Redis key:  conv:{conversation_id}:lock
Value:      { user_id: string, user_name: string, locked_at: number }
TTL:        120 seconds (2 minutes)
```

### State Diagram

```
                    ┌──────────┐
                    │ UNLOCKED │  No one is replying
                    └────┬─────┘
                         │
                Agent opens conversation
                         │
                    ┌────┴────────────────┐
                    │                      │
             No existing lock        Lock exists
                    │                      │
                    ▼                      ▼
              ┌──────────┐          ┌──────────────────────┐
              │  LOCKED  │          │ SHOW "Agent X is     │
              │ by Agent │          │ replying..." banner  │
              └────┬─────┘          └──────────────────────┘
                   │
              ┌────┴────────────────┐
              │                      │
         Agent types           Agent leaves
         (extend TTL)          (release lock)
              │                      │
              ▼                      ▼
         ┌──────────┐         ┌──────────┐
         │  LOCKED  │         │ UNLOCKED │
         │ TTL=120s │         └──────────┘
         └────┬─────┘
              │
         Agent sends reply
         (release lock)
              │
              ▼
         ┌──────────┐
         │ UNLOCKED │
         └──────────┘
```

### Lock Rules

```typescript
export const CONVERSATION_LOCK_RULES = {
  ttl_seconds: 120,                    // 2 minute auto-expire
  refresh_on_typing: true,             // Extend TTL when agent types
  refresh_interval_ms: 30_000,         // Refresh every 30s while typing

  // When agent opens a conversation that has a pending AI evaluation:
  cancel_ai_on_human_open: true,       // T-155: Human always takes priority

  // Lock behavior:
  allow_override: false,               // Agent cannot steal another agent's lock
  show_lock_holder: true,              // Show "Agent X is replying..."
  auto_release_on_send: true,          // Release lock when reply is sent
  auto_release_on_navigate: true,      // Release when agent navigates away
};
```

### AI + Lock Interaction

```
┌─────────────────────────────────────────────────────────────────┐
│  SCENARIO: AI evaluating when human opens conversation          │
│                                                                 │
│  1. Guest message arrives                                       │
│  2. AI evaluation queued (BullMQ job)                           │
│  3. Before AI finishes, Agent opens the conversation            │
│  4. Agent acquires conversation lock                            │
│  5. System checks: is there a pending AI evaluation?            │
│     YES → Cancel the BullMQ job (T-155)                         │
│          → Don't show AI draft                                  │
│          → Log AIEvaluation with was_cancelled=true             │
│  6. Agent responds manually                                    │
│                                                                 │
│  SCENARIO: AI completes before human opens                      │
│                                                                 │
│  1. Guest message arrives                                       │
│  2. AI evaluation queued                                        │
│  3. AI finishes, routing_decision = "draft"                     │
│  4. System checks: is conversation locked by a human?           │
│     NO → Show AI draft in composer via WebSocket                │
│     YES → Discard draft, log as cancelled                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Channel Connection State Machine

### State Diagram

```
                    ┌──────────────┐
     Initial setup  │ DISCONNECTED │
         ────────── │              │
                    └──────┬───────┘
                           │
                    Credentials provided
                    (T-049: POST /channels)
                           │
                           ▼
                    ┌──────────────┐
                    │ CONNECTING...│  (transient, not stored)
                    └──────┬───────┘
                           │
                    ┌──────┴──────────────────┐
                    │                          │
              Auth succeeds              Auth fails
                    │                          │
                    ▼                          ▼
             ┌──────────────┐          ┌──────────────┐
             │  CONNECTED   │          │    ERROR     │
             │              │          │              │
             └──────┬───────┘          └──────┬───────┘
                    │                          │
              ┌─────┴──────────┐         Auto-retry
              │                │         (backoff)
         Session expires   Connection          │
         (approaching)     drops               │
              │                │         ┌─────┘
              ▼                ▼         ▼
       ┌──────────────┐  ┌──────────────┐
       │   SESSION    │  │ DISCONNECTED │
       │   EXPIRING   │  └──────┬───────┘
       └──────┬───────┘         │
              │           Auto-reconnect
        Proactive re-auth  (exponential backoff)
              │                 │
              ▼                 ▼
       ┌──────────────┐  ┌──────────────┐
       │  CONNECTED   │  │ CONNECTING...│
       │  (refreshed) │  └──────────────┘
       └──────────────┘

       ┌──────────────────────────────────────────┐
       │           2FA FLOW (Airbnb only)          │
       │                                           │
       │  During auth/re-auth:                     │
       │  ┌──────────┐                             │
       │  │TFA_PENDING│  2FA page detected         │
       │  └────┬─────┘  Admin notified             │
       │       │                                   │
       │  ┌────┴────┐                              │
       │  │         │                              │
       │ Code OK  Code fail                        │
       │  │       or timeout                       │
       │  ▼         ▼                              │
       │ CONNECTED  TFA_FAILED                     │
       │            (→ retry or manual)            │
       └──────────────────────────────────────────┘
```

### Per-Channel Connection Specifics

| Channel | Auth Method | Re-auth Frequency | 2FA Possible? |
|---------|------------|-------------------|---------------|
| Airbnb | Playwright login + cookies | Every 2-4 weeks | Yes (SMS/Email OTP) |
| Booking.com | No auth needed (email relay) | Never | No |
| WhatsApp | Baileys QR code pairing | Every 2-6 months | No (re-pair needed) |

---

## 5. AI Evaluation State Machine

```
              ┌──────────┐
Inbound msg → │  QUEUED  │  Job added to ai-evaluation BullMQ queue
              └────┬─────┘
                   │
              Worker picks up job
                   │
                   ▼
              ┌──────────────────┐
              │ CLASSIFYING      │  Haiku: intent + stage detection
              │ (Step 1)         │
              └────┬─────────────┘
                   │
              ┌────┴──────────────────┐
              │                        │
        Never-auto intent        Normal intent
              │                        │
              ▼                        ▼
        ┌──────────────┐        ┌──────────────────┐
        │ ROUTE_HUMAN  │        │ KB_MATCHING       │  Check KB fields
        │ (never_auto) │        │ (Step 3)          │
        └──────────────┘        └────┬──────────────┘
                                     │
                               ┌─────┴──────┐
                               │            │
                          KB match     No KB match
                               │            │
                               ▼            ▼
                         ┌──────────┐  ┌──────────────┐
                         │GENERATING│  │ ROUTE_HUMAN  │
                         │(Step 4)  │  │ (no_kb_match)│
                         │ Sonnet   │  └──────────────┘
                         └────┬─────┘
                              │
                        ┌─────┴──────┐
                        │            │
                   auto_send    draft_only
                        │            │
                        ▼            ▼
                  ┌──────────┐  ┌──────────┐
                  │AUTO_SENT │  │  DRAFT   │
                  │→ outbound│  │→ composer│
                  │  queue   │  │  UI      │
                  └──────────┘  └──────────┘
```

### Cancellation at Any Point

If a human opens the conversation while AI is processing (Steps 1-4), the evaluation is cancelled:
- BullMQ job removed from queue (if still waiting)
- In-progress evaluation aborted (if worker is processing)
- AIEvaluation record created with `was_cancelled = true`
- No response generated, no draft shown

This is implemented via Redis key: `ai:cancel:{conversation_id}` (set when human opens conversation). The AI worker checks this key between each step and aborts if found.
