# Tarksh Inbox - Feature Specifications (MVP)

## Overview

This document details the MVP feature set for Tarksh Inbox. MVP focuses on:
- All OTA channels via Beds24 API (Airbnb, Booking.com, Goibibo) + WhatsApp
- Manual replies + basic AI
- Single-tenant (Tarksh internal use first)

---

## F1: Unified Inbox

The core UI where all guest messages are viewed and managed.

### F1.1 Message Feed

**Description**: A chronological list of all conversations across connected channels.

**Behavior**:
- Displays conversations sorted by most recent message (newest on top)
- Each conversation row shows: guest name, last message preview (truncated), channel icon, property name, timestamp, unread indicator
- Clicking a conversation opens the full message thread in the detail panel
- New messages push to the top in real-time (no manual refresh needed)

**States per conversation**:
- `unread` - Has messages not yet seen by any team member
- `pending` - Read but not yet replied
- `replied` - Most recent message is from the team/AI
- `resolved` - Marked as resolved (archived)
- `starred` - Flagged for follow-up

### F1.2 Conversation Detail Panel

**Description**: Full message thread for a selected conversation.

**Layout**:
- **Header**: Guest name, channel(s) used, property name, conversation status
- **Message thread**: Chronological list of all messages in the conversation
  - Each message shows: sender (guest / agent name / AI), content, timestamp, channel tag
  - AI-generated messages are visually distinct (different background/icon)
  - Messages from different channels within the same conversation are tagged
- **Reply composer**: Text input at the bottom with send button
- **Booking context sidebar** (right panel): Booking details pulled alongside

### F1.3 Booking Context Sidebar

**Description**: When a conversation is linked to a booking, display booking details alongside.

**Fields displayed**:
- Booking ID / confirmation code
- Property name
- Check-in / check-out dates
- Number of guests (adults + children)
- Booking amount
- Booking status (confirmed / cancelled / checked-in / checked-out)
- Channel the booking came from
- Special requests (if available)

**Linking logic**: Conversations are linked to bookings by matching guest identity (name + channel identifier) with booking records.

### F1.4 Filters & Search

**Filters**:
- By channel: Airbnb, Booking.com, Goibibo, WhatsApp (all available from Phase 1 via Beds24)
- By property: Dropdown of connected properties
- By status: Unread, Pending, Replied, Resolved, Starred
- By date range: Last 24h, last 7 days, last 30 days, custom range
- By assigned agent: Who the conversation is assigned to

**Search**:
- Full-text search across all message content
- Search by guest name
- Results show matching conversations with the relevant message highlighted

### F1.5 Real-Time Updates

**Behavior**:
- New incoming messages appear instantly without page refresh
- Browser notification when a new message arrives (if permitted)
- Sound notification (configurable on/off)
- Unread count badge in the browser tab title
- If user is viewing a conversation and a new message arrives in it, auto-scroll to the new message

---

## F2: Channel Connections

### F2.0 Beds24 Connection (Required — Powers All OTA Channels)

**Description**: Beds24 API integration that connects all OTA channels (Airbnb, Booking.com, Goibibo) through a single API key. Beds24 is the existing channel manager already connected to these OTAs.

**Connection flow (MVP)**:
1. User navigates to Settings > Integrations > Beds24
2. Enter Beds24 API key (obtained from Beds24 account settings)
3. System validates API key and fetches property list from Beds24
4. Map Beds24 properties to Tarksh properties (auto-match by name or manual selection)
5. System configures webhook URL in Beds24 for real-time notifications
6. Status indicator: Connected / Error / Properties mapped

**How it works**:
- Beds24 webhooks push notifications when new guest messages arrive (< 30 sec)
- Polling fallback checks for new messages every 60 seconds (if webhooks not configured)
- All OTA messages (Airbnb, Booking.com, Goibibo) arrive through the same Beds24 API
- Messages appear in the unified inbox automatically

**What the user sees**:
- "Beds24 Connected" status badge in Settings
- List of connected OTA channels (auto-detected from Beds24)
- Last message received timestamp
- Messages synced today count
- Error indicator if API connection fails

### F2.1 OTA Channels via Beds24 (MVP — Airbnb, Booking.com, Goibibo)

**Inbound (via Beds24 API)**:
- Guest messages from all connected OTAs arrive through Beds24 webhooks or polling
- Source OTA (Airbnb, Booking.com, Goibibo) identified from booking metadata
- Messages appear in inbox with correct OTA channel icon
- Full message content available (no truncation issues like with email parsing)

**Outbound (via Beds24 API)**:
- Replies sent from unified inbox are delivered through Beds24 API
- No browser automation, no OTA credentials needed
- Simple API call: `send_message(bookId, message)`
- Delivery status shown: Sending → Confirmed or Failed
- On failure: red banner with retry option

**Booking context (auto-populated)**:
- Booking details fetched automatically from Beds24 API on first guest message
- Check-in/out dates, guest count, amount, status — all available immediately
- No manual entry or scraping required

### F2.2 WhatsApp Connection (MVP)

**Connection flow**:
1. User navigates to Settings > Channels > WhatsApp
2. QR code displayed for WhatsApp Web pairing
3. User scans with their WhatsApp app
4. Once paired, system begins receiving messages
5. Connection health check every 5 minutes

**Message sync**:
- Real-time message reception via WhatsApp Web connection (event-driven)
- Support text messages (images/files deferred to later)
- Associate WhatsApp messages with existing guests by phone number matching

**Outbound messaging**:
- Replies sent from unified inbox are delivered through WhatsApp
- Message delivery status (sent / delivered / read) shown
- Typing indicator shown before sending (human-like)

**Health**:
- Prominent "WhatsApp Connected ✓" / "Disconnected ✗" indicator
- If disconnected: "Reconnect" button shows QR code for re-scanning
- Note to user: "WhatsApp may require periodic reconnection"

### F2.3 Channel Health Monitoring

**Dashboard showing per-channel status**:
- **Beds24 API**: Connected/Error, last message received, last API call timestamp
- **Beds24 Webhooks**: Active/Not configured, last webhook received
- **WhatsApp**: Connected/Disconnected, last message timestamp
- **Per-OTA status**: Airbnb / Booking.com / Goibibo activity indicators (from Beds24 data)

**Auto-recovery**:
- Beds24 API retry on failure (exponential backoff: 1s, 5s, 15s)
- Automatic webhook → polling fallback if webhooks stop arriving
- Alert if Beds24 API unreachable for > 2 minutes
- Alert if WhatsApp disconnected (prompt QR re-scan)
- Manual reconnect buttons for each channel

**Outbound delivery monitoring**:
- "Unsent messages" indicator if any outbound messages are in `failed` state
- Click to see failed messages with retry option

---

## F3: Response System

### F3.1 Manual Reply

**Behavior**:
- Reply composer at the bottom of conversation detail panel
- Replies are sent back through the original channel the guest used
- If a guest has messaged on multiple channels, user can select which channel to reply on
- Message sent confirmation indicator

**Composer features**:
- Multi-line text input
- Template insertion (see F3.2)
- Character count (relevant for OTAs with character limits)
- Send button (+ keyboard shortcut: Ctrl/Cmd + Enter)

### F3.2 Response Templates

**Description**: Pre-built message templates for common responses.

**Template management**:
- Create, edit, delete templates
- Templates are per-property (each property has its own set)
- Organize templates by category: Check-in, Check-out, Amenities, Directions, House Rules, General

**Template variables** (auto-filled when template is inserted):
- `{{guest_name}}` - Guest's first name
- `{{property_name}}` - Property name
- `{{check_in_date}}` - Check-in date (formatted)
- `{{check_out_date}}` - Check-out date (formatted)
- `{{check_in_time}}` - Property check-in time
- `{{check_out_time}}` - Property check-out time
- `{{wifi_password}}` - WiFi password from property knowledge base
- `{{property_address}}` - Property address

**Template insertion flow**:
1. User clicks template icon in reply composer
2. Template picker dropdown shows categories and templates
3. User selects a template
4. Template is inserted into composer with variables auto-filled
5. User can edit before sending

### F3.3 Quick Actions

- **Mark as resolved**: Archive the conversation
- **Star / Unstar**: Flag for follow-up
- **Assign to**: Assign conversation to a specific team member
- **Add internal note**: Team-only note (not sent to guest)

---

## F4: AI Auto-Response (Basic - MVP)

### F4.1 Property Knowledge Base

**Description**: Structured data about each property that the AI uses to answer guest queries.

**Configurable fields**:
- Check-in / check-out times
- Check-in instructions (step-by-step)
- Property address + directions (from airport, station, etc.)
- WiFi name and password
- Amenities list
- House rules
- Parking information
- Nearby restaurants / attractions
- Emergency contact information
- Custom FAQs (question + answer pairs)

**Management UI**:
- Form-based editor in Settings > Properties > [Property] > Knowledge Base
- Each field is a text area or structured input
- Changes take effect immediately for AI responses

### F4.2 AI Response Behavior

**Trigger**: When a new guest message arrives, AI evaluates whether it can respond.

**Confidence levels**:
- **High confidence (auto-respond)**: The query clearly matches knowledge base content
  - Examples: "What's the WiFi password?", "What time is check-in?", "How do I get to the property from the airport?"
- **Medium confidence (draft for review)**: The query seems related to knowledge base but AI is less certain
  - Examples: "Can I check in early?", "Is there a grocery store nearby?", "Can I bring my dog?"
  - AI drafts a response and flags it for human review
- **Low confidence (route to human)**: The query is complex, sensitive, or outside knowledge base
  - Examples: "I need to cancel my booking", "The AC is broken", "I want a refund"
  - No AI response generated, conversation highlighted for human attention

**Response format**:
- AI responses are clearly labeled as "AI-assisted" in the inbox
- When an AI response is auto-sent, team members can review it after the fact
- When an AI response is drafted for review, it appears as a suggestion in the reply composer

### F4.3 AI Controls (per property)

- **Enable/Disable**: Toggle AI auto-response on/off per property
- **Auto-respond mode**: "Auto-send" (high confidence responses sent immediately) or "Draft only" (all AI responses require human approval)
- **Operating hours**: AI can be set to only auto-respond outside business hours, or always
- **Excluded topics**: Topics the AI should never auto-respond to (e.g., cancellations, complaints)

---

## F5: Property Management

### F5.1 Property Setup

- Add / edit / remove properties
- Each property has: Name, address, description, photos (optional), channel connections, knowledge base, templates
- Property dashboard showing: active conversations, unread count, channel statuses

### F5.2 Multi-Property View

- Inbox can show all properties or filter to a specific property
- Property selector in the sidebar
- Color-coded or icon-tagged conversations by property

---

## F6: User Management (Basic - MVP)

### F6.1 Roles

For MVP, two roles:
- **Admin**: Full access - manage properties, channels, AI settings, templates, users
- **Agent**: Can view and respond to conversations for assigned properties

### F6.2 Team Features

- Invite team members by email
- Assign agents to specific properties
- Conversation assignment (assign a conversation to a specific agent)
- "Assigned to me" filter in inbox

---

## F7: Notifications

### F7.1 In-App Notifications

- Notification bell icon with unread count
- Notification list: new messages, AI responses needing review, channel disconnection alerts
- Click notification to navigate to the relevant conversation

### F7.2 Browser Notifications

- Push notifications for new messages (with guest name and preview)
- Configurable: all messages, only unassigned, only assigned to me
- Sound notification toggle

### F7.3 Email/WhatsApp Notifications (Later)

- Deferred to Phase 2 - notify team via email or WhatsApp when critical messages arrive

---

## F8: Settings

### F8.1 Organization Settings
- Organization name, logo
- Default timezone
- Business hours

### F8.2 Channel Settings
- Connect / disconnect Beds24 API (API key management)
- Connect / disconnect WhatsApp (QR code pairing)
- Beds24 property mapping (map Beds24 properties to Tarksh properties)
- Webhook configuration status
- Polling frequency settings (default: 60s)

### F8.3 AI Settings (per property)
- Knowledge base editor
- AI mode (auto-send / draft-only / disabled)
- Excluded topics
- Tone preference (formal / casual / friendly)

### F8.4 Template Settings (per property)
- Template CRUD
- Template categories
- Variable reference guide

### F8.5 User Settings
- Notification preferences
- Personal profile
