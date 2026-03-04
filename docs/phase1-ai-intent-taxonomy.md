# AI Intent Taxonomy & Routing Decision Tree

> Sprint 8 prerequisite. Must be finalized before T-143 (intent classifier).
> Source: docs/ai-agent.md + docs/architecture-review.md P0.1 fix

---

## 1. How Deterministic Routing Works (NOT LLM Confidence)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INBOUND MESSAGE RECEIVED                        │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 1: INTENT CLASSIFICATION (Claude Haiku — cheap, fast)        │
│                                                                     │
│  Input: message_content + last 3 messages for context               │
│  Output: { intent: string, stage: GuestLifecycleStage }            │
│                                                                     │
│  System prompt: "Classify the guest's intent into exactly ONE of    │
│  the following categories: [intent list]. Also detect the guest     │
│  lifecycle stage. Respond ONLY with JSON."                          │
│                                                                     │
│  Cost: ~$0.002/call (~2000 tokens)                                  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 2: NEVER-AUTO CHECK (Hard-coded rules — zero LLM cost)       │
│                                                                     │
│  If intent ∈ NEVER_AUTO_INTENTS:                                    │
│    → routing_decision = "never_auto"                                │
│    → Route to human immediately                                     │
│    → DO NOT call Sonnet                                             │
│    → STOP                                                           │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ (intent is NOT in never-auto list)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 3: KB FIELD MATCHING (Rule-based — zero LLM cost)             │
│                                                                     │
│  Map intent → required KB fields (see INTENT_TO_KB_MAP below)       │
│  Check if property's KnowledgeBase has non-null data for fields     │
│                                                                     │
│  If ALL required KB fields have data:                               │
│    → kb_has_data = true                                             │
│    → intent_confidence = "high"                                     │
│    → Proceed to Step 4                                              │
│                                                                     │
│  If SOME required KB fields have data:                              │
│    → kb_has_data = true                                             │
│    → intent_confidence = "medium"                                   │
│    → Proceed to Step 4 (partial info, may need human follow-up)     │
│                                                                     │
│  If NO required KB fields have data:                                │
│    → kb_has_data = false                                            │
│    → intent_confidence = "low"                                      │
│    → routing_decision = "no_kb_match"                               │
│    → Route to human                                                 │
│    → STOP                                                           │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ (KB has data for this intent)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 4: RESPONSE GENERATION (Claude Sonnet — quality response)     │
│                                                                     │
│  Input: system_prompt (KB data + rules) + conversation_history      │
│  Output: generated_response (max 500 chars)                         │
│                                                                     │
│  System prompt includes:                                            │
│    - Property KB data (only relevant fields)                        │
│    - Guest context (name, stage, booking dates, channel)            │
│    - Response rules (tone, length, language)                        │
│    - Last 10 messages for context                                   │
│    - Instruction: ONLY use KB data, never invent information        │
│                                                                     │
│  Cost: ~$0.01-0.02/call (~3000-5000 tokens)                        │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 5: ROUTING DECISION (Rule-based)                              │
│                                                                     │
│  Check property.ai_mode:                                            │
│                                                                     │
│  "auto_send" + kb_has_data:                                         │
│    → routing_decision = "auto_send"                                 │
│    → Queue message for outbound delivery                            │
│    → Log AIEvaluation record                                        │
│                                                                     │
│  "draft_only" + kb_has_data:                                        │
│    → routing_decision = "draft"                                     │
│    → Show draft in composer for agent review                        │
│    → Emit WebSocket ai_update event                                 │
│    → Log AIEvaluation record                                        │
│                                                                     │
│  "disabled":                                                        │
│    → Skip all AI processing                                         │
│    → STOP                                                           │
│                                                                     │
│  Business hours check (if configured):                              │
│    → Outside hours + auto_send: queue for next business hour        │
│    → Outside hours + draft_only: create draft (agent sees later)    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Intent Taxonomy

### 2.1 Auto-Respondable Intents (AI CAN handle if KB has data)

| Intent ID | Category | Description | Required KB Fields | Example Messages |
|-----------|----------|-------------|-------------------|------------------|
| `wifi_query` | Amenities | Guest asks for WiFi details | `wifi.network_name`, `wifi.password` | "What's the WiFi password?" / "How do I connect to internet?" / "Is there WiFi?" |
| `check_in_info` | Check-in | Check-in time or process | `check_in.time`, `check_in.instructions` | "What time can I check in?" / "How do I get in?" / "Where do I pick up keys?" |
| `check_out_info` | Check-out | Check-out time or process | `check_out.time`, `check_out.instructions` | "What time is checkout?" / "Where do I leave the keys?" |
| `directions` | Location | How to get to property | `directions.address`, `directions.*` | "How do I get there from the airport?" / "What's the address?" / "Can you share location?" |
| `parking_info` | Amenities | Parking availability | `parking.*` | "Is there parking?" / "Where can I park?" / "Is parking free?" |
| `amenities_query` | Amenities | General amenity questions | `amenities` | "Is there a pool?" / "Do you have a washing machine?" / "Is kitchen available?" |
| `house_rules` | Rules | Property rules inquiry | `house_rules` | "Can I smoke?" / "Are pets allowed?" / "What are the rules?" |
| `nearby_places` | Location | Restaurants, attractions, etc. | `nearby.*` | "Any good restaurants nearby?" / "What to do around here?" / "Where's the nearest ATM?" |
| `early_check_in` | Check-in | Request for early arrival | `check_in.early_check_in` | "Can I arrive at 10am?" / "Is early check-in possible?" |
| `late_check_out` | Check-out | Request for late departure | `check_out.late_check_out` | "Can I check out late?" / "Can I stay till 2pm?" |
| `self_check_in` | Check-in | Self check-in details | `check_in.self_check_in`, `check_in.key_location` | "Is there a lockbox?" / "How does self check-in work?" |
| `emergency_contact` | Emergency | Emergency contact info | `emergency.*` | "Who do I call in emergency?" / "What's the emergency number?" |
| `custom_faq` | FAQ | Matches a custom FAQ entry | `custom_faqs` | Dynamically matched against FAQ question list |
| `greeting` | General | Simple greeting/pleasantry | — (no KB needed, use template) | "Hi!" / "Hello" / "Good morning" |
| `thank_you` | General | Gratitude expression | — (no KB needed, use template) | "Thank you!" / "Thanks for the help" / "Appreciate it" |
| `arrival_time` | Check-in | Guest shares arrival time | — (acknowledge + log) | "We'll arrive around 3pm" / "Our flight lands at 2pm" |
| `property_features` | Amenities | Specific feature questions | `amenities` | "How many bedrooms?" / "Is there AC?" / "Is there hot water?" |

### 2.2 NEVER-AUTO Intents (ALWAYS route to human)

| Intent ID | Category | Why Never Auto | Example Messages |
|-----------|----------|---------------|------------------|
| `cancellation` | Booking | Financial impact, policy decisions | "I need to cancel" / "Can I cancel my booking?" / "I won't be coming" |
| `booking_modification` | Booking | Date/guest changes need manual handling | "Can I change my dates?" / "Can I add a guest?" / "I need to extend my stay" |
| `refund_request` | Financial | Money matters need human judgment | "I want a refund" / "Can I get my money back?" / "I was overcharged" |
| `complaint` | Support | Negative experience needs empathy + action | "The room is dirty" / "AC is not working" / "There are insects" / "Very disappointed" |
| `damage_report` | Support | Liability, documentation needed | "Something is broken" / "I accidentally damaged..." / "The glass broke" |
| `safety_concern` | Emergency | Immediate human attention needed | "There's a gas leak" / "Someone is at the door" / "I don't feel safe" |
| `medical_emergency` | Emergency | Life-threatening, needs immediate help | "I need a doctor" / "Someone is hurt" / "Medical emergency" |
| `payment_issue` | Financial | Payment processing, receipts, disputes | "My card was charged twice" / "I need an invoice" / "Payment failed" |
| `legal_matter` | Legal | Legal threats, disputes, authorities | "I want to report this" / "I'll take legal action" / "I need official documentation" |
| `personal_info_request` | Privacy | PII handling needs caution | "Can you share owner's number?" / "Who else is staying?" |
| `dispute` | Support | Guest disputes charge or policy | "I disagree with the charge" / "This is unfair" / "I want to speak to manager" |
| `special_request_complex` | Support | Non-standard requests needing judgment | "Can you arrange a birthday cake?" / "I need a crib" / "Can you book a taxi?" |

### 2.3 Ambiguous/Fallback Intents

| Intent ID | Category | Description | Routing |
|-----------|----------|-------------|---------|
| `unclear` | Fallback | Can't determine intent | Route to human |
| `multi_intent` | Fallback | Multiple intents in one message | Route to human (for now) |
| `off_topic` | Fallback | Not related to stay/property | Route to human |
| `language_unknown` | Fallback | Message in unsupported language | Route to human |

---

## 3. Intent-to-KB Field Mapping

```typescript
/**
 * Maps each intent to the KB fields needed to answer it.
 * Used in Step 3 (KB Field Matching) of the routing pipeline.
 *
 * If ALL listed fields are non-null in the property's KB → high confidence
 * If SOME listed fields are non-null → medium confidence
 * If NONE are non-null → no KB match → route to human
 */
export const INTENT_TO_KB_MAP: Record<string, string[]> = {
  // ── Auto-respondable ──
  wifi_query:          ['wifi.network_name', 'wifi.password'],
  check_in_info:       ['check_in.time', 'check_in.instructions'],
  check_out_info:      ['check_out.time', 'check_out.instructions'],
  directions:          ['directions.address'],
  parking_info:        ['parking.available'],
  amenities_query:     ['amenities'],
  house_rules:         ['house_rules'],
  nearby_places:       ['nearby'],
  early_check_in:      ['check_in.early_check_in'],
  late_check_out:      ['check_out.late_check_out'],
  self_check_in:       ['check_in.self_check_in', 'check_in.key_location'],
  emergency_contact:   ['emergency.contact_name', 'emergency.phone'],
  custom_faq:          ['custom_faqs'],
  property_features:   ['amenities'],

  // ── No KB needed (template responses) ──
  greeting:            [],   // Use template: "Hello! Welcome to {property}..."
  thank_you:           [],   // Use template: "You're welcome! Let us know..."
  arrival_time:        [],   // Use template: "Thanks for letting us know..."

  // ── NEVER AUTO (not in this map — handled by NEVER_AUTO_INTENTS set) ──
};

export const NEVER_AUTO_INTENTS = new Set([
  'cancellation',
  'booking_modification',
  'refund_request',
  'complaint',
  'damage_report',
  'safety_concern',
  'medical_emergency',
  'payment_issue',
  'legal_matter',
  'personal_info_request',
  'dispute',
  'special_request_complex',
  'unclear',
  'multi_intent',
  'off_topic',
  'language_unknown',
]);
```

---

## 4. Example Messages for Classifier Training (50+ examples)

### WiFi Query (`wifi_query`)
1. "What's the WiFi password?"
2. "How do I connect to the internet?"
3. "Is there WiFi available?"
4. "WiFi name and password please"
5. "Internet is not working, what's the password again?"
6. "We can't find the WiFi network"
7. "password for wifi?"

### Check-in Info (`check_in_info`)
8. "What time can we check in?"
9. "How do I get into the apartment?"
10. "Where do I pick up the keys?"
11. "Check in process?"
12. "We're arriving today, what do we need to do?"
13. "Is there a front desk or how does check-in work?"
14. "What floor are we on and how do we get in?"

### Check-out Info (`check_out_info`)
15. "What time do we need to check out?"
16. "Where should I leave the keys when I leave?"
17. "Any checkout instructions?"
18. "Do I need to clean before leaving?"

### Directions (`directions`)
19. "How do I get there from the airport?"
20. "What's the exact address?"
21. "Can you share the Google Maps link?"
22. "We're coming by train, which station is closest?"
23. "Any landmarks near the property?"

### Parking (`parking_info`)
24. "Is there parking available?"
25. "Where can I park my car?"
26. "How much does parking cost?"
27. "Is the parking underground or open?"

### Amenities (`amenities_query`)
28. "Do you have a swimming pool?"
29. "Is there a washing machine?"
30. "Does the kitchen have a microwave?"
31. "Is there hot water?"
32. "Do you have AC in all rooms?"
33. "Iron and ironing board available?"

### House Rules (`house_rules`)
34. "Are pets allowed?"
35. "Can we smoke on the balcony?"
36. "What are the quiet hours?"
37. "Is having a small party okay?"
38. "Can we bring extra guests?"

### Nearby Places (`nearby_places`)
39. "Any good restaurants nearby?"
40. "What's fun to do around here?"
41. "Where's the nearest pharmacy?"
42. "Nearest ATM?"
43. "Any supermarkets close by?"

### Cancellation (`cancellation`) — NEVER AUTO
44. "I need to cancel my reservation"
45. "Can I cancel? Something came up"
46. "I won't be able to make it, please cancel"

### Complaint (`complaint`) — NEVER AUTO
47. "The apartment is not clean"
48. "AC is broken and it's very hot"
49. "There are cockroaches in the kitchen"
50. "Neighbors are very noisy, can't sleep"
51. "This doesn't match what was shown in pictures"

### Refund (`refund_request`) — NEVER AUTO
52. "I want my money back"
53. "The place was nothing like described, I want a refund"

### Greeting (`greeting`)
54. "Hi!"
55. "Hello, we just booked your place"
56. "Good morning!"
57. "Hey there"

### Thank You (`thank_you`)
58. "Thank you so much!"
59. "Thanks for the quick reply"
60. "Perfect, thanks!"
61. "Appreciate the help"

### Arrival Time (`arrival_time`)
62. "We'll arrive around 3pm"
63. "Our flight lands at 2pm, we'll be there by 4"
64. "We're coming late, around 11pm"

### Early Check-in (`early_check_in`)
65. "Can we arrive at 10am instead of 2pm?"
66. "Is early check-in possible? We arrive at noon"

### Late Check-out (`late_check_out`)
67. "Can we leave at 1pm instead of 11am?"
68. "Is late checkout available? How much extra?"

### Complex/Special Requests (`special_request_complex`) — NEVER AUTO
69. "Can you arrange a birthday cake for my wife?"
70. "We need an extra bed for our child"
71. "Can you book us a taxi to the airport?"
72. "Can we get someone to do our laundry?"

---

## 5. Haiku Intent Classification Prompt

```
You are an intent classifier for a hospitality messaging system. Classify the guest's message into exactly ONE intent category.

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
{ "intent": "<intent_id>", "stage": "<stage_id>" }

Recent conversation context:
{{conversation_context}}

Guest message to classify:
{{message_content}}
```

---

## 6. Sonnet Response Generation Prompt

```
You are an AI assistant for {{property_name}}, a hospitality property. Your job is to respond to guest inquiries using ONLY the information provided below.

RULES:
1. ONLY use information from the Knowledge Base below. NEVER make up information.
2. If the KB doesn't have the answer, say "Let me check with our team and get back to you shortly."
3. Keep responses under {{max_length}} characters.
4. Use a {{tone}} tone.
5. Address the guest by name ({{guest_name}}) when natural.
6. Do not repeat information the guest already knows.
7. Be concise but helpful.
8. If guest shared arrival time, acknowledge it.
9. Never discuss pricing, refunds, or booking modifications — those need human handling.
10. Sign off with: {{signature}}

KNOWLEDGE BASE:
{{kb_data_json}}

GUEST CONTEXT:
- Name: {{guest_name}}
- Lifecycle stage: {{stage}}
- Channel: {{channel}}
- Check-in: {{check_in_date}}
- Check-out: {{check_out_date}}

CONVERSATION HISTORY (last 10 messages):
{{conversation_history}}

GUEST'S CURRENT MESSAGE:
{{current_message}}

Respond to the guest's message:
```

---

## 7. Response Caching Strategy

Cache key: `ai:response:{property_id}:{intent}:{kb_version}`

- **Cache hit**: Same intent + same KB version → return cached response (adjust guest name)
- **Cache miss**: Generate new response, cache for 24 hours
- **Cache invalidation**: On KB update (version changes), all cached responses for that property are invalidated

Cacheable intents (high repetition):
- `wifi_query` — same answer every time
- `check_in_info` — same instructions
- `check_out_info` — same instructions
- `directions` — same address
- `parking_info` — same details
- `house_rules` — same rules
- `amenities_query` — same amenities list

Non-cacheable (context-dependent):
- `early_check_in` — depends on guest's requested time
- `late_check_out` — depends on date
- `greeting` — should reference guest name, conversation context
- `arrival_time` — acknowledgment varies
- `nearby_places` — depends on what they ask about

Expected cache hit rate: **40-60%** for properties with complete KBs.
