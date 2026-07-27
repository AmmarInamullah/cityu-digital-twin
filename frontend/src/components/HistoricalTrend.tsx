'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { YearlyData } from '@/lib/api';

export default function HistoricalTrend({ data }: { data: YearlyData[] }) {
  if (!data.length) return null;

  const chartData = data.map(d => ({
    year: d.year.replace('20', "'"),
    yeungKwh: d.yeungKwh,
    campusKwh: d.campusTotalKwh,
  }));

  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
        7-Year Energy Trend
      </div>
      <div className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        YEUNG Building annual consumption (million kWh) from CityU Environmental Reports
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={35} domain={[40, 60]} />
          <Tooltip
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }}
            formatter={(value: number) => [`${value}M kWh`]}
          />
          <Bar dataKey="yeungKwh" radius={[4, 4, 0, 0]} maxBarSize={32}>
            {chartData.map((entry, index) => (
              <Cell
                key={index}
                fill={index === chartData.length - 1 ? 'var(--accent-amber)' : 'var(--accent-teal)'}
                opacity={index === chartData.length - 1 ? 1 : 0.7}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 rounded-lg p-3 text-xs" style={{ background: 'var(--accent-amber-dim)', color: 'var(--accent-amber)' }}>
        2023-24 shows a notable jump to 53.1M kWh as campus activity fully resumed post-COVID
      </div>
    </div>
  );
}
