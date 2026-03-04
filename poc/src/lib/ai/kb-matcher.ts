// ============================================================================
// KB Field Matcher — Deterministic, zero LLM cost
// ============================================================================

import { KBMatchResult, KnowledgeBase, IntentConfidence } from '../types';
import { INTENT_TO_KB_MAP } from './intent-map';

/**
 * Resolve a dot-notation path (e.g., "wifi.network_name") against a KB object.
 * Returns the value if found and non-null, undefined otherwise.
 */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  // Treat empty arrays and empty strings as "no data"
  if (Array.isArray(current) && current.length === 0) return undefined;
  if (current === '') return undefined;

  return current ?? undefined;
}

/**
 * Match an intent against KB data. Returns which fields were found/missing.
 */
export function matchKBFields(
  intent: string,
  kb: KnowledgeBase
): KBMatchResult {
  const fieldsRequired = INTENT_TO_KB_MAP[intent];

  // Intents not in the map (never-auto, fallback) — no KB needed
  if (!fieldsRequired) {
    return {
      hasData: false,
      confidence: 'low',
      fieldsRequired: [],
      fieldsFound: [],
      fieldsMissing: [],
      kbData: {},
    };
  }

  // Template intents (greeting, thank_you, arrival_time) — no KB needed
  if (fieldsRequired.length === 0) {
    return {
      hasData: true,
      confidence: 'high',
      fieldsRequired: [],
      fieldsFound: [],
      fieldsMissing: [],
      kbData: { property_name: kb.property_name },
    };
  }

  const fieldsFound: string[] = [];
  const fieldsMissing: string[] = [];
  const kbData: Record<string, unknown> = { property_name: kb.property_name };

  for (const field of fieldsRequired) {
    const value = resolvePath(kb as unknown as Record<string, unknown>, field);
    if (value !== undefined) {
      fieldsFound.push(field);
      kbData[field] = value;
    } else {
      fieldsMissing.push(field);
    }
  }

  // Also include parent objects for richer context
  for (const field of fieldsFound) {
    const topLevel = field.split('.')[0];
    const parentValue = (kb as unknown as Record<string, unknown>)[topLevel];
    if (parentValue !== null && parentValue !== undefined) {
      kbData[topLevel] = parentValue;
    }
  }

  let confidence: IntentConfidence;
  if (fieldsMissing.length === 0) {
    confidence = 'high';
  } else if (fieldsFound.length > 0) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    hasData: fieldsFound.length > 0,
    confidence,
    fieldsRequired,
    fieldsFound,
    fieldsMissing,
    kbData,
  };
}
