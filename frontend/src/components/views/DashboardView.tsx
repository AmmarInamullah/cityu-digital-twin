'use client';
import { useEffect } from 'react';
import { useDashboardStore } from '@/stores/dashboardStore';
import ResilienceGauge from '@/components/ResilienceGauge';
import EnergyChart from '@/components/EnergyChart';
import HistoricalTrend from '@/components/HistoricalTrend';
import NetZeroProjection from '@/components/NetZeroProjection';
import ZoneBreakdown from '@/components/ZoneBreakdown';
import CampusComparison from '@/components/CampusComparison';
import GuidedTour from '@/components/GuidedTour';

function PageHeader() {
  return (
    <div className="border-b px-8 py-5" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            YEUNG Building (Yeung Kin Man Academic Building) · Kowloon Tong, Hong Kong
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Live</span>
          </div>
          <div className="text-xs font-mono px-3 py-1 rounded-lg" style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
            Jul 2023 &ndash; Jun 2024
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsBar({ dailyData, config }: { dailyData: any[]; config: { gridEmissionFactor: number } | null }) {
  if (!dailyData.length) return null;
  const totalKwh = dailyData.reduce((s: number, d: any) => s + d.totalKwh, 0);
  const totalCo2 = dailyData.reduce((s: number, d: any) => s + d.co2Kg, 0);
  const avgDaily = totalKwh / dailyData.length;
  const gridFactor = config?.gridEmissionFactor ?? 0.34;

  const stats = [
    { label: 'Annual Energy', value: `${(totalKwh / 1e6).toFixed(1)}M`, unit: 'kWh', color: 'var(--accent-teal)' },
    { label: 'Annual CO2', value: `${(totalCo2 / 1e6).toFixed(1)}M`, unit: 'kg CO2e', color: 'var(--accent-amber)' },
    { label: 'Avg. Daily', value: `${(avgDaily / 1000).toFixed(0)}k`, unit: 'kWh/day', color: 'var(--accent-blue)' },
    { label: 'Grid Factor', value: gridFactor.toFixed(2), unit: `kg/kWh (${config?.gridProvider || 'CLP'})`, color: 'var(--text-primary)' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map(s => (
        <div key={s.label} className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
          <div className="text-2xl font-bold" style={{ fontFamily: 'JetBrains Mono, monospace', color: s.color }}>
            {s.value}
            <span className="text-xs font-normal ml-1.5" style={{ color: 'var(--text-muted)' }}>{s.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardView() {
  const {
    building, config, dailyData, hourlyData, historicalData, resilience,
    selectedDate, loading, error, loadDashboard, loadHourlyData,
  } = useDashboardStore();

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--accent-teal)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading YEUNG Building data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="rounded-xl p-6 max-w-md text-center" style={{ background: 'var(--bg-card)' }}>
          <p className="text-sm mb-2" style={{ color: 'var(--accent-red)' }}>Failed to load</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{error}</p>
          <button onClick={loadDashboard} className="px-4 py-2 text-xs rounded-lg" style={{ background: 'var(--accent-blue)', color: '#fff' }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader />
      <div className="p-8">
        <StatsBar dailyData={dailyData} config={config} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div id="section-resilience"><ResilienceGauge data={resilience} /></div>
          <div className="lg:col-span-2" id="section-energy">
            <EnergyChart dailyData={dailyData} hourlyData={hourlyData} selectedDate={selectedDate} onDateChange={loadHourlyData} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div id="section-historical"><HistoricalTrend data={historicalData} /></div>
          <div id="section-netzero"><NetZeroProjection data={historicalData} /></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ZoneBreakdown building={building} />
          <CampusComparison data={historicalData} />
        </div>
      </div>
      <GuidedTour />
    </div>
  );
}
