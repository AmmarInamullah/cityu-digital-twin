'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Real campus-wide GHG scope data from CityU 2022-23 Environmental Report
const SCOPE_DATA = [
  { scope: 'Scope 1', label: 'Direct', value: 2380, color: '#f87171', description: 'On-site fuel combustion, refrigerants' },
  { scope: 'Scope 2', label: 'Energy Indirect', value: 26920, color: '#fbbf24', description: 'Purchased electricity (CLP grid)' },
  { scope: 'Scope 3', label: 'Other Indirect', value: 61, color: '#60a5fa', description: 'Paper waste, business travel' },
];

const TOTAL = SCOPE_DATA.reduce((s, d) => s + d.value, 0);

export default function GHGScopeBreakdown() {
  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
        GHG Emissions by Scope
      </div>
      <div className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        Campus-wide breakdown (2022-23 Environmental Report) in tonnes CO2e
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={SCOPE_DATA} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <YAxis type="category" dataKey="scope" tick={{ fontSize: 10 }} width={60} />
          <Tooltip
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }}
            formatter={(value: number) => [`${value.toLocaleString()} tCO2e`]}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
            {SCOPE_DATA.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="space-y-2 mt-3">
        {SCOPE_DATA.map(s => (
          <div key={s.scope} className="flex items-center gap-3 text-xs">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <div className="flex-1">
              <span style={{ color: 'var(--text-secondary)' }}>{s.scope}</span>
              <span className="mx-1" style={{ color: 'var(--text-muted)' }}>-</span>
              <span style={{ color: 'var(--text-muted)' }}>{s.description}</span>
            </div>
            <div className="font-mono text-right" style={{ minWidth: 80 }}>
              <span>{s.value.toLocaleString()}</span>
              <span className="ml-1" style={{ color: 'var(--text-muted)' }}>({((s.value / TOTAL) * 100).toFixed(1)}%)</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg p-3 text-xs" style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' }}>
        Scope 2 (electricity) dominates at 91.7%. This is where YEUNG's simulated energy data directly maps.
        Scopes 1 and 3 are campus-wide reference figures from the published report.
      </div>
    </div>
  );
}
