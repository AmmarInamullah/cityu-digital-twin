'use client';
import { useMemo } from 'react';
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceArea, Cell, BarChart,
} from 'recharts';
import { getEquipment, CATEGORY_LABELS } from '@/lib/equipmentLibrary';
import {
  simulateDay, RoomState, ScheduleMap, ScheduleEntry,
  HOURLY_CO2_FACTOR, isActiveAt,
} from '@/lib/roomPhysics';

const CATEGORY_COLORS: Record<string, string> = {
  'Lighting': '#fbbf24',
  'Computing & AV': '#a78bfa',
  'Appliances': '#fb923c',
  'Specialist / Lab': '#ef4444',
  'Fans': '#60a5fa',
  'Air conditioning': '#38bdf8',
};

function Metric({ label, value, unit, color, hint }: {
  label: string; value: string; unit?: string; color?: string; hint?: string;
}) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--bg-primary)' }} title={hint}>
      <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-lg font-bold font-mono mt-0.5 leading-tight" style={{ color: color || 'var(--text-primary)' }}>
        {value}{unit && <span className="text-[10px] font-normal ml-1" style={{ color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
    </div>
  );
}

export default function DayProfilePanel({
  state, schedule, onScheduleChange,
}: {
  state: RoomState;
  schedule: ScheduleMap;
  onScheduleChange: (next: ScheduleMap) => void;
}) {
  const day = useMemo(() => simulateDay(state, schedule), [state, schedule]);

  // Equipment types actually present in the room
  const presentTypes = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const it of state.items) counts[it.equipmentId] = (counts[it.equipmentId] ?? 0) + 1;
    return Object.entries(counts).map(([id, count]) => ({ id, count, eq: getEquipment(id) }))
      .filter(x => x.eq)
      .sort((a, b) => (a.eq!.category).localeCompare(b.eq!.category));
  }, [state.items]);

  // Chart data: stacked categories + temperature
  const chartData = day.hours.map(h => ({
    hour: h.hour,
    label: `${String(h.hour).padStart(2, '0')}:00`,
    ...h.byCategory,
    indoor: h.indoorTempC,
    outdoor: h.outdoorTempC,
    total: Math.round(h.totalKw * 100) / 100,
    co2Factor: h.co2Factor,
  }));

  const activeCategories = useMemo(() => {
    const set = new Set<string>();
    for (const h of day.hours) for (const k of Object.keys(h.byCategory)) set.add(k);
    return Array.from(set);
  }, [day]);

  const carbonData = HOURLY_CO2_FACTOR.map((f, h) => ({
    hour: h,
    label: `${String(h).padStart(2, '0')}`,
    factor: f,
    load: day.hours[h].totalKw,
  }));

  const updateEntry = (id: string, patch: Partial<ScheduleEntry>) => {
    onScheduleChange({ ...schedule, [id]: { ...schedule[id], ...patch } });
  };

  const co2Diff = day.dailyCo2Kg - day.dailyCo2FlatKg;

  return (
    <div className="space-y-4">

      {/* ---------- Headline metrics ---------- */}
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="text-[10px] uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          24-Hour Simulation Results
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <Metric label="Daily energy" value={day.dailyKwh.toFixed(1)} unit="kWh" color="var(--accent-teal)"
            hint="Sum of hourly demand across the full day" />
          <Metric label="Peak demand" value={day.peakKw.toFixed(2)} unit="kW" color="var(--accent-red)"
            hint={`Occurs at ${String(day.peakHour).padStart(2, '0')}:00. Real tariffs charge for this separately.`} />
          <Metric label="Load factor" value={day.loadFactor.toFixed(2)} unit=""
            color={day.loadFactor < 0.4 ? 'var(--accent-amber)' : 'var(--accent-teal)'}
            hint="Mean divided by peak. Below 0.4 means a peaky profile and oversized equipment." />
          <Metric label="Daily CO2" value={day.dailyCo2Kg.toFixed(1)} unit="kg" color="var(--accent-amber)"
            hint="Using hour-by-hour grid carbon intensity" />
          <Metric label="Annual EUI" value={day.euiKwhPerM2Yr.toFixed(0)} unit="kWh/m2/yr"
            color={day.euiKwhPerM2Yr > 300 ? 'var(--accent-red)' : day.euiKwhPerM2Yr > 200 ? 'var(--accent-amber)' : 'var(--accent-teal)'}
            hint="Scaled to a year. Compare against the portfolio benchmarks." />
          <Metric label="Uncomfortable hrs" value={String(day.uncomfortableHours)} unit="of occupied"
            color={day.uncomfortableHours > 2 ? 'var(--accent-red)' : 'var(--accent-teal)'}
            hint="Occupied hours where the room sits outside the comfort band" />
        </div>
      </div>

      {/* ---------- Load profile chart ---------- */}
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
          Daily Load Profile
        </div>
        <div className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>
          Stacked electrical demand by category, with indoor and outdoor temperature overlaid.
          The shaded band marks occupied hours.
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={2} />
            <YAxis yAxisId="kw" tick={{ fontSize: 9 }} width={42}
              label={{ value: 'kW', angle: -90, position: 'insideLeft', style: { fontSize: 9, fill: 'var(--text-muted)' } }} />
            <YAxis yAxisId="temp" orientation="right" tick={{ fontSize: 9 }} width={36} domain={[15, 40]}
              label={{ value: 'C', angle: 90, position: 'insideRight', style: { fontSize: 9, fill: 'var(--text-muted)' } }} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 11 }}
              formatter={(v: number, name: string) => {
                if (name === 'indoor' || name === 'outdoor') return [`${v} C`, name === 'indoor' ? 'Indoor' : 'Outdoor'];
                return [`${v.toFixed(2)} kW`, name];
              }} />
            {activeCategories.map(cat => (
              <Area key={cat} yAxisId="kw" type="monotone" dataKey={cat} stackId="load"
                stroke={CATEGORY_COLORS[cat] ?? '#94a3b8'} fill={CATEGORY_COLORS[cat] ?? '#94a3b8'}
                fillOpacity={0.55} strokeWidth={1} />
            ))}
            <Line yAxisId="temp" type="monotone" dataKey="outdoor" stroke="#f87171"
              strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            <Line yAxisId="temp" type="monotone" dataKey="indoor" stroke="#2dd4bf"
              strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2">
          {activeCategories.map(cat => (
            <div key={cat} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: CATEGORY_COLORS[cat] ?? '#94a3b8' }} />
              <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{cat}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5" style={{ background: '#2dd4bf' }} />
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Indoor temp</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5" style={{ background: '#f87171' }} />
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Outdoor temp</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ---------- Schedule editor ---------- */}
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Operating Schedules
          </div>
          <div className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>
            Change when each equipment type runs. This is where power becomes energy.
          </div>

          {presentTypes.length === 0 && (
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              No equipment placed yet. Add items in the room view to schedule them.
            </p>
          )}

          <div className="space-y-3">
            {presentTypes.map(({ id, count, eq }) => {
              const entry = schedule[id];
              if (!eq || !entry) return null;
              const hoursOn = entry.alwaysOn ? 24 :
                (entry.endHour >= entry.startHour
                  ? entry.endHour - entry.startHour
                  : 24 - entry.startHour + entry.endHour);
              const dailyKwh = (eq.watts * eq.dutyCycle * hoursOn * count) / 1000;

              return (
                <div key={id} className="rounded-lg p-3" style={{ background: 'var(--bg-primary)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ color: eq.color, fontSize: 12 }}>{eq.icon}</span>
                    <span className="text-[11px] font-medium flex-1">{eq.shortName}</span>
                    <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
                      &times;{count}
                    </span>
                    <span className="text-[9px] font-mono" style={{ color: 'var(--accent-teal)' }}>
                      {dailyKwh.toFixed(2)} kWh/day
                    </span>
                  </div>

                  {/* 24-hour visual bar */}
                  <div className="flex gap-px mb-2 h-4 rounded overflow-hidden">
                    {Array.from({ length: 24 }).map((_, h) => (
                      <div key={h} className="flex-1" title={`${String(h).padStart(2, '0')}:00`}
                        style={{
                          background: isActiveAt(entry, h)
                            ? eq.color
                            : 'rgba(148,163,184,0.12)',
                          opacity: isActiveAt(entry, h) ? 0.75 : 1,
                        }} />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-[9px]" style={{ color: 'var(--text-muted)' }}>
                      <input type="checkbox" checked={entry.alwaysOn}
                        onChange={e => updateEntry(id, { alwaysOn: e.target.checked })}
                        className="w-3 h-3" />
                      24/7
                    </label>
                    {!entry.alwaysOn && (
                      <>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>On</span>
                          <input type="number" min={0} max={23} value={entry.startHour}
                            onChange={e => updateEntry(id, { startHour: Math.max(0, Math.min(23, Number(e.target.value))) })}
                            className="w-11 text-[9px] font-mono rounded px-1 py-0.5"
                            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }} />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Off</span>
                          <input type="number" min={1} max={24} value={entry.endHour}
                            onChange={e => updateEntry(id, { endHour: Math.max(1, Math.min(24, Number(e.target.value))) })}
                            className="w-11 text-[9px] font-mono rounded px-1 py-0.5"
                            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }} />
                        </div>
                        <span className="text-[9px] font-mono ml-auto" style={{ color: 'var(--text-muted)' }}>
                          {hoursOn}h/day
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------- Carbon timing ---------- */}
        <div className="space-y-4">
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
              Grid Carbon Intensity vs Your Load
            </div>
            <div className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>
              Bars show your demand. The line is how dirty the grid is that hour.
              Running load when the line is low means less carbon for the same kWh.
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <ComposedChart data={carbonData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 8 }} interval={2} />
                <YAxis yAxisId="kw" tick={{ fontSize: 8 }} width={34} />
                <YAxis yAxisId="f" orientation="right" tick={{ fontSize: 8 }} width={38} domain={[0.25, 0.42]} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number, n: string) =>
                    n === 'factor' ? [`${v.toFixed(3)} kg/kWh`, 'Grid intensity'] : [`${v.toFixed(2)} kW`, 'Demand']} />
                <Bar yAxisId="kw" dataKey="load" maxBarSize={12} radius={[2, 2, 0, 0]}>
                  {carbonData.map((d, i) => (
                    <Cell key={i} fill={d.factor > 0.37 ? '#f87171' : d.factor < 0.31 ? '#2dd4bf' : '#94a3b8'} opacity={0.8} />
                  ))}
                </Bar>
                <Line yAxisId="f" type="monotone" dataKey="factor" stroke="#fbbf24" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl p-4" style={{ background: 'var(--accent-blue-dim)', border: '1px solid var(--accent-blue)' }}>
            <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--accent-blue)' }}>
              Why Timing Matters
            </div>
            <div className="space-y-1.5 text-[10px]">
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>CO2 using a flat annual factor</span>
                <span className="font-mono">{day.dailyCo2FlatKg.toFixed(2)} kg</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>CO2 using hourly factors</span>
                <span className="font-mono" style={{ color: 'var(--accent-amber)' }}>{day.dailyCo2Kg.toFixed(2)} kg</span>
              </div>
              <div className="flex justify-between pt-1.5 font-semibold" style={{ borderTop: '1px solid rgba(96,165,250,0.3)' }}>
                <span>Difference</span>
                <span className="font-mono" style={{ color: co2Diff > 0 ? 'var(--accent-red)' : 'var(--accent-teal)' }}>
                  {co2Diff >= 0 ? '+' : ''}{co2Diff.toFixed(2)} kg/day
                </span>
              </div>
            </div>
            <p className="text-[9px] mt-2.5 leading-snug" style={{ color: 'var(--text-secondary)' }}>
              {co2Diff > 0
                ? `This room runs its load during dirtier grid hours than average, so a flat factor understates its real emissions by ${(co2Diff / day.dailyCo2FlatKg * 100).toFixed(1)} percent.`
                : `This room runs during cleaner grid hours than average, so a flat factor overstates its emissions by ${(Math.abs(co2Diff) / day.dailyCo2FlatKg * 100).toFixed(1)} percent.`}
              {' '}Grid intensity is cleanest at {String(day.cleanestHour).padStart(2, '0')}:00
              ({HOURLY_CO2_FACTOR[day.cleanestHour].toFixed(2)} kg/kWh) and dirtiest at
              {' '}{String(day.dirtiestHour).padStart(2, '0')}:00 ({HOURLY_CO2_FACTOR[day.dirtiestHour].toFixed(2)} kg/kWh).
            </p>
          </div>

          <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Peak Demand
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Peak" value={day.peakKw.toFixed(2)} unit="kW" color="var(--accent-red)" />
              <Metric label="Occurs at" value={`${String(day.peakHour).padStart(2, '0')}:00`} />
            </div>
            <p className="text-[9px] mt-2.5 leading-snug" style={{ color: 'var(--text-muted)' }}>
              Commercial electricity tariffs charge separately for peak demand, not just total energy.
              A load factor of {day.loadFactor.toFixed(2)} means average demand is
              {' '}{(day.loadFactor * 100).toFixed(0)} percent of peak.
              {day.loadFactor < 0.4 && ' Below 0.4 suggests a peaky profile where equipment is sized for a load that rarely occurs.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
