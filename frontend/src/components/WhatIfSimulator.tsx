'use client';
import { useState, useCallback } from 'react';
import { useDashboardStore } from '@/stores/dashboardStore';
import { ResilienceResult } from '@/lib/api';

function Slider({ label, value, min, max, step, unit, onChange, description }: {
  label: string; value: number; min: number; max: number; step: number;
  unit: string; onChange: (v: number) => void; description: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="text-xs font-mono font-semibold" style={{ color: 'var(--accent-blue)' }}>
          {value > 0 ? '+' : ''}{value}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ background: 'var(--bg-primary)' }}
      />
      <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</div>
    </div>
  );
}

export default function WhatIfSimulator() {
  const { simulateScenario } = useDashboardStore();
  const [occupancyDelta, setOccupancyDelta] = useState(0);
  const [acSetpointDelta, setAcSetpointDelta] = useState(0);
  const [solarInstalled, setSolarInstalled] = useState(false);
  const [lightingEfficiency, setLightingEfficiency] = useState(1.0);
  const [result, setResult] = useState<ResilienceResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runSimulation = useCallback(async () => {
    setLoading(true);
    const r = await simulateScenario({
      occupancyDelta,
      acSetpointDelta,
      solarPanelInstalled: solarInstalled,
      lightingEfficiency,
    });
    setResult(r);
    setLoading(false);
  }, [occupancyDelta, acSetpointDelta, solarInstalled, lightingEfficiency, simulateScenario]);

  const scoreColor = (s: number) => s >= 70 ? 'var(--resilience-high)' : s >= 40 ? 'var(--resilience-mid)' : 'var(--resilience-low)';

  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
        What-If Scenario Simulator
      </div>

      <Slider
        label="Additional Occupants" value={occupancyDelta} min={-100} max={200} step={10} unit=" people"
        onChange={setOccupancyDelta}
        description="+0.8% consumption per 10 additional occupants (HVAC load)"
      />
      <Slider
        label="AC Setpoint Shift" value={acSetpointDelta} min={0} max={4} step={0.5} unit="C"
        onChange={setAcSetpointDelta}
        description="Each +1C reduces chiller load by ~3% (DOE guideline)"
      />
      <Slider
        label="Lighting Efficiency" value={Math.round((1 - lightingEfficiency) * 100)} min={0} max={30} step={5} unit="% savings"
        onChange={(v) => setLightingEfficiency(1 - v / 100)}
        description="LED/motion-sensor upgrades on the 35.7% lighting zone"
      />

      <div className="flex items-center gap-3 mb-4 mt-2">
        <button
          onClick={() => setSolarInstalled(!solarInstalled)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors"
          style={{
            background: solarInstalled ? 'var(--accent-green-dim)' : 'var(--bg-primary)',
            color: solarInstalled ? 'var(--accent-green)' : 'var(--text-muted)',
            border: `1px solid ${solarInstalled ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
          }}
        >
          {solarInstalled ? '☀ Solar ON' : '☀ Install Solar'}
        </button>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          CityU's 2,000-panel / 1.15 GWh/year initiative
        </span>
      </div>

      <button
        onClick={runSimulation}
        disabled={loading}
        className="w-full rounded-lg py-2.5 text-sm font-semibold transition-colors"
        style={{ background: 'var(--accent-blue)', color: '#fff', opacity: loading ? 0.6 : 1 }}
      >
        {loading ? 'Computing...' : 'Run Simulation'}
      </button>

      {result && (
        <div className="mt-4 rounded-lg p-4" style={{ background: 'var(--bg-primary)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Projected Score</span>
            <span className="text-2xl font-bold font-mono" style={{ color: scoreColor(result.score) }}>
              {result.score}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Daily kWh: </span>
              <span className="font-mono">{result.metadata.dailyKwh.toLocaleString()}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Daily CO2: </span>
              <span className="font-mono">{result.metadata.dailyCo2Kg.toLocaleString()} kg</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Baseline: </span>
              <span className="font-mono" style={{ color: result.metadata.baselineDeviation < 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {result.metadata.baselineDeviation > 0 ? '+' : ''}{result.metadata.baselineDeviation}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
