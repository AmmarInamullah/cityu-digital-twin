'use client';
import { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LineChart, Line, AreaChart, Area } from 'recharts';

export default function AnalyticsView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('benchmarks');
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/analysis/full');
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (err) { console.error(err); }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (<div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-teal)', borderTopColor: 'transparent' }} /></div>);

  if (!data) return (
    <div className="flex items-center justify-center h-full">
      <div className="rounded-xl p-8 max-w-lg text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="text-3xl mb-3">📊</div>
        <h3 className="text-lg font-semibold mb-2">Analysis Not Yet Generated</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Run the analysis pipeline first.</p>
        <div className="rounded-lg p-3 text-left font-mono text-xs" style={{ background: 'var(--bg-primary)' }}>
          <div style={{ color: 'var(--text-muted)' }}>cd ml</div>
          <div style={{ color: 'var(--accent-teal)' }}>python run_analysis.py</div>
        </div>
      </div>
    </div>
  );

  // If a building is selected, show drill-down
  if (selectedBuilding) {
    return <BuildingDrillDown data={data} buildingId={selectedBuilding} onBack={() => setSelectedBuilding(null)} />;
  }

  const tabs = [
    { id: 'benchmarks', label: 'EUI Benchmarks', count: data.eui_benchmarks?.length },
    { id: 'faults', label: 'Fault Detection', count: data.faults?.length },
    { id: 'macc', label: 'MACC Optimizer', count: data.macc?.interventions_selected },
    { id: 'uncertainty', label: 'Uncertainty' },
    { id: 'climate', label: 'Climate Adaptation' },
  ];

  return (
    <div>
      <div className="border-b px-8 py-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-xl font-semibold tracking-tight">Portfolio Analytics</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{data.portfolio_size} education buildings · BDG2-calibrated · 9 analytical pillars · Click any building to drill down</p>
      </div>
      <div className="flex border-b px-8 gap-1" style={{ borderColor: 'var(--border-subtle)' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="px-4 py-3 text-xs font-medium transition-colors relative"
            style={{ color: activeTab === tab.id ? 'var(--accent-teal)' : 'var(--text-muted)' }}>
            {tab.label} {'count' in tab && tab.count != null && <span className="ml-1 opacity-60">({tab.count})</span>}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--accent-teal)' }} />}
          </button>
        ))}
      </div>
      <div className="p-8">
        {activeTab === 'benchmarks' && <BenchmarksPanel benchmarks={data.eui_benchmarks || []} onSelectBuilding={setSelectedBuilding} />}
        {activeTab === 'faults' && <FaultsPanel faults={data.faults || []} onSelectBuilding={setSelectedBuilding} />}
        {activeTab === 'macc' && <MACCPanel allOptions={data.macc?.options || []} originalBudget={data.macc?.budget || 2000000} />}
        {activeTab === 'uncertainty' && <UncertaintyPanel mc={data.monte_carlo || {}} />}
        {activeTab === 'climate' && <ClimatePanel climate={data.climate_adaptation || {}} />}
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-2xl font-bold font-mono mt-1" style={{ color: color || 'var(--text-primary)' }}>
        {value}{unit && <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
    </div>
  );
}

// ============================================================
// Feature 3: Building Drill-Down
// ============================================================
function BuildingDrillDown({ data, buildingId, onBack }: { data: any; buildingId: string; onBack: () => void }) {
  const benchmark = (data.eui_benchmarks || []).find((b: any) => b.building_id === buildingId);
  const faults = (data.faults || []).filter((f: any) => f.building_id === buildingId);
  const interventions = (data.macc?.options || []).filter((o: any) => o.building_id === buildingId);
  const [hourlyProfile, setHourlyProfile] = useState<Array<{ hour: number; kwh: number }>>([]);

  useEffect(() => {
    async function fetchHourly() {
      try {
        const bRes = await fetch('/api/buildings');
        const buildings = await bRes.json();
        const buildingId = buildings.data?.[0]?._id;
        if (buildingId) {
          const hrRes = await fetch(`/api/readings/${buildingId}/hourly?date=2024-06-15`);
          const hrData = await hrRes.json();
          if (hrData.data?.length > 0) {
            setHourlyProfile(hrData.data);
          }
        }
      } catch {
        // Fallback: empty profile
      }
    }
    fetchHourly();
  }, []);

  const SEV: Record<string, { color: string; bg: string }> = { high: { color: 'var(--accent-red)', bg: 'var(--accent-red-dim)' }, medium: { color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)' }, low: { color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' } };

  return (
    <div>
      <div className="border-b px-8 py-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            ← Back
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{buildingId}</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {benchmark?.subtype?.replace(/_/g, ' ')} · {benchmark?.annual_eui} kWh/m2/yr · {benchmark?.eui_percentile}th percentile
            </p>
          </div>
        </div>
      </div>

      <div className="p-8">
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatCard label="Annual EUI" value={benchmark?.annual_eui || '-'} unit="kWh/m2/yr" color={benchmark?.above_median_pct > 20 ? 'var(--accent-red)' : 'var(--accent-teal)'} />
          <StatCard label="Peer Median" value={benchmark?.peer_median_eui || '-'} unit="kWh/m2/yr" />
          <StatCard label="vs Median" value={`${benchmark?.above_median_pct > 0 ? '+' : ''}${benchmark?.above_median_pct}%`} color={benchmark?.above_median_pct > 0 ? 'var(--accent-red)' : 'var(--accent-teal)'} />
          <StatCard label="Faults" value={faults.length} color={faults.length > 0 ? 'var(--accent-red)' : 'var(--accent-teal)'} />
          <StatCard label="Recommended Interventions" value={interventions.length} color="var(--accent-blue)" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Hourly load profile */}
          <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Reference Day Load Profile (YEUNG Building)</div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={hourlyProfile}>
                <defs><linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--accent-teal)" stopOpacity={0.3} /><stop offset="95%" stopColor="var(--accent-teal)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }} labelFormatter={(h) => `${h}:00`} />
                <Area type="monotone" dataKey="kwh" stroke="var(--accent-teal)" fill="url(#loadGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* EUI peer comparison */}
          <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>EUI vs Peer Group ({benchmark?.peer_count} buildings)</div>
            <div className="flex items-end gap-2 h-48">
              <div className="flex-1 flex flex-col items-center justify-end">
                <div className="text-[10px] mb-1 font-mono" style={{ color: 'var(--text-muted)' }}>{benchmark?.peer_p25_eui}</div>
                <div className="w-full rounded-t" style={{ height: `${(benchmark?.peer_p25_eui / 500) * 100}%`, background: 'var(--accent-blue)', opacity: 0.3 }} />
                <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>P25</div>
              </div>
              <div className="flex-1 flex flex-col items-center justify-end">
                <div className="text-[10px] mb-1 font-mono" style={{ color: 'var(--text-muted)' }}>{benchmark?.peer_median_eui}</div>
                <div className="w-full rounded-t" style={{ height: `${(benchmark?.peer_median_eui / 500) * 100}%`, background: 'var(--accent-blue)', opacity: 0.5 }} />
                <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Median</div>
              </div>
              <div className="flex-1 flex flex-col items-center justify-end">
                <div className="text-[10px] mb-1 font-mono font-bold" style={{ color: benchmark?.above_median_pct > 0 ? 'var(--accent-red)' : 'var(--accent-teal)' }}>{benchmark?.annual_eui}</div>
                <div className="w-full rounded-t" style={{ height: `${(benchmark?.annual_eui / 500) * 100}%`, background: benchmark?.above_median_pct > 0 ? 'var(--accent-red)' : 'var(--accent-teal)', opacity: 0.8 }} />
                <div className="text-[10px] mt-1 font-bold" style={{ color: 'var(--text-primary)' }}>This</div>
              </div>
              <div className="flex-1 flex flex-col items-center justify-end">
                <div className="text-[10px] mb-1 font-mono" style={{ color: 'var(--text-muted)' }}>{benchmark?.peer_p75_eui}</div>
                <div className="w-full rounded-t" style={{ height: `${(benchmark?.peer_p75_eui / 500) * 100}%`, background: 'var(--accent-blue)', opacity: 0.3 }} />
                <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>P75</div>
              </div>
            </div>
          </div>
        </div>

        {/* Faults for this building */}
        {faults.length > 0 && (
          <div className="mb-6">
            <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Detected Faults</div>
            <div className="space-y-2">
              {faults.map((f: any, i: number) => {
                const cfg = SEV[f.severity] || SEV.low;
                return (
                  <div key={i} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-start gap-3">
                      <span className="text-[10px] font-bold px-2 py-1 rounded flex-shrink-0" style={{ background: cfg.bg, color: cfg.color }}>{f.severity.toUpperCase()}</span>
                      <div className="flex-1">
                        <span className="text-sm font-medium">{f.fault_type.replace(/_/g, ' ')}</span>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{f.description}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--accent-teal)' }}>Fix: {f.recommended_fix} (${(f.estimated_fix_cost_usd || 0).toLocaleString()})</p>
                        <p className="text-xs font-mono" style={{ color: 'var(--accent-teal)' }}>Expected savings: ${(f.estimated_annual_savings_usd || 0).toLocaleString()}/year</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recommended interventions */}
        {interventions.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Recommended Interventions (ranked by cost-effectiveness)</div>
            <div className="space-y-2">
              {interventions.sort((a: any, b: any) => a.marginal_abatement_cost - b.marginal_abatement_cost).map((intv: any, i: number) => (
                <div key={i} className="rounded-xl p-4 flex items-center gap-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' }}>{i + 1}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{intv.intervention_name}</div>
                    <div className="flex gap-4 mt-1 text-[10px] font-mono">
                      <span style={{ color: 'var(--accent-teal)' }}>Saves {(intv.annual_savings_kwh || 0).toLocaleString()} kWh/yr</span>
                      <span style={{ color: 'var(--accent-amber)' }}>Cost: ${(intv.cost_usd || 0).toLocaleString()}</span>
                      <span style={{ color: 'var(--accent-blue)' }}>${intv.marginal_abatement_cost}/tonne CO2</span>
                      <span>Lifetime: {intv.lifetime_co2_saved_tonnes} t CO2</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Benchmarks panel with clickable buildings
// ============================================================
function BenchmarksPanel({ benchmarks, onSelectBuilding }: { benchmarks: any[]; onSelectBuilding: (id: string) => void }) {
  const chartData = benchmarks.slice(0, 20).map((b: any) => ({ id: b.building_id, eui: b.annual_eui, median: b.peer_median_eui, deviation: b.above_median_pct }));
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Portfolio Median EUI" value={benchmarks[Math.floor(benchmarks.length / 2)]?.annual_eui || '-'} unit="kWh/m2/yr" color="var(--accent-teal)" />
        <StatCard label="Worst Performer" value={benchmarks[0]?.annual_eui || '-'} unit={`+${benchmarks[0]?.above_median_pct}% above median`} color="var(--accent-red)" />
        <StatCard label="Above Median" value={benchmarks.filter((b: any) => b.above_median_pct > 0).length} unit="buildings" color="var(--accent-amber)" />
      </div>
      <div className="rounded-xl p-6 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Top 20 by EUI deviation — click any bar to drill down</div>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} onClick={(e: any) => { if (e?.activePayload?.[0]?.payload?.id) onSelectBuilding(e.activePayload[0].payload.id); }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="id" tick={{ fontSize: 8 }} angle={-45} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 10 }} width={50} />
            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="eui" name="Building EUI" radius={[3, 3, 0, 0]} maxBarSize={20} cursor="pointer">
              {chartData.map((e: any, i: number) => (<Cell key={i} fill={e.deviation > 30 ? 'var(--accent-red)' : e.deviation > 10 ? 'var(--accent-amber)' : 'var(--accent-teal)'} opacity={0.8} />))}
            </Bar>
            <Bar dataKey="median" name="Peer Median" fill="var(--text-muted)" opacity={0.3} radius={[3, 3, 0, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Building table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <table className="w-full text-xs">
          <thead><tr style={{ background: 'var(--bg-primary)' }}>
            <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Building</th>
            <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Type</th>
            <th className="px-4 py-2 text-right font-medium" style={{ color: 'var(--text-muted)' }}>EUI</th>
            <th className="px-4 py-2 text-right font-medium" style={{ color: 'var(--text-muted)' }}>Peer Median</th>
            <th className="px-4 py-2 text-right font-medium" style={{ color: 'var(--text-muted)' }}>Deviation</th>
          </tr></thead>
          <tbody>
            {benchmarks.slice(0, 15).map((b: any, i: number) => (
              <tr key={i} onClick={() => onSelectBuilding(b.building_id)} className="cursor-pointer transition-colors" style={{ borderTop: '1px solid var(--border-subtle)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--accent-blue)' }}>{b.building_id}</td>
                <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{b.subtype?.replace('Education_', '')}</td>
                <td className="px-4 py-2.5 text-right font-mono">{b.annual_eui}</td>
                <td className="px-4 py-2.5 text-right font-mono" style={{ color: 'var(--text-muted)' }}>{b.peer_median_eui}</td>
                <td className="px-4 py-2.5 text-right font-mono" style={{ color: b.above_median_pct > 0 ? 'var(--accent-red)' : 'var(--accent-teal)' }}>
                  {b.above_median_pct > 0 ? '+' : ''}{b.above_median_pct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Faults panel with clickable building IDs
// ============================================================
function FaultsPanel({ faults, onSelectBuilding }: { faults: any[]; onSelectBuilding: (id: string) => void }) {
  const totalWaste = faults.reduce((s: number, f: any) => s + (f.estimated_waste_kwh || 0), 0);
  const totalSavings = faults.reduce((s: number, f: any) => s + (f.estimated_annual_savings_usd || 0), 0);
  const SEV: Record<string, { color: string; bg: string }> = { high: { color: 'var(--accent-red)', bg: 'var(--accent-red-dim)' }, medium: { color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)' }, low: { color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' } };
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Faults Detected" value={faults.length} color="var(--accent-red)" />
        <StatCard label="Estimated Waste" value={`${(totalWaste / 1e6).toFixed(1)}M`} unit="kWh/yr" color="var(--accent-amber)" />
        <StatCard label="Recoverable Savings" value={`$${(totalSavings / 1000).toFixed(0)}k`} unit="/year" color="var(--accent-teal)" />
      </div>
      <div className="space-y-2">
        {faults.slice(0, 25).map((f: any, i: number) => {
          const cfg = SEV[f.severity] || SEV.low;
          return (
            <div key={i} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-start gap-3">
                <span className="text-[10px] font-bold px-2 py-1 rounded flex-shrink-0" style={{ background: cfg.bg, color: cfg.color }}>{f.severity.toUpperCase()}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono cursor-pointer underline" style={{ color: 'var(--accent-blue)' }} onClick={() => onSelectBuilding(f.building_id)}>{f.building_id}</span>
                    <span className="text-xs font-medium">{f.fault_type.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{f.description}</p>
                  <div className="flex gap-4 mt-1 text-[10px] font-mono">
                    <span style={{ color: 'var(--accent-red)' }}>Waste: {(f.estimated_waste_kwh || 0).toLocaleString()} kWh/yr</span>
                    <span style={{ color: 'var(--accent-teal)' }}>Savings: ${(f.estimated_annual_savings_usd || 0).toLocaleString()}/yr</span>
                    <span style={{ color: 'var(--accent-amber)' }}>Fix: ${(f.estimated_fix_cost_usd || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Feature 1: Interactive budget slider MACC
// ============================================================
function MACCPanel({ allOptions, originalBudget }: { allOptions: any[]; originalBudget: number }) {
  const [budget, setBudget] = useState(originalBudget);

  const computed = useMemo(() => {
    const sorted = [...allOptions].sort((a: any, b: any) => a.marginal_abatement_cost - b.marginal_abatement_cost);
    let remaining = budget;
    let totalCo2 = 0;
    let totalSpent = 0;
    let count = 0;
    const selectedPairs = new Set<string>();
    const selected: any[] = [];

    for (const opt of sorted) {
      const pair = `${opt.building_id}:${opt.intervention_id}`;
      if (selectedPairs.has(pair)) continue;
      if (opt.cost_usd <= remaining) {
        selected.push({ ...opt, selected: true });
        selectedPairs.add(pair);
        remaining -= opt.cost_usd;
        totalCo2 += opt.lifetime_co2_saved_tonnes;
        totalSpent += opt.cost_usd;
        count++;
      }
    }
    return { selected, totalCo2, totalSpent, count };
  }, [budget, allOptions]);

  const chartData = computed.selected.slice(0, 50).map((o: any, i: number) => ({
    idx: i + 1, mac: Math.min(o.marginal_abatement_cost, 200), name: o.intervention_name, building: o.building_id,
  }));

  return (
    <div>
      {/* Budget slider */}
      <div className="rounded-xl p-6 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Capital Budget</div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--accent-teal)' }}>${(budget / 1e6).toFixed(1)}M</div>
        </div>
        <input type="range" min={100000} max={5000000} step={100000} value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer" style={{ background: 'var(--bg-primary)' }} />
        <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
          <span>$100k</span><span>$1M</span><span>$2M</span><span>$3M</span><span>$5M</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Budget" value={`$${(budget / 1e6).toFixed(1)}M`} />
        <StatCard label="Allocated" value={`$${(computed.totalSpent / 1e6).toFixed(2)}M`} color="var(--accent-teal)" />
        <StatCard label="Interventions" value={computed.count} color="var(--accent-blue)" />
        <StatCard label="Lifetime CO2 Abated" value={`${(computed.totalCo2 / 1000).toFixed(1)}k`} unit="tonnes" color="var(--accent-teal)" />
      </div>

      <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Marginal Abatement Cost Curve</div>
        <div className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Drag the budget slider above. Curve updates in real time. Green = cheap, red = expensive.</div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="idx" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 10 }} width={50} label={{ value: '$/tonne CO2', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'var(--text-muted)' } }} />
            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 11 }}
              formatter={(v: number) => [`$${v}/tonne`, 'MAC']} labelFormatter={(idx) => { const item = chartData[idx - 1]; return item ? `${item.name} @ ${item.building}` : ''; }} />
            <Bar dataKey="mac" radius={[2, 2, 0, 0]} maxBarSize={14}>
              {chartData.map((e: any, i: number) => (<Cell key={i} fill={e.mac < 30 ? '#2dd4bf' : e.mac < 80 ? '#fbbf24' : '#f87171'} opacity={0.85} />))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================================
// Uncertainty and Climate panels (unchanged)
// ============================================================
function UncertaintyPanel({ mc }: { mc: any }) {
  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="P10 (Conservative)" value={mc.p10 || '-'} unit="tCO2/yr" color="var(--accent-amber)" />
        <StatCard label="P50 (Expected)" value={mc.p50 || '-'} unit="tCO2/yr" color="var(--accent-teal)" />
        <StatCard label="P90 (Optimistic)" value={mc.p90 || '-'} unit="tCO2/yr" color="var(--accent-blue)" />
        <StatCard label="Std Dev" value={mc.std?.toFixed(0) || '-'} unit="tCO2/yr" />
      </div>
      <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Monte Carlo Methodology (1,000 simulations)</div>
        <div className="space-y-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <p>Each simulation samples savings percentages from each intervention's distribution (mean +/- std from published retrofit studies). Portfolio-wide CO2 savings are summed per simulation to produce a probability distribution of outcomes.</p>
          <p>P10/P50/P90 represent the 10th, 50th, and 90th percentile. Decision-makers should plan around P50 but budget contingency for P10. This implements Chopra's stochastic uncertainty analysis approach.</p>
        </div>
      </div>
    </div>
  );
}

function ClimatePanel({ climate }: { climate: any }) {
  const scenarios = Object.entries(climate).map(([label, d]: [string, any]) => ({ label, ...d }));
  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {scenarios.map((s: any) => (
          <div key={s.label} className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Scenario: {s.label} Warming</div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-primary)' }}><div className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>Additional Load</div><div className="text-lg font-bold font-mono" style={{ color: 'var(--accent-red)' }}>+{(s.additional_annual_kwh / 1e6).toFixed(1)}M <span className="text-[10px] font-normal">kWh/yr</span></div></div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-primary)' }}><div className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>Additional CO2</div><div className="text-lg font-bold font-mono" style={{ color: 'var(--accent-amber)' }}>+{s.additional_annual_co2_tonnes} <span className="text-[10px] font-normal">tCO2/yr</span></div></div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-primary)' }}><div className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>Efficiency Needed</div><div className="text-lg font-bold font-mono" style={{ color: 'var(--accent-amber)' }}>{s.efficiency_improvement_needed_pct}%</div></div>
              <div className="rounded-lg p-3" style={{ background: 'var(--accent-red-dim)' }}><div className="text-[10px] uppercase" style={{ color: 'var(--accent-red)' }}>Combined with 8% Target</div><div className="text-lg font-bold font-mono" style={{ color: 'var(--accent-red)' }}>{s.combined_with_8pct_target}%</div></div>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl p-5" style={{ background: 'var(--accent-red-dim)', border: '1px solid var(--accent-red)' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--accent-red)' }}>Without accounting for increased cooling load from climate change, CityU is setting a target that assumes static weather. This adaptation-mitigation coupling is the core finding.</p>
      </div>
    </div>
  );
}
