'use client';

import { useState, useEffect } from 'react';
import { TestResult, Rating } from '@/lib/types';

interface KBListItem {
  propertyId: string;
  propertyName: string;
}

const ROUTING_COLORS: Record<string, string> = {
  auto_send: 'bg-green-100 text-green-800',
  draft: 'bg-yellow-100 text-yellow-800',
  route_to_human: 'bg-red-100 text-red-800',
  never_auto: 'bg-red-100 text-red-800',
  no_kb_match: 'bg-gray-100 text-gray-800',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-red-100 text-red-800',
};

export default function TestPage() {
  const [message, setMessage] = useState('');
  const [guestName, setGuestName] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [kbList, setKbList] = useState<KBListItem[]>([]);
  const [skipClassify, setSkipClassify] = useState(false);
  const [overrideIntent, setOverrideIntent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/kb')
      .then((res) => res.json())
      .then((data: KBListItem[]) => {
        setKbList(data);
        if (data.length > 0 && !propertyId) {
          setPropertyId(data[0].propertyId);
        }
      })
      .catch(() => {});
  }, []);

  async function runTest() {
    if (!message.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/ai/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          propertyId,
          guestName: guestName || undefined,
          overrideIntent: skipClassify && overrideIntent ? overrideIntent : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pipeline failed');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function rateResult(rating: Rating) {
    if (!result) return;
    try {
      await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: result.id, rating }),
      });
      setResult({ ...result, rating });
    } catch {
      // Ignore rating errors
    }
  }

  const r = result?.pipelineResult;

  return (
    <div className="p-8 max-w-4xl">
      <h2 className="text-xl font-bold mb-6">Test Messages</h2>

      {/* Input Section */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-muted mb-1">Property KB</label>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white"
            >
              {kbList.length === 0 && (
                <option key="__loading" value="">Loading...</option>
              )}
              {kbList.map((kb) => (
                <option key={kb.propertyId} value={kb.propertyId}>
                  {kb.propertyName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Guest Name (optional)</label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              placeholder="John"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={skipClassify}
              onChange={(e) => setSkipClassify(e.target.checked)}
              className="rounded"
            />
            Skip Intent Classification
          </label>
          {skipClassify && (
            <select
              value={overrideIntent}
              onChange={(e) => setOverrideIntent(e.target.value)}
              className="border border-border rounded-lg px-2 py-1 text-xs bg-white flex-1"
            >
              <option value="">— Select intent —</option>
              <optgroup label="Auto-respondable">
                <option value="wifi_query">wifi_query</option>
                <option value="check_in_info">check_in_info</option>
                <option value="check_out_info">check_out_info</option>
                <option value="directions">directions</option>
                <option value="parking_info">parking_info</option>
                <option value="amenities_query">amenities_query</option>
                <option value="house_rules">house_rules</option>
                <option value="nearby_places">nearby_places</option>
                <option value="early_check_in">early_check_in</option>
                <option value="late_check_out">late_check_out</option>
                <option value="self_check_in">self_check_in</option>
                <option value="emergency_contact">emergency_contact</option>
                <option value="custom_faq">custom_faq</option>
                <option value="property_features">property_features</option>
              </optgroup>
              <optgroup label="Template responses">
                <option value="greeting">greeting</option>
                <option value="thank_you">thank_you</option>
                <option value="arrival_time">arrival_time</option>
              </optgroup>
              <optgroup label="Never-auto (route to human)">
                <option value="cancellation">cancellation</option>
                <option value="booking_modification">booking_modification</option>
                <option value="refund_request">refund_request</option>
                <option value="complaint">complaint</option>
                <option value="damage_report">damage_report</option>
                <option value="safety_concern">safety_concern</option>
                <option value="payment_issue">payment_issue</option>
                <option value="special_request_complex">special_request_complex</option>
                <option value="unclear">unclear</option>
                <option value="multi_intent">multi_intent</option>
              </optgroup>
            </select>
          )}
        </div>
        <div className="mb-4">
          <label className="block text-xs text-muted mb-1">Guest Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm h-24 resize-none"
            placeholder="What's the WiFi password?"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runTest();
            }}
          />
        </div>
        <button
          onClick={runTest}
          disabled={loading || !message.trim()}
          className="bg-accent text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Running Pipeline...' : 'Run Pipeline'}
        </button>
        <span className="text-xs text-muted ml-3">Cmd+Enter to run</span>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Result */}
      {r && (
        <div className="space-y-4">
          {/* Timing Breakdown */}
          {(() => {
            const t = r.stepTimings;
            const total = r.totalLatencyMs || 1;
            const steps = [
              { step: 1, label: 'Intent Classification', ms: t?.classifyMs ?? r.classification.latencyMs, color: 'bg-blue-400', model: r.classification.tokenUsage.model },
              { step: 2, label: 'Never-Auto Check', ms: t?.neverAutoCheckMs ?? 0, color: 'bg-orange-400', model: null },
              { step: 3, label: 'KB Field Matching', ms: t?.kbMatchMs ?? 0, color: 'bg-purple-400', model: null },
              { step: 4, label: 'Response Generation', ms: t?.generateMs ?? (r.generation?.latencyMs ?? 0), color: 'bg-green-400', model: r.generation?.tokenUsage.model ?? null },
              { step: 5, label: 'Routing Decision', ms: t?.routingMs ?? 0, color: 'bg-cyan-400', model: null },
            ];
            const measured = steps.reduce((sum, s) => sum + s.ms, 0);
            const overhead = Math.max(0, r.totalLatencyMs - measured);

            return (
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Pipeline Timing</h3>
                  <span className="text-sm font-mono text-muted">{r.totalLatencyMs}ms total</span>
                </div>

                {/* Waterfall bar */}
                <div className="flex h-7 rounded-lg overflow-hidden mb-4">
                  {steps.filter((s) => s.ms > 0).map((s) => (
                    <div
                      key={s.step}
                      className={`${s.color} flex items-center justify-center text-xs font-medium text-white`}
                      style={{ width: `${Math.max((s.ms / total) * 100, 4)}%` }}
                      title={`Step ${s.step}: ${s.label} — ${s.ms}ms`}
                    >
                      {s.ms > 50 ? `${s.ms}ms` : ''}
                    </div>
                  ))}
                  {overhead > 0 && (
                    <div
                      className="bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-600"
                      style={{ width: `${Math.max((overhead / total) * 100, 4)}%` }}
                      title={`Overhead — ${overhead}ms`}
                    >
                      {overhead > 50 ? `${overhead}ms` : ''}
                    </div>
                  )}
                </div>

                {/* Per-step table */}
                <div className="space-y-1.5">
                  {steps.map((s) => (
                    <div key={s.step} className="flex items-center text-xs">
                      <div className={`w-2.5 h-2.5 rounded-sm ${s.color} shrink-0`} />
                      <span className="text-muted ml-2 w-5">S{s.step}</span>
                      <span className="ml-1 flex-1">{s.label}</span>
                      {s.model && (
                        <span className="text-muted font-mono mr-3">{s.model}</span>
                      )}
                      <span className="font-mono w-16 text-right">{s.ms}ms</span>
                      <span className="text-muted w-12 text-right">
                        {r.totalLatencyMs > 0 ? `${Math.round((s.ms / total) * 100)}%` : '—'}
                      </span>
                    </div>
                  ))}
                  {overhead > 0 && (
                    <div className="flex items-center text-xs">
                      <div className="w-2.5 h-2.5 rounded-sm bg-gray-300 shrink-0" />
                      <span className="text-muted ml-2 w-5"></span>
                      <span className="ml-1 flex-1 text-muted">Network / Serialization</span>
                      <span className="font-mono w-16 text-right">{overhead}ms</span>
                      <span className="text-muted w-12 text-right">{Math.round((overhead / total) * 100)}%</span>
                    </div>
                  )}
                  <div className="flex items-center text-xs font-semibold border-t border-border pt-1.5 mt-1.5">
                    <span className="w-2.5 shrink-0" />
                    <span className="ml-2 w-5"></span>
                    <span className="ml-1 flex-1">Total</span>
                    <span className="font-mono w-16 text-right">{r.totalLatencyMs}ms</span>
                    <span className="w-12 text-right">100%</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Pipeline Steps */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-4">Pipeline Result</h3>

            {/* Step 1: Classification */}
            <div className="mb-4 pb-4 border-b border-border">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-muted">STEP 1</span>
                <span className="text-sm">Intent Classification</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-1 rounded text-xs font-mono bg-accent-light text-accent">
                  {r.classification.intent}
                </span>
                <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">
                  {r.classification.stage}
                </span>
                <span className="text-xs text-muted">
                  {r.classification.latencyMs}ms | ${r.classification.tokenUsage.estimatedCostUsd.toFixed(5)}
                </span>
              </div>
            </div>

            {/* Step 2: Never-Auto Check */}
            <div className="mb-4 pb-4 border-b border-border">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-muted">STEP 2</span>
                <span className="text-sm">Never-Auto Check</span>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${r.isNeverAuto ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {r.isNeverAuto ? 'BLOCKED — always route to human' : 'PASSED'}
              </span>
            </div>

            {/* Step 3: KB Match */}
            <div className="mb-4 pb-4 border-b border-border">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-muted">STEP 3</span>
                <span className="text-sm">KB Field Match</span>
              </div>
              {r.kbMatch ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs ${r.kbMatch.hasData ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {r.kbMatch.hasData ? 'Data Found' : 'No Data'}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${CONFIDENCE_COLORS[r.kbMatch.confidence]}`}>
                      {r.kbMatch.confidence}
                    </span>
                  </div>
                  {r.kbMatch.fieldsFound.length > 0 && (
                    <p className="text-xs text-muted">
                      Found: {r.kbMatch.fieldsFound.join(', ')}
                    </p>
                  )}
                  {r.kbMatch.fieldsMissing.length > 0 && (
                    <p className="text-xs text-red-500">
                      Missing: {r.kbMatch.fieldsMissing.join(', ')}
                    </p>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted">No KB match data</span>
              )}
            </div>

            {/* Step 4: Response Generation */}
            <div className="mb-4 pb-4 border-b border-border">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-muted">STEP 4</span>
                <span className="text-sm">Response Generation</span>
              </div>
              {r.generation ? (
                <div>
                  {r.isNeverAuto && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 mb-2">
                      Route to human — AI draft shown for reference only
                    </div>
                  )}
                  <div className={`border rounded-lg p-3 text-sm mb-2 ${r.isNeverAuto ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                    {r.generation.response}
                  </div>
                  <p className="text-xs text-muted">
                    {r.generation.latencyMs}ms | ${r.generation.tokenUsage.estimatedCostUsd.toFixed(5)}
                  </p>
                </div>
              ) : (
                <span className="text-xs text-muted">Skipped (no KB data found)</span>
              )}
            </div>

            {/* Step 5: Routing */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-muted">STEP 5</span>
                <span className="text-sm">Routing Decision</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${ROUTING_COLORS[r.routingDecision]}`}>
                  {r.routingDecision}
                </span>
              </div>
              <p className="text-xs text-muted mt-1">{r.routingReason}</p>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-sm">
                <span className="font-medium">Total: </span>
                {r.totalLatencyMs}ms | ${r.totalCostUsd.toFixed(5)}
              </p>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted mr-2">Rate:</span>
              {(['good', 'needs_edit', 'bad'] as Rating[]).map((rating) => {
                const labels = { good: 'Good', needs_edit: 'Needs Edit', bad: 'Bad' };
                const colors = {
                  good: result?.rating === 'good' ? 'bg-green-500 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100',
                  needs_edit: result?.rating === 'needs_edit' ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
                  bad: result?.rating === 'bad' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100',
                };
                return (
                  <button
                    key={rating}
                    onClick={() => rateResult(rating)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${colors[rating]}`}
                  >
                    {labels[rating]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Quick Test Examples */}
      {!result && !loading && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-3">Quick Test Examples</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              "What's the WiFi password?",
              'What time is check-in?',
              'Is there parking?',
              'Any good restaurants nearby?',
              'I need to cancel my booking',
              'Hi!',
              'Can we arrive early at 10am?',
              'The AC is not working',
            ].map((example) => (
              <button
                key={example}
                onClick={() => setMessage(example)}
                className="text-left text-sm px-3 py-2 rounded-lg bg-gray-50 hover:bg-accent-light transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
