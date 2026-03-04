// ============================================================================
// Sonnet Response Generator — via Claude CLI
// ============================================================================

import { GenerationResult, KnowledgeBase } from '../types';
import { MODELS, MAX_RESPONSE_LENGTH, DEFAULT_SIGNATURE } from '../constants';
import { buildGenerationSystemPrompt, buildGenerationUserPrompt } from './prompts';
import { callClaude } from './claude-cli';

export async function generateResponse(params: {
  message: string;
  kb: KnowledgeBase;
  kbData: Record<string, unknown>;
  guestName?: string;
  stage?: string;
  channel?: string;
  checkInDate?: string;
  checkOutDate?: string;
  conversationHistory?: string;
}): Promise<GenerationResult> {
  const systemPrompt = buildGenerationSystemPrompt({
    propertyName: params.kb.property_name,
    kbDataJson: JSON.stringify(params.kbData, null, 2),
    guestName: params.guestName,
    stage: params.stage,
    channel: params.channel,
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
    maxLength: params.kb.response_preferences?.max_response_length || MAX_RESPONSE_LENGTH,
    tone: params.kb.response_preferences?.tone || 'friendly',
    signature: params.kb.response_preferences?.signature || DEFAULT_SIGNATURE,
  });

  const userPrompt = buildGenerationUserPrompt(params.message, params.conversationHistory);

  const { text, latencyMs } = await callClaude({
    systemPrompt,
    userPrompt,
    model: MODELS.GENERATOR,
  });

  return {
    response: text,
    tokenUsage: {
      inputTokens: 0, // CLI mode — no token tracking
      outputTokens: 0,
      model: MODELS.GENERATOR,
      estimatedCostUsd: 0,
    },
    latencyMs,
  };
}
