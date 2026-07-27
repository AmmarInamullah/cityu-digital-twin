'use client';
import { ResilienceResult } from '@/lib/api';

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--resilience-high)';
  if (score >= 40) return 'var(--resilience-mid)';
  return 'var(--resilience-low)';
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Poor';
  return 'Critical';
}

function PillarBar({ label, value, weight }: { label: string; value: number; weight: string }) {
  const color = scoreColor(value);
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: 'var(--text-secondary)' }}>{label} <span style={{ color: 'var(--text-muted)' }}>({weight})</span></span>
        <span style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-primary)' }}>
        <div
          className="h-1.5 rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function ResilienceGauge({ data }: { data: ResilienceResult | null }) {
  if (!data) return null;
  const color = scoreColor(data.score);

  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
        Resilience Score
      </div>

      <div className="flex items-center gap-6 mb-6">
        <div className="relative w-28 h-28 flex-shrink-0">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--bg-primary)" strokeWidth="8" />
            <circle
              cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="8"
              strokeDasharray={`${(data.score / 100) * 327} 327`}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>
              {data.score}
            </span>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {scoreLabel(data.score)}
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <PillarBar label="Energy Performance" value={data.breakdown.energyPerformance} weight="40%" />
          <PillarBar label="CO2 Trajectory" value={data.breakdown.co2Trajectory} weight="35%" />
          <PillarBar label="Operational Adaptability" value={data.breakdown.operationalAdaptability} weight="25%" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Daily kWh', value: data.metadata.dailyKwh.toLocaleString(), unit: 'kWh' },
          { label: 'Daily CO2', value: data.metadata.dailyCo2Kg.toLocaleString(), unit: 'kg' },
          { label: 'Baseline Dev.', value: `${data.metadata.baselineDeviation > 0 ? '+' : ''}${data.metadata.baselineDeviation}%`, unit: '' },
        ].map(item => (
          <div key={item.label} className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-primary)' }}>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
            <div className="text-sm font-semibold mt-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {item.value} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{item.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
