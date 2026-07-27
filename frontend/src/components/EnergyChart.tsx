'use client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { DailyConsumption, HourlyConsumption } from '@/lib/api';
import { useState } from 'react';

function DailyChart({ data }: { data: DailyConsumption[] }) {
  const recent = data.slice(-90);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={recent} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent-teal)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--accent-teal)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => d.slice(5)}
          interval={13}
          tick={{ fontSize: 10 }}
        />
        <YAxis
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 10 }}
          width={45}
        />
        <Tooltip
          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: 'var(--text-secondary)' }}
          formatter={(value: number) => [`${value.toLocaleString()} kWh`, 'Energy']}
        />
        <Area type="monotone" dataKey="totalKwh" stroke="var(--accent-teal)" fill="url(#energyGrad)" strokeWidth={1.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function HourlyChart({ data }: { data: HourlyConsumption[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="hourlyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="hour"
          tickFormatter={(h) => `${h}:00`}
          tick={{ fontSize: 10 }}
        />
        <YAxis
          tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
          tick={{ fontSize: 10 }}
          width={45}
        />
        <Tooltip
          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }}
          formatter={(value: number) => [`${value.toLocaleString()} kWh`, 'Energy']}
          labelFormatter={(h) => `${h}:00`}
        />
        <Area type="monotone" dataKey="kwh" stroke="var(--accent-blue)" fill="url(#hourlyGrad)" strokeWidth={1.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function EnergyChart({
  dailyData, hourlyData, selectedDate, onDateChange
}: {
  dailyData: DailyConsumption[];
  hourlyData: HourlyConsumption[];
  selectedDate: string;
  onDateChange: (date: string) => void;
}) {
  const [view, setView] = useState<'daily' | 'hourly'>('daily');

  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Energy Consumption
        </div>
        <div className="flex items-center gap-2">
          {view === 'hourly' && (
            <input
              type="date"
              value={selectedDate}
              min="2023-07-01"
              max="2024-06-30"
              onChange={(e) => onDateChange(e.target.value)}
              className="text-xs rounded px-2 py-1"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
            />
          )}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            {(['daily', 'hourly'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-3 py-1 text-xs font-medium capitalize transition-colors"
                style={{
                  background: view === v ? 'var(--accent-blue-dim)' : 'transparent',
                  color: view === v ? 'var(--accent-blue)' : 'var(--text-muted)',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>
      {view === 'daily' ? <DailyChart data={dailyData} /> : <HourlyChart data={hourlyData} />}
    </div>
  );
}
