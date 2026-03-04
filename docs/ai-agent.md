# Tarksh Inbox - AI Agent Design

## Overview

The AI agent is the core differentiator of Tarksh Inbox. Unlike rule-based autoresponders (if guest says X, reply Y), the AI agent understands guest intent, references property-specific knowledge, and responds naturally across the full guest lifecycle.

**AI Provider**: Claude API (Anthropic)
**Approach**: Retrieval-augmented generation (RAG) with property knowledge base
**Confidence routing**: Auto-send / draft for review / route to human

---

## Guest Lifecycle Stages

The AI agent is lifecycle-aware - it knows where the guest is in their journey and tailors responses accordingly.

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Pre-Booking  │───▶│ Post-Booking│───▶│ Pre-Arrival │───▶│ During Stay │───▶│Post-Checkout│
│              │    │             │    │             │    │             │    │             │
│ Inquiries,   │    │ Confirmation│    │ Check-in    │    │ Support,    │    │ Thank you,  │
│ questions    │    │ details     │    │ instructions│    │ requests    │    │ review ask  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Stage 1: Pre-Booking
**Context**: Guest is considering the property but hasn't booked yet.
**AI behavior**:
- Answer questions about the property (amenities, location, rules)
- Highlight property features relevant to the guest's question
- Be helpful and encouraging (goal: convert inquiry to booking)
- Never make promises about pricing or availability (refer to OTA listing)

**Example queries**:
- "Is there parking available?"
- "How far is it from the beach?"
- "Do you allow pets?"
- "Is there a kitchen I can use?"

### Stage 2: Post-Booking (Confirmation)
**Context**: Guest has just booked. Booking is confirmed.
**AI behavior**:
- Welcome the guest and express excitement
- Confirm key booking details (dates, property)
- Ask if they have any questions before their stay
- Proactive: send a confirmation message with key info

**Automated messages** (triggered by booking event):
- "Welcome! Your booking at {{property_name}} is confirmed for {{check_in_date}} to {{check_out_date}}. Let me know if you have any questions!"

### Stage 3: Pre-Arrival
**Context**: 1-3 days before check-in.
**AI behavior**:
- Send check-in instructions (time, location, key/code access)
- Share directions to the property
- Share WiFi details
- Mention house rules
- Ask about estimated arrival time

**Automated messages** (triggered by time - 24h before check-in):
- Check-in instructions with all details from knowledge base
- Directions from common arrival points

### Stage 4: During Stay
**Context**: Guest is currently staying at the property.
**AI behavior**:
- Answer operational questions (WiFi, appliances, laundry, etc.)
- Provide local recommendations (restaurants, attractions, transport)
- Handle maintenance/issue reports (escalate to human for physical issues)
- Be responsive and helpful

**Escalation triggers** (always route to human):
- Complaints about cleanliness or damage
- Safety concerns
- Requests for refunds or compensation
- Maintenance emergencies (no hot water, AC broken, etc.)
- Noise complaints

### Stage 5: Post-Checkout
**Context**: Guest has checked out.
**AI behavior**:
- Thank the guest for their stay
- Ask for a review (tactfully, not pushy)
- Handle any follow-up questions (forgotten items, receipts)
- Address feedback gracefully

**Automated messages** (triggered 2-4 hours after checkout):
- "Thank you for staying with us! We hope you had a wonderful time. If you enjoyed your stay, we'd love a review."

---

## Property Knowledge Base

### Structure

Each property has a structured knowledge base that the AI uses to ground its responses.

```json
{
  "property_name": "Sunset Villa, Goa",
  "property_type": "villa",

  "check_in": {
    "time": "14:00",
    "early_check_in": "Subject to availability, contact us to request",
    "instructions": [
      "Property address: 123 Beach Road, Calangute, Goa",
      "You will find a lockbox at the main gate",
      "Lockbox code will be shared 1 hour before check-in",
      "Open the gate and walk straight to the main entrance",
      "Keys are inside the lockbox"
    ],
    "self_check_in": true
  },

  "check_out": {
    "time": "11:00",
    "late_check_out": "Available until 1 PM for an additional charge of INR 1000, subject to availability",
    "instructions": [
      "Please return keys to the lockbox",
      "Ensure all windows and doors are locked",
      "Place used towels in the bathroom",
      "Take all your belongings"
    ]
  },

  "wifi": {
    "network_name": "SunsetVilla_Guest",
    "password": "welcome2024"
  },

  "amenities": [
    "Swimming pool (open 7 AM - 9 PM)",
    "Fully equipped kitchen",
    "Washing machine",
    "Air conditioning in all bedrooms",
    "Free parking (2 cars)",
    "BBQ grill",
    "Garden area",
    "Beach towels provided"
  ],

  "house_rules": [
    "No smoking inside the property",
    "No parties or events",
    "Quiet hours: 10 PM - 8 AM",
    "Maximum 8 guests",
    "Pets allowed (small dogs only, prior approval required)",
    "No outside guests without prior permission"
  ],

  "directions": {
    "from_airport": "Dabolim Airport is 45 min drive. Take NH66 towards Calangute. Turn right at the Calangute junction.",
    "from_station": "Thivim Railway Station is 30 min drive. Take the road towards Mapusa, then Calangute.",
    "landmarks": "Near St. Alex Church, Calangute. 5 min walk from Calangute Beach."
  },

  "parking": {
    "available": true,
    "details": "Free covered parking for 2 cars. Street parking available for additional vehicles."
  },

  "nearby": {
    "restaurants": [
      "Souza Lobo (5 min walk) - Goan seafood",
      "Infantaria (10 min walk) - Bakery and cafe",
      "Thalassa (15 min drive) - Greek cuisine with ocean view"
    ],
    "attractions": [
      "Calangute Beach (5 min walk)",
      "Baga Beach (10 min drive)",
      "Fort Aguada (20 min drive)",
      "Saturday Night Market, Arpora (15 min drive)"
    ],
    "essentials": [
      "Mini supermarket (3 min walk)",
      "ATM (5 min walk)",
      "Pharmacy (5 min walk)"
    ]
  },

  "emergency": {
    "contact_name": "Ravi (Property Manager)",
    "contact_phone": "+91-9876543210",
    "hospital": "Calangute Health Center (10 min drive)",
    "police": "Calangute Police Station: +91-832-2276001"
  },

  "custom_faqs": [
    {
      "question": "Is the pool heated?",
      "answer": "The pool is not heated, but water temperature is pleasant year-round in Goa."
    },
    {
      "question": "Can I arrange a cook?",
      "answer": "Yes! We can arrange a local cook for your meals. Please let us know at least 24 hours in advance. Cost is approximately INR 500-800 per meal depending on the menu."
    },
    {
      "question": "Are there mosquitoes?",
      "answer": "Goa is tropical, so mosquitoes are present especially in the evenings. We provide mosquito repellent and the bedrooms have window screens. We recommend using the repellent during sunset hours."
    }
  ],

  "response_preferences": {
    "tone": "friendly",
    "language": "english",
    "sign_off": "Best regards,\nTeam Sunset Villa"
  }
}
```

### Knowledge Base Management UI

Property owners configure their knowledge base through a form-based UI:

1. **Basic Info**: Property name, type, address
2. **Check-in / Check-out**: Times, instructions, early/late policies
3. **WiFi**: Network name and password
4. **Amenities**: Checklist + free text for details
5. **House Rules**: List of rules
6. **Directions**: From key arrival points
7. **Nearby**: Restaurants, attractions, essentials
8. **Emergency**: Contact info, hospital, police
9. **Custom FAQs**: Add unlimited Q&A pairs
10. **Response Preferences**: Tone, language, sign-off

---

## AI Prompt Architecture

### System Prompt Template

```
You are a helpful property assistant for {{property_name}}. Your role is to
answer guest questions accurately based on the property information provided below.

IMPORTANT RULES:
1. ONLY answer based on the property information provided. Never make up information.
2. If you don't have the answer, say "Let me check with our team and get back to you"
   and flag for human review.
3. Never discuss pricing, discounts, or refunds - direct these to the property manager.
4. Never share information about other guests.
5. Be warm, professional, and concise.
6. Match the tone preference: {{tone}}.
7. End messages with: {{sign_off}}

CURRENT CONTEXT:
- Guest name: {{guest_name}}
- Lifecycle stage: {{stage}}
- Booking dates: {{check_in}} to {{check_out}}
- Channel: {{channel}}

PROPERTY INFORMATION:
{{knowledge_base_json}}

CONVERSATION HISTORY:
{{previous_messages}}
```

### Confidence Scoring

The AI service returns a confidence score with each response:

```typescript
interface AIResponse {
  message: string;        // The generated response
  confidence: number;     // 0-100
  stage: string;          // Detected lifecycle stage
  intent: string;         // Detected guest intent (e.g., "wifi_query", "check_in_info")
  sources: string[];      // Which KB fields were used
  shouldEscalate: boolean; // AI recommends human handling
  escalationReason?: string;
}
```

**Confidence determination**:
- **90-100**: Query directly answered by knowledge base content (WiFi password, check-in time)
- **70-89**: Query related to knowledge base but requires some inference (nearby recommendations, policy interpretation)
- **50-69**: Query partially covered by knowledge base (general questions about the area)
- **0-49**: Query outside knowledge base scope (complaints, cancellations, unique requests)

### Routing Logic

```
                    New Guest Message
                           │
                    ┌──────▼──────┐
                    │  AI Agent   │
                    │  Evaluates  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐
        │ Confidence │ │ 70-89 │ │ Below 70  │
        │   90+      │ │       │ │           │
        └─────┬─────┘ └───┬───┘ └─────┬─────┘
              │            │            │
        ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐
        │ Auto-send  │ │ Draft │ │ Route to  │
        │ response   │ │ for   │ │ human     │
        │ immediately│ │ review│ │ agent     │
        └───────────┘ └───────┘ └───────────┘
```

**Per-property overrides**:
- Property owner can set AI to "Draft only" mode (all responses require approval)
- Property owner can disable AI for specific conversation types
- Operating hours: AI auto-responds only during configured hours

---

## Automated Message Triggers

Beyond reactive responses, the AI can send proactive messages at key lifecycle moments.

### Trigger Schedule

| Trigger | When | Message Type |
|---------|------|-------------|
| Booking confirmed | Immediately after booking | Welcome + confirmation |
| Pre-arrival | 24 hours before check-in | Check-in instructions |
| Check-in day | Morning of check-in day | Reminder + arrival time request |
| Mid-stay check | 24 hours after check-in | "How's everything? Need anything?" |
| Pre-checkout | Evening before check-out | Check-out instructions + reminder |
| Post-checkout | 2-4 hours after check-out | Thank you + review request |

### Trigger Configuration

Property owners can:
- Enable/disable each automated trigger
- Customize the message content (or use AI-generated default)
- Set the timing offset (e.g., send pre-arrival message 48h before instead of 24h)
- Preview what the message will look like before enabling

---

## AI Learning & Improvement

### MVP: Template-Based Learning

When a human agent edits an AI draft before sending:
1. The original AI response and the human-edited version are both stored
2. Patterns are tracked: which types of queries get edited most?
3. This data informs knowledge base improvements (not automatic model fine-tuning)

### Future: Feedback Loop (Phase 3+)

```
Guest Query ──► AI Response ──► Human Review ──► Correction
                                                      │
                                                      ▼
                                              Knowledge Base Update
                                              (suggested, not automatic)
```

- Dashboard showing AI performance: auto-resolution rate, correction rate, common edits
- Suggestions for knowledge base improvements based on frequently asked questions the AI couldn't answer
- Sentiment analysis of guest responses to AI messages (was the guest satisfied?)

---

## Safety & Guardrails

### Never Auto-Respond To

These topics ALWAYS route to human, regardless of confidence score:

1. **Cancellations** or booking modifications
2. **Refund** requests
3. **Complaints** about cleanliness, safety, damage
4. **Legal** matters or disputes
5. **Payment** issues
6. **Emergencies** (medical, security, fire)
7. **Personal information** requests beyond what's in the booking
8. **Other guest** inquiries (privacy)

### Content Filters

- AI never shares other guests' information
- AI never makes financial commitments or promises
- AI never provides medical or legal advice
- AI responses are limited to 500 characters (concise, chat-appropriate)
- AI never uses information not in the knowledge base

### Audit Trail

Every AI interaction is logged:
- Original guest message
- AI-generated response
- Confidence score
- Whether auto-sent or drafted
- If drafted: human edits and final sent version
- Guest's response (for feedback analysis)

---

## Technical Implementation

### LLM Provider Abstraction

The AI service depends on a `LLMProvider` interface — not directly on Claude. This enables swapping providers, A/B testing, fallback chains, and enterprise customers bringing their own API keys.

```typescript
// --- LLM Provider interface (in /ai/interfaces.ts) ---

interface LLMProvider {
  readonly id: string;             // 'claude', 'openai', etc.
  readonly name: string;

  /** Fast intent classification (cheap, low-latency model) */
  classifyIntent(
    message: string,
    context: IntentContext
  ): Promise<IntentResult>;

  /** Generate a full response (capable model) */
  generateResponse(
    prompt: string,
    context: ResponseContext
  ): Promise<GeneratedResponse>;
}

interface IntentContext {
  conversationHistory: Message[];
  knowledgeBaseFields: string[];   // available KB field names
  neverAutoList: string[];         // intents that always route to human
}

interface IntentResult {
  intent: string;                  // e.g., 'wifi_query', 'complaint', 'unknown'
  stage: LifecycleStage;
  kbFieldsMatched: string[];      // which KB fields are relevant
  routing: 'auto_send' | 'draft' | 'route_to_human';
  tokenUsage: TokenUsage;
  latencyMs: number;
}

interface ResponseContext {
  property: Property;
  knowledgeBase: KnowledgeBase;
  guest: Guest;
  stage: LifecycleStage;
  intent: string;
  conversationHistory: Message[];
  channelCapabilities: ChannelCapabilities;  // from channel adapter
}

interface GeneratedResponse {
  message: string;
  sources: string[];               // which KB fields were used
  tokenUsage: TokenUsage;
  latencyMs: number;
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
  estimatedCost: number;
}
```

```typescript
// --- Claude implementation (in /ai/providers/claude.ts) ---

class ClaudeProvider implements LLMProvider {
  readonly id = 'claude';
  readonly name = 'Claude (Anthropic)';

  async classifyIntent(message: string, context: IntentContext): Promise<IntentResult> {
    // Uses Claude Haiku for fast, cheap intent classification
    // via structured output / tool use for deterministic results
  }

  async generateResponse(prompt: string, context: ResponseContext): Promise<GeneratedResponse> {
    // Uses Claude Sonnet for high-quality response generation
    // Only called when intent is matched and KB has data
  }
}
```

**Adding a new LLM provider**: Implement `LLMProvider` interface (e.g., `OpenAIProvider`, `GeminiProvider`). The AI service uses whichever provider is configured per property/org.

### AI Service Architecture

The AI service orchestrates intent classification, KB matching, and response generation through the `LLMProvider` interface.

```typescript
class AIAgentService {
  constructor(private llmProvider: LLMProvider) {}

  // Evaluate a new message and generate response
  async evaluateMessage(
    message: Message,
    conversation: Conversation,
    property: Property,
    knowledgeBase: KnowledgeBase
  ): Promise<AIResponse>

  // Detect which lifecycle stage the guest is in
  detectLifecycleStage(
    booking: Booking | null,
    currentDate: Date
  ): LifecycleStage

  // Build the system prompt with property context
  buildPrompt(
    property: Property,
    knowledgeBase: KnowledgeBase,
    guest: Guest,
    stage: LifecycleStage,
    conversationHistory: Message[]
  ): string

  // Execute routing decision (deterministic, not LLM-dependent)
  routeResponse(
    intentResult: IntentResult,
    propertySettings: AISettings
  ): 'auto_send' | 'draft' | 'route_to_human'
}
```

### Intent-to-KB Field Registry

Instead of hardcoding which KB fields map to which intents, use a registry:

```typescript
class IntentKBRegistry {
  private mappings = new Map<string, string[]>();

  register(intent: string, kbFields: string[]): void {
    this.mappings.set(intent, kbFields);
  }

  getFields(intent: string): string[] | undefined {
    return this.mappings.get(intent);
  }

  hasMapping(intent: string): boolean {
    return this.mappings.has(intent);
  }
}

const intentKBRegistry = new IntentKBRegistry();

// Built-in mappings
intentKBRegistry.register('wifi_query', ['wifi.network_name', 'wifi.password']);
intentKBRegistry.register('checkin_info', ['check_in.time', 'check_in.instructions', 'check_in.early_check_in']);
intentKBRegistry.register('checkout_info', ['check_out.time', 'check_out.instructions', 'check_out.late_check_out']);
intentKBRegistry.register('directions', ['directions.from_airport', 'directions.from_station', 'directions.landmarks']);
intentKBRegistry.register('parking', ['parking.available', 'parking.details']);
intentKBRegistry.register('amenities', ['amenities']);
intentKBRegistry.register('house_rules', ['house_rules']);
intentKBRegistry.register('nearby_food', ['nearby.restaurants']);
intentKBRegistry.register('nearby_attractions', ['nearby.attractions']);
intentKBRegistry.register('emergency', ['emergency.contact_name', 'emergency.contact_phone']);

// Property owners can add custom mappings via custom FAQs
// Custom FAQs create implicit intent mappings: faq_{index} → custom_faqs[index]
```

### Knowledge Base Validation

The KB is validated at save time using Zod schemas, with support for custom sections:

```typescript
import { z } from 'zod';

const wifiSchema = z.object({
  network_name: z.string().min(1),
  password: z.string().min(1),
}).optional();

const checkInSchema = z.object({
  time: z.string(),
  early_check_in: z.string().optional(),
  instructions: z.array(z.string()),
  self_check_in: z.boolean().default(false),
});

const checkOutSchema = z.object({
  time: z.string(),
  late_check_out: z.string().optional(),
  instructions: z.array(z.string()),
});

const knowledgeBaseSchema = z.object({
  property_name: z.string().min(1),
  property_type: z.string().min(1),
  check_in: checkInSchema,
  check_out: checkOutSchema,
  wifi: wifiSchema,
  amenities: z.array(z.string()).optional(),
  house_rules: z.array(z.string()).optional(),
  directions: z.record(z.string()).optional(),
  parking: z.object({
    available: z.boolean(),
    details: z.string(),
  }).optional(),
  nearby: z.record(z.array(z.string())).optional(),
  emergency: z.object({
    contact_name: z.string(),
    contact_phone: z.string(),
    hospital: z.string().optional(),
    police: z.string().optional(),
  }).optional(),
  custom_faqs: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional(),
  response_preferences: z.object({
    tone: z.enum(['friendly', 'professional', 'casual']),
    language: z.string().default('english'),
    sign_off: z.string().optional(),
  }).optional(),
  // Extensible: property types can add custom sections
  custom_sections: z.record(z.string(), z.unknown()).optional(),
});

type KnowledgeBase = z.infer<typeof knowledgeBaseSchema>;
```

`custom_sections` allows property-type-specific data (e.g., `marina_location` for a boat rental, `spa_hours` for a resort) without schema changes.

### Queue Processing

AI evaluation jobs are dispatched via the `JobQueue` interface (see `architecture.md`), not directly via BullMQ.

```
ai-evaluation-queue:
  ├── Priority: high (unread messages from active stays)
  ├── Priority: medium (pre-booking inquiries)
  ├── Priority: low (post-checkout messages)
  │
  ├── Concurrency: 5 (parallel AI evaluations)
  ├── Rate limit: 50 requests/minute (LLM provider rate limit)
  └── Retry: 3 attempts with exponential backoff
```

### Cost Management

- LLM API calls cost per token (provider-specific pricing)
- Estimated cost per message: ~$0.01-0.05 depending on conversation length
- At 1000 messages/day = $10-50/day in AI costs
- Optimization: cache common responses (WiFi password, check-in time) to avoid redundant API calls
- Only invoke AI for genuinely new queries, not for every incoming message
- `TokenUsage` tracked per evaluation via `LLMProvider` responses, stored in `AIEvaluation` table
- Per-property and per-org cost caps configurable in settings
