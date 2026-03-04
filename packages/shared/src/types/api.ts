/**
 * ============================================================================
 * TARKSH INBOX - Complete API Contract Definitions
 * ============================================================================
 *
 * Shared TypeScript interfaces for ALL REST API endpoints.
 * Used by both frontend (TanStack Query) and backend (Fastify routes).
 *
 * Conventions:
 * - Request body types: *Request
 * - Response types: *Response
 * - List responses: Paginated<T>
 * - All responses wrapped in ApiResponse<T>
 * - Errors follow ProblemDetails (RFC 7807)
 * ============================================================================
 */

import type {
  AIPropertyMode,
  AIRoutingDecision,
  BookingStatus,
  ChannelType,
  ConnectionMethod,
  ConnectionStatus,
  ConversationStatus,
  DeliveryStatus,
  GuestLifecycleStage,
  KnowledgeBaseData,
  MessageAttachment,
  MessageSenderType,
  OrganizationSettings,
  TemplateCategory,
  TFAStatus,
  TFAType,
  UserRole,
} from './database';

// ============================================================================
// COMMON TYPES
// ============================================================================

/** Standard API success wrapper */
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

/** Standard API error (RFC 7807 ProblemDetails) */
export interface ApiError {
  success: false;
  error: {
    code: string;           // Machine-readable: "VALIDATION_ERROR", "NOT_FOUND"
    message: string;        // Human-readable description
    details?: Record<string, string[]>;  // Field-level validation errors
    status: number;         // HTTP status code
  };
}

/** Paginated list wrapper */
export interface Paginated<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

/** Common query params for list endpoints */
export interface PaginationParams {
  page?: number;            // default 1
  limit?: number;           // default 20, max 100
  sort_by?: string;         // field name
  sort_order?: 'asc' | 'desc';
}

// ============================================================================
// AUTH ENDPOINTS (Sprint 1 - T-034 to T-040)
// ============================================================================

// POST /auth/login (T-036)
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;          // JWT, 15min expiry
  refresh_token: string;         // Opaque token, 7d expiry (set via httpOnly cookie)
  expires_in: number;            // Seconds until access_token expires (900)
  user: UserProfile;
}

// POST /auth/refresh (T-037)
export interface RefreshRequest {
  refresh_token: string;         // From httpOnly cookie or body
}

export interface RefreshResponse {
  access_token: string;
  expires_in: number;
}

// POST /auth/logout (T-040)
// No request body - uses refresh token from cookie
export interface LogoutResponse {
  message: string;
}

// GET /auth/me
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  org_id: string;
  org_name: string;
  avatar_url?: string;
  last_login_at?: string;
}

// ============================================================================
// PROPERTY ENDPOINTS (Sprint 2 - T-043 to T-048)
// ============================================================================

// POST /properties (T-043)
export interface CreatePropertyRequest {
  name: string;                  // min 2, max 100
  address?: string;
  description?: string;
  timezone: string;              // IANA timezone, validated
}

// GET /properties (T-044)
export interface ListPropertiesParams extends PaginationParams {
  search?: string;               // Search by name
  is_active?: boolean;
}

// GET /properties/:id (T-045)
export interface PropertyResponse {
  id: string;
  name: string;
  address?: string;
  description?: string;
  timezone: string;
  ai_mode: AIPropertyMode;
  ai_enabled: boolean;
  is_active: boolean;
  channel_count: number;          // Denormalized count
  active_conversations: number;   // Denormalized count
  created_at: string;
  updated_at: string;
}

// PATCH /properties/:id (T-046)
export interface UpdatePropertyRequest {
  name?: string;
  address?: string;
  description?: string;
  timezone?: string;
  ai_mode?: AIPropertyMode;
  ai_enabled?: boolean;
}

// GET /properties/:id/knowledge-base (T-048)
export interface KnowledgeBaseResponse {
  id: string;
  property_id: string;
  data: KnowledgeBaseData;
  version: number;
  updated_at: string;
}

// PUT /properties/:id/knowledge-base (T-048)
export interface UpdateKnowledgeBaseRequest {
  data: Partial<KnowledgeBaseData>;
  version: number;               // Optimistic locking - must match current version
}

// ============================================================================
// CHANNEL CONNECTION ENDPOINTS (Sprint 2 - T-049 to T-053)
// ============================================================================

// POST /properties/:id/channels (T-049)
export interface CreateChannelConnectionRequest {
  channel_type: ChannelType;
  connection_method: ConnectionMethod;
  credentials: ChannelCredentials;
  config?: Record<string, unknown>;
}

/** Channel-specific credential shapes */
export type ChannelCredentials =
  | AirbnbCredentials
  | BookingComCredentials
  | WhatsAppCredentials;

export interface AirbnbCredentials {
  type: 'airbnb';
  email: string;
  password: string;
  host_id?: string;
}

export interface BookingComCredentials {
  type: 'booking_com';
  property_id: string;
  // No login needed - uses email relay
}

export interface WhatsAppCredentials {
  type: 'whatsapp';
  phone_number: string;
  // QR code pairing happens separately
}

// GET /properties/:id/channels (T-050)
export interface ChannelConnectionResponse {
  id: string;
  channel_type: ChannelType;
  connection_method: ConnectionMethod;
  status: ConnectionStatus;
  last_sync_at?: string;
  error_message?: string;
  error_count: number;
  config?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // NEVER expose credentials in response
}

// GET /channels/:id/health (T-053)
export interface ChannelHealthResponse {
  id: string;
  channel_type: ChannelType;
  status: ConnectionStatus;
  last_sync_at?: string;
  messages_sent_today: number;
  messages_received_today: number;
  unsent_count: number;           // Messages in outbound queue
  error_message?: string;
  uptime_percentage: number;      // Last 24 hours
  next_retry_at?: string;         // If disconnected, when next reconnect attempt
}

// ============================================================================
// EMAIL CONNECTION ENDPOINTS (Sprint 2 - T-054 to T-056)
// ============================================================================

// POST /properties/:id/email (T-054)
export interface CreateEmailConnectionRequest {
  imap_host: string;
  imap_port: number;
  email: string;
  password: string;               // Will be encrypted with AES-256-GCM
  imap_secure?: boolean;          // default true
}

// POST /email/test (T-055)
export interface TestEmailConnectionRequest {
  imap_host: string;
  imap_port: number;
  email: string;
  password: string;
  imap_secure?: boolean;
}

export interface TestEmailConnectionResponse {
  success: boolean;
  message: string;                // "Connected successfully" or error
  inbox_count?: number;           // Number of messages in inbox
  server_greeting?: string;       // IMAP server banner
}

export interface EmailConnectionResponse {
  id: string;
  property_id: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  forwarding_email?: string;
  forwarding_verified: boolean;
  status: ConnectionStatus;
  last_connected_at?: string;
  created_at: string;
  updated_at: string;
  // NEVER expose credentials
}

// ============================================================================
// CONVERSATION ENDPOINTS (Sprint 5 - T-093, T-098, T-103)
// ============================================================================

// GET /conversations (T-093)
export interface ListConversationsParams extends PaginationParams {
  status?: ConversationStatus | ConversationStatus[];
  channel?: ChannelType | ChannelType[];
  property_id?: string;
  assigned_to?: string;           // User ID or 'unassigned'
  is_starred?: boolean;
  search?: string;                // Full-text search in messages
  date_from?: string;             // ISO date
  date_to?: string;               // ISO date
}

export interface ConversationListItem {
  id: string;
  guest: {
    id: string;
    name: string;
    avatar_url?: string;
  };
  property: {
    id: string;
    name: string;
  };
  booking?: {
    id: string;
    check_in: string;
    check_out: string;
    status: BookingStatus;
  };
  status: ConversationStatus;
  primary_channel: ChannelType;
  last_message_at: string;
  last_message_preview: string;
  unread_count: number;
  is_starred: boolean;
  assigned_to?: {
    id: string;
    name: string;
  };
  ai_enabled: boolean;
  locked_by?: {
    id: string;
    name: string;
  };
  created_at: string;
}

// GET /conversations/:id (full detail)
export interface ConversationDetailResponse extends ConversationListItem {
  guest: ConversationListItem['guest'] & {
    email?: string;
    phone?: string;
    language?: string;
    channels_used: ChannelType[];
  };
  booking?: ConversationListItem['booking'] & {
    num_guests?: number;
    amount?: number;
    currency?: string;
    special_requests?: string;
    external_booking_id?: string;
  };
}

// GET /conversations/:id/messages (T-098)
export interface ListMessagesParams extends PaginationParams {
  before?: string;                // Cursor: messages before this timestamp (for infinite scroll)
  after?: string;                 // Cursor: messages after this timestamp (for real-time catch-up)
  include_internal?: boolean;     // default true for agents
}

export interface MessageResponse {
  id: string;
  conversation_id: string;
  content: string;
  sender_type: MessageSenderType;
  sender: {
    id?: string;
    name: string;
    avatar_url?: string;
  };
  channel: ChannelType;
  delivery_status?: DeliveryStatus;
  is_internal_note: boolean;
  attachments?: MessageAttachment[];
  ai_evaluation?: {
    id: string;
    detected_intent: string;
    routing_decision: AIRoutingDecision;
    was_edited: boolean;
  };
  sent_at: string;
  created_at: string;
}

// POST /conversations/:id/messages (T-103)
export interface SendMessageRequest {
  content: string;                // Message text (max per-channel limit)
  channel?: ChannelType;          // Override channel (default: conversation.primary_channel)
  is_internal_note?: boolean;     // default false
  ai_evaluation_id?: string;      // If approving an AI draft
}

export interface SendMessageResponse {
  id: string;
  content: string;
  sender_type: MessageSenderType;
  channel: ChannelType;
  delivery_status: DeliveryStatus;  // Initially 'queued'
  sent_at: string;
}

// PATCH /conversations/:id (status update, assignment)
export interface UpdateConversationRequest {
  status?: ConversationStatus;
  assigned_to?: string | null;     // User ID or null to unassign
  is_starred?: boolean;
  ai_enabled?: boolean;
}

// ============================================================================
// TEMPLATE ENDPOINTS (Sprint 9 - T-160 to T-165)
// ============================================================================

// POST /templates (T-160)
export interface CreateTemplateRequest {
  name: string;
  content: string;                // With {{variable}} placeholders
  category: TemplateCategory;
  property_id?: string;           // null = org-wide
}

// GET /templates (T-160)
export interface ListTemplatesParams extends PaginationParams {
  category?: TemplateCategory;
  property_id?: string;
  search?: string;
}

export interface TemplateResponse {
  id: string;
  name: string;
  content: string;
  category: TemplateCategory;
  property_id?: string;
  property_name?: string;
  created_by: {
    id: string;
    name: string;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// POST /templates/:id/resolve (T-163)
export interface ResolveTemplateRequest {
  conversation_id: string;        // Context for variable resolution
}

export interface ResolveTemplateResponse {
  resolved_content: string;       // Template with variables replaced
  unresolved_variables: string[]; // Variables that couldn't be resolved
}

// ============================================================================
// AI ENDPOINTS (Sprint 8 - T-142 to T-159)
// ============================================================================

// GET /conversations/:id/ai-evaluations
export interface AIEvaluationResponse {
  id: string;
  detected_intent: string;
  detected_stage: GuestLifecycleStage;
  intent_confidence: 'high' | 'medium' | 'low';
  kb_fields_used: string[];
  kb_has_data: boolean;
  generated_response?: string;
  routing_decision: AIRoutingDecision;
  routing_reason: string;
  was_edited: boolean;
  was_sent: boolean;
  token_usage: {
    total_tokens: number;
    estimated_cost_usd: number;
  };
  latency_ms: number;
  created_at: string;
}

// POST /conversations/:id/ai/approve (approve AI draft)
export interface ApproveAIDraftRequest {
  ai_evaluation_id: string;
  edited_content?: string;        // If agent modified the draft
}

// POST /conversations/:id/ai/discard (discard AI draft)
export interface DiscardAIDraftRequest {
  ai_evaluation_id: string;
  reason?: string;
}

// POST /conversations/:id/ai/cancel (T-155 - cancel pending evaluation)
// No body - cancels the in-progress evaluation

// ============================================================================
// USER MANAGEMENT ENDPOINTS (Sprint 10 - T-188 to T-190)
// ============================================================================

// GET /users
export interface ListUsersParams extends PaginationParams {
  role?: UserRole;
  is_active?: boolean;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  properties: Array<{ id: string; name: string }>;  // Assigned properties
  last_login_at?: string;
  created_at: string;
}

// POST /users/invite (T-189)
export interface InviteUserRequest {
  email: string;
  name: string;
  role: UserRole;
  property_ids?: string[];        // Properties to assign
}

// PUT /users/:id/properties (T-190)
export interface AssignPropertiesRequest {
  property_ids: string[];         // Replace all property assignments
}

// ============================================================================
// HEALTH & MONITORING (Sprint 10 - T-185)
// ============================================================================

// GET /health (T-185)
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime_seconds: number;
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
    imap_connections: {
      status: 'ok' | 'degraded' | 'down';
      active: number;
      total: number;
      errored: number;
    };
    browser_pool: {
      status: 'ok' | 'degraded' | 'down';
      available: number;
      in_use: number;
      total: number;
    };
    whatsapp: {
      status: 'ok' | 'degraded' | 'down';
      connected: number;
      disconnected: number;
    };
    queues: {
      ai_evaluation: QueueHealth;
      channel_outbound: QueueHealth;
    };
  };
}

interface HealthCheck {
  status: 'ok' | 'error';
  latency_ms?: number;
  error?: string;
}

interface QueueHealth {
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
}

// ============================================================================
// 2FA ENDPOINTS (Sprint 6 - T-122)
// ============================================================================

// GET /channels/:id/tfa
export interface TFAChallengeResponse {
  id: string;
  channel: ChannelType;
  tfa_type: TFAType;
  masked_target?: string;
  status: TFAStatus;
  expires_at: string;
  attempt_count: number;
}

// POST /channels/:id/tfa/submit
export interface SubmitTFARequest {
  code: string;                   // Admin-entered verification code
}

// ============================================================================
// ORGANIZATION SETTINGS
// ============================================================================

// GET /organization
export interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings: OrganizationSettings;
  property_count: number;
  user_count: number;
  created_at: string;
}

// PATCH /organization
export interface UpdateOrganizationRequest {
  name?: string;
  settings?: Partial<OrganizationSettings>;
}
