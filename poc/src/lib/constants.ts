// ============================================================================
// POC Constants
// ============================================================================

export const MODELS = {
  CLASSIFIER: 'claude-haiku-4-5-20251001',
  GENERATOR: 'claude-sonnet-4-6',
} as const;

// Pricing per million tokens (USD)
export const PRICING = {
  [MODELS.CLASSIFIER]: { input: 1.00, output: 5.00 },
  [MODELS.GENERATOR]: { input: 3.00, output: 15.00 },
} as const;

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING[model as keyof typeof PRICING];
  if (!pricing) return 0;
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

export const MAX_RESPONSE_LENGTH = 500;

export const DEFAULT_TONE = 'friendly' as const;

export const DEFAULT_SIGNATURE = 'Best regards,\nYour Host';
