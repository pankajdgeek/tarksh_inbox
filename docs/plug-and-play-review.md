# Tarksh Inbox - Plug-and-Play Architecture Review

**Date**: 2026-03-03
**Scope**: Review all system documentation for modularity, extensibility, and plug-and-play design.

---

## Executive Summary

**Overall Modularity Score: 4/10**

The inbound side is well-designed (parser interface, normalized schema, EventBus). But the outbound side, channel management, AI integration, and cross-cutting concerns (queues, notifications, health) are tightly coupled. Adding a new channel today would require touching 10+ files across 6+ modules.

---

## What's Already Good

### 1. OTAEmailParser Interface

`channel-integrations.md` defines a clean contract:

```typescript
interface OTAEmailParser {
  canParse(email: ParsedEmail): boolean;
  parse(email: ParsedEmail): NormalizedMessage;
  isContentTruncated(email: ParsedEmail): boolean;
}
```

Adding a new email parser = implement this interface. Proper plug-and-play.

### 2. NormalizedMessage Schema

All channels normalize to one format. Downstream code (DB, WebSocket, AI) doesn't care where the message came from.

### 3. EventBus Pattern

Modules communicate via events, not direct imports. Email-ingest emits `message:received`, inbox module handles it. Clean decoupling that enables future service extraction.

### 4. Service Boundaries

Logical module separation under `/src/modules/`. Each module owns its domain. Well-structured for a monolith-first approach.

### 5. Three-Tier Ingestion

Channels can independently use any tier (IMAP, scraping, native). Booking.com uses email relay while Airbnb uses scraping. Good separation of concerns.

---

## What's NOT Plug-and-Play

### CRITICAL — Will cause pain every time you add a channel

#### C1. Hardcoded Channel Union Type — No Registry

`NormalizedMessage.channel` is typed as a literal union:

```typescript
channel: 'airbnb' | 'booking_com' | 'whatsapp' | 'goibibo' | 'agoda' | 'expedia';
```

This union appears in `NormalizedMessage`, `ChannelConnection`, `TFAChallenge`, `TFA_SELECTORS`, `CHANNEL_PATTERNS`, outbound queue routing, rate limits, and health checks. Adding a new channel (e.g., `hostelworld`) means hunting down and updating **10-15 locations** across multiple files.

**Fix**: Channel registry pattern. See updated `architecture.md` for the `ChannelAdapter` interface and `ChannelRegistry` design.

#### C2. No ChannelOutboundSender Interface

There's a clean `OTAEmailParser` interface for inbound, but nothing equivalent for outbound. Each channel's outbound sending is described in prose but never abstracted into a common interface.

**Fix**: `ChannelOutboundSender` interface — see updated `channel-integrations.md`.

#### C3. No Channel Capability Declaration

The system implicitly assumes all channels work the same way. But they don't:

| Capability | Airbnb | WhatsApp | Booking.com |
|-----------|--------|----------|-------------|
| Read receipts | No | Yes | No |
| Typing indicator | No | Yes | No |
| Media messages | Phase 2 | Yes | No |
| Reply threading | Yes | No | N/A |
| Delivery confirmation | Scrape-verify | Native | Email bounce |

Without capability declarations, the frontend and AI agent can't adapt per channel.

**Fix**: Each channel adapter declares its capabilities — see updated `architecture.md`.

---

### HIGH — Will cause unnecessary coupling and rework

#### H1. AI Provider Hardcoded to Claude

`AIAgentService` references Haiku and Sonnet directly. No `LLMProvider` interface. Prevents:
- Using cheaper models for certain properties
- A/B testing providers for response quality
- Falling back when Claude is down
- Enterprise customers bringing their own API key

**Fix**: `LLMProvider` interface — see updated `ai-agent.md`.

#### H2. No Middleware/Hook System for Message Processing

The message flow is fixed: parse → normalize → save → push WebSocket → queue AI. No way to inject custom processing without modifying core code. Real-world needs:
- Auto-translate messages
- Spam/scam detection before AI evaluation
- PII redaction for compliance
- Custom routing rules per property
- Analytics hooks
- Auto-tagging (sentiment, urgency)

**Fix**: Message processing pipeline with hooks — see updated `architecture.md`.

#### H3. Knowledge Base Schema is a Flat Untyped Blob

The KB is a JSONB field with a hardcoded structure. Problems:
- No validation schema
- Not extensible per property type (hotel vs villa vs hostel vs boat)
- AI intent → KB field mapping is string-based with no formal registry
- Can't add custom KB sections (e.g., marina_location for boats)

**Fix**: Typed KB schema with Zod validation + optional custom sections + intent-to-KB field registry — see updated `ai-agent.md`.

#### H4. Queue System (BullMQ) Has No Abstraction

BullMQ is referenced directly in every module that uses queues. Prevents:
- Using SQS on AWS deployment
- Using Cloud Tasks on GCP
- Using in-memory queue for local dev/testing

**Fix**: `JobQueue` interface — see updated `architecture.md`.

#### H5. Notification Service Not Abstracted

2FA relay mentions "push notification" and "email alert" but no notification provider interface. Prevents adding Slack, SMS, webhooks, Firebase push.

**Fix**: `NotificationProvider` interface — see updated `architecture.md`.

---

### MEDIUM — Nice to have for extensibility

#### M1. Rate Limits Hardcoded Per Channel

Static table of rate limits. Not configurable per-connection. No rate limit strategy interface.

**Fix**: Make rate limits part of channel adapter config with per-connection overrides.

#### M2. Anti-Detection Strategies Are Prose, Not Codified

"Human-like typing", "randomized delays" described in text but no `HumanBehaviorSimulator` abstraction. Each scraper would re-implement these.

**Fix**: `HumanBehaviorSimulator` interface shared across all Playwright-based senders.

#### M3. Template Engine Not Abstracted

Templates use `{{variable}}` substitution with no defined engine. Missing: conditional sections, loops, localization.

#### M4. Health Check is a Monolithic Blob

The `/health` endpoint returns everything in one response. No way to register health checks from plugins dynamically.

**Fix**: Health check registry where channel adapters auto-register their checks.

---

## Summary Scorecard

| Area | Plug-and-Play? | Rating |
|------|---------------|--------|
| Inbound email parsing | Yes (`OTAEmailParser` interface) | 9/10 |
| Message normalization | Yes (`NormalizedMessage` schema) | 9/10 |
| Module boundaries | Yes (EventBus + `/modules/`) | 8/10 |
| Tier selection per channel | Yes (channels pick tiers independently) | 8/10 |
| **Channel registration** | **No (hardcoded union, no registry)** | **2/10** |
| **Outbound sending** | **No (no common sender interface)** | **2/10** |
| **Channel capabilities** | **No (implicit, not declared)** | **1/10** |
| **AI provider** | **No (Claude hardcoded)** | **3/10** |
| **Message pipeline hooks** | **No (fixed pipeline, no middleware)** | **2/10** |
| **Queue system** | **No (BullMQ direct references everywhere)** | **3/10** |
| **KB extensibility** | **Partial (JSONB but no schema/validation)** | **4/10** |
| Notification providers | No (hardcoded channels) | 3/10 |
| Health checks | No (static blob) | 4/10 |
| Rate limiting | No (hardcoded per channel) | 3/10 |

---

## Recommended Fix Priority

| Priority | Fix | Effort | Impact |
|----------|-----|--------|--------|
| **P0** | Channel registry + adapter pattern (C1+C2+C3) | Medium | Every future channel = single-folder drop-in |
| **P1** | `LLMProvider` interface (H1) | Low | AI provider swappable |
| **P1** | Message processing pipeline/hooks (H2) | Medium | Translate, spam filter, analytics without core changes |
| **P1** | Queue abstraction (H4) | Low | Testing + deployment flexibility |
| **P2** | KB schema validation + extensibility (H3) | Medium | Data integrity + per-property-type flexibility |
| **P2** | Notification provider interface (H5) | Low | Enables Slack, SMS, webhook notifications |
| **P3** | Health check registry (M4) | Low | Channels auto-register health checks |
| **P3** | Rate limit configurability (M1) | Low | Per-connection tuning |
| **P3** | Behavior simulator abstraction (M2) | Low | Shared anti-detection across scrapers |

The **single highest-ROI fix** is the channel registry + adapter pattern (C1+C2+C3). It transforms channel integration from scattered multi-file surgery into "implement interface, drop in folder, done."

---

## Documents Updated

All fixes have been incorporated into the architecture docs:

- `architecture.md` — Channel registry, adapter interfaces, message pipeline, queue abstraction, notification provider, health registry
- `channel-integrations.md` — ChannelAdapter interface, outbound sender contract, capability declarations
- `ai-agent.md` — LLMProvider interface, KB schema validation, intent-to-KB registry
- `2fa-handling.md` — 2FA handling moved into channel adapter pattern
