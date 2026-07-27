'use client';
import { useState, useCallback } from 'react';
import { useDashboardStore } from '@/stores/dashboardStore';

interface Decision {
  id: string;
  title: string;
  description: string;
  tradeoff: string;
  category: 'energy' | 'comfort' | 'operations';
  impact: {
    kwhReduction: number;    // percentage reduction in daily kWh
    comfortCost: number;     // 0-10 scale of occupant discomfort
    implementationCost: number; // relative cost 1-5
  };
  applied: boolean;
}

const INITIAL_DECISIONS: Decision[] = [
  {
    id: 'ac_zone3b',
    title: 'Turn off AC in unused Zone 3B',
    description: 'Zone 3B lecture theatre is unoccupied after 6pm. Disable AC during off-hours.',
    tradeoff: 'Saves energy but any evening events will start warm.',
    category: 'energy',
    impact: { kwhReduction: 3.2, comfortCost: 2, implementationCost: 1 },
    applied: false,
  },
  {
    id: 'motion_lighting',
    title: 'Switch corridors to motion-sensor lighting',
    description: 'Replace always-on corridor lights with motion-activated LEDs across floors 2-7.',
    tradeoff: 'Significant savings on the 35.7% lighting zone, minimal comfort impact.',
    category: 'energy',
    impact: { kwhReduction: 5.8, comfortCost: 1, implementationCost: 3 },
    applied: false,
  },
  {
    id: 'chiller_delay',
    title: 'Delay chiller startup by 1 hour',
    description: 'Start chiller plant at 8am instead of 7am. Building retains overnight cooling.',
    tradeoff: 'Early morning labs may be slightly warmer for the first hour.',
    category: 'operations',
    impact: { kwhReduction: 4.1, comfortCost: 4, implementationCost: 1 },
    applied: false,
  },
  {
    id: 'lab_standby',
    title: 'Put idle lab equipment on standby mode',
    description: 'Auto-standby for lab instruments unused for >2 hours. Covers 27.9% lab power zone.',
    tradeoff: '2-minute warm-up delay when researchers return to equipment.',
    category: 'operations',
    impact: { kwhReduction: 6.5, comfortCost: 3, implementationCost: 2 },
    applied: false,
  },
  {
    id: 'setpoint_raise',
    title: 'Raise AC setpoint from 22C to 24C',
    description: 'University-wide policy change. Each +1C saves ~3% of chiller load (27.1% of total).',
    tradeoff: 'Noticeable warmth increase. May face pushback from staff and students.',
    category: 'comfort',
    impact: { kwhReduction: 4.8, comfortCost: 7, implementationCost: 1 },
    applied: false,
  },
  {
    id: 'solar_install',
    title: 'Install rooftop solar panels',
    description: "Deploy CityU's planned 2,000-panel array (1.15 GWh/year offset).",
    tradeoff: 'High upfront cost but long-term savings. References real CityU initiative.',
    category: 'energy',
    impact: { kwhReduction: 2.2, comfortCost: 0, implementationCost: 5 },
    applied: false,
  },
];

const BASELINE_DAILY_KWH = 145479;
const CO2_FACTOR = 0.34;

function categoryIcon(cat: string) {
  if (cat === 'energy') return '⚡';
  if (cat === 'comfort') return '🌡';
  return '⚙';
}

function categoryColor(cat: string) {
  if (cat === 'energy') return 'var(--accent-teal)';
  if (cat === 'comfort') return 'var(--accent-amber)';
  return 'var(--accent-blue)';
}

export default function GameMode() {
  const [decisions, setDecisions] = useState<Decision[]>(INITIAL_DECISIONS);
  const [sessionLog, setSessionLog] = useState<string[]>([]);
  const [showGame, setShowGame] = useState(false);

  const appliedDecisions = decisions.filter(d => d.applied);
  const totalReduction = appliedDecisions.reduce((sum, d) => sum + d.impact.kwhReduction, 0);
  const totalComfort = appliedDecisions.reduce((sum, d) => sum + d.impact.comfortCost, 0);
  const avgComfort = appliedDecisions.length > 0 ? totalComfort / appliedDecisions.length : 0;

  const currentDailyKwh = BASELINE_DAILY_KWH * (1 - totalReduction / 100);
  const currentCo2 = currentDailyKwh * CO2_FACTOR;
  const savingsKwh = BASELINE_DAILY_KWH - currentDailyKwh;
  const savingsCo2 = savingsKwh * CO2_FACTOR;

  // Resilience score for game mode
  const energyScore = Math.min(100, 80 + totalReduction * 2);
  const comfortScore = Math.max(0, 100 - avgComfort * 12);
  const overallScore = Math.round(energyScore * 0.5 + comfortScore * 0.3 + (appliedDecisions.length > 0 ? 70 : 100) * 0.2);

  const scoreColor = overallScore >= 70 ? 'var(--resilience-high)' : overallScore >= 40 ? 'var(--resilience-mid)' : 'var(--resilience-low)';

  const toggleDecision = useCallback((id: string) => {
    setDecisions(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, applied: !d.applied } : d);
      const toggled = updated.find(d => d.id === id)!;
      setSessionLog(log => [
        ...log,
        `${toggled.applied ? 'Applied' : 'Reverted'}: ${toggled.title} (${toggled.applied ? '-' : '+'}${toggled.impact.kwhReduction}% kWh)`
      ]);
      return updated;
    });
  }, []);

  const resetAll = () => {
    setDecisions(INITIAL_DECISIONS);
    setSessionLog([]);
  };

  if (!showGame) {
    return (
      <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="text-center py-8">
          <div className="text-3xl mb-3">🏢</div>
          <h3 className="text-lg font-semibold mb-2">Manage the Building</h3>
          <p className="text-sm mb-4 max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Step into the role of a facilities manager. Make decisions about YEUNG Building's
            energy systems and watch the resilience score respond in real time.
          </p>
          <button
            onClick={() => setShowGame(true)}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            style={{ background: 'var(--accent-teal)', color: '#0a0f1a' }}
          >
            Start Managing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Manage the Building
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetAll}
            className="px-3 py-1 rounded text-xs"
            style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
          >
            Reset All
          </button>
          <button
            onClick={() => setShowGame(false)}
            className="px-3 py-1 rounded text-xs"
            style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
          >
            Exit
          </button>
        </div>
      </div>

      {/* Score dashboard */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-primary)' }}>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Score</div>
          <div className="text-2xl font-bold font-mono mt-1" style={{ color: scoreColor }}>{overallScore}</div>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-primary)' }}>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Savings</div>
          <div className="text-sm font-bold font-mono mt-1" style={{ color: 'var(--accent-green)' }}>
            {savingsKwh > 0 ? '-' : ''}{(savingsKwh / 1000).toFixed(1)}k
          </div>
          <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>kWh/day</div>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-primary)' }}>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>CO2 Saved</div>
          <div className="text-sm font-bold font-mono mt-1" style={{ color: 'var(--accent-green)' }}>
            {savingsCo2 > 0 ? '-' : ''}{(savingsCo2 / 1000).toFixed(1)}k
          </div>
          <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>kg/day</div>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-primary)' }}>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Comfort</div>
          <div className="text-sm font-bold font-mono mt-1" style={{ color: avgComfort > 5 ? 'var(--accent-red)' : avgComfort > 3 ? 'var(--accent-amber)' : 'var(--accent-green)' }}>
            {avgComfort.toFixed(1)}/10
          </div>
          <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>impact</div>
        </div>
      </div>

      {/* Decision cards */}
      <div className="space-y-2 mb-4">
        {decisions.map(d => (
          <button
            key={d.id}
            onClick={() => toggleDecision(d.id)}
            className="w-full text-left rounded-lg p-3 transition-all"
            style={{
              background: d.applied ? 'var(--accent-green-dim)' : 'var(--bg-primary)',
              border: `1px solid ${d.applied ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
            }}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg flex-shrink-0">{categoryIcon(d.category)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{d.title}</span>
                  {d.applied && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--accent-green)', color: '#0a0f1a' }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{d.description}</p>
                <div className="flex items-center gap-4 mt-1.5">
                  <span className="text-[10px] font-mono" style={{ color: 'var(--accent-green)' }}>-{d.impact.kwhReduction}% kWh</span>
                  <span className="text-[10px]" style={{ color: d.impact.comfortCost > 5 ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                    Comfort impact: {d.impact.comfortCost}/10
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Cost: {'$'.repeat(d.impact.implementationCost)}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Session log */}
      {sessionLog.length > 0 && (
        <div className="rounded-lg p-3" style={{ background: 'var(--bg-primary)' }}>
          <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Decision Log</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {sessionLog.map((entry, i) => (
              <div key={i} className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                {i + 1}. {entry}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
