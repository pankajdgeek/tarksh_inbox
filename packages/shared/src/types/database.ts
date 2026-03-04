/**
 * ============================================================================
 * TARKSH INBOX - Complete Database Schema (Drizzle ORM)
 * ============================================================================
 *
 * Source of truth for all Phase 1 tables.
 * Includes ALL P0 fixes from architecture-review.md:
 *   - P0.1: Deterministic AI routing (AIEvaluation table)
 *   - P1.7: Missing denormalized fields (Conversation, Message, Guest)
 *   - P1.4: Guest merging (merged_into_id FK)
 *   - P1.5: Concurrency control (locked_by, locked_at)
 *   - 2FA handling (TFAChallenge table)
 *
 * Sprint 1 Tasks: T-021 through T-033
 * ============================================================================
 */

// ============================================================================
// ENUMS
// ============================================================================

export const OrganizationPlan = {
  STARTER: 'starter',
  PRO: 'pro',
  BUSINESS: 'business',
  ENTERPRISE: 'enterprise',
} as const;
export type OrganizationPlan = typeof OrganizationPlan[keyof typeof OrganizationPlan];

export const UserRole = {
  ADMIN: 'admin',
  AGENT: 'agent',
} as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];

export const ChannelType = {
  AIRBNB: 'airbnb',
  BOOKING_COM: 'booking_com',
  WHATSAPP: 'whatsapp',
  GOIBIBO: 'goibibo',
  AGODA: 'agoda',
  EXPEDIA: 'expedia',
} as const;
export type ChannelType = typeof ChannelType[keyof typeof ChannelType];

export const ConnectionMethod = {
  IMAP_IDLE: 'imap_idle',
  PLAYWRIGHT: 'playwright',
  EMAIL_RELAY: 'email_relay',
  BAILEYS: 'baileys',
  WHATSAPP_BUSINESS_API: 'whatsapp_business_api',
  OFFICIAL_API: 'official_api',
} as const;
export type ConnectionMethod = typeof ConnectionMethod[keyof typeof ConnectionMethod];

export const ConnectionStatus = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  SESSION_EXPIRING: 'session_expiring',
  SESSION_EXPIRED: 'session_expired',
  TFA_PENDING: 'tfa_pending',
  TFA_FAILED: 'tfa_failed',
  ERROR: 'error',
} as const;
export type ConnectionStatus = typeof ConnectionStatus[keyof typeof ConnectionStatus];

export const ConversationStatus = {
  UNREAD: 'unread',
  PENDING: 'pending',
  REPLIED: 'replied',
  RESOLVED: 'resolved',
  STARRED: 'starred',
} as const;
export type ConversationStatus = typeof ConversationStatus[keyof typeof ConversationStatus];

export const MessageSenderType = {
  GUEST: 'guest',
  AGENT: 'agent',
  AI: 'ai',
  SYSTEM: 'system',
} as const;
export type MessageSenderType = typeof MessageSenderType[keyof typeof MessageSenderType];

export const DeliveryStatus = {
  QUEUED: 'queued',
  SENDING: 'sending',
  SENT: 'sent',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  // WhatsApp-specific
  DELIVERED: 'delivered',
  READ: 'read',
} as const;
export type DeliveryStatus = typeof DeliveryStatus[keyof typeof DeliveryStatus];

export const BookingStatus = {
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
} as const;
export type BookingStatus = typeof BookingStatus[keyof typeof BookingStatus];

export const AIRoutingDecision = {
  AUTO_SEND: 'auto_send',
  DRAFT: 'draft',
  ROUTE_TO_HUMAN: 'route_to_human',
  NEVER_AUTO: 'never_auto',
  NO_KB_MATCH: 'no_kb_match',
} as const;
export type AIRoutingDecision = typeof AIRoutingDecision[keyof typeof AIRoutingDecision];

export const AIPropertyMode = {
  AUTO_SEND: 'auto_send',
  DRAFT_ONLY: 'draft_only',
  DISABLED: 'disabled',
} as const;
export type AIPropertyMode = typeof AIPropertyMode[keyof typeof AIPropertyMode];

export const TFAType = {
  SMS_OTP: 'sms_otp',
  EMAIL_OTP: 'email_otp',
  TOTP: 'totp',
  PUSH_NOTIFICATION: 'push_notification',
} as const;
export type TFAType = typeof TFAType[keyof typeof TFAType];

export const TFAStatus = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  VERIFIED: 'verified',
  FAILED: 'failed',
  EXPIRED: 'expired',
} as const;
export type TFAStatus = typeof TFAStatus[keyof typeof TFAStatus];

export const GuestLifecycleStage = {
  PRE_BOOKING: 'pre_booking',
  POST_BOOKING: 'post_booking',
  PRE_ARRIVAL: 'pre_arrival',
  DURING_STAY: 'during_stay',
  POST_CHECKOUT: 'post_checkout',
} as const;
export type GuestLifecycleStage = typeof GuestLifecycleStage[keyof typeof GuestLifecycleStage];

export const TemplateCategory = {
  CHECK_IN: 'check_in',
  CHECK_OUT: 'check_out',
  AMENITIES: 'amenities',
  DIRECTIONS: 'directions',
  HOUSE_RULES: 'house_rules',
  GENERAL: 'general',
} as const;
export type TemplateCategory = typeof TemplateCategory[keyof typeof TemplateCategory];

// ============================================================================
// TABLE INTERFACES
// ============================================================================

// T-021: Organization
export interface Organization {
  id: string;               // UUID v4
  name: string;
  slug: string;             // URL-safe unique identifier
  plan: OrganizationPlan;
  settings: OrganizationSettings;  // JSONB
  created_at: Date;
  updated_at: Date;
}

export interface OrganizationSettings {
  timezone: string;           // IANA timezone (e.g., "Asia/Kolkata")
  business_hours: {
    start: string;            // "09:00"
    end: string;              // "21:00"
    days: number[];           // [1,2,3,4,5] = Mon-Fri
  };
  notification_preferences: {
    email_alerts: boolean;
    browser_push: boolean;
    sound_enabled: boolean;
  };
  default_language: string;   // "en"
}

// T-022: User
export interface User {
  id: string;               // UUID v4
  name: string;
  email: string;            // UNIQUE per org
  password_hash: string;    // Argon2id
  role: UserRole;
  org_id: string;           // FK → Organization.id
  avatar_url?: string;
  is_active: boolean;       // default true
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// T-023: Property
export interface Property {
  id: string;               // UUID v4
  name: string;
  address?: string;
  description?: string;
  timezone: string;         // IANA timezone, overrides org default
  org_id: string;           // FK → Organization.id
  ai_mode: AIPropertyMode;  // default 'draft_only'
  ai_enabled: boolean;      // default true
  is_active: boolean;       // default true (soft delete)
  created_at: Date;
  updated_at: Date;
}

// T-024: Guest
export interface Guest {
  id: string;               // UUID v4
  name: string;
  email?: string;
  phone?: string;
  language?: string;        // P1.7 fix: detected language
  identifiers: GuestIdentifiers;  // JSONB, GIN-indexed
  merged_into_id?: string;  // P1.4 fix: FK → Guest.id (nullable, for manual merge)
  org_id: string;           // FK → Organization.id
  last_active_at?: Date;    // P1.7 fix: last message timestamp
  created_at: Date;
  updated_at: Date;
}

/**
 * GuestIdentifiers JSONB structure
 * Stores per-channel identifiers for cross-channel guest matching.
 * GIN-indexed for fast lookups across any channel.
 *
 * Example:
 * {
 *   "airbnb": { "guest_id": "123456", "name": "John Doe" },
 *   "booking_com": { "guest_id": "BC-789", "email": "john@gmail.com" },
 *   "whatsapp": { "phone": "+919876543210", "name": "John" }
 * }
 */
export interface GuestIdentifiers {
  airbnb?: {
    guest_id?: string;
    name?: string;
    profile_url?: string;
  };
  booking_com?: {
    guest_id?: string;
    email?: string;
    name?: string;
  };
  whatsapp?: {
    phone: string;        // E.164 format: +919876543210
    name?: string;        // WhatsApp profile name
    jid?: string;         // Baileys JID
  };
  goibibo?: {
    guest_id?: string;
    name?: string;
  };
  agoda?: {
    guest_id?: string;
    name?: string;
  };
  expedia?: {
    guest_id?: string;
    name?: string;
  };
}

// T-025: Conversation
export interface Conversation {
  id: string;                    // UUID v4
  guest_id: string;              // FK → Guest.id
  property_id: string;           // FK → Property.id
  booking_id?: string;           // FK → Booking.id (nullable)
  status: ConversationStatus;
  assigned_to?: string;          // FK → User.id (nullable)

  // AI state
  ai_enabled: boolean;           // Inherits from property, can override per-conversation

  // Concurrency control (P1.5 fix)
  locked_by?: string;            // FK → User.id (nullable)
  locked_at?: Date;              // Lock timestamp (TTL check in app layer)

  // Denormalized fields (P1.7 fix - critical for list performance)
  last_message_at?: Date;        // Updated on every new message
  last_message_preview?: string; // First 100 chars of last message
  unread_count: number;          // Unread messages for agent
  primary_channel: ChannelType;  // Channel of first/most-recent message

  // Metadata
  is_starred: boolean;           // default false
  resolved_at?: Date;            // When marked resolved
  org_id: string;                // FK → Organization.id (denormalized for query perf)
  created_at: Date;
  updated_at: Date;
}

// T-026: Message
export interface Message {
  id: string;                    // UUID v4
  conversation_id: string;      // FK → Conversation.id
  content: string;              // Message text
  sender_type: MessageSenderType;
  sender_id?: string;            // FK → User.id (for agent/ai) or external guest ID
  channel: ChannelType;

  // External tracking (dedup)
  external_id?: string;          // hash(channel + booking_ref + timestamp) - UNIQUE
  external_thread_id?: string;   // OTA-specific thread/conversation identifier

  // Delivery state machine (P0.3 fix)
  delivery_status?: DeliveryStatus;  // For outbound messages only
  delivery_attempts: number;      // Retry counter
  delivered_at?: Date;            // When confirmed delivered
  failed_reason?: string;         // Error message on failure

  // Internal notes (P1.7 fix)
  is_internal_note: boolean;      // default false - team-only, never sent to guest

  // Attachments
  attachments?: MessageAttachment[];  // JSONB array

  // AI metadata
  ai_evaluation_id?: string;     // FK → AIEvaluation.id (if AI-generated)
  was_ai_edited: boolean;        // default false - if agent modified AI draft

  sent_at: Date;                 // When sent/received
  created_at: Date;
}

export interface MessageAttachment {
  type: 'image' | 'document' | 'audio' | 'video' | 'file';
  url: string;
  filename: string;
  mime_type: string;
  size_bytes?: number;
}

// T-027: Booking
export interface Booking {
  id: string;                    // UUID v4
  guest_id: string;              // FK → Guest.id
  property_id: string;           // FK → Property.id
  channel: ChannelType;
  external_booking_id: string;   // OTA-specific booking/reservation ID

  check_in: Date;                // Date only (YYYY-MM-DD)
  check_out: Date;               // Date only (YYYY-MM-DD)
  num_guests?: number;
  num_adults?: number;
  num_children?: number;

  amount?: number;               // Booking total
  currency?: string;             // ISO 4217 (INR, USD, EUR)

  status: BookingStatus;
  special_requests?: string;     // Guest's special requests text

  org_id: string;                // FK → Organization.id
  created_at: Date;
  updated_at: Date;
}

// T-028: ChannelConnection
export interface ChannelConnection {
  id: string;                    // UUID v4
  property_id: string;           // FK → Property.id
  channel_type: ChannelType;
  connection_method: ConnectionMethod;

  // Encrypted credentials (AES-256-GCM via T-041)
  credentials_encrypted: string; // Encrypted JSON blob
  credentials_iv: string;        // Initialization vector
  credentials_tag: string;       // Auth tag

  status: ConnectionStatus;
  last_sync_at?: Date;
  error_message?: string;
  error_count: number;           // Consecutive error count

  // Channel-specific config (JSONB)
  config?: ChannelConnectionConfig;

  org_id: string;                // FK → Organization.id
  created_at: Date;
  updated_at: Date;
}

export interface ChannelConnectionConfig {
  // Airbnb
  airbnb_host_id?: string;
  airbnb_session_ttl_hours?: number;

  // Booking.com
  booking_property_id?: string;
  booking_reply_email_pattern?: string;  // hotel-{id}-{res}@guest.booking.com

  // WhatsApp
  whatsapp_phone_number?: string;
  whatsapp_jid?: string;
  whatsapp_session_dir?: string;

  // Rate limits (overrides per channel)
  rate_limit_per_second?: number;
  rate_limit_per_hour?: number;
}

// T-029: EmailConnection
export interface EmailConnection {
  id: string;                    // UUID v4
  property_id: string;           // FK → Property.id (or ChannelConnection.id)

  imap_host: string;             // e.g., imap.gmail.com
  imap_port: number;             // e.g., 993
  imap_secure: boolean;          // default true (TLS)

  // Encrypted credentials (AES-256-GCM)
  credentials_encrypted: string;
  credentials_iv: string;
  credentials_tag: string;

  // Forwarding setup
  forwarding_email?: string;     // property-{id}@inbox.tarksh.com
  forwarding_verified: boolean;  // default false

  status: ConnectionStatus;
  last_connected_at?: Date;
  last_sync_uid?: number;        // Last IMAP UID processed (for catch-up)

  org_id: string;
  created_at: Date;
  updated_at: Date;
}

// T-030: KnowledgeBase
export interface KnowledgeBase {
  id: string;                    // UUID v4
  property_id: string;           // FK → Property.id, UNIQUE
  data: KnowledgeBaseData;       // JSONB
  version: number;               // Increment on update (optimistic locking)
  org_id: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * KnowledgeBaseData JSONB structure
 * Source of truth: docs/ai-agent.md
 *
 * This structure directly maps to AI intent taxonomy.
 * If a field has data → AI can answer queries about it.
 * If a field is null/missing → AI routes to human for that topic.
 */
export interface KnowledgeBaseData {
  property_name: string;

  check_in: {
    time: string;                // "14:00" (24h format)
    instructions: string[];      // Step-by-step
    self_check_in: boolean;
    early_check_in?: string;     // Policy text
    key_location?: string;       // "Lockbox code: 1234"
  } | null;

  check_out: {
    time: string;                // "11:00"
    instructions: string[];
    late_check_out?: string;     // "Available until 1 PM for INR 1000"
  } | null;

  wifi: {
    network_name: string;
    password: string;
  } | null;

  amenities: string[] | null;    // ["Pool", "Gym", "Parking", "Kitchen"]

  house_rules: string[] | null;  // ["No smoking", "No parties", "Quiet hours 10PM-7AM"]

  directions: {
    address: string;
    from_airport?: string;
    from_station?: string;
    from_bus_stand?: string;
    google_maps_link?: string;
    landmarks?: string;
  } | null;

  parking: {
    available: boolean;
    type?: string;               // "Free", "Paid", "Valet"
    instructions?: string;
    cost?: string;
  } | null;

  nearby: {
    restaurants?: Array<{ name: string; cuisine?: string; distance?: string }>;
    attractions?: Array<{ name: string; distance?: string; description?: string }>;
    pharmacies?: Array<{ name: string; distance?: string }>;
    hospitals?: Array<{ name: string; distance?: string }>;
    atms?: Array<{ name: string; distance?: string }>;
  } | null;

  emergency: {
    contact_name: string;
    phone: string;
    backup_phone?: string;
    local_police?: string;
    nearest_hospital?: string;
  } | null;

  custom_faqs: Array<{
    question: string;
    answer: string;
  }> | null;

  response_preferences: {
    tone: 'friendly' | 'professional' | 'casual';
    language: string;             // "english", "hindi", "both"
    max_response_length?: number; // Override default 500 char cap
    signature?: string;           // "- Team Sunset Villa"
  };
}

// T-031: AIEvaluation
export interface AIEvaluation {
  id: string;                     // UUID v4
  message_id: string;            // FK → Message.id (the inbound message evaluated)
  conversation_id: string;       // FK → Conversation.id
  property_id: string;           // FK → Property.id

  // Intent classification (Haiku)
  detected_intent: string;       // From intent taxonomy (e.g., "wifi_query")
  detected_stage: GuestLifecycleStage;
  intent_confidence: 'high' | 'medium' | 'low';  // KB match level, NOT LLM confidence

  // KB matching
  kb_fields_used: string[];      // ["wifi.network_name", "wifi.password"]
  kb_has_data: boolean;          // Does KB have data for this intent?

  // Response generation (Sonnet)
  generated_response?: string;   // AI-generated response text (null if no KB match)

  // Routing
  routing_decision: AIRoutingDecision;
  routing_reason: string;        // Human-readable explanation

  // Post-routing tracking
  was_edited: boolean;           // Did agent modify the AI draft?
  edited_response?: string;      // Agent's modified version
  was_sent: boolean;             // Was the response (or edit) actually sent?

  // Cost tracking
  token_usage: {
    intent_input_tokens: number;
    intent_output_tokens: number;
    response_input_tokens?: number;
    response_output_tokens?: number;
    total_tokens: number;
    estimated_cost_usd: number;
  };

  latency_ms: number;            // Total processing time
  model_intent: string;          // e.g., "claude-3-haiku-20240307"
  model_response?: string;       // e.g., "claude-3-sonnet-20240229"

  // Cancellation
  was_cancelled: boolean;        // Human opened conversation before AI finished
  cancelled_by?: string;         // FK → User.id

  org_id: string;
  created_at: Date;
}

// TFA Challenge (2FA Handling - from docs/2fa-handling.md)
export interface TFAChallenge {
  id: string;                    // UUID v4
  channel_connection_id: string; // FK → ChannelConnection.id
  channel: ChannelType;

  tfa_type: TFAType;
  masked_target?: string;        // "+91-XXXX7890" or "j***@gmail.com"

  status: TFAStatus;
  code?: string;                 // Admin-entered code (encrypted)

  expires_at: Date;              // 10-minute window
  submitted_at?: Date;
  verified_at?: Date;

  error_message?: string;
  attempt_count: number;         // default 0, max 3

  org_id: string;
  created_at: Date;
}

// Template (Response Templates - Sprint 9)
export interface Template {
  id: string;                    // UUID v4
  name: string;
  content: string;               // Template text with {{variables}}
  category: TemplateCategory;
  property_id?: string;          // FK → Property.id (null = org-wide)
  org_id: string;                // FK → Organization.id
  is_active: boolean;            // default true
  created_by: string;            // FK → User.id
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// INDEX DEFINITIONS (T-032)
// ============================================================================

/**
 * Critical indexes for Phase 1 performance.
 *
 * All queries MUST be org_id scoped (tenant isolation).
 * Conversation list is the hottest query (sorted by last_message_at DESC).
 * Message search is the most expensive (full-text GIN index).
 * Guest dedup relies on GIN index on JSONB identifiers.
 *
 * SQL definitions:
 *
 * -- Conversation list (THE most common query)
 * CREATE INDEX idx_conversations_org_status
 *   ON conversations(org_id, status);
 * CREATE INDEX idx_conversations_org_last_msg
 *   ON conversations(org_id, last_message_at DESC);
 * CREATE INDEX idx_conversations_org_property
 *   ON conversations(org_id, property_id, status);
 * CREATE INDEX idx_conversations_assigned
 *   ON conversations(org_id, assigned_to) WHERE assigned_to IS NOT NULL;
 *
 * -- Message retrieval (per conversation, chronological)
 * CREATE INDEX idx_messages_conversation_sent
 *   ON messages(conversation_id, sent_at);
 *
 * -- Deduplication (external_id lookup on every inbound message)
 * CREATE UNIQUE INDEX idx_messages_external_id
 *   ON messages(external_id) WHERE external_id IS NOT NULL;
 *
 * -- Guest matching (GIN on JSONB for cross-channel lookup)
 * CREATE INDEX idx_guests_identifiers
 *   ON guests USING GIN(identifiers);
 * CREATE INDEX idx_guests_org
 *   ON guests(org_id);
 *
 * -- Full-text search (GIN + tsvector for message content)
 * CREATE INDEX idx_messages_content_search
 *   ON messages USING GIN(to_tsvector('english', content));
 *
 * -- AI evaluations (audit trail queries)
 * CREATE INDEX idx_ai_evaluations_property
 *   ON ai_evaluations(property_id, created_at DESC);
 * CREATE INDEX idx_ai_evaluations_routing
 *   ON ai_evaluations(routing_decision, created_at DESC);
 *
 * -- Bookings (lookup by external ID + property)
 * CREATE INDEX idx_bookings_external
 *   ON bookings(external_booking_id, channel);
 * CREATE INDEX idx_bookings_property
 *   ON bookings(property_id, check_in DESC);
 *
 * -- Channel connections (health monitoring)
 * CREATE INDEX idx_channel_connections_property
 *   ON channel_connections(property_id, channel_type);
 *
 * -- Email connections
 * CREATE INDEX idx_email_connections_property
 *   ON email_connections(property_id);
 */
