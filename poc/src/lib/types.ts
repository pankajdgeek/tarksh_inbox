// ============================================================================
// POC Types
// ============================================================================

export type GuestLifecycleStage =
  | 'pre_booking'
  | 'post_booking'
  | 'pre_arrival'
  | 'during_stay'
  | 'post_checkout';

export type AIRoutingDecision =
  | 'auto_send'
  | 'draft'
  | 'route_to_human'
  | 'never_auto'
  | 'no_kb_match';

export type IntentConfidence = 'high' | 'medium' | 'low';

export type Rating = 'good' | 'needs_edit' | 'bad';

// ── Classification ──

export interface ClassificationResult {
  intent: string;
  stage: GuestLifecycleStage;
  tokenUsage: TokenUsage;
  latencyMs: number;
}

// ── KB Matching ──

export interface KBMatchResult {
  hasData: boolean;
  confidence: IntentConfidence;
  fieldsRequired: string[];
  fieldsFound: string[];
  fieldsMissing: string[];
  kbData: Record<string, unknown>;
}

// ── Response Generation ──

export interface GenerationResult {
  response: string;
  tokenUsage: TokenUsage;
  latencyMs: number;
}

// ── Full Pipeline ──

export interface PipelineResult {
  id: string;
  message: string;
  guestName?: string;
  timestamp: string;

  // Step 1: Classification
  classification: ClassificationResult;

  // Step 2: Never-auto check
  isNeverAuto: boolean;

  // Step 3: KB match
  kbMatch: KBMatchResult | null;

  // Step 4: Generation
  generation: GenerationResult | null;

  // Step 5: Routing
  routingDecision: AIRoutingDecision;
  routingReason: string;

  // Per-step timing
  stepTimings: {
    classifyMs: number;
    neverAutoCheckMs: number;
    kbMatchMs: number;
    generateMs: number;
    routingMs: number;
  };

  // Totals
  totalLatencyMs: number;
  totalCostUsd: number;
}

// ── Token Usage ──

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
  estimatedCostUsd: number;
}

// ── Knowledge Base ──

// Amenities can be a flat array (simple) or nested object (detailed)
export interface AmenitiesDetailed {
  in_room?: string[];
  kitchen?: string[];
  bathroom?: string[];
  laundry?: string[];
  on_call?: string[];
  building?: string[];
  linen_policy?: string;
  not_provided?: string[];
}

export interface KBRoom {
  id: string;
  name: string;
  airbnb_title?: string;
  booking_com_title?: string;
  type?: string;
  layout?: string;
  max_guests?: number;
  bedrooms?: number;
  beds?: string;
  bathrooms?: number;
  floor?: string;
  highlight?: string;
  special_feature?: string;
  airbnb_rating?: number;
  airbnb_reviews?: number;
  airbnb_url?: string;
  room_amenities?: string[];
  booking_com_amenities?: string[];
  not_provided_in_studio?: string[];
}

export interface KnowledgeBase {
  property_name: string;
  property_id?: string;
  host_name?: string;
  co_host?: string;
  superhost?: boolean;
  overall_rating?: number;
  total_reviews?: number;
  beds24_address?: string;
  booking_com_address?: string;
  booking_com_rating?: number;
  booking_com_reviews?: number;

  // Room types (detailed KB)
  rooms?: Record<string, KBRoom>;

  check_in: {
    time: string;
    instructions: string[];
    self_check_in: boolean;
    early_check_in?: string;
    key_location?: string;
    booking_com_check_in?: string;
    latest_check_in?: string;
    check_in_type?: string;
    guest_review_note?: string;
  } | null;

  check_out: {
    time: string;
    instructions: string[];
    late_check_out?: string;
    booking_com_checkout?: string;
  } | null;

  wifi: {
    network_name: string;
    password: string;
    speed?: string;
    note?: string;
    booking_com_wifi_score?: string;
  } | null;

  // Amenities: flat array (simple KB) or nested object (detailed KB)
  amenities: string[] | AmenitiesDetailed | null;
  house_rules: string[] | null;

  directions: {
    address: string;
    from_airport?: string;
    from_station?: string;
    from_bus_stand?: string;
    google_maps_link?: string;
    google_maps_area?: string;
    landmarks?: string | Array<string>;
    nearest_metro?: string[];
    area_description?: string;
  } | null;

  parking: {
    available: boolean;
    type?: string;
    instructions?: string;
    details?: string;
    cost?: string;
    booking_com_note?: string;
  } | null;

  nearby: {
    restaurants?: Array<{ name: string; cuisine?: string; type?: string; distance?: string }>;
    attractions?: Array<{ name: string; distance?: string; description?: string }>;
    pharmacies?: Array<{ name: string; distance?: string }>;
    hospitals?: Array<{ name: string; distance?: string }>;
    atms?: Array<{ name: string; distance?: string }>;
    corporate_offices?: Array<{ name: string; distance?: string }>;
    transit?: Array<{ name: string; distance?: string }>;
  } | null;

  emergency: {
    contact_name: string;
    phone: string;
    backup_phone?: string;
    local_police?: string;
    nearest_hospital?: string;
    response_time?: string;
    on_site_staff?: string;
    security?: string;
  } | null;

  custom_faqs: Array<{
    question: string;
    answer: string;
  }> | null;

  response_preferences: {
    tone: 'friendly' | 'professional' | 'casual';
    language: string;
    max_response_length?: number;
    signature?: string;
  };
}

// ── Test Results ──

export interface TestResult {
  id: string;
  pipelineResult: PipelineResult;
  rating?: Rating;
  notes?: string;
  expectedIntent?: string;
  intentMatch?: boolean;
  createdAt: string;
}

// ── Dashboard Stats ──

export interface DashboardStats {
  totalTested: number;
  totalRated: number;
  successRate: number;
  intentAccuracy: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  ratingDistribution: { good: number; needs_edit: number; bad: number };
  intentDistribution: Record<string, number>;
  routingDistribution: Record<string, number>;
}

// ── Scraped Data ──

export interface ScrapedData {
  platform: 'airbnb' | 'booking_com';
  url: string;
  propertyName?: string;
  description?: string;
  amenities?: string[];
  houseRules?: string[];
  checkIn?: string;
  checkOut?: string;
  location?: string;
  photos?: string[];
  rawHtml?: string;
  scrapedAt: string;
}

// ── Beds24 Types ──

export interface Beds24Property {
  id: number;
  name: string;
  address?: string;
  city?: string;
  country?: string;
}

export interface Beds24Booking {
  id: number;
  propertyId: number;
  guestName: string;
  guestEmail?: string;
  checkIn: string;
  checkOut: string;
  status: string;
  channel?: string;
  numAdults?: number;
  numChildren?: number;
}

export interface Beds24Message {
  id: number;
  bookingId: number;
  message: string;
  sender: 'guest' | 'host';
  timestamp: string;
}

// ── KB Generation ──

export interface KBGenerationInput {
  beds24Data?: {
    property: Beds24Property;
    bookings: Beds24Booking[];
  };
  scrapedData?: ScrapedData[];
  historicalMessages?: Beds24Message[];
}
