/**
 * ============================================================================
 * TARKSH INBOX - WebSocket Events & Internal Event Bus Contracts
 * ============================================================================
 *
 * Two event systems:
 * 1. Internal Event Bus (backend-only): EventEmitter for decoupled services
 * 2. WebSocket Events (backend→frontend): Socket.io real-time updates
 *
 * Sprint 3: T-074, T-075 (Internal Event Bus)
 * Sprint 4: T-076 to T-088 (WebSocket Events)
 * ============================================================================
 */

import type {
  AIRoutingDecision,
  ChannelType,
  ConnectionStatus,
  ConversationStatus,
  DeliveryStatus,
  GuestLifecycleStage,
  MessageSenderType,
} from './database';

// ============================================================================
// INTERNAL EVENT BUS (Backend Only)
// ============================================================================
// Used by: IMAP service, parsers, normalizer, AI evaluator, outbound sender
// Transport: Node.js EventEmitter (same process) or Redis Pub/Sub (cross-process)

/**
 * All internal events follow this naming convention:
 *   domain:action (e.g., message:received, conversation:created)
 *
 * Handler chain for message:received (T-075):
 *   1. Save message to DB (Message table)
 *   2. Create or update conversation (Conversation table, denormalized fields)
 *   3. Match or create guest (Guest table)
 *   4. Link booking if found (Booking table)
 *   5. Emit WebSocket event to frontend (new_message)
 *   6. Queue AI evaluation (BullMQ ai-evaluation queue)
 */

export interface InternalEventMap {
  // ── Message Events ──
  'message:received': MessageReceivedEvent;       // Inbound message from any channel
  'message:sent': MessageSentEvent;               // Outbound message queued/sent
  'message:delivery_updated': DeliveryUpdatedEvent; // Delivery status changed
  'message:failed': MessageFailedEvent;           // Outbound delivery failed after retries

  // ── Conversation Events ──
  'conversation:created': ConversationCreatedEvent;
  'conversation:updated': ConversationUpdatedEvent;
  'conversation:locked': ConversationLockedEvent;
  'conversation:unlocked': ConversationUnlockedEvent;

  // ── AI Events ──
  'ai:evaluation_queued': AIEvaluationQueuedEvent;
  'ai:evaluation_complete': AIEvaluationCompleteEvent;
  'ai:evaluation_cancelled': AIEvaluationCancelledEvent;
  'ai:draft_created': AIDraftCreatedEvent;
  'ai:auto_sent': AIAutoSentEvent;

  // ── Channel Events ──
  'channel:connected': ChannelStatusEvent;
  'channel:disconnected': ChannelStatusEvent;
  'channel:error': ChannelErrorEvent;
  'channel:tfa_required': TFARequiredEvent;

  // ── Email Events ──
  'email:received': EmailReceivedEvent;           // Raw email from IMAP
  'email:parsed': EmailParsedEvent;               // After OTA parser
  'email:parse_failed': EmailParseFailedEvent;    // Parser couldn't handle it

  // ── WhatsApp Events ──
  'whatsapp:connected': WhatsAppConnectionEvent;
  'whatsapp:disconnected': WhatsAppConnectionEvent;
  'whatsapp:qr_generated': WhatsAppQREvent;
  'whatsapp:message_received': WhatsAppInboundEvent;
}

// ── Message Event Payloads ──

export interface MessageReceivedEvent {
  message_id: string;
  conversation_id: string;
  guest_id: string;
  property_id: string;
  org_id: string;
  channel: ChannelType;
  content: string;
  sender_type: MessageSenderType;
  external_id?: string;
  is_new_conversation: boolean;
  timestamp: string;
}

export interface MessageSentEvent {
  message_id: string;
  conversation_id: string;
  property_id: string;
  org_id: string;
  channel: ChannelType;
  content: string;
  sender_type: MessageSenderType;
  sender_id: string;
  delivery_status: DeliveryStatus;
  timestamp: string;
}

export interface DeliveryUpdatedEvent {
  message_id: string;
  conversation_id: string;
  org_id: string;
  previous_status: DeliveryStatus;
  new_status: DeliveryStatus;
  timestamp: string;
}

export interface MessageFailedEvent {
  message_id: string;
  conversation_id: string;
  property_id: string;
  org_id: string;
  channel: ChannelType;
  error: string;
  attempts: number;
  timestamp: string;
}

// ── Conversation Event Payloads ──

export interface ConversationCreatedEvent {
  conversation_id: string;
  guest_id: string;
  property_id: string;
  org_id: string;
  channel: ChannelType;
  timestamp: string;
}

export interface ConversationUpdatedEvent {
  conversation_id: string;
  org_id: string;
  changes: Partial<{
    status: ConversationStatus;
    assigned_to: string | null;
    is_starred: boolean;
    ai_enabled: boolean;
    unread_count: number;
  }>;
  updated_by?: string;   // User ID
  timestamp: string;
}

export interface ConversationLockedEvent {
  conversation_id: string;
  org_id: string;
  locked_by: string;     // User ID
  user_name: string;
  timestamp: string;
}

export interface ConversationUnlockedEvent {
  conversation_id: string;
  org_id: string;
  timestamp: string;
}

// ── AI Event Payloads ──

export interface AIEvaluationQueuedEvent {
  message_id: string;
  conversation_id: string;
  property_id: string;
  org_id: string;
  job_id: string;         // BullMQ job ID
  timestamp: string;
}

export interface AIEvaluationCompleteEvent {
  evaluation_id: string;
  message_id: string;
  conversation_id: string;
  property_id: string;
  org_id: string;
  detected_intent: string;
  detected_stage: GuestLifecycleStage;
  routing_decision: AIRoutingDecision;
  generated_response?: string;
  latency_ms: number;
  timestamp: string;
}

export interface AIEvaluationCancelledEvent {
  evaluation_id?: string;
  message_id: string;
  conversation_id: string;
  org_id: string;
  cancelled_by: string;   // User ID
  reason: string;          // "human_opened_conversation"
  timestamp: string;
}

export interface AIDraftCreatedEvent {
  evaluation_id: string;
  conversation_id: string;
  org_id: string;
  draft_content: string;
  detected_intent: string;
  timestamp: string;
}

export interface AIAutoSentEvent {
  evaluation_id: string;
  message_id: string;
  conversation_id: string;
  org_id: string;
  content: string;
  channel: ChannelType;
  timestamp: string;
}

// ── Channel Event Payloads ──

export interface ChannelStatusEvent {
  channel_connection_id: string;
  property_id: string;
  org_id: string;
  channel: ChannelType;
  status: ConnectionStatus;
  timestamp: string;
}

export interface ChannelErrorEvent extends ChannelStatusEvent {
  error: string;
  error_count: number;
  next_retry_at?: string;
}

export interface TFARequiredEvent {
  channel_connection_id: string;
  property_id: string;
  org_id: string;
  channel: ChannelType;
  tfa_challenge_id: string;
  tfa_type: string;
  masked_target?: string;
  expires_at: string;
  timestamp: string;
}

// ── Email Event Payloads ──

export interface EmailReceivedEvent {
  email_connection_id: string;
  property_id: string;
  org_id: string;
  uid: number;            // IMAP UID
  from: string;
  subject: string;
  date: string;
  raw_size: number;
  timestamp: string;
}

export interface EmailParsedEvent {
  email_connection_id: string;
  property_id: string;
  org_id: string;
  channel: ChannelType;
  parsed: {
    guest_name: string;
    message_content: string;
    reservation_id?: string;
    thread_id?: string;
    reply_to_address?: string;
  };
  timestamp: string;
}

export interface EmailParseFailedEvent {
  email_connection_id: string;
  property_id: string;
  org_id: string;
  from: string;
  subject: string;
  error: string;
  raw_email_path?: string; // Archived raw email location
  timestamp: string;
}

// ── WhatsApp Event Payloads ──

export interface WhatsAppConnectionEvent {
  channel_connection_id: string;
  property_id: string;
  org_id: string;
  phone_number: string;
  status: 'connected' | 'disconnected';
  reason?: string;
  timestamp: string;
}

export interface WhatsAppQREvent {
  channel_connection_id: string;
  property_id: string;
  org_id: string;
  qr_data: string;        // QR code string (for QR generation in UI)
  expires_at: string;
  timestamp: string;
}

export interface WhatsAppInboundEvent {
  channel_connection_id: string;
  property_id: string;
  org_id: string;
  from_jid: string;
  from_phone: string;
  from_name?: string;
  content: string;
  message_type: 'text' | 'image' | 'document' | 'audio' | 'video';
  wa_message_id: string;
  timestamp: string;
}

// ============================================================================
// WEBSOCKET EVENTS (Frontend ↔ Backend)
// ============================================================================
// Transport: Socket.io
// Auth: JWT token validated on handshake (T-077)
// Rooms: org:{org_id} (all org events), conv:{conversation_id} (conversation-specific)

/**
 * Socket.io Room Strategy:
 *
 * On connect:
 *   1. Validate JWT from auth header/query
 *   2. Extract org_id from JWT payload
 *   3. Auto-join room: org:{org_id}
 *
 * On viewing conversation:
 *   4. Client emits: join_conversation { conversation_id }
 *   5. Server validates org_id ownership
 *   6. Server joins client to room: conv:{conversation_id}
 *   7. Server marks conversation as read (reset unread_count)
 *
 * On leaving conversation:
 *   8. Client emits: leave_conversation { conversation_id }
 *   9. Server removes client from room
 */

// ── Server → Client Events ──

export interface ServerToClientEvents {
  // New message in any conversation (sent to org room)
  new_message: (payload: WSNewMessage) => void;

  // Conversation metadata changed
  conversation_updated: (payload: WSConversationUpdated) => void;

  // Message delivery status changed
  delivery_status: (payload: WSDeliveryStatus) => void;

  // Agent is replying to a conversation
  agent_replying: (payload: WSAgentReplying) => void;

  // Typing indicator
  typing: (payload: WSTyping) => void;

  // AI evaluation complete (draft available or auto-sent)
  ai_update: (payload: WSAIUpdate) => void;

  // Channel connection status changed
  channel_status: (payload: WSChannelStatus) => void;

  // 2FA required for a channel
  tfa_required: (payload: WSTFARequired) => void;

  // WhatsApp QR code for pairing
  whatsapp_qr: (payload: WSWhatsAppQR) => void;

  // Error notification
  error: (payload: WSError) => void;
}

// ── Client → Server Events ──

export interface ClientToServerEvents {
  // Join a specific conversation room
  join_conversation: (payload: { conversation_id: string }) => void;

  // Leave a specific conversation room
  leave_conversation: (payload: { conversation_id: string }) => void;

  // Typing indicator (client is typing in a conversation)
  typing_start: (payload: { conversation_id: string }) => void;

  // Stopped typing
  typing_stop: (payload: { conversation_id: string }) => void;

  // Mark conversation as read
  mark_read: (payload: { conversation_id: string }) => void;

  // Ping (keep-alive)
  ping: () => void;
}

// ── WebSocket Payload Types ──

export interface WSNewMessage {
  message: {
    id: string;
    conversation_id: string;
    content: string;
    sender_type: MessageSenderType;
    sender: {
      id?: string;
      name: string;
    };
    channel: ChannelType;
    delivery_status?: DeliveryStatus;
    is_internal_note: boolean;
    sent_at: string;
  };
  conversation: {
    id: string;
    last_message_at: string;
    last_message_preview: string;
    unread_count: number;
    status: ConversationStatus;
  };
}

export interface WSConversationUpdated {
  conversation_id: string;
  changes: Partial<{
    status: ConversationStatus;
    assigned_to: { id: string; name: string } | null;
    is_starred: boolean;
    ai_enabled: boolean;
    unread_count: number;
    last_message_at: string;
    last_message_preview: string;
  }>;
  updated_by?: {
    id: string;
    name: string;
  };
}

export interface WSDeliveryStatus {
  message_id: string;
  conversation_id: string;
  status: DeliveryStatus;
  failed_reason?: string;       // Only present when status === 'failed'
  timestamp: string;
}

export interface WSAgentReplying {
  conversation_id: string;
  agent: {
    id: string;
    name: string;
  };
  is_replying: boolean;         // true = started, false = stopped
}

export interface WSTyping {
  conversation_id: string;
  user: {
    id: string;
    name: string;
  };
  is_typing: boolean;
}

export interface WSAIUpdate {
  conversation_id: string;
  type: 'draft_available' | 'auto_sent' | 'routed_to_human' | 'cancelled';
  evaluation: {
    id: string;
    detected_intent: string;
    routing_decision: AIRoutingDecision;
    generated_response?: string;
    routing_reason: string;
  };
}

export interface WSChannelStatus {
  channel_connection_id: string;
  channel_type: ChannelType;
  property_id: string;
  property_name: string;
  status: ConnectionStatus;
  error_message?: string;
}

export interface WSTFARequired {
  channel_connection_id: string;
  channel_type: ChannelType;
  property_name: string;
  tfa_challenge_id: string;
  masked_target?: string;
  expires_at: string;
}

export interface WSWhatsAppQR {
  channel_connection_id: string;
  property_id: string;
  qr_data: string;
  expires_at: string;
}

export interface WSError {
  code: string;
  message: string;
  conversation_id?: string;
}

// ============================================================================
// BULLMQ JOB DEFINITIONS
// ============================================================================
// Used by: Sprint 6 (outbound), Sprint 8 (AI evaluation)

/** channel-outbound queue job data */
export interface OutboundJobData {
  message_id: string;
  conversation_id: string;
  property_id: string;
  org_id: string;
  channel: ChannelType;
  content: string;
  recipient: {
    // Channel-specific recipient info
    thread_id?: string;        // Airbnb thread ID
    reply_to_email?: string;   // Booking.com relay address
    phone_number?: string;     // WhatsApp number
    jid?: string;              // WhatsApp JID
  };
  priority: 'high' | 'medium' | 'low';  // high=agent reply, medium=AI auto-send, low=enrichment
  attempt: number;
  max_attempts: number;        // default 3
}

/** ai-evaluation queue job data */
export interface AIEvaluationJobData {
  message_id: string;
  conversation_id: string;
  property_id: string;
  org_id: string;
  channel: ChannelType;
  message_content: string;
  guest_name: string;
  conversation_history: Array<{
    sender_type: MessageSenderType;
    content: string;
    sent_at: string;
  }>;
}
