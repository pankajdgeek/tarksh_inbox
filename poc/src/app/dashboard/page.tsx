'use client';

import { useEffect, useState } from 'react';
import { DashboardStats } from '@/lib/types';

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/results/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-bold mb-6">Dashboard</h2>
        <p className="text-muted">Loading stats...</p>
      </div>
    );
  }

  if (!stats || stats.totalTested === 0) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-bold mb-6">Dashboard</h2>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted">No test results yet.</p>
          <p className="text-sm text-muted mt-2">
            Go to <a href="/test" className="text-accent underline">Test Messages</a> or{' '}
            <a href="/batch" className="text-accent underline">Batch Test</a> to get started.
          </p>
        </div>
      </div>
    );
  }

  const intentEntries = Object.entries(stats.intentDistribution).sort((a, b) => b[1] - a[1]);
  const routingEntries = Object.entries(stats.routingDistribution).sort((a, b) => b[1] - a[1]);

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-6">Dashboard</h2>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Tested" value={stats.totalTested.toString()} />
        <StatCard
          label="Success Rate"
          value={`${stats.successRate.toFixed(1)}%`}
          sub={`${stats.ratingDistribution.good} good / ${stats.totalRated} rated`}
        />
        <StatCard
          label="Intent Accuracy"
          value={stats.intentAccuracy > 0 ? `${stats.intentAccuracy.toFixed(1)}%` : 'N/A'}
          sub="Batch tests with expected intents"
        />
        <StatCard
          label="Total Cost"
          value={`$${stats.totalCostUsd.toFixed(4)}`}
          sub={`Avg latency: ${stats.avgLatencyMs}ms`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Intent Distribution */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Intent Distribution</h3>
          <div className="space-y-2">
            {intentEntries.map(([intent, count]) => (
              <div key={intent} className="flex items-center gap-2">
                <span className="text-xs font-mono w-40 truncate">{intent}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div
                    className="bg-accent h-full rounded-full"
                    style={{ width: `${(count / stats.totalTested) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Routing Distribution */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Routing Decisions</h3>
          <div className="space-y-3">
            {routingEntries.map(([routing, count]) => {
              const colors: Record<string, string> = {
                auto_send: 'bg-success',
                draft: 'bg-warning',
                route_to_human: 'bg-danger',
                never_auto: 'bg-danger',
                no_kb_match: 'bg-gray-400',
              };
              return (
                <div key={routing} className="flex items-center gap-2">
                  <span className="text-xs font-mono w-32 truncate">{routing}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div
                      className={`${colors[routing] || 'bg-gray-400'} h-full rounded-full`}
                      style={{ width: `${(count / stats.totalTested) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>

          {/* Rating Breakdown */}
          {stats.totalRated > 0 && (
            <div className="mt-6 pt-4 border-t border-border">
              <h4 className="text-sm font-semibold mb-2">Ratings</h4>
              <div className="flex gap-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-success">{stats.ratingDistribution.good}</p>
                  <p className="text-xs text-muted">Good</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-warning">{stats.ratingDistribution.needs_edit}</p>
                  <p className="text-xs text-muted">Needs Edit</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-danger">{stats.ratingDistribution.bad}</p>
                  <p className="text-xs text-muted">Bad</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
