'use client';
import { useEffect, useState } from 'react';

interface Alert {
  _id: string;
  timestamp: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  resolved: boolean;
  metadata?: { actualValue?: number; expectedValue?: number; residual?: number };
}

interface AlertStats {
  total: number;
  unresolved: number;
  bySeverity: Record<string, number>;
}

const SEVERITY_CONFIG = {
  high: { color: 'var(--accent-red)', bg: 'var(--accent-red-dim)', label: 'HIGH' },
  medium: { color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)', label: 'MED' },
  low: { color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)', label: 'LOW' },
};

export default function AlertsView() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [totalReadings, setTotalReadings] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    async function load() {
      try {
        const bRes = await fetch('/api/buildings');
        const buildings = await bRes.json();
        const bid = buildings.data?.[0]?._id;
        if (!bid) return;

        const [aRes, sRes, rRes] = await Promise.all([
          fetch(`/api/alerts/${bid}?limit=50`),
          fetch(`/api/alerts/${bid}/stats`),
          fetch(`/api/readings/${bid}?metricType=energy_kwh&limit=10000`),
        ]);
        const aData = await aRes.json();
        const sData = await sRes.json();
        const rData = await rRes.json();
        setAlerts(aData.data || []);
        setStats(sData.data || null);
        setTotalReadings(rData.count || 0);
      } catch (err) { console.error(err); }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-teal)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div>
      <div className="border-b px-8 py-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-xl font-semibold tracking-tight">Alerts & Anomalies</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Threshold-based anomaly detection (1.5x hourly average)
        </p>
      </div>

      <div className="p-8">
        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Total Alerts</div>
            <div className="text-3xl font-bold font-mono mt-1">{stats?.total || 0}</div>
          </div>
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Unresolved</div>
            <div className="text-3xl font-bold font-mono mt-1" style={{ color: 'var(--accent-red)' }}>{stats?.unresolved || 0}</div>
          </div>
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>High Severity</div>
            <div className="text-3xl font-bold font-mono mt-1" style={{ color: 'var(--accent-red)' }}>{stats?.bySeverity?.high || 0}</div>
          </div>
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Detection Rate</div>
            <div className="text-3xl font-bold font-mono mt-1" style={{ color: 'var(--accent-teal)' }}>
              {totalReadings > 0 ? `${((stats?.total || 0) / totalReadings * 100).toFixed(1)}%` : '—'}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>of {totalReadings.toLocaleString()} readings</div>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2 mb-4">
          {(['all', 'high', 'medium', 'low'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors"
              style={{
                background: filter === f ? 'var(--accent-teal)' : 'var(--bg-card)',
                color: filter === f ? '#0a0f1a' : 'var(--text-secondary)',
                border: `1px solid ${filter === f ? 'var(--accent-teal)' : 'var(--border-subtle)'}`,
              }}
            >{f} {f !== 'all' && `(${stats?.bySeverity?.[f] || 0})`}</button>
          ))}
        </div>

        {/* Alert list */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No alerts to display. Run the ML forecast script to detect anomalies.</p>
            </div>
          ) : (
            filtered.map(alert => {
              const cfg = SEVERITY_CONFIG[alert.severity];
              const ts = new Date(alert.timestamp);
              return (
                <div key={alert._id} className="rounded-xl p-4 flex items-start gap-4"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                  <div className="flex-shrink-0 px-2 py-1 rounded text-[10px] font-bold"
                    style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{alert.message}</p>
                    <div className="flex items-center gap-4 mt-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      <span>{ts.toLocaleDateString()} {ts.toLocaleTimeString()}</span>
                      <span>{alert.type === 'anomaly' ? 'ML Anomaly' : 'Threshold Breach'}</span>
                      {alert.metadata?.actualValue && (
                        <span className="font-mono">
                          Actual: {alert.metadata.actualValue.toFixed(0)} | Expected: {alert.metadata.expectedValue?.toFixed(0)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="text-[10px] px-2 py-1 rounded" style={{
                      background: alert.resolved ? 'var(--accent-green-dim)' : 'var(--accent-red-dim)',
                      color: alert.resolved ? 'var(--accent-green)' : 'var(--accent-red)',
                    }}>{alert.resolved ? 'Resolved' : 'Active'}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
