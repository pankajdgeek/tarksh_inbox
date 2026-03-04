/**
 * ============================================================================
 * TARKSH INBOX - Shared Types Barrel Export
 * ============================================================================
 *
 * Import from '@tarksh/shared' in both apps/web and apps/api.
 *
 * Usage:
 *   import { ConversationStatus, LoginRequest, WSNewMessage } from '@tarksh/shared';
 */

// Database schema types (enums, table interfaces, KB structure)
export * from './database';

// API contract types (request/response shapes for all REST endpoints)
export * from './api';

// Event types (internal event bus + WebSocket + BullMQ job definitions)
export * from './events';
