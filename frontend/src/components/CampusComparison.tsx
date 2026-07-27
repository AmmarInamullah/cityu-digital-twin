'use client';
import { YearlyData } from '@/lib/api';

export default function CampusComparison({ data }: { data: YearlyData[] }) {
  if (!data.length) return null;

  const latest = data[data.length - 1];
  const yeungShare = (latest.yeungKwh / latest.campusTotalKwh) * 100;

  // Campus average per building (rough: YEUNG is the largest single building)
  // Compare YEUNG's consumption to what "average" would be
  const campusDailyAvg = (latest.campusTotalKwh * 1e6) / 365;
  const yeungDaily = (latest.yeungKwh * 1e6) / 365;

  // YEUNG as percentage of campus
  const percentOfCampus = yeungShare;

  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
        Campus Context
      </div>

      <div className="space-y-4">
        {/* YEUNG vs Campus bar */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span style={{ color: 'var(--text-secondary)' }}>YEUNG Building</span>
            <span className="font-mono" style={{ color: 'var(--accent-teal)' }}>{latest.yeungKwh}M kWh</span>
          </div>
          <div className="h-3 rounded-full" style={{ background: 'var(--bg-primary)' }}>
            <div
              className="h-3 rounded-full transition-all duration-700"
              style={{ width: `${percentOfCampus}%`, background: 'var(--accent-teal)' }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span style={{ color: 'var(--text-secondary)' }}>Total Campus</span>
            <span className="font-mono" style={{ color: 'var(--accent-blue)' }}>{latest.campusTotalKwh}M kWh</span>
          </div>
          <div className="h-3 rounded-full" style={{ background: 'var(--bg-primary)' }}>
            <div className="h-3 rounded-full" style={{ width: '100%', background: 'var(--accent-blue)', opacity: 0.5 }} />
          </div>
        </div>

        {/* Key stat */}
        <div className="rounded-lg p-4 text-center" style={{ background: 'var(--bg-primary)' }}>
          <div className="text-3xl font-bold font-mono" style={{ color: 'var(--accent-amber)' }}>
            {percentOfCampus.toFixed(1)}%
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            YEUNG accounts for <strong>{percentOfCampus.toFixed(1)}%</strong> of CityU's total campus energy
          </div>
          <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
            {latest.year} data from CityU Environmental Report
          </div>
        </div>

        {/* Year-over-year share trend */}
        <div className="grid grid-cols-4 gap-1.5">
          {data.slice(-4).map(d => {
            const share = (d.yeungKwh / d.campusTotalKwh) * 100;
            return (
              <div key={d.year} className="text-center rounded-lg p-2" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{d.year.replace('20', "'")}</div>
                <div className="text-xs font-mono font-semibold mt-0.5">{share.toFixed(1)}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
