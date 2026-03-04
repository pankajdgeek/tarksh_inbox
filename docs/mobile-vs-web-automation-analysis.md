# Mobile vs Web Automation: Risk & Sustainability Analysis

**Date**: 2026-03-03
**Context**: Evaluating whether Tarksh Inbox should use mobile automation (notification hooks, app automation) vs web automation (Playwright scraping) vs hybrid approaches for OTA channel integration.

---

## Executive Summary

Mobile automation (notification interception + app automation) is **not the silver bullet it appears to be**. While the event-driven model is architecturally appealing (no polling), the implementation reality introduces harder problems than it solves. The real insight from this analysis is that **neither pure web nor pure mobile is the answer** - the winning strategy is a **three-tier architecture** where IMAP IDLE (email push) is promoted from "fallback" to "primary ingestion", web scraping becomes "enrichment + outbound", and mobile is avoided entirely until official APIs are available.

### Bottom Line

| Approach | Sustainability (3yr) | Risk | Cost (50 props) | Recommendation |
|----------|----------------------|------|-----------------|----------------|
| Web Scraping (Playwright) | Medium | Medium | $500-1.5K/mo | Use for outbound + enrichment |
| Mobile Emulator Farm | Low | High | $1-12K/mo | Avoid |
| Mobile Notification Forwarding | Low | Medium | Low | Not scalable |
| IMAP IDLE (Email Push) | High | Low | ~Free | **Promote to primary** |
| Official APIs | Highest | None | Varies | Pursue in parallel |

---

## Part 1: The Mobile Automation Promise

### The Appealing Idea

The thesis: Instead of polling OTA dashboards every 60-90 seconds with headless browsers, run the OTA mobile apps somewhere, hook into their notification system, and get event-driven, on-demand message ingestion. No polling. No wasted cycles. Real-time.

This is architecturally elegant. Push > Poll is a fundamental truth in system design. But let's examine whether this is achievable in practice.

### Three Ways to Do Mobile Automation

#### Approach A: Server-Side Android Emulator Farm

Run Android emulators on your servers. Install OTA apps. Capture notifications via `NotificationListenerService`. Open apps via Accessibility Service to read full messages and send replies.

```
Your Server (VPS/Cloud)
├── Android Emulator Instance 1 (Property A's Airbnb)
│   ├── Airbnb App (logged in)
│   ├── NotificationListenerService (captures push)
│   └── Accessibility Service (opens app, reads, replies)
├── Android Emulator Instance 2 (Property A's Booking.com)
│   ├── Booking.com App (logged in)
│   └── ...
├── Android Emulator Instance 3 (Property B's Airbnb)
│   └── ...
└── ... (N emulators for N property-channel pairs)
```

#### Approach B: Client-Side Notification Forwarding

Property managers install a companion app on their phones. The app uses `NotificationListenerService` to capture OTA notifications and forwards them to your server.

```
Property Manager's Phone
├── Airbnb App → Push Notification → NotificationListenerService
├── Booking.com App → Push Notification → NotificationListenerService
└── Tarksh Companion App
    └── Captures notifications → HTTPS POST → Your Server
```

#### Approach C: Mobile API Reverse Engineering

Intercept API calls from OTA mobile apps using MITM proxy, reverse-engineer the endpoints, register your own push notification tokens, and call APIs directly.

```
Your Server
├── Reverse-engineered Airbnb API client
│   ├── Register FCM token (receive push)
│   ├── GET /messages (read messages)
│   └── POST /messages (send replies)
└── Repeat for each OTA
```

---

## Part 2: Why Each Mobile Approach Fails

### Approach A Fails: Android Emulator Farm

#### Problem 1: Emulators Are Resource-Heavier Than Playwright

| Resource | Playwright Instance | Android Emulator |
|----------|-------------------|-----------------|
| RAM | 150-300 MB | 2-4 GB |
| CPU | 0.5-1 core | 2-4 cores |
| Disk | ~50 MB | 4-8 GB |
| Startup time | 2-5 seconds | 30-120 seconds |

**For 50 properties across 3 channels = 150 emulator instances**:
- Playwright: ~45 GB RAM, ~75 CPU cores
- Android Emulators: ~450 GB RAM, ~450 CPU cores

The mobile approach needs **10x more resources** than web scraping for the same coverage.

Even with lightweight container-based Android (ReDroid), you're looking at 1-2 GB per instance minimum. That's still 3-5x heavier than Playwright.

#### Problem 2: Play Integrity API Kills Emulators

Google's Play Integrity API (fully deployed, replaced SafetyNet in 2025) makes emulator detection trivial for apps that check:

- `MEETS_DEVICE_INTEGRITY` - Is this a real device? Emulators fail.
- `MEETS_STRONG_INTEGRITY` - Hardware-backed attestation? Emulators fail.
- Only `MEETS_BASIC_INTEGRITY` passes on emulators, and OTA apps can (and do) require higher levels.

Airbnb and Booking.com both use Play Integrity. Their apps may not work on emulators at all, or may degrade functionality (no push notifications, limited messaging).

**Bypass tools exist** (Play Integrity Fix modules for Magisk) but they are:
- Inconsistent across app versions
- Detected by continuous API updates from Google
- A cat-and-mouse game you cannot win long-term

#### Problem 3: App Updates Break Everything

OTA apps update every 2-4 weeks. Each update can:
- Change UI element IDs, layouts, and navigation flows
- Break Accessibility Service selectors (same problem as web scraper CSS selectors)
- Add new anti-automation checks
- Change push notification payload formats

**This is the same maintenance problem as web scraping, but harder to debug** because:
- Android app UIs are harder to inspect than web DOM
- No equivalent of browser DevTools for emulator debugging
- App crash logs are less informative than browser console errors
- You need to decompile APKs to understand changes

#### Problem 4: Detection Is More Aggressive on Mobile

OTA mobile apps have **more detection vectors** than websites:

| Detection Method | Web | Mobile |
|-----------------|-----|--------|
| Browser fingerprinting | Yes | N/A |
| TLS fingerprinting (JA3/JA4) | Yes | Yes |
| Behavioral analysis | Yes | Yes |
| Device attestation (Play Integrity) | No | **Yes** |
| Root/jailbreak detection | No | **Yes** |
| Emulator detection | No | **Yes** |
| Accessibility Service detection | No | **Yes** |
| Frida/instrumentation detection | No | **Yes** |
| App integrity check (tamper detection) | No | **Yes** |

Mobile apps have **5 additional detection vectors** that don't exist on the web. You're fighting on a harder battlefield.

#### Cost: Emulator Farm

| Solution | Monthly (50 properties) | Per Instance |
|----------|------------------------|-------------|
| ReDroid (self-hosted) | $1,000-2,000 | $20-40 |
| Genymotion Cloud | $9,300 | $186 |
| AWS Device Farm | $12,500 | $250 |
| BrowserStack | $11,250 | $225 |

Compare to Playwright: **$500-1,500/month**. Mobile is 2-20x more expensive.

---

### Approach B Fails: Client-Side Notification Forwarding

#### Problem 1: It Doesn't Scale

This requires every property manager to:
1. Install your companion app on their personal phone
2. Grant it `NotificationListenerService` permission (scary for users)
3. Keep their phone on and connected 24/7
4. Not kill the app (Android battery optimization aggressively kills background services)

**At 100+ properties (Phase 3), this is operationally unmanageable.**

- Support tickets: "My notifications stopped forwarding" (because Android killed the background service)
- Phone replacement: Customer gets new phone, forgets to set up forwarding
- Multiple team members: Which team member's phone runs the forwarder?
- Battery drain: 10-15% additional battery usage

#### Problem 2: Android OS Restrictions Are Tightening

Android 13-15 have progressively restricted background services and notification access:
- **Android 13**: Sideloaded apps can't access notification listener without extra user confirmation
- **Android 14**: Stricter background process limits
- **Android 15**: Enhanced Confirmation Mode - additional security prompt for sensitive permissions
- **Google Play Policy 4.7**: Apps misusing Accessibility/Notification services get removed

Your companion app may not survive Google Play review, and sideloading has increasing friction.

#### Problem 3: Notification Content Is Incomplete

**Critical finding**: OTA push notifications typically contain **limited text**, not the full message.

| OTA | Notification Content |
|-----|---------------------|
| Airbnb | "New message from [Guest Name]" + first ~100 chars |
| Booking.com | "New message regarding reservation [ID]" + preview |
| Goibibo | "You have a new booking inquiry" (minimal) |
| Agoda | "New guest message" (minimal) |
| Expedia | "New message from [Guest]" + short preview |

**You still need to open the app or scrape the web to get the full message content.** The notification is just a trigger, not the payload. This means you need a second system (web scraping or API) anyway, negating the "no polling" advantage.

#### Problem 4: Outbound Is Unsolved

Even if you capture inbound notifications, **how do you send replies?**

- You can't reply from a notification (OTAs don't support inline reply actions)
- You need either web scraping or app automation to send outbound messages
- So you're running two systems: mobile for inbound detection + web for outbound sending

This increases complexity without eliminating the web scraping dependency.

---

### Approach C Fails: Mobile API Reverse Engineering

#### Problem 1: SSL/Certificate Pinning

All major OTA apps implement certificate pinning:
- Airbnb: Certificate pinning + public key pinning
- Booking.com: Multiple pinning layers
- WhatsApp: Certificate pinning + binary verification

Bypassing requires:
- Rooted device/emulator
- Frida or Xposed framework to hook SSL verification
- Constant maintenance as apps update their pinning certificates

#### Problem 2: API Contracts Change Without Notice

Mobile APIs are internal/undocumented. They change frequently:
- No versioning guarantees
- No deprecation notices
- Breaking changes on any app update
- Different API versions per app version (forced updates)

#### Problem 3: FCM Token Interception Is Infeasible

FCM tokens are **cryptographically bound to a specific device + app installation**. You cannot:
- Register your own FCM token to receive another device's notifications
- Intercept FCM traffic in transit (end-to-end encrypted)
- Clone a FCM token to another device

The only way to get push notifications is to run the actual app on a device you control.

#### Problem 4: Highest Legal Risk

Reverse-engineering mobile APIs and bypassing security measures may violate:
- **CFAA (Computer Fraud and Abuse Act)**: Accessing a computer system in a manner that exceeds authorization
- **DMCA Section 1201**: Circumventing technological protection measures
- **OTA Terms of Service**: Explicitly prohibit reverse engineering

**Precedent**: Ryanair v. Booking.com (2024) resulted in a unanimous jury verdict against Booking.com under CFAA for unauthorized automated access to Ryanair's systems, even though the underlying data was publicly available.

---

## Part 3: Web Scraping (Current Plan) - Honest Assessment

### Strengths

| Factor | Assessment |
|--------|-----------|
| **Proven approach** | Hundreds of companies run production web scrapers |
| **Tooling maturity** | Playwright is battle-tested, excellent ecosystem |
| **Debugging** | Browser DevTools, screenshots, HAR files |
| **Resource efficiency** | 150-300 MB per instance |
| **Recovery speed** | Selector changes fixed in hours, not days |
| **Community** | Large community sharing bypass techniques |

### Weaknesses

| Factor | Assessment |
|--------|-----------|
| **Polling-based** | 60-90 sec latency, wasted cycles between messages |
| **Detection** | DataDome, Akamai, PerimeterX getting smarter |
| **Session management** | OTA sessions expire, require re-auth |
| **Resource at scale** | 150 browser instances for 50 properties x 3 channels |
| **ToS violation** | Medium legal risk |
| **Maintenance** | UI changes break scrapers every few weeks |

### Detection Landscape (2025-2026)

Major OTAs use sophisticated bot detection:

**Airbnb**: Uses DataDome
- 35+ behavioral signals (mouse movement, scroll velocity, typing cadence)
- TLS fingerprinting (JA3/JA4)
- Browser fingerprinting (Canvas, WebGL, fonts)
- IP reputation scoring

**Booking.com**: Uses Akamai Bot Manager + PerimeterX
- TLS fingerprinting with JA4 (2026, catches JA3 spoofing)
- Behavioral biometrics
- Device fingerprinting
- Risk scoring across sessions

**Bypass requirements**:
- Residential proxies ($5-15/GB)
- Realistic browser profiles (fingerprint spoofing)
- Human-like behavioral patterns (randomized timing, mouse movements)
- Session persistence (reuse cookies, don't create fresh sessions constantly)

### Realistic Sustainability Assessment

| Timeframe | Probability of Working | Notes |
|-----------|----------------------|-------|
| 0-6 months | 90% | Initial implementation works well |
| 6-12 months | 75% | First major UI changes, detection upgrades |
| 1-2 years | 50-60% | Continuous cat-and-mouse |
| 2-3 years | 30-40% | Detection outpaces scraping |
| 3+ years | <30% | Unsustainable without API migration |

---

## Part 4: The Dark Horse - IMAP IDLE (Email Push)

### Why This Changes Everything

The current architecture treats email parsing as a "fallback." This is backwards. **Email should be the primary ingestion channel.** Here's why:

### How IMAP IDLE Works

```
Your Server                     Email Provider (Gmail, etc.)
    |                                    |
    |--- IMAP IDLE connection --------->|
    |    (persistent TCP connection)     |
    |                                    |
    |    ... waiting ...                 |
    |                                    |
    |<-- EXISTS notification ---------- | (new email arrives)
    |                                    |
    |--- FETCH email content --------->|
    |<-- Email body + headers ----------|
    |                                    |
    |    Parse OTA notification email    |
    |    Extract: guest, message, booking|
    |                                    |
    |    ... continues waiting ...       |
```

IMAP IDLE maintains a persistent connection to the email server. When a new email arrives, the server **pushes** a notification instantly. No polling. Event-driven. Exactly what you want.

### Why IMAP IDLE Wins

| Factor | IMAP IDLE | Web Scraping | Mobile Automation |
|--------|-----------|-------------|-------------------|
| **Latency** | 2-10 seconds | 60-90 seconds | 1-5 seconds |
| **Resource usage** | 1 TCP connection per mailbox | 150-300 MB per browser | 2-4 GB per emulator |
| **Detection risk** | Zero | Medium-High | High |
| **Legal risk** | Zero | Medium | High |
| **Maintenance** | Very low (email formats stable) | High (UI changes) | Very high (app updates) |
| **Works for all OTAs** | Yes (all send email notifications) | Per-OTA scraper needed | Per-OTA app needed |
| **Cost (50 props)** | ~$0 (email accounts are free) | $500-1,500/mo | $1,000-12,000/mo |
| **Reliability** | 99%+ (email is rock solid) | 85-95% | 70-85% |
| **Scalability** | 1,000+ properties trivially | Hard beyond 100 | Very hard beyond 50 |

### What IMAP IDLE Can Do

Every major OTA sends email notifications for guest messages:

| OTA | Email Notification | Content Included |
|-----|-------------------|-----------------|
| Airbnb | Yes - sends to host email | Guest name, message content (usually full or substantial), reservation ID |
| Booking.com | Yes - sends to property email | Guest name, message content, reservation ID, reply-to relay address |
| Goibibo | Yes - sends to partner email | Booking details, guest queries |
| Agoda | Yes - sends to partner email | Guest messages, booking reference |
| Expedia | Yes - sends to partner email | Guest messages, reservation details |

**Booking.com is especially interesting**: It provides email relay addresses (`hotel-{id}-{res_id}@guest.booking.com`). You can **reply to the email** and the reply goes back to the guest on Booking.com. No scraping needed for outbound either.

### What IMAP IDLE Cannot Do

| Limitation | Impact | Mitigation |
|-----------|--------|-----------|
| Email may truncate long messages | Lose some message content | Accept truncation for MVP; scrape full message only if needed |
| No real-time delivery status | Can't show "delivered/read" | Show "sent via email" status; accept this limitation |
| Email format may vary by locale | Parser needs locale handling | Build flexible parsers with regex + structured extraction |
| Some OTAs may not email all messages | Miss some messages | Use web scraping as secondary/verification layer |
| Outbound only works for email-relay OTAs | Booking.com works; Airbnb doesn't | Use web scraping for outbound on non-relay channels |

### IMAP IDLE Resource Requirements

```
50 properties, each with 1 email account:
- 50 IMAP IDLE connections (persistent TCP)
- Each connection: ~5 KB memory
- Total: ~250 KB + parsing overhead
- One Node.js process can handle 1000+ IMAP connections

Compare:
- Playwright (50 props x 3 channels): 150 browsers x 200MB = 30 GB
- IMAP IDLE (50 props): < 50 MB total
```

That's a **600x reduction in resource usage.**

---

## Part 5: Recommended Architecture - Three-Tier Ingestion

### The Architecture

```
TIER 1: IMAP IDLE (Primary - Event-Driven Ingestion)
────────────────────────────────────────────────────
- IMAP IDLE connection to property's email
- Parses OTA notification emails in real-time
- Extracts: guest name, message content, booking reference, channel
- Routes to Message Normalizer
- Coverage: ALL OTAs (Airbnb, Booking.com, Goibibo, Agoda, Expedia)
- Latency: 2-10 seconds
- Resource: < 50 MB for 50 properties
- Risk: Zero

TIER 2: Web Scraping (Secondary - Enrichment + Outbound)
──────────────────────────────────────────────────────────
- Playwright scrapers for OUTBOUND messages only (sending replies)
- Enrichment scraping: fetch full message if email was truncated
- Booking detail scraping: pull full reservation data
- Triggered ON-DEMAND (by IMAP IDLE events), not polling
- Coverage: Airbnb (outbound), Goibibo, Agoda, Expedia (outbound)
- Not needed for Booking.com (email relay handles outbound)
- Resource: Much lower (only spin up browsers when needed)

TIER 3: Channel-Native (Best Available - Per Channel)
─────────────────────────────────────────────────────
- Booking.com: Email relay (reply to relay address = outbound solved)
- WhatsApp: Baileys/whatsapp-web.js (already event-driven)
- Future: Official APIs as they become available
```

### Data Flow

```
Guest sends message on Airbnb
        │
        ▼
Airbnb sends notification email to host's email
        │
        ▼
IMAP IDLE detects new email (2-10 sec latency)
        │
        ▼
Email Parser extracts: guest name, message, reservation ID
        │
        ├──► Message Normalizer ──► Database ──► WebSocket Push ──► Frontend
        │
        └──► (Optional) Trigger Playwright to fetch full message
             if email content was truncated
        │
        └──► AI Evaluation Queue

Agent replies in Tarksh Inbox
        │
        ▼
Outbound Queue ──► Playwright scraper ──► Airbnb dashboard
                   (on-demand, not always-running)
```

### Why This Is Superior

#### vs Current Architecture (Pure Web Scraping)

| Metric | Current (Polling) | Three-Tier |
|--------|-------------------|-----------|
| Inbound latency | 60-90 seconds | 2-10 seconds |
| Resource usage (50 props) | ~30 GB (always-on browsers) | < 5 GB (on-demand browsers) |
| Detection exposure | High (constant polling) | Low (browsers only for outbound) |
| Monthly cost | $500-1,500 | $100-300 |
| Single point of failure | Scraper breaks = messages lost | Email works even if scraper breaks |

#### vs Mobile Automation

| Metric | Mobile Emulators | Three-Tier |
|--------|-----------------|-----------|
| Inbound latency | 1-5 seconds | 2-10 seconds |
| Resource usage (50 props) | ~150 GB | < 5 GB |
| Detection risk | Very high | Low |
| Legal risk | High | Low |
| Monthly cost | $1,000-12,000 | $100-300 |
| Maintenance burden | Very high (app updates) | Low (email formats stable) |
| Scalability | Hard beyond 50 | Easy to 1000+ |

The only metric where mobile wins is latency (1-5 sec vs 2-10 sec). That's a difference guests will never notice, and it costs 10-100x more.

---

## Part 6: On-Demand Scraping - Making Web Scraping Event-Driven

### The Key Insight

You can get the best of both worlds: **event-driven triggers from IMAP IDLE + web scraping for full data when needed.**

Instead of running 150 always-on Playwright browsers polling every 60 seconds, you:

1. Run zero browsers by default
2. When IMAP IDLE detects a new message email, check if email content is sufficient
3. If sufficient (most cases): save directly, no browser needed
4. If truncated or need booking details: spin up a browser, fetch the full data, shut it down
5. For outbound: spin up a browser only when an agent sends a reply

### Browser Pool Architecture

```
┌─────────────────────────────────────────────────┐
│              Browser Pool Manager                │
│                                                  │
│  Pool size: 5-10 browsers (not 150)              │
│  Strategy: Acquire on demand, release after use  │
│  Session cache: Keep OTA sessions warm in Redis  │
│                                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │Browser 1│ │Browser 2│ │Browser 3│ ...        │
│  │(idle)   │ │(sending │ │(idle)   │            │
│  │         │ │ reply)  │ │         │            │
│  └─────────┘ └─────────┘ └─────────┘           │
└─────────────────────────────────────────────────┘
```

### Resource Savings

| Approach | Always-On Browsers | Peak Browsers | RAM (50 props) |
|----------|-------------------|---------------|----------------|
| Pure polling | 150 | 150 | ~30 GB |
| On-demand (3-channel) | 0 | 10-15 | ~3 GB |
| On-demand + IMAP IDLE | 0 | 5-8 | ~1.5 GB |

**That's a 20x reduction.** You can run 50 properties on a single 4 GB VPS instead of needing a 32 GB server.

---

## Part 7: Per-Channel Strategy Breakdown

### Airbnb

```
INBOUND:  IMAP IDLE (primary) → email parsing → full message in 90% of cases
          On-demand Playwright (if email truncated) → fetch full thread
OUTBOUND: On-demand Playwright → navigate to thread → send reply
FUTURE:   Airbnb API (if partner access obtained)
```

**Why not mobile for Airbnb?**
- Airbnb app has aggressive automation detection (Play Integrity, device attestation)
- Push notifications contain limited content (still need to "open the app")
- Email notifications are reliable and contain substantial message content
- Airbnb's DataDome protection is easier to handle on web than their mobile app security

### Booking.com

```
INBOUND:  IMAP IDLE (primary) → email parsing → full message
OUTBOUND: Email reply to relay address (hotel-{id}-{res}@guest.booking.com)
          Zero scraping needed!
FUTURE:   Booking.com Connectivity Partner API
```

**Booking.com is the easiest channel.** Their email relay system means you never need to scrape at all. Inbound via email, outbound via email reply. This should be the second channel after Airbnb, not lumped into Phase 2.

### WhatsApp

```
INBOUND:  Baileys/whatsapp-web.js (already event-driven, no change)
OUTBOUND: Same library (already event-driven)
FUTURE:   WhatsApp Business API (Phase 2, not Phase 4)
```

No change needed. WhatsApp is already event-driven.

### Goibibo / Agoda / Expedia

```
INBOUND:  IMAP IDLE (primary) → email parsing
          On-demand Playwright (if email insufficient)
OUTBOUND: On-demand Playwright → dashboard automation
FUTURE:   Official APIs as available
```

These channels have less sophisticated anti-scraping than Airbnb/Booking.com, and their email notifications are the most practical primary source.

---

## Part 8: Implementation Considerations

### Email Setup Requirements

For IMAP IDLE to work, properties need to configure email:

**Option 1: Email Forwarding (Simplest)**
- Property sets up auto-forwarding from their OTA notification email to a Tarksh mailbox
- e.g., Forward all Airbnb emails to `property-123@inbox.tarksh.com`
- Tarksh runs IMAP IDLE on its own mailboxes

**Option 2: Direct IMAP Access**
- Property provides IMAP credentials for their email account
- Tarksh connects directly to their Gmail/Outlook/etc
- More invasive but captures all emails

**Option 3: Google/Microsoft OAuth (Best for SaaS)**
- "Connect your Gmail" via OAuth
- Tarksh gets read-only access via Gmail API (with push notifications via Pub/Sub)
- No passwords stored, revocable by user
- Google Workspace Pub/Sub gives real-time push (better than IMAP IDLE)

**Recommendation**: Option 1 for MVP (simplest), Option 3 for Phase 3 SaaS launch.

### Email Parser Architecture

```typescript
interface EmailParser {
  // Detect which OTA sent the email
  detectChannel(email: ParsedEmail): Channel | null;

  // Extract message content
  extractMessage(email: ParsedEmail, channel: Channel): NormalizedMessage;

  // Each channel has its own parser
  parsers: {
    airbnb: AirbnbEmailParser;
    booking_com: BookingComEmailParser;
    goibibo: GoibiboEmailParser;
    agoda: AgodaEmailParser;
    expedia: ExpediaEmailParser;
  };
}

// Detection is based on sender email patterns
const CHANNEL_PATTERNS = {
  airbnb: /(@airbnb\.com|@airbnbmail\.com)/,
  booking_com: /(@booking\.com|@guest\.booking\.com)/,
  goibibo: /(@goibibo\.com|@makemytrip\.com)/,
  agoda: /(@agoda\.com)/,
  expedia: /(@expedia\.com|@hotels\.com)/,
};
```

### Risk: Email Format Changes

Email templates from OTAs do change, but far less frequently than web UIs:

| Change Type | Web UI | Email Templates |
|------------|--------|----------------|
| Layout changes | Monthly | Yearly |
| CSS/class changes | Weekly | N/A (email uses inline styles) |
| Content structure | Monthly | Quarterly |
| Complete redesign | Yearly | Very rare |

Email parsing is roughly **10x more stable** than web scraping. OTAs have strong incentives to keep email notifications working (it's how they communicate with hosts who don't use the dashboard).

### Deduplication Strategy

With IMAP IDLE + on-demand scraping, you might get the same message from both sources. Deduplication is critical:

```
Email arrives → Parse → Extract external_id (booking ref + timestamp hash)
                           │
                           ▼
                  Check: Does message with this external_id exist?
                           │
                  ├── YES → Skip (already ingested)
                  └── NO  → Save to database
```

---

## Part 9: Legal Risk Comparison

### Risk Matrix

| Approach | CFAA Risk | ToS Risk | DMCA Risk | Overall |
|----------|----------|---------|----------|---------|
| Official API | None | None | None | **None** |
| Email parsing (own email) | None | None | None | **None** |
| Email forwarding | None | Low | None | **Very Low** |
| IMAP (OAuth, read-only) | None | Low | None | **Very Low** |
| Web scraping (own account) | Low-Medium | Medium | None | **Medium** |
| Web scraping (customer account) | Medium | Medium | None | **Medium** |
| Mobile app automation | Medium-High | High | Low | **High** |
| Mobile API reverse engineering | High | High | Medium | **Very High** |

### Key Legal Precedent

**Ryanair v. Booking.com (2024)**: Unanimous CFAA jury verdict against Booking.com for automated access to Ryanair's systems. Key holding: CFAA applies to password-gated access even if data is publicly available elsewhere.

**Implication for Tarksh**: Automated access to OTA dashboards using customer credentials could be characterized as "exceeding authorized access" under CFAA. Email parsing of emails already delivered to the customer's own inbox has no such risk.

---

## Part 10: Sustainability Scorecard (3-Year Horizon)

| Factor | Web Scraping | Mobile Automation | IMAP IDLE + On-Demand | Official API |
|--------|-------------|-------------------|----------------------|-------------|
| Will it work in 6 months? | 90% | 70% | 99% | 100% |
| Will it work in 1 year? | 75% | 50% | 98% | 100% |
| Will it work in 3 years? | 40% | 20% | 95% | 100% |
| Detection arms race | Accelerating | Accelerating | N/A | N/A |
| Legal trend | Tightening | Tightening | Stable (safe) | Stable (safe) |
| Maintenance hours/month | 20-40 hrs | 40-80 hrs | 2-5 hrs | 1-2 hrs |
| Can support 500 properties? | Barely | No | Easily | Easily |
| Team skills required | Scraping + anti-detection | Android + RE + Scraping | Email parsing | REST API |

---

## Part 11: Revised Roadmap Recommendation

### Phase 1 (MVP) - Changed

| Component | Old Plan | New Plan |
|-----------|----------|----------|
| Airbnb Inbound | Playwright polling (60-90s) | IMAP IDLE + email parsing (2-10s) |
| Airbnb Outbound | Playwright (always-on browser) | On-demand Playwright (spin up only to send) |
| WhatsApp | Baileys (no change) | Baileys (no change) |
| Infrastructure | Single VPS, ~8GB RAM | Single VPS, ~4GB RAM (sufficient) |
| Scraper budget | $500-1,500/month | $100-300/month |

### Phase 2 - Changed

| Component | Old Plan | New Plan |
|-----------|----------|----------|
| Booking.com | Scraping extranet | **Email relay only** (zero scraping needed) |
| Goibibo/Agoda/Expedia | Per-OTA scrapers | IMAP IDLE + on-demand scraping |
| WhatsApp | Continue Baileys | **WhatsApp Business API** (move from Phase 4) |
| Total scrapers to maintain | 5 (one per OTA) | 3 (Airbnb, Goibibo, Expedia outbound only) |

### Phase 3-4 - Changed

| Component | Old Plan | New Plan |
|-----------|----------|----------|
| Primary ingestion | Still scraping | IMAP IDLE (already primary) |
| API migration urgency | Phase 4 (desperate) | Phase 4 (nice-to-have, email is working fine) |
| Mobile automation | Not planned | Not needed |

---

## Final Verdict

### Mobile Automation: Do Not Pursue

- 10x more expensive than alternatives
- Higher detection risk
- Higher legal risk
- Harder to maintain
- Doesn't even solve the core problem (notifications lack full message content)
- The "no polling" advantage is real but achievable through IMAP IDLE at 1/100th the cost

### IMAP IDLE: Promote from Fallback to Primary

- Near-real-time (2-10 seconds) - good enough for hospitality messaging
- Zero detection risk
- Zero legal risk
- 600x less resource usage than web scraping
- Works for ALL OTAs universally
- 10x more stable than web scraping
- Trivially scalable to 1000+ properties

### Web Scraping: Demote from Primary to On-Demand

- Still needed for outbound messages (sending replies on Airbnb, Goibibo, etc.)
- Still useful for enrichment (fetching full message if email truncated)
- But run on-demand, not as always-on polling
- Reduces resource usage by 20x
- Reduces detection exposure dramatically

### The Bottom Line

The question was "mobile vs web - which is more sustainable?" The answer is **neither, on its own**. The sustainable architecture is:

```
IMAP IDLE (inbound, primary) + On-demand Web Scraping (outbound + enrichment) + Official APIs (when available)
```

This gives you real-time event-driven ingestion (what mobile promised), with the reliability and low risk of email (what web scraping can't match), and web scraping only where truly necessary (outbound delivery).
