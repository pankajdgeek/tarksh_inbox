# MCP Debug Report — zest-living Connector

**Date**: 2026-03-04
**Context**: `get_messages_for_property` deployed to Cloud Run but not appearing in Claude Code

---

## Error 1: `get_messages_for_property` — Tool Not Found

**Call attempted**:
```json
{ "name": "get_messages_for_property", "arguments": { "propertyId": "277117" } }
```

**Error returned**:
```
Error: No such tool available: mcp__zest-living__get_messages_for_property
```

**Root cause**: The MCP client caches the tool manifest from the initial connection. Deploying a new tool to Cloud Run doesn't automatically refresh the client-side tool list.

**Fix**: Disconnect and reconnect the zest-living MCP connector in Claude Code (or whatever client is consuming the MCP server) so it re-fetches the tool manifest.

---

## Error 2: `get_messages` (existing) — Internal Server Error

**Call attempted**:
```json
{ "name": "get_messages", "arguments": { "bookId": "82981657" } }
```

**Error returned**:
```
Error: MCP error -32603: Internal error
```

**Context**: Booking ID `82981657` is valid — `get_booking("82981657")` returns full booking data (guest: Richa Ahuja, channel: Airbnb, property: 277117). The `get_messages` handler is failing server-side for all booking IDs tested.

**Likely cause**: Bug in the existing `get_messages` handler (separate from the new `get_messages_for_property` code). Check server logs:
```bash
gcloud run logs read --service=<service-name> --limit=50 | grep -i "messages\|error"
```

---

## Current Tool Inventory — zest-living MCP

| # | Tool | Status | Notes |
|---|------|--------|-------|
| 1 | `get_property` | Working | Returns empty for some queries |
| 2 | `get_booking` | Working | Tested with `82981657` |
| 3 | `get_availability` | Working | |
| 4 | `get_price_availability` | Working | |
| 5 | `get_booking_info` | Working | |
| 6 | `get_messages` | **Broken** | `-32603 Internal error` for all booking IDs |
| 7 | `send_message` | Untested | |
| 8 | `get_revenue_analytics` | Working | |
| 9 | `get_booking_analytics` | Working | |
| 10 | `get_cxo_dashboard` | Working | |
| 11 | `get_data_quality` | Working | |
| 12 | `get_pipeline_status` | Working | |
| 13 | `get_advance_booking_analytics` | Working | |
| 14 | `get_pricing_config` | Working | |
| 15 | `get_pricing_overview` | Working | |
| 16 | `calculate_pricing` | Working | |
| 17 | **`get_messages_for_property`** | **Not in manifest** | Deployed but client needs reconnect |

---

## Action Items

- [ ] **Reconnect MCP connector** in Claude Code so `get_messages_for_property` appears
- [ ] **Debug `get_messages` handler** — check Cloud Run logs for the `-32603` error on `bookId: 82981657`
- [ ] After reconnect, test: `get_messages_for_property({ propertyId: "277117", limit: 100 })`
- [ ] After reconnect, test: `get_messages_for_property({ propertyId: "252487", limit: 100 })`

---

## What We'll Do With the Messages

Once `get_messages_for_property` is available, we'll:

1. Pull all messages for both properties (277117 + 252487)
2. Analyze guest question patterns — what do guests ask most?
3. Extract host response templates — how does the host actually respond?
4. Enrich KB `custom_faqs` with real Q&A pairs from conversations
5. Identify missing KB fields — topics guests ask about that aren't in the KB yet
6. Calibrate `response_preferences.tone` to match the host's actual style
