// ============================================================================
// Full 5-Step AI Pipeline Orchestrator
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import { PipelineResult, KnowledgeBase, AIRoutingDecision } from '../types';
import { classifyIntent } from './classifier';
import { matchKBFields } from './kb-matcher';
import { generateResponse } from './generator';
import { NEVER_AUTO_INTENTS } from './intent-map';

export async function runPipeline(params: {
  message: string;
  kb: KnowledgeBase;
  guestName?: string;
  conversationContext?: string;
  conversationHistory?: string;
  channel?: string;
  checkInDate?: string;
  checkOutDate?: string;
  overrideIntent?: string;
}): Promise<PipelineResult> {
  const pipelineStart = Date.now();
  const id = uuidv4();

  // ── Step 1: Intent Classification (Haiku) — or override ──
  const t1 = Date.now();
  const classification = params.overrideIntent
    ? {
        intent: params.overrideIntent,
        stage: 'during_stay' as const,
        tokenUsage: { inputTokens: 0, outputTokens: 0, model: 'override', estimatedCostUsd: 0 },
        latencyMs: 0,
      }
    : await classifyIntent(params.message, params.conversationContext);
  const classifyMs = Date.now() - t1;

  // ── Step 2: Never-Auto Check ──
  const t2 = Date.now();
  const isNeverAuto = NEVER_AUTO_INTENTS.has(classification.intent);
  const neverAutoCheckMs = Date.now() - t2;

  // ── Step 3: KB Field Matching (always run, even for never-auto) ──
  const t3 = Date.now();
  const kbMatch = matchKBFields(classification.intent, params.kb);
  const kbMatchMs = Date.now() - t3;

  // ── Step 4: Response Generation (always run to show AI draft) ──
  const t4 = Date.now();
  let generation = null;
  if (kbMatch.hasData) {
    generation = await generateResponse({
      message: params.message,
      kb: params.kb,
      kbData: kbMatch.kbData,
      guestName: params.guestName,
      stage: classification.stage,
      channel: params.channel,
      checkInDate: params.checkInDate,
      checkOutDate: params.checkOutDate,
      conversationHistory: params.conversationHistory,
    });
  }
  const generateMs = Date.now() - t4;

  // ── Step 5: Routing Decision ──
  const t5 = Date.now();
  let routingDecision: AIRoutingDecision;
  let routingReason: string;

  if (isNeverAuto) {
    routingDecision = 'never_auto';
    routingReason = `Intent "${classification.intent}" is in NEVER_AUTO list — always requires human handling`;
  } else if (!kbMatch.hasData) {
    routingDecision = 'no_kb_match';
    routingReason = `No KB data found for intent "${classification.intent}" — fields needed: ${kbMatch.fieldsRequired.join(', ')}`;
  } else if (kbMatch.confidence === 'high') {
    routingDecision = 'auto_send';
    routingReason = `All KB fields found (${kbMatch.fieldsFound.join(', ')}) — high confidence auto-send`;
  } else {
    routingDecision = 'draft';
    routingReason = `Partial KB data (found: ${kbMatch.fieldsFound.join(', ')}, missing: ${kbMatch.fieldsMissing.join(', ')}) — draft for review`;
  }
  const routingMs = Date.now() - t5;

  const totalCostUsd =
    classification.tokenUsage.estimatedCostUsd +
    (generation?.tokenUsage.estimatedCostUsd ?? 0);

  return {
    id,
    message: params.message,
    guestName: params.guestName,
    timestamp: new Date().toISOString(),
    classification,
    isNeverAuto,
    kbMatch,
    generation,
    routingDecision,
    routingReason,
    stepTimings: { classifyMs, neverAutoCheckMs, kbMatchMs, generateMs, routingMs },
    totalLatencyMs: Date.now() - pipelineStart,
    totalCostUsd,
  };
}
