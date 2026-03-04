# MCP Tool Requirements — zest-living Connector

## Status Tracker

| # | Tool | Status | Date |
|---|------|--------|------|
| 1 | `get_messages` | Fixed | 2026-03-04 |
| 2 | `get_messages_for_property` | Deployed, needs client reconnect | 2026-03-04 |
| 3 | `get_bookings_for_property` | **Requested** | 2026-03-04 |

---

## Tool Request: `get_bookings_for_property`

### Why

Currently the MCP only has `get_booking` (single booking by ID). There's no way to discover booking IDs for a property. This blocks the KB enrichment workflow:

```
get_bookings_for_property(propertyId) → booking IDs
    → get_messages(bookId) for each → analyze → enrich KB
```

Without this tool, we can't iterate over a property's bookings to pull conversations.

### Beds24 API Endpoint

```
GET /v2/bookings?propertyId={id}&arrivalFrom={date}&arrivalTo={date}
```

### MCP Tool Schema

**Name**: `get_bookings_for_property`

**Description**: List bookings for a property with optional date and status filters. Returns booking details including guest name, channel, room, dates, and message count.

### Parameters

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `propertyId` | string | Yes | — | Beds24 property ID (e.g. `"277117"`) |
| `status` | string | No | `"confirmed"` | Filter: `confirmed`, `cancelled`, `new`, `request` |
| `arrivalFrom` | string | No | 90 days ago | Start date filter `YYYY-MM-DD` |
| `arrivalTo` | string | No | today | End date filter `YYYY-MM-DD` |
| `limit` | number | No | `50` | Max bookings to return |

### Expected Response

Array of booking objects:

```json
[
  {
    "bookId": "82981657",
    "guestName": "Richa Ahuja",
    "channel": "airbnb",
    "roomId": "579123",
    "roomName": "The Executive Escape",
    "status": "confirmed",
    "checkIn": "2026-03-02",
    "checkOut": "2026-03-08",
    "nights": 6,
    "numGuests": 1,
    "totalPrice": 12500,
    "hasMessages": true,
    "messageCount": 40
  },
  {
    "bookId": "82345678",
    "guestName": "John Doe",
    "channel": "booking_com",
    "roomId": "622063",
    "roomName": "Jacuzzi Terrace",
    "status": "confirmed",
    "checkIn": "2026-02-25",
    "checkOut": "2026-02-27",
    "nights": 2,
    "numGuests": 2,
    "totalPrice": 8500,
    "hasMessages": false,
    "messageCount": 0
  }
]
```

### Key Fields

| Field | Why Needed |
|-------|-----------|
| `bookId` | To call `get_messages(bookId)` for each booking |
| `channel` | To understand message patterns per OTA (Airbnb vs Booking.com vs Goibibo) |
| `roomId` / `roomName` | To map conversations to specific room types in KB |
| `hasMessages` / `messageCount` | To skip zero-message bookings and save API calls |
| `nights` | To correlate stay length with conversation complexity |
| `totalPrice` | Context for revenue-related guest queries |

### Implementation Notes

- `messageCount` can be derived from Beds24 `GET /v2/bookings/{id}/messages` count, or if that's expensive, just include `hasMessages: true/false` based on whether any messages exist
- Sort by `checkIn` descending (most recent first)
- If `messageCount` is too expensive per-booking, drop it and just return all bookings — we'll call `get_messages` and handle empty results

---

## Downstream Workflow

Once `get_bookings_for_property` is live:

```
1. get_bookings_for_property("277117", limit: 50)
   → Returns 50 recent bookings with hasMessages flag

2. Filter bookings where hasMessages = true
   → ~15-20 bookings with actual conversations

3. get_messages(bookId) for each
   → Pull full conversation threads

4. Analyze patterns across all conversations:
   - Top guest questions by frequency
   - Host response templates and tone
   - Missing KB topics
   - Channel-specific patterns (Airbnb guests ask X, Booking.com guests ask Y)

5. Enrich KB custom_faqs with real Q&A pairs
   - Replace generic FAQs with actual guest-host exchanges
   - Add new FAQs for topics not currently covered

6. Repeat for property 252487
```

---

## Properties to Process

| Property ID | Name | Rooms | Est. Bookings (90d) |
|-------------|------|-------|---------------------|
| `277117` | Zest.Living — Golf Course Road, Sector 42 | The Executive Escape (579123), Jacuzzi Terrace (622063) | ~200+ |
| `252487` | Zest.Living — Golf Course Road, Sector 55 | 1BHK Apartment (537986), 1RK Studio (537985) | ~150+ |
