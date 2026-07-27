'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { YearlyData } from '@/lib/api';

export default function NetZeroProjection({ data }: { data: YearlyData[] }) {
  const baselineGHG = 0.13; // 2018-19 baseline
  const target2030 = baselineGHG * (1 - 0.08); // 8% reduction

  const withGHG = data.filter(d => d.ghgPerFloorArea !== null);

  const chartData = withGHG.map(d => {
    const yearNum = parseInt(d.year.split('-')[0]);
    const yearsFrom2018 = yearNum - 2018;
    const targetThisYear = baselineGHG - (baselineGHG - target2030) * (yearsFrom2018 / 12);
    return {
      year: d.year.replace('20', "'"),
      actual: d.ghgPerFloorArea,
      target: Math.round(targetThisYear * 1000) / 1000,
    };
  });

  // Add 2030 target point
  chartData.push({ year: "'29-30", actual: undefined as any, target: target2030 });

  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
        Path to Net-Zero
      </div>
      <div className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        GHG emissions per floor area (tCO2e/m2) vs. CityU's 2030 target
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={40} domain={[0.08, 0.16]} />
          <Tooltip
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }}
            formatter={(value: number, name: string) => [
              `${value} tCO2e/m2`,
              name === 'actual' ? 'Actual' : 'Target Path'
            ]}
          />
          <Line
            type="monotone" dataKey="target" stroke="var(--accent-green)"
            strokeDasharray="6 3" strokeWidth={2} dot={false}
          />
          <Line
            type="monotone" dataKey="actual" stroke="var(--accent-red)"
            strokeWidth={2} dot={{ fill: 'var(--accent-red)', r: 4 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-3 rounded-lg p-3 text-xs" style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)' }}>
        CityU is currently 7.69% <strong>above</strong> its 2018-19 baseline, moving away from the 8% reduction target by 2030
      </div>
    </div>
  );
}
