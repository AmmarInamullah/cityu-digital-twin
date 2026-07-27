'use client';
import { useState } from 'react';
import { Building } from '@/lib/api';

const ZONE_DATA = [
  { id: 'generalLightingAC', label: 'General Lighting\n& AC', share: 0.357, x: 20, y: 30, w: 260, h: 140 },
  { id: 'laboratoryPower', label: 'Laboratory\nPower', share: 0.279, x: 300, y: 30, w: 200, h: 140 },
  { id: 'chillerPlant', label: 'Chiller\nPlant', share: 0.271, x: 20, y: 190, w: 240, h: 120 },
  { id: 'otherServices', label: 'Other\nServices', share: 0.093, x: 280, y: 190, w: 220, h: 120 },
];

function intensityColor(share: number): string {
  // Blue (low) -> Teal (medium) -> Amber (high) -> Red (very high)
  if (share > 0.30) return '#f87171';
  if (share > 0.25) return '#fbbf24';
  if (share > 0.15) return '#2dd4bf';
  return '#60a5fa';
}

function intensityOpacity(share: number): number {
  return 0.3 + share * 1.5;
}

export default function FloorPlanHeatMap({ building }: { building: Building | null }) {
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

  if (!building) return null;

  const baselineDaily = building.baselineDailyKwh;

  return (
    <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
        YEUNG Building Floor Plan
      </div>
      <div className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        Illustrative zone layout colored by energy intensity (not to architectural scale)
      </div>

      <svg viewBox="0 0 520 340" className="w-full" style={{ maxHeight: 300 }}>
        {/* Building outline */}
        <rect x="10" y="15" width="500" height="310" rx="8" fill="none"
          stroke="var(--border-subtle)" strokeWidth="1.5" strokeDasharray="4 2" />

        {/* Zone rectangles */}
        {ZONE_DATA.map(zone => {
          const color = intensityColor(zone.share);
          const isHovered = hoveredZone === zone.id;
          const dailyKwh = Math.round(baselineDaily * zone.share);

          return (
            <g
              key={zone.id}
              onMouseEnter={() => setHoveredZone(zone.id)}
              onMouseLeave={() => setHoveredZone(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={zone.x} y={zone.y} width={zone.w} height={zone.h}
                rx="6" fill={color}
                opacity={isHovered ? 0.6 : intensityOpacity(zone.share)}
                stroke={isHovered ? '#fff' : color}
                strokeWidth={isHovered ? 2 : 1}
                className="transition-all duration-200"
              />
              {/* Zone label */}
              {zone.label.split('\n').map((line, i) => (
                <text
                  key={i}
                  x={zone.x + zone.w / 2} y={zone.y + zone.h / 2 - 10 + i * 16}
                  textAnchor="middle" fill="#fff" fontSize="12" fontWeight="600"
                  style={{ pointerEvents: 'none' }}
                >
                  {line}
                </text>
              ))}
              {/* Percentage */}
              <text
                x={zone.x + zone.w / 2} y={zone.y + zone.h - 12}
                textAnchor="middle" fill="#fff" fontSize="11"
                fontFamily="JetBrains Mono, monospace" opacity="0.8"
                style={{ pointerEvents: 'none' }}
              >
                {(zone.share * 100).toFixed(1)}% ({(dailyKwh / 1000).toFixed(0)}k kWh/day)
              </text>
            </g>
          );
        })}

        {/* Building label */}
        <text x="260" y="335" textAnchor="middle" fill="var(--text-muted)" fontSize="10">
          YEUNG Building (Yeung Kin Man Academic Building)
        </text>
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3">
        {[
          { label: 'Low (<15%)', color: '#60a5fa' },
          { label: 'Medium (15-25%)', color: '#2dd4bf' },
          { label: 'High (25-30%)', color: '#fbbf24' },
          { label: 'Very High (>30%)', color: '#f87171' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: item.color, opacity: 0.7 }} />
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Hover tooltip */}
      {hoveredZone && (
        <div className="mt-3 rounded-lg p-3 text-xs" style={{ background: 'var(--bg-primary)' }}>
          {(() => {
            const zone = ZONE_DATA.find(z => z.id === hoveredZone);
            if (!zone) return null;
            const dailyKwh = Math.round(baselineDaily * zone.share);
            const co2 = Math.round(dailyKwh * 0.34);
            return (
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>{zone.label.replace('\n', ' ')}</span>
                <span className="font-mono">
                  {dailyKwh.toLocaleString()} kWh/day | {co2.toLocaleString()} kg CO2/day
                </span>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
