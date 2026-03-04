# Tarksh Inbox - Product Outline

## Problem Statement

Property managers in the hospitality industry juggle 5-10 different OTA dashboards (Airbnb, Booking.com, Agoda, Expedia, Goibibo) plus WhatsApp to handle guest communications. This fragmentation leads to:

- **Missed messages**: Guests reach out on different platforms; some messages slip through
- **Slow response times**: Switching between dashboards wastes time; response times average 2+ hours
- **No unified guest view**: The same guest may message on Airbnb and WhatsApp - there's no single thread
- **Repetitive manual work**: 70-80% of guest queries are routine (check-in time, WiFi password, directions)
- **No after-hours coverage**: When the team is offline, guests wait

## Product Vision

**One-liner**: A unified inbox that pulls guest messages from all OTAs and WhatsApp into one place, with an AI agent that can respond on behalf of the property.

### What Tarksh Inbox Does

1. **Aggregates** all guest messages from Airbnb, Booking.com, Goibibo, Agoda, Expedia, and WhatsApp into a single inbox
2. **Threads** conversations by guest - not by channel - so you see the full picture
3. **Surfaces** booking context alongside every conversation (dates, property, amount, guests)
4. **Enables** direct replies that route back through the original channel
5. **Deploys** an AI agent that handles routine queries automatically, escalating complex ones to humans

### Core Value Propositions

| Value Prop | Before | After |
|-----------|--------|-------|
| **Never miss a message** | Checking 5+ dashboards manually | One inbox, real-time notifications |
| **Respond faster** | 2+ hour average response time | < 5 minutes (AI handles most instantly) |
| **Unified guest view** | Fragmented across channels | Single conversation thread per guest |
| **Reduce workload** | Manual replies to repetitive questions | AI auto-resolves 60%+ of routine queries |
| **24/7 coverage** | Guests wait when team is offline | AI agent responds around the clock |

## Product Type

- **SaaS** for the hospitality industry
- **Target market**: Property managers, hoteliers, vacation rental operators
- **Integration approach**: Scraping/automation first (pragmatic MVP), official APIs later
- **AI scope**: Full guest lifecycle - pre-booking to post-checkout

## Target Users & Personas

### 1. Property Manager
- **Who**: Manages 5-50 properties across multiple OTAs
- **Pain**: Constantly switching between dashboards, slow response times, missed messages
- **Value**: Single inbox replaces 5+ dashboards, AI handles routine queries
- **Key need**: Multi-property view, delegation to team members

### 2. Hotel Front Desk
- **Who**: Small-medium hotels (10-100 rooms)
- **Pain**: High volume of repetitive questions, no coverage after hours
- **Value**: AI handles FAQs 24/7, staff focuses on complex guest needs
- **Key need**: High volume message handling, consistent response quality

### 3. Vacation Rental Host
- **Who**: Individual or small portfolio (1-10 listings)
- **Pain**: Can't monitor all channels 24/7, language barriers with international guests
- **Value**: AI monitors and responds on all channels continuously
- **Key need**: Set-and-forget automation, multi-language support

### 4. Operations Manager
- **Who**: Oversees a team of agents handling guest communications
- **Pain**: No visibility into response quality, can't enforce consistency
- **Value**: Dashboard with response metrics, AI ensures consistent tone
- **Key need**: Analytics, team performance tracking, quality controls

## Product Principles

1. **Channel-agnostic**: The guest experience should feel the same regardless of which OTA they booked through
2. **AI-assisted, human-controlled**: AI handles the routine; humans handle the exceptional. The human always has override control
3. **Property-aware**: Every response is grounded in property-specific knowledge (not generic)
4. **Reliability first**: If scraping breaks, email parsing kicks in. Never silently lose a message
5. **Progressive enhancement**: Start simple (manual replies + basic AI), grow into full lifecycle automation
