// ============================================================================
// Intent-to-KB Field Mapping + Never-Auto Intents
// Source: docs/phase1-ai-intent-taxonomy.md
// ============================================================================

/**
 * Maps each intent to the KB fields needed to answer it.
 * Used in Step 3 (KB Field Matching) of the routing pipeline.
 *
 * If ALL listed fields are non-null in the property's KB -> high confidence
 * If SOME listed fields are non-null -> medium confidence
 * If NONE are non-null -> no KB match -> route to human
 */
export const INTENT_TO_KB_MAP: Record<string, string[]> = {
  // Auto-respondable
  wifi_query: ['wifi.network_name', 'wifi.password'],
  check_in_info: ['check_in.time', 'check_in.instructions'],
  check_out_info: ['check_out.time', 'check_out.instructions'],
  directions: ['directions.address'],
  parking_info: ['parking.available'],
  amenities_query: ['amenities'],
  house_rules: ['house_rules'],
  nearby_places: ['nearby'],
  early_check_in: ['check_in.early_check_in'],
  late_check_out: ['check_out.late_check_out'],
  self_check_in: ['check_in.self_check_in', 'check_in.key_location'],
  emergency_contact: ['emergency.contact_name', 'emergency.phone'],
  custom_faq: ['custom_faqs'],
  property_features: ['amenities'],

  // No KB needed (template responses)
  greeting: [],
  thank_you: [],
  arrival_time: [],
};

/**
 * Intents that ALWAYS route to human, regardless of KB data.
 */
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

/**
 * All valid intent IDs for the classifier
 */
export const ALL_INTENTS = [
  ...Object.keys(INTENT_TO_KB_MAP),
  ...Array.from(NEVER_AUTO_INTENTS),
];
