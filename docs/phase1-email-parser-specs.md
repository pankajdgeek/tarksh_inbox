# OTA Email Parser Specifications

> Sprint 3 prerequisite: T-064 to T-069
> **CRITICAL**: Collect 20+ real email samples per OTA BEFORE starting parser development.
> Source: docs/channel-integrations.md

---

## 1. Parser Architecture

### Flow

```
Raw Email (from IMAP IDLE)
    │
    ▼
┌─────────────────────────────────────────────┐
│  Channel Detection Router (T-065)            │
│                                              │
│  Check sender address against regex patterns │
│  → Determines which parser to invoke         │
└───────────────────┬─────────────────────────┘
                    │
       ┌────────────┼────────────┐
       │            │            │
       ▼            ▼            ▼
  ┌─────────┐  ┌──────────┐  ┌──────────┐
  │ Airbnb  │  │Booking   │  │ Unknown  │
  │ Parser  │  │.com      │  │ → Alert  │
  │ (T-066) │  │Parser    │  │ (T-068)  │
  └────┬────┘  │(T-067)   │  └──────────┘
       │       └────┬─────┘
       │            │
       └─────┬──────┘
             │
             ▼
    ┌─────────────────────────────────────┐
    │  NormalizedMessage (T-070/T-071)     │
    │                                      │
    │  Unified format for all channels     │
    │  → Dedup check (T-072)              │
    │  → Save to DB                        │
    │  → Event bus: message:received       │
    └─────────────────────────────────────┘
```

### OTAEmailParser Interface (T-064)

```typescript
/**
 * Every OTA email parser must implement this interface.
 *
 * Design principles:
 * 1. NEVER throw — return ParseResult with success: false on failure
 * 2. Always extract what you can, even if some fields are missing
 * 3. Log the raw email path for debugging unparseable emails
 * 4. Be resilient to format changes (use multiple extraction strategies)
 */
export interface OTAEmailParser {
  /** Unique channel identifier */
  channel: ChannelType;

  /**
   * Test if this parser can handle the given email.
   * Based on sender address, subject, or headers.
   * Must be fast — called for EVERY incoming email.
   */
  canParse(email: RawEmail): boolean;

  /**
   * Extract structured data from the email.
   * Returns ParseResult with extracted fields or error.
   */
  parse(email: RawEmail): Promise<ParseResult>;

  /**
   * Check if the email content was truncated.
   * Some OTA emails contain "View full message" links.
   * If truncated → trigger Playwright enrichment to fetch full content.
   */
  isContentTruncated(email: RawEmail): boolean;
}

export interface RawEmail {
  uid: number;                    // IMAP UID
  message_id: string;            // Message-ID header
  from: EmailAddress;             // Parsed from header
  to: EmailAddress[];             // Parsed to header
  reply_to?: EmailAddress;        // Reply-To header (critical for Booking.com)
  subject: string;
  date: Date;
  text_body?: string;             // Plain text body
  html_body?: string;             // HTML body
  headers: Record<string, string>; // All headers
  raw: Buffer;                    // Raw RFC 2822 email (for archival)
}

export interface EmailAddress {
  name?: string;
  address: string;
}

export interface ParseResult {
  success: boolean;
  channel: ChannelType;
  data?: ParsedEmailData;
  error?: string;
  warnings?: string[];            // Non-fatal issues (e.g., missing optional fields)
  is_truncated: boolean;          // If true, queue enrichment job
}

export interface ParsedEmailData {
  // Guest info
  guest_name: string;
  guest_email?: string;
  guest_phone?: string;

  // Message content
  message_content: string;        // The actual guest message text
  message_type: 'guest_message' | 'booking_notification' | 'system_notification';

  // Booking/reservation reference
  reservation_id?: string;        // OTA-specific booking ID
  thread_id?: string;             // OTA-specific thread/conversation ID

  // Outbound reply info
  reply_to_address?: string;      // For Booking.com email relay
  reply_url?: string;             // Direct link to reply in OTA portal

  // Metadata
  received_at: Date;              // Email date header
  raw_subject: string;            // Original subject line
}
```

### NormalizedMessage Interface (T-070)

```typescript
/**
 * The canonical message format used across ALL channels.
 * Every parser output + WhatsApp message gets converted to this.
 * This is what gets saved to the Message table.
 */
export interface NormalizedMessage {
  // Identity
  external_id: string;            // Dedup key: hash(channel + reservation_id + timestamp)
  channel: ChannelType;

  // Content
  content: string;                // Message text (cleaned, no HTML)
  sender_type: MessageSenderType; // 'guest' for inbound
  attachments?: MessageAttachment[];

  // Guest
  guest_name: string;
  guest_identifiers: Partial<GuestIdentifiers>;  // Channel-specific identifiers

  // Booking context
  reservation_id?: string;
  thread_id?: string;

  // Outbound info (for replies)
  reply_context?: {
    reply_to_email?: string;      // Booking.com relay
    thread_url?: string;          // Airbnb inbox URL
    phone_number?: string;        // WhatsApp
  };

  // Metadata
  received_at: Date;
  property_id: string;            // Resolved from email connection
  org_id: string;

  // Enrichment
  needs_enrichment: boolean;      // If truncated, needs Playwright fetch
}
```

### External ID Generation (T-072)

```typescript
import { createHash } from 'crypto';

/**
 * Generate a deduplication ID for messages.
 * Same message from same channel = same external_id → skip (dedup).
 *
 * Format: {channel}_{reservation_id}_{timestamp_hash}
 *
 * Handles edge cases:
 * - Email received twice (IMAP reconnect catches up) → same external_id → deduped
 * - Same guest, same booking, different messages → different timestamp → unique
 * - No reservation_id available → use guest_email or thread_id as fallback
 */
export function generateExternalId(
  channel: ChannelType,
  reservationId: string | undefined,
  messageContent: string,
  timestamp: Date,
  fallbackIdentifier?: string,
): string {
  const identifier = reservationId || fallbackIdentifier || 'unknown';
  const contentHash = createHash('sha256')
    .update(messageContent.trim().substring(0, 200))
    .digest('hex')
    .substring(0, 8);
  const timeHash = createHash('sha256')
    .update(timestamp.toISOString())
    .digest('hex')
    .substring(0, 8);

  return `${channel}_${identifier}_${contentHash}_${timeHash}`;
}
```

---

## 2. Channel Detection Patterns (T-065)

```typescript
/**
 * Regex patterns to identify which OTA sent an email.
 * Checked against the `from` address and sometimes `subject`.
 *
 * Order matters: check most specific patterns first.
 */
export const CHANNEL_DETECTION_PATTERNS: Array<{
  channel: ChannelType;
  fromPatterns: RegExp[];
  subjectPatterns?: RegExp[];
  headerPatterns?: Record<string, RegExp>;
}> = [
  {
    channel: 'airbnb',
    fromPatterns: [
      /^.*@(airbnb\.com|airbnbmail\.com)$/i,
      /^.*@(guest\.airbnb\.com)$/i,
      /^no-?reply@airbnb\./i,
    ],
    subjectPatterns: [
      /new message from/i,
      /sent you a message/i,
      /reservation for/i,
      /booking confirmation/i,
    ],
  },
  {
    channel: 'booking_com',
    fromPatterns: [
      /^.*@(booking\.com|bookingmail\.com)$/i,
      /^.*@guest\.booking\.com$/i,
      /^noreply@booking\.com$/i,
    ],
    subjectPatterns: [
      /new message.*booking/i,
      /guest message/i,
      /reservation \d+/i,
    ],
  },
  {
    channel: 'goibibo',
    fromPatterns: [
      /^.*@(goibibo\.com|makemytrip\.com)$/i,
      /^.*@(guestmessage\.goibibo\.com)$/i,
    ],
    subjectPatterns: [
      /goibibo.*message/i,
      /makemytrip.*message/i,
    ],
  },
  {
    channel: 'agoda',
    fromPatterns: [
      /^.*@(agoda\.com|agodamail\.com)$/i,
    ],
    subjectPatterns: [
      /agoda.*message/i,
      /new guest message/i,
    ],
  },
  {
    channel: 'expedia',
    fromPatterns: [
      /^.*@(expedia\.com|hotels\.com|expediamail\.com)$/i,
    ],
    subjectPatterns: [
      /expedia.*message/i,
      /hotels\.com.*message/i,
    ],
  },
];

/**
 * Detect channel from email headers.
 * Returns the matched channel or null if no match.
 */
export function detectChannel(email: RawEmail): ChannelType | null {
  for (const pattern of CHANNEL_DETECTION_PATTERNS) {
    const fromMatch = pattern.fromPatterns.some(p =>
      p.test(email.from.address)
    );
    if (fromMatch) return pattern.channel;

    // Fallback: check subject if from didn't match
    if (pattern.subjectPatterns) {
      const subjectMatch = pattern.subjectPatterns.some(p =>
        p.test(email.subject)
      );
      if (subjectMatch) return pattern.channel;
    }
  }
  return null;
}
```

---

## 3. Airbnb Email Parser (T-066)

### Email Structure (Expected Patterns)

**Subject patterns**:
```
"New message from {Guest Name}"
"{Guest Name} sent you a message"
"Message about your reservation at {Property}"
"Reservation confirmed: {Guest Name}, {Dates}"
```

**Sender**:
```
no-reply@airbnb.com
automated@airbnbmail.com
```

**HTML body structure** (key elements to extract):

```html
<!-- Pattern 1: Guest message notification -->
<div class="message-content">
  <!-- Guest name usually in a heading or bold -->
  <h2>{Guest Name}</h2>
  <!-- or -->
  <span class="guest-name">{Guest Name}</span>

  <!-- Message content -->
  <div class="message-text">
    {Actual guest message here}
  </div>

  <!-- Reservation reference -->
  <a href="https://www.airbnb.com/hosting/inbox/{thread_id}">
    View conversation
  </a>

  <!-- Booking details (sometimes) -->
  <div class="booking-details">
    Check-in: {date}
    Check-out: {date}
    Guests: {count}
    Confirmation code: {HMXXXXXX}
  </div>
</div>

<!-- Truncation indicator -->
<a href="...">View full message</a>
<!-- or -->
<div class="truncated">
  This message has been shortened...
</div>
```

### Extraction Strategy

```typescript
/**
 * Airbnb parser uses multiple extraction strategies in priority order:
 *
 * 1. HTML parsing (primary): Parse HTML body with cheerio/jsdom
 *    - Most reliable, most content
 *    - Look for known CSS classes/data attributes
 *
 * 2. Plain text parsing (fallback): Parse text body with regex
 *    - For emails where HTML is missing or malformed
 *    - Less reliable but good fallback
 *
 * 3. Subject line parsing (last resort): Extract from subject
 *    - Guest name is always in the subject
 *    - Useful when body parsing fails
 *
 * IMPORTANT: Airbnb changes their email template 2-3x per year.
 * The parser MUST handle both old and new formats.
 * Keep a list of known format versions and try all of them.
 */

export interface AirbnbParsedData extends ParsedEmailData {
  // Airbnb-specific fields
  airbnb_thread_id?: string;     // From URL: /hosting/inbox/{thread_id}
  confirmation_code?: string;     // HMXXXXXX format
  check_in?: string;
  check_out?: string;
  num_guests?: number;
  property_name?: string;
  guest_profile_url?: string;
}

// Extraction patterns (maintain a list — add new ones when format changes)
export const AIRBNB_EXTRACTION_PATTERNS = {
  // Guest name extraction
  guest_name: [
    // Subject line patterns
    /New message from (.+)/i,
    /(.+) sent you a message/i,
    /Message from (.+) about/i,
    // HTML patterns
    /<h[23][^>]*>([^<]+)<\/h[23]>/,
    /class="[^"]*guest[_-]?name[^"]*"[^>]*>([^<]+)/i,
  ],

  // Message content extraction
  message_content: [
    // HTML patterns — look for message text container
    /class="[^"]*message[_-]?(text|content|body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    // Plain text — content between known markers
    /Message:\s*\n([\s\S]*?)(?=\n(?:View|Reply|Check-in|Reservation))/i,
  ],

  // Thread ID extraction (from URLs in the email)
  thread_id: [
    /airbnb\.com\/hosting\/inbox\/(\d+)/i,
    /airbnb\.com\/messaging\/thread\/(\d+)/i,
    /thread[_-]?id[=:]?\s*(\d+)/i,
  ],

  // Confirmation code
  confirmation_code: [
    /(?:confirmation|booking)\s*(?:code|#|number)?:?\s*(HM[A-Z0-9]{6,10})/i,
    /(HM[A-Z0-9]{6,10})/,
  ],

  // Truncation detection
  truncation_indicators: [
    /view full message/i,
    /read more/i,
    /this message has been shortened/i,
    /message truncated/i,
  ],
};
```

---

## 4. Booking.com Email Parser (T-067)

### Email Structure

**Subject patterns**:
```
"New message from guest {Guest Name} - Booking {Reservation ID}"
"Guest message: {Property Name}"
"Message about reservation {Reservation ID}"
```

**Sender**:
```
noreply@booking.com
guest-messages@booking.com
```

**Reply-To** (CRITICAL for outbound):
```
hotel-{property_id}-{reservation_id}@guest.booking.com
```

**HTML body structure**:

```html
<!-- Pattern 1: Guest message -->
<div class="message-container">
  <div class="guest-info">
    <strong>{Guest Name}</strong>
    <span>Reservation: {Reservation ID}</span>
  </div>

  <div class="message-body">
    {Full guest message text — Booking.com usually doesn't truncate}
  </div>

  <div class="reservation-details">
    Property: {Property Name}
    Check-in: {date}
    Check-out: {date}
    Room: {Room Type}
  </div>

  <!-- Reply instruction -->
  <p>Reply directly to this email to respond to your guest.</p>
</div>
```

### Key Differentiator: Reply-To Address

Booking.com is the **ONLY** OTA where we can reply by email. The `Reply-To` header contains a relay address. We don't need Playwright at all.

```typescript
export interface BookingComParsedData extends ParsedEmailData {
  booking_reservation_id: string;
  reply_to_relay: string;          // hotel-{id}-{res}@guest.booking.com
  room_type?: string;
  property_name_in_email?: string;
}

export const BOOKING_COM_EXTRACTION_PATTERNS = {
  guest_name: [
    /New message from guest\s+(.+?)\s*[-–]/i,
    /class="[^"]*guest[_-]?(name|info)[^"]*"[^>]*>\s*<strong>([^<]+)/i,
    /From:\s*(.+?)(?:\n|<br)/i,
  ],

  message_content: [
    /class="[^"]*message[_-]?(body|content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    // Plain text fallback
    /(?:wrote|says|message):\s*\n([\s\S]*?)(?=\n(?:Reservation|Property|Check-in|Reply))/i,
  ],

  reservation_id: [
    /(?:reservation|booking)\s*(?:ID|number|#)?:?\s*(\d{6,15})/i,
    /Booking\.com.*?(\d{8,12})/i,
  ],

  // Reply-To address extraction (CRITICAL)
  reply_to_address: [
    // From Reply-To header
    /(hotel-\d+-\d+@guest\.booking\.com)/i,
    // From email body
    /reply.*?to.*?(hotel-\d+-\d+@guest\.booking\.com)/i,
  ],

  // Booking.com typically doesn't truncate
  truncation_indicators: [
    /view full message/i,  // Rare but possible
  ],
};
```

---

## 5. Email Parser Test Suite Requirements (T-069)

### Test Requirements

```
Per parser, collect and test against:

1. MINIMUM 5 real email samples per channel
2. Cover these message types:
   - New guest inquiry (pre-booking)
   - Booking confirmation notification
   - Guest message during stay
   - Guest message with attachments mentioned
   - System notification (not a guest message — must NOT parse as guest message)

3. Edge cases to test:
   - HTML only (no plain text part)
   - Plain text only (no HTML part)
   - Truncated message (need enrichment)
   - Unicode characters in guest name
   - Very long message (1000+ chars)
   - Empty message body (subject only)
   - Multiple recipients (forwarded email)
   - Non-English message content

4. Negative cases (must return success: false):
   - Marketing email from OTA
   - Payment receipt (not a message)
   - Review notification
   - Email from unknown OTA
   - Completely unrelated email
```

### Test Structure

```typescript
describe('AirbnbEmailParser', () => {
  // Load real email samples from fixtures
  const samples = loadFixtures('airbnb');

  test('parses guest message correctly', async () => {
    const result = await parser.parse(samples.guest_message_basic);
    expect(result.success).toBe(true);
    expect(result.data?.guest_name).toBe('John Smith');
    expect(result.data?.message_content).toContain('What time can I check in');
    expect(result.data?.thread_id).toBe('123456789');
    expect(result.data?.reservation_id).toMatch(/HM[A-Z0-9]+/);
  });

  test('detects truncated content', async () => {
    const result = await parser.parse(samples.truncated_message);
    expect(result.is_truncated).toBe(true);
  });

  test('ignores marketing email', async () => {
    const result = await parser.parse(samples.marketing_email);
    expect(result.success).toBe(false);
    // OR: parser.canParse() returns false
  });

  test('handles Unicode guest name', async () => {
    const result = await parser.parse(samples.unicode_name);
    expect(result.data?.guest_name).toBe('Müller');
  });

  test('handles missing reservation ID gracefully', async () => {
    const result = await parser.parse(samples.no_reservation);
    expect(result.success).toBe(true);
    expect(result.warnings).toContain('reservation_id not found');
  });
});
```

### Fixture Collection Guide

**How to collect real email samples**:

1. **Airbnb**: Send test messages from a guest account to your host account. Forward the notification emails as `.eml` files.

2. **Booking.com**: Make a test booking, send messages, save the notification emails.

3. **Storage**: Save as `.eml` files in `tests/fixtures/emails/{channel}/`:
   ```
   tests/fixtures/emails/
   ├── airbnb/
   │   ├── guest-message-basic.eml
   │   ├── guest-message-long.eml
   │   ├── guest-message-truncated.eml
   │   ├── booking-confirmation.eml
   │   ├── marketing-email.eml
   │   └── system-notification.eml
   ├── booking_com/
   │   ├── guest-message-basic.eml
   │   ├── guest-message-with-relay.eml
   │   ├── booking-confirmation.eml
   │   ├── payment-receipt.eml
   │   └── review-notification.eml
   └── unknown/
       ├── random-email.eml
       └── non-ota-email.eml
   ```

4. **Sanitization**: Remove any real guest PII before committing. Replace with fake data in the fixtures.

---

## 6. Resilience & Error Handling

### Parser Failure Handling (T-068)

When a parser fails or returns `success: false`:

```
1. Log the error with context:
   - Channel (detected or unknown)
   - From address
   - Subject line
   - Error message
   - Parser version

2. Archive the raw email:
   - Save to disk: /data/unparseable/{date}/{uid}.eml
   - 30-day retention
   - Used for developing new parsers and fixing existing ones

3. Admin notification:
   - If > 5 unparseable emails in 1 hour → send admin alert
   - Include sample subjects for debugging
   - Don't spam (max 1 alert per hour per channel)

4. NEVER discard the email:
   - Save to a separate "unparseable" queue
   - Admin can review and manually process
   - Might be a format change requiring parser update
```

### Format Change Detection

```typescript
/**
 * Monitor parser success rate to detect OTA email format changes.
 *
 * If success rate drops below 80% in a 1-hour window:
 *   → Send admin alert: "Airbnb email format may have changed"
 *   → Include example of failed emails
 *   → Continue attempting to parse (may recover)
 *
 * Track in Redis:
 *   parser:{channel}:success - INCR on success
 *   parser:{channel}:failure - INCR on failure
 *   Both keys expire after 1 hour (TTL: 3600)
 */
export const FORMAT_CHANGE_DETECTION = {
  window_seconds: 3600,          // 1 hour
  min_sample_size: 10,           // Need at least 10 emails to trigger
  failure_threshold: 0.2,        // Alert if > 20% failure rate
  alert_cooldown_seconds: 3600,  // Max 1 alert per hour per channel
};
```
