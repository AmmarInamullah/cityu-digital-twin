'use client';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Building } from '@/lib/api';

const ZONE_LABELS: Record<string, string> = {
  generalLightingAC: 'General Lighting & AC',
  laboratoryPower: 'Laboratory Power',
  chillerPlant: 'Chiller Plant',
  otherBuildingServices: 'Other Services',
};

const ZONE_COLORS = ['#2dd4bf', '#60a5fa', '#a78bfa', '#64748b'];

export default function ZoneBreakdown({ building }: { building: Building | null }) {
  if (!building) return null;

  const zb = building.zoneBreakdown;
  const data = [
    { name: ZONE_LABELS.generalLightingAC, value: zb.generalLightingAC },
    { name: ZONE_LABELS.laboratoryPower, value: zb.laboratoryPower },
    { name: ZONE_LABELS.chillerPlant, value: zb.chillerPlant },
    { name: ZONE_LABELS.otherBuildingServices, value: zb.otherBuildingServices },
  ];

  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
        YEUNG Zone Breakdown
      </div>

      <div className="flex items-center gap-4">
        <div className="w-32 h-32 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data} dataKey="value" cx="50%" cy="50%"
                innerRadius={30} outerRadius={55} paddingAngle={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={ZONE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 12 }}
                formatter={(value: number) => [`${(value * 100).toFixed(1)}%`]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 space-y-2">
          {data.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: ZONE_COLORS[i] }} />
              <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
              <span className="ml-auto font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                {(item.value * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
