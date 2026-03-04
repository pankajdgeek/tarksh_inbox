// ============================================================================
// AI-Powered Knowledge Base Generator — via Claude CLI
// ============================================================================

import { KnowledgeBase, KBGenerationInput } from '../types';
import { MODELS } from '../constants';
import { KB_GENERATION_SYSTEM_PROMPT, buildKBGenerationUserPrompt } from './prompts';
import { callClaude } from './claude-cli';

export async function generateKB(
  input: KBGenerationInput
): Promise<{ kb: KnowledgeBase; tokenUsage: { inputTokens: number; outputTokens: number; costUsd: number } }> {
  // Prepare source data strings
  const beds24Str = input.beds24Data
    ? JSON.stringify(input.beds24Data, null, 2)
    : undefined;

  const scrapedStr = input.scrapedData
    ? JSON.stringify(input.scrapedData, null, 2)
    : undefined;

  const messagesStr = input.historicalMessages?.length
    ? input.historicalMessages
        .map((m) => `[${m.sender}] ${m.message}`)
        .join('\n')
    : undefined;

  const userPrompt = buildKBGenerationUserPrompt(beds24Str, scrapedStr, messagesStr);

  const { text } = await callClaude({
    systemPrompt: KB_GENERATION_SYSTEM_PROMPT,
    userPrompt,
    model: MODELS.GENERATOR,
  });

  // Parse the JSON response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse KB generation response as JSON');
  }

  const kb = JSON.parse(jsonMatch[0]) as KnowledgeBase;

  // Ensure response_preferences has defaults
  if (!kb.response_preferences) {
    kb.response_preferences = {
      tone: 'friendly',
      language: 'english',
    };
  }

  return {
    kb,
    tokenUsage: {
      inputTokens: 0, // CLI mode — no token tracking
      outputTokens: 0,
      costUsd: 0,
    },
  };
}
