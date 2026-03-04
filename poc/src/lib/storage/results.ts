// ============================================================================
// Results Storage — JSON file persistence
// ============================================================================

import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { TestResult, DashboardStats, Rating } from '../types';

const RESULTS_PATH = path.join(process.cwd(), 'data', 'results', 'test-results.json');

export async function getResults(): Promise<TestResult[]> {
  try {
    const data = await readFile(RESULTS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function saveResult(result: TestResult): Promise<void> {
  const results = await getResults();
  // Replace if same id exists
  const idx = results.findIndex((r) => r.id === result.id);
  if (idx >= 0) {
    results[idx] = result;
  } else {
    results.push(result);
  }
  await writeFile(RESULTS_PATH, JSON.stringify(results, null, 2));
}

export async function rateResult(
  id: string,
  rating: Rating,
  notes?: string
): Promise<TestResult | null> {
  const results = await getResults();
  const result = results.find((r) => r.id === id);
  if (!result) return null;

  result.rating = rating;
  result.notes = notes;
  await writeFile(RESULTS_PATH, JSON.stringify(results, null, 2));
  return result;
}

export async function getStats(): Promise<DashboardStats> {
  const results = await getResults();

  const rated = results.filter((r) => r.rating);
  const good = rated.filter((r) => r.rating === 'good').length;
  const needsEdit = rated.filter((r) => r.rating === 'needs_edit').length;
  const bad = rated.filter((r) => r.rating === 'bad').length;

  // Intent accuracy (for batch tests with expectedIntent)
  const withExpected = results.filter((r) => r.expectedIntent);
  const intentMatches = withExpected.filter((r) => r.intentMatch).length;

  // Intent distribution
  const intentDist: Record<string, number> = {};
  for (const r of results) {
    const intent = r.pipelineResult.classification.intent;
    intentDist[intent] = (intentDist[intent] || 0) + 1;
  }

  // Routing distribution
  const routingDist: Record<string, number> = {};
  for (const r of results) {
    const routing = r.pipelineResult.routingDecision;
    routingDist[routing] = (routingDist[routing] || 0) + 1;
  }

  const totalCost = results.reduce((sum, r) => sum + r.pipelineResult.totalCostUsd, 0);
  const avgLatency =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.pipelineResult.totalLatencyMs, 0) / results.length
      : 0;

  return {
    totalTested: results.length,
    totalRated: rated.length,
    successRate: rated.length > 0 ? (good / rated.length) * 100 : 0,
    intentAccuracy: withExpected.length > 0 ? (intentMatches / withExpected.length) * 100 : 0,
    totalCostUsd: totalCost,
    avgLatencyMs: Math.round(avgLatency),
    ratingDistribution: { good, needs_edit: needsEdit, bad },
    intentDistribution: intentDist,
    routingDistribution: routingDist,
  };
}
