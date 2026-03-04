# Phase 1: Complete API Endpoint Specification

> Source of truth for all REST API endpoints. Frontend and backend MUST match these contracts.
> TypeScript types: `packages/shared/src/types/api.ts`
> Base URL: `/api/v1`

---

## API Conventions

| Convention | Rule |
|-----------|------|
| Auth | All endpoints (except `/auth/*`) require `Authorization: Bearer <jwt>` |
| Tenant isolation | Every DB query filtered by `org_id` from JWT payload |
| Pagination | `?page=1&limit=20` (max 100) |
| Sorting | `?sort_by=created_at&sort_order=desc` |
| Errors | RFC 7807 ProblemDetails: `{ success: false, error: { code, message, status } }` |
| Dates | ISO 8601 strings in JSON: `"2026-03-03T14:30:00.000Z"` |
| IDs | UUID v4 strings |

### HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success (GET, PATCH) |
| 201 | Created (POST) |
| 204 | No Content (DELETE) |
| 400 | Validation error (Zod) |
| 401 | Unauthorized (missing/invalid JWT) |
| 403 | Forbidden (wrong role or org) |
| 404 | Resource not found |
| 409 | Conflict (duplicate, optimistic lock) |
| 422 | Unprocessable (business logic error) |
| 429 | Rate limited |
| 500 | Internal server error |

---

## Endpoint Index

### Auth (Sprint 1)
| Method | Path | Task | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | T-036 | Login with email + password |
| POST | `/auth/refresh` | T-037 | Refresh access token |
| POST | `/auth/logout` | T-040 | Invalidate refresh token |
| GET | `/auth/me` | T-038 | Get current user profile |

### Properties (Sprint 2)
| Method | Path | Task | Description |
|--------|------|------|-------------|
| POST | `/properties` | T-043 | Create property |
| GET | `/properties` | T-044 | List properties |
| GET | `/properties/:id` | T-045 | Get property detail |
| PATCH | `/properties/:id` | T-046 | Update property |
| DELETE | `/properties/:id` | T-047 | Soft delete property |
| GET | `/properties/:id/knowledge-base` | T-048 | Get KB |
| PUT | `/properties/:id/knowledge-base` | T-048 | Update KB |

### Channels (Sprint 2)
| Method | Path | Task | Description |
|--------|------|------|-------------|
| POST | `/properties/:id/channels` | T-049 | Add channel connection |
| GET | `/properties/:id/channels` | T-050 | List channels |
| PATCH | `/channels/:id` | T-051 | Update channel config |
| DELETE | `/channels/:id` | T-052 | Remove channel |
| GET | `/channels/:id/health` | T-053 | Channel health status |

### Email (Sprint 2)
| Method | Path | Task | Description |
|--------|------|------|-------------|
| POST | `/properties/:id/email` | T-054 | Add email connection |
| GET | `/properties/:id/email` | T-054 | Get email connection |
| PATCH | `/properties/:id/email` | T-054 | Update email connection |
| DELETE | `/properties/:id/email` | T-054 | Remove email connection |
| POST | `/email/test` | T-055 | Test IMAP connection |

### Conversations (Sprint 5)
| Method | Path | Task | Description |
|--------|------|------|-------------|
| GET | `/conversations` | T-093 | List conversations (paginated, filterable) |
| GET | `/conversations/:id` | T-093 | Get conversation detail |
| PATCH | `/conversations/:id` | T-166+ | Update status, assignment, star |
| GET | `/conversations/:id/messages` | T-098 | List messages in conversation |
| POST | `/conversations/:id/messages` | T-103 | Send message (queue outbound) |

### Templates (Sprint 9)
| Method | Path | Task | Description |
|--------|------|------|-------------|
| POST | `/templates` | T-160 | Create template |
| GET | `/templates` | T-160 | List templates |
| GET | `/templates/:id` | T-160 | Get template |
| PATCH | `/templates/:id` | T-160 | Update template |
| DELETE | `/templates/:id` | T-160 | Delete template |
| POST | `/templates/:id/resolve` | T-163 | Resolve variables |

### AI (Sprint 8)
| Method | Path | Task | Description |
|--------|------|------|-------------|
| GET | `/conversations/:id/ai-evaluations` | T-154 | List AI evaluations |
| POST | `/conversations/:id/ai/approve` | T-158 | Approve AI draft |
| POST | `/conversations/:id/ai/discard` | T-158 | Discard AI draft |
| POST | `/conversations/:id/ai/cancel` | T-155 | Cancel pending evaluation |

### Users (Sprint 10)
| Method | Path | Task | Description |
|--------|------|------|-------------|
| GET | `/users` | T-188 | List users |
| POST | `/users/invite` | T-189 | Invite user |
| PUT | `/users/:id/properties` | T-190 | Assign properties |

### 2FA (Sprint 6)
| Method | Path | Task | Description |
|--------|------|------|-------------|
| GET | `/channels/:id/tfa` | T-122 | Get active 2FA challenge |
| POST | `/channels/:id/tfa/submit` | T-122 | Submit 2FA code |

### Health (Sprint 10)
| Method | Path | Task | Description |
|--------|------|------|-------------|
| GET | `/health` | T-185 | System health check |

### Organization (Sprint 1)
| Method | Path | Task | Description |
|--------|------|------|-------------|
| GET | `/organization` | T-021 | Get org details |
| PATCH | `/organization` | T-021 | Update org settings |

---

## Detailed Endpoint Specifications

### POST /auth/login

```
Request:
  Body:
    email: string (required, valid email)
    password: string (required, min 8 chars)

Response 200:
  {
    success: true,
    data: {
      access_token: "eyJ...",        // JWT, 15min expiry
      refresh_token: "abc123...",     // Also set as httpOnly cookie
      expires_in: 900,
      user: {
        id: "uuid",
        name: "Pankaj",
        email: "pankaj@tarksh.com",
        role: "admin",
        org_id: "uuid",
        org_name: "Tarksh Properties"
      }
    }
  }

Response 401:
  {
    success: false,
    error: {
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password",
      status: 401
    }
  }

JWT Payload:
  {
    sub: "user_id",
    org_id: "org_uuid",
    role: "admin",
    iat: 1709472000,
    exp: 1709472900
  }
```

### GET /conversations

```
Request:
  Query params:
    page: number (default 1)
    limit: number (default 20, max 100)
    status: string | string[] (unread, pending, replied, resolved, starred)
    channel: string | string[] (airbnb, booking_com, whatsapp)
    property_id: string (UUID, filter by property)
    assigned_to: string (UUID or "unassigned")
    is_starred: boolean
    search: string (full-text search across messages)
    date_from: string (ISO date)
    date_to: string (ISO date)
    sort_by: string (default "last_message_at")
    sort_order: string (default "desc")

Response 200:
  {
    success: true,
    data: {
      items: [
        {
          id: "conv-uuid",
          guest: {
            id: "guest-uuid",
            name: "John Smith",
            avatar_url: null
          },
          property: {
            id: "prop-uuid",
            name: "Sunset Villa"
          },
          booking: {
            id: "booking-uuid",
            check_in: "2026-03-10",
            check_out: "2026-03-13",
            status: "confirmed"
          },
          status: "unread",
          primary_channel: "airbnb",
          last_message_at: "2026-03-03T10:30:00Z",
          last_message_preview: "What's the WiFi password?",
          unread_count: 2,
          is_starred: false,
          assigned_to: null,
          ai_enabled: true,
          locked_by: null,
          created_at: "2026-03-01T08:00:00Z"
        }
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 47,
        total_pages: 3,
        has_next: true,
        has_prev: false
      }
    }
  }

SQL (simplified):
  SELECT c.*, g.name as guest_name, p.name as property_name
  FROM conversations c
  JOIN guests g ON c.guest_id = g.id
  JOIN properties p ON c.property_id = p.id
  LEFT JOIN bookings b ON c.booking_id = b.id
  WHERE c.org_id = $org_id
    AND ($status IS NULL OR c.status = ANY($status))
    AND ($channel IS NULL OR c.primary_channel = ANY($channel))
    AND ($property_id IS NULL OR c.property_id = $property_id)
  ORDER BY c.last_message_at DESC
  LIMIT $limit OFFSET ($page - 1) * $limit;

Performance notes:
  - Uses idx_conversations_org_last_msg index
  - Full-text search uses idx_messages_content_search (GIN)
  - Full-text adds a subquery: WHERE c.id IN (
      SELECT DISTINCT conversation_id FROM messages
      WHERE to_tsvector('english', content) @@ plainto_tsquery($search)
    )
```

### POST /conversations/:id/messages

```
Request:
  Params:
    id: string (conversation UUID)
  Body:
    content: string (required, max 5000 chars)
    channel: string (optional, override primary channel)
    is_internal_note: boolean (optional, default false)
    ai_evaluation_id: string (optional, if approving AI draft)

Response 201:
  {
    success: true,
    data: {
      id: "msg-uuid",
      content: "The WiFi password is SunsetVilla2024",
      sender_type: "agent",
      channel: "airbnb",
      delivery_status: "queued",
      sent_at: "2026-03-03T10:35:00Z"
    }
  }

Side effects:
  1. Save Message to DB (delivery_status = 'queued')
  2. Update conversation.last_message_at, .last_message_preview
  3. Set conversation.status = 'replied'
  4. Add job to 'channel-outbound' BullMQ queue
  5. Release conversation lock
  6. WebSocket: emit 'new_message' to org room
  7. WebSocket: emit 'delivery_status' as status changes
  8. If ai_evaluation_id provided: update AIEvaluation.was_sent = true
```

### PUT /properties/:id/knowledge-base

```
Request:
  Params:
    id: string (property UUID)
  Body:
    data: object (partial KnowledgeBaseData — merge with existing)
    version: number (required — must match current KB version)

Response 200:
  {
    success: true,
    data: {
      id: "kb-uuid",
      property_id: "prop-uuid",
      data: { ...merged KB data... },
      version: 3,
      updated_at: "2026-03-03T10:40:00Z"
    }
  }

Response 409 (optimistic lock failure):
  {
    success: false,
    error: {
      code: "VERSION_CONFLICT",
      message: "KB was modified by another user. Refresh and retry.",
      status: 409,
      details: {
        current_version: 3,
        provided_version: 2
      }
    }
  }

Side effects:
  1. Invalidate AI response cache for this property
     (Redis: DEL ai:response:{property_id}:*)
  2. Emit 'kb:updated' internal event
```

### GET /health

```
Response 200 (healthy):
  {
    success: true,
    data: {
      status: "healthy",
      version: "1.0.0",
      uptime_seconds: 86400,
      checks: {
        database: { status: "ok", latency_ms: 2 },
        redis: { status: "ok", latency_ms: 1 },
        imap_connections: {
          status: "ok",
          active: 47,
          total: 50,
          errored: 3
        },
        browser_pool: {
          status: "ok",
          available: 8,
          in_use: 2,
          total: 10
        },
        whatsapp: {
          status: "ok",
          connected: 12,
          disconnected: 1
        },
        queues: {
          ai_evaluation: { waiting: 3, active: 2, failed: 0, delayed: 1 },
          channel_outbound: { waiting: 1, active: 1, failed: 0, delayed: 0 }
        }
      }
    }
  }

Response 503 (unhealthy):
  {
    success: true,
    data: {
      status: "unhealthy",
      ...same structure with failing checks...
    }
  }

Logic:
  - "healthy": all core checks pass (DB, Redis, at least 1 IMAP up)
  - "degraded": some non-critical checks failing (browser pool low, some IMAP errors)
  - "unhealthy": DB or Redis down, or 0 IMAP connections
```

---

## Rate Limiting Specification (T-198)

```
Per-IP limits (all endpoints):
  - 100 requests per minute
  - 429 response with Retry-After header

Per-user limits:
  - POST /conversations/:id/messages: 10 per minute (prevent message spam)
  - POST /auth/login: 5 per minute (prevent brute force)
  - POST /email/test: 3 per minute (prevent IMAP abuse)

Headers returned:
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 95
  X-RateLimit-Reset: 1709473000
```

---

## Error Code Reference

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Zod validation failed |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `TOKEN_EXPIRED` | 401 | JWT expired |
| `TOKEN_INVALID` | 401 | JWT malformed or revoked |
| `FORBIDDEN` | 403 | Insufficient role permissions |
| `NOT_FOUND` | 404 | Resource doesn't exist or wrong org |
| `VERSION_CONFLICT` | 409 | Optimistic lock version mismatch |
| `DUPLICATE_ENTRY` | 409 | Unique constraint violation |
| `CONVERSATION_LOCKED` | 422 | Another agent is replying |
| `CHANNEL_DISCONNECTED` | 422 | Can't send — channel is down |
| `KB_EMPTY` | 422 | KB has no data for AI to use |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
