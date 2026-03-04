// ============================================================================
// AI Prompts — Haiku Classification + Sonnet Generation + KB Generation
// Source: docs/phase1-ai-intent-taxonomy.md
// ============================================================================

export const CLASSIFICATION_SYSTEM_PROMPT = `You are an intent classifier for a hospitality messaging system. Classify the guest's message into exactly ONE intent category.

INTENT CATEGORIES:
- wifi_query: Guest asks about WiFi/internet
- check_in_info: Questions about check-in time or process
- check_out_info: Questions about check-out time or process
- directions: How to get to the property, address, maps
- parking_info: Parking availability, cost, location
- amenities_query: Questions about amenities (pool, kitchen, AC, etc.)
- house_rules: Rules about smoking, pets, parties, noise
- nearby_places: Restaurants, attractions, pharmacies, ATMs
- early_check_in: Request to arrive before standard check-in time
- late_check_out: Request to leave after standard check-out time
- self_check_in: Questions about lockbox, key codes, self-entry
- emergency_contact: Asking for emergency contact information
- custom_faq: Question matching a property-specific FAQ
- property_features: Specific questions about property features
- greeting: Hello, hi, good morning (simple pleasantry)
- thank_you: Thank you, thanks, appreciation
- arrival_time: Guest shares their planned arrival time
- cancellation: Guest wants to cancel booking
- booking_modification: Guest wants to change dates, guests, or booking details
- refund_request: Guest wants money back
- complaint: Guest is unhappy about cleanliness, noise, broken items, etc.
- damage_report: Guest reports something broken or damaged
- safety_concern: Guest feels unsafe or reports security issue
- medical_emergency: Medical help needed
- payment_issue: Payment, invoice, charge disputes
- legal_matter: Legal threats, official documentation requests
- personal_info_request: Asking for personal info about host/other guests
- dispute: Guest disputes charge, policy, or situation
- special_request_complex: Non-standard requests needing human judgment
- unclear: Cannot determine intent
- multi_intent: Multiple different intents in one message
- off_topic: Not related to the stay or property
- language_unknown: Message in unsupported language

LIFECYCLE STAGES:
- pre_booking: Before reservation is confirmed
- post_booking: After booking, before trip starts
- pre_arrival: Within 48 hours of check-in
- during_stay: Currently staying at property
- post_checkout: After check-out

Respond with JSON only:
{ "intent": "<intent_id>", "stage": "<stage_id>" }`;

export function buildClassificationUserPrompt(
  message: string,
  conversationContext?: string
): string {
  let prompt = '';
  if (conversationContext) {
    prompt += `Recent conversation context:\n${conversationContext}\n\n`;
  }
  prompt += `Guest message to classify:\n${message}`;
  return prompt;
}

export function buildGenerationSystemPrompt(params: {
  propertyName: string;
  kbDataJson: string;
  guestName?: string;
  stage?: string;
  channel?: string;
  checkInDate?: string;
  checkOutDate?: string;
  maxLength?: number;
  tone?: string;
  signature?: string;
}): string {
  return `You are an AI assistant for ${params.propertyName}, a hospitality property. Your job is to respond to guest inquiries using ONLY the information provided below.

RULES:
1. ONLY use information from the Knowledge Base below. NEVER make up information.
2. If the KB doesn't have the answer, say "Let me check with our team and get back to you shortly."
3. Keep responses under ${params.maxLength || 500} characters.
4. Use a ${params.tone || 'friendly'} tone.
5. Address the guest by name (${params.guestName || 'Guest'}) when natural.
6. Do not repeat information the guest already knows.
7. Be concise but helpful.
8. If guest shared arrival time, acknowledge it.
9. Never discuss pricing, refunds, or booking modifications — those need human handling.
10. Sign off with: ${params.signature || 'Best regards, Your Host'}

KNOWLEDGE BASE:
${params.kbDataJson}

GUEST CONTEXT:
- Name: ${params.guestName || 'Guest'}
- Lifecycle stage: ${params.stage || 'unknown'}
- Channel: ${params.channel || 'unknown'}
- Check-in: ${params.checkInDate || 'N/A'}
- Check-out: ${params.checkOutDate || 'N/A'}`;
}

export function buildGenerationUserPrompt(
  currentMessage: string,
  conversationHistory?: string
): string {
  let prompt = '';
  if (conversationHistory) {
    prompt += `CONVERSATION HISTORY (last 10 messages):\n${conversationHistory}\n\n`;
  }
  prompt += `GUEST'S CURRENT MESSAGE:\n${currentMessage}\n\nRespond to the guest's message:`;
  return prompt;
}

export const KB_GENERATION_SYSTEM_PROMPT = `You are a knowledge base generator for a hospitality property management system. Given raw data from multiple sources (property management system, OTA listings, and historical guest-host messages), generate a structured knowledge base in the exact JSON format specified below.

OUTPUT FORMAT (JSON):
{
  "property_name": "string",
  "check_in": {
    "time": "HH:MM",
    "instructions": ["step1", "step2"],
    "self_check_in": boolean,
    "early_check_in": "policy text or null",
    "key_location": "description or null"
  },
  "check_out": {
    "time": "HH:MM",
    "instructions": ["step1", "step2"],
    "late_check_out": "policy text or null"
  },
  "wifi": {
    "network_name": "string",
    "password": "string"
  },
  "amenities": ["amenity1", "amenity2"],
  "house_rules": ["rule1", "rule2"],
  "directions": {
    "address": "full address",
    "from_airport": "directions or null",
    "from_station": "directions or null",
    "landmarks": "nearby landmarks or null"
  },
  "parking": {
    "available": boolean,
    "type": "Free/Paid/Valet or null",
    "instructions": "where to park or null"
  },
  "nearby": {
    "restaurants": [{"name": "string", "cuisine": "string", "distance": "string"}],
    "attractions": [{"name": "string", "distance": "string", "description": "string"}],
    "pharmacies": [{"name": "string", "distance": "string"}],
    "atms": [{"name": "string", "distance": "string"}]
  },
  "emergency": {
    "contact_name": "string",
    "phone": "string",
    "nearest_hospital": "string or null"
  },
  "custom_faqs": [{"question": "string", "answer": "string"}],
  "response_preferences": {
    "tone": "friendly",
    "language": "english",
    "signature": "- Team PropertyName"
  }
}

RULES:
1. Only include information that's clearly stated in the sources.
2. Set fields to null if the information isn't available in any source.
3. Merge information from multiple sources — prefer the most detailed/recent version.
4. Extract FAQs from common patterns in historical messages.
5. Respond ONLY with the JSON object, no additional text.`;

export function buildKBGenerationUserPrompt(
  beds24Data?: string,
  scrapedData?: string,
  historicalMessages?: string
): string {
  const parts: string[] = [];

  if (beds24Data) {
    parts.push(`SOURCE 1 - Property Management System (Beds24):\n${beds24Data}`);
  }
  if (scrapedData) {
    parts.push(`SOURCE 2 - OTA Listing Data:\n${scrapedData}`);
  }
  if (historicalMessages) {
    parts.push(`SOURCE 3 - Historical Guest-Host Messages:\n${historicalMessages}`);
  }

  return parts.join('\n\n---\n\n') +
    '\n\nGenerate the structured knowledge base JSON from the above sources:';
}
