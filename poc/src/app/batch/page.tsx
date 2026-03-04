'use client';

import { useState, useEffect } from 'react';
import { TestResult } from '@/lib/types';

interface BatchMessage {
  message: string;
  expectedIntent: string;
  category: string;
}

const ROUTING_COLORS: Record<string, string> = {
  auto_send: 'bg-green-100 text-green-800',
  draft: 'bg-yellow-100 text-yellow-800',
  route_to_human: 'bg-red-100 text-red-800',
  never_auto: 'bg-red-100 text-red-800',
  no_kb_match: 'bg-gray-100 text-gray-800',
};

export default function BatchPage() {
  const [messages, setMessages] = useState<BatchMessage[]>([]);
  const [propertyId, setPropertyId] = useState('sample-property');
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/batch-messages')
      .then((r) => (r.ok ? r.json() : []))
      .then(setMessages)
      .catch(() => {
        // Load from embedded data
        setMessages(getDefaultBatchMessages());
      });
  }, []);

  async function runBatch() {
    setRunning(true);
    setResults([]);
    setProgress(0);
    setError('');

    const msgs = messages.length > 0 ? messages : getDefaultBatchMessages();
    const batchResults: TestResult[] = [];

    for (let i = 0; i < msgs.length; i++) {
      try {
        const res = await fetch('/api/ai/pipeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: msgs[i].message,
            propertyId,
            expectedIntent: msgs[i].expectedIntent,
          }),
        });

        if (res.ok) {
          const result: TestResult = await res.json();
          batchResults.push(result);
        }
      } catch {
        // Skip failed messages
      }

      setProgress(i + 1);
      setResults([...batchResults]);
    }

    setRunning(false);
  }

  const totalMessages = messages.length || getDefaultBatchMessages().length;
  const intentMatches = results.filter((r) => r.intentMatch).length;
  const intentMismatches = results.filter((r) => r.intentMatch === false).length;

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-6">Batch Test</h2>

      {/* Controls */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs text-muted mb-1">Property KB</label>
            <input
              type="text"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm w-48"
            />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted">{totalMessages} test messages loaded</p>
          </div>
          <button
            onClick={runBatch}
            disabled={running}
            className="bg-accent text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
          >
            {running ? `Running... ${progress}/${totalMessages}` : 'Run All'}
          </button>
        </div>

        {running && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-accent h-2 rounded-full transition-all"
                style={{ width: `${(progress / totalMessages) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary Stats */}
      {results.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">{results.length}</p>
            <p className="text-xs text-muted">Tested</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{intentMatches}</p>
            <p className="text-xs text-muted">Intent Match</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{intentMismatches}</p>
            <p className="text-xs text-muted">Intent Mismatch</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">
              {results.length > 0 ? `${((intentMatches / results.length) * 100).toFixed(1)}%` : 'N/A'}
            </p>
            <p className="text-xs text-muted">Accuracy</p>
          </div>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 text-xs text-muted font-medium">#</th>
                  <th className="px-4 py-3 text-xs text-muted font-medium">Message</th>
                  <th className="px-4 py-3 text-xs text-muted font-medium">Expected</th>
                  <th className="px-4 py-3 text-xs text-muted font-medium">Classified</th>
                  <th className="px-4 py-3 text-xs text-muted font-medium">Match</th>
                  <th className="px-4 py-3 text-xs text-muted font-medium">Routing</th>
                  <th className="px-4 py-3 text-xs text-muted font-medium">Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {results.map((result, i) => (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-muted">{i + 1}</td>
                    <td className="px-4 py-3 max-w-48 truncate">{result.pipelineResult.message}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-100 font-mono">
                        {result.expectedIntent}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-accent-light text-accent font-mono">
                        {result.pipelineResult.classification.intent}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {result.intentMatch === true && <span className="text-green-600 font-bold">✓</span>}
                      {result.intentMatch === false && <span className="text-red-600 font-bold">✗</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${ROUTING_COLORS[result.pipelineResult.routingDecision]}`}>
                        {result.pipelineResult.routingDecision}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-64 truncate text-xs text-muted">
                      {result.pipelineResult.generation?.response || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function getDefaultBatchMessages(): BatchMessage[] {
  return [
    { message: "What's the WiFi password?", expectedIntent: 'wifi_query', category: 'WiFi' },
    { message: 'How do I connect to the internet?', expectedIntent: 'wifi_query', category: 'WiFi' },
    { message: 'Is there WiFi available?', expectedIntent: 'wifi_query', category: 'WiFi' },
    { message: 'WiFi name and password please', expectedIntent: 'wifi_query', category: 'WiFi' },
    { message: 'password for wifi?', expectedIntent: 'wifi_query', category: 'WiFi' },
    { message: 'What time can we check in?', expectedIntent: 'check_in_info', category: 'Check-in' },
    { message: 'How do I get into the apartment?', expectedIntent: 'check_in_info', category: 'Check-in' },
    { message: 'Where do I pick up the keys?', expectedIntent: 'check_in_info', category: 'Check-in' },
    { message: 'Check in process?', expectedIntent: 'check_in_info', category: 'Check-in' },
    { message: 'What time do we need to check out?', expectedIntent: 'check_out_info', category: 'Check-out' },
    { message: 'Where should I leave the keys when I leave?', expectedIntent: 'check_out_info', category: 'Check-out' },
    { message: 'Any checkout instructions?', expectedIntent: 'check_out_info', category: 'Check-out' },
    { message: 'How do I get there from the airport?', expectedIntent: 'directions', category: 'Directions' },
    { message: "What's the exact address?", expectedIntent: 'directions', category: 'Directions' },
    { message: 'Can you share the Google Maps link?', expectedIntent: 'directions', category: 'Directions' },
    { message: 'Is there parking available?', expectedIntent: 'parking_info', category: 'Parking' },
    { message: 'Where can I park my car?', expectedIntent: 'parking_info', category: 'Parking' },
    { message: 'How much does parking cost?', expectedIntent: 'parking_info', category: 'Parking' },
    { message: 'Do you have a swimming pool?', expectedIntent: 'amenities_query', category: 'Amenities' },
    { message: 'Is there a washing machine?', expectedIntent: 'amenities_query', category: 'Amenities' },
    { message: 'Does the kitchen have a microwave?', expectedIntent: 'amenities_query', category: 'Amenities' },
    { message: 'Do you have AC in all rooms?', expectedIntent: 'amenities_query', category: 'Amenities' },
    { message: 'Are pets allowed?', expectedIntent: 'house_rules', category: 'House Rules' },
    { message: 'Can we smoke on the balcony?', expectedIntent: 'house_rules', category: 'House Rules' },
    { message: 'What are the quiet hours?', expectedIntent: 'house_rules', category: 'House Rules' },
    { message: 'Is having a small party okay?', expectedIntent: 'house_rules', category: 'House Rules' },
    { message: 'Any good restaurants nearby?', expectedIntent: 'nearby_places', category: 'Nearby' },
    { message: "What's fun to do around here?", expectedIntent: 'nearby_places', category: 'Nearby' },
    { message: "Where's the nearest pharmacy?", expectedIntent: 'nearby_places', category: 'Nearby' },
    { message: 'Nearest ATM?', expectedIntent: 'nearby_places', category: 'Nearby' },
    { message: 'I need to cancel my reservation', expectedIntent: 'cancellation', category: 'Never-Auto' },
    { message: "Can I cancel? Something came up", expectedIntent: 'cancellation', category: 'Never-Auto' },
    { message: 'The apartment is not clean', expectedIntent: 'complaint', category: 'Never-Auto' },
    { message: "AC is broken and it's very hot", expectedIntent: 'complaint', category: 'Never-Auto' },
    { message: 'There are cockroaches in the kitchen', expectedIntent: 'complaint', category: 'Never-Auto' },
    { message: 'I want my money back', expectedIntent: 'refund_request', category: 'Never-Auto' },
    { message: 'Hi!', expectedIntent: 'greeting', category: 'Greeting' },
    { message: 'Hello, we just booked your place', expectedIntent: 'greeting', category: 'Greeting' },
    { message: 'Good morning!', expectedIntent: 'greeting', category: 'Greeting' },
    { message: 'Thank you so much!', expectedIntent: 'thank_you', category: 'Thank You' },
    { message: 'Thanks for the quick reply', expectedIntent: 'thank_you', category: 'Thank You' },
    { message: "We'll arrive around 3pm", expectedIntent: 'arrival_time', category: 'Arrival' },
    { message: "Our flight lands at 2pm, we'll be there by 4", expectedIntent: 'arrival_time', category: 'Arrival' },
    { message: 'Can we arrive at 10am instead of 2pm?', expectedIntent: 'early_check_in', category: 'Early Check-in' },
    { message: 'Is early check-in possible? We arrive at noon', expectedIntent: 'early_check_in', category: 'Early Check-in' },
    { message: 'Can we leave at 1pm instead of 11am?', expectedIntent: 'late_check_out', category: 'Late Check-out' },
    { message: 'Is late checkout available? How much extra?', expectedIntent: 'late_check_out', category: 'Late Check-out' },
    { message: 'Can you arrange a birthday cake for my wife?', expectedIntent: 'special_request_complex', category: 'Never-Auto' },
    { message: 'We need an extra bed for our child', expectedIntent: 'special_request_complex', category: 'Never-Auto' },
    { message: 'Can you book us a taxi to the airport?', expectedIntent: 'special_request_complex', category: 'Never-Auto' },
  ];
}
