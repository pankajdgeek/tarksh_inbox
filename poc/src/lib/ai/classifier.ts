// ============================================================================
// Haiku Intent Classifier — via Claude CLI
// ============================================================================

import { ClassificationResult, GuestLifecycleStage } from '../types';
import { MODELS } from '../constants';
import { CLASSIFICATION_SYSTEM_PROMPT, buildClassificationUserPrompt } from './prompts';
import { ALL_INTENTS } from './intent-map';
import { callClaude } from './claude-cli';

export async function classifyIntent(
  message: string,
  conversationContext?: string
): Promise<ClassificationResult> {
  const userPrompt = buildClassificationUserPrompt(message, conversationContext);

  const { text, latencyMs } = await callClaude({
    systemPrompt: CLASSIFICATION_SYSTEM_PROMPT,
    userPrompt,
    model: MODELS.CLASSIFIER,
  });

  // Parse JSON response
  let intent = 'unclear';
  let stage: GuestLifecycleStage = 'during_stay';

  try {
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.intent && ALL_INTENTS.includes(parsed.intent)) {
        intent = parsed.intent;
      }
      if (parsed.stage) {
        stage = parsed.stage as GuestLifecycleStage;
      }
    }
  } catch {
    // If parsing fails, try to extract intent from text
    for (const knownIntent of ALL_INTENTS) {
      if (text.includes(knownIntent)) {
        intent = knownIntent;
        break;
      }
    }
  }

  return {
    intent,
    stage,
    tokenUsage: {
      inputTokens: 0, // CLI mode — no token tracking
      outputTokens: 0,
      model: MODELS.CLASSIFIER,
      estimatedCostUsd: 0,
    },
    latencyMs,
  };
}
