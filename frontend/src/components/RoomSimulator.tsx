'use client';
import { useState, useMemo, useCallback } from 'react';
import {
  EQUIPMENT_LIBRARY, CATEGORY_LABELS, getEquipment,
  WALL_OPTIONS, GLAZING_OPTIONS, ORIENTATION_SOLAR,
  Equipment, EquipmentCategory,
} from '@/lib/equipmentLibrary';
import {
  simulateRoom, simulateDay, ROOM_PRESETS, swapEquipment,
  THERMAL_MASS_OPTIONS, ADJACENT_SPACE_OPTIONS,
  RoomState, PlacedItem, SimulationResult, ScheduleMap,
  buildDefaultSchedule, defaultScheduleFor,
  COMFORT_MIN_C, COMFORT_MAX_C,
} from '@/lib/roomPhysics';
import DayProfilePanel from '@/components/DayProfilePanel';
import ChallengePanel from '@/components/ChallengePanel';
import type { Challenge } from '@/lib/roomPhysics';

// ============================================================
// Isometric projection
// ============================================================
const TILE_W = 52;
const TILE_H = 30;
const WALL_PX_PER_M = 34;

function iso(gx: number, gz: number) {
  return { x: (gx - gz) * (TILE_W / 2), y: (gx + gz) * (TILE_H / 2) };
}

// ============================================================
// Heat colour scale
// ============================================================
const HEAT_STOPS: { at: number; rgb: [number, number, number] }[] = [
  { at: 0,   rgb: [37, 99, 235] },
  { at: 25,  rgb: [45, 212, 191] },
  { at: 50,  rgb: [163, 230, 53] },
  { at: 80,  rgb: [251, 191, 36] },
  { at: 120, rgb: [251, 146, 60] },
  { at: 200, rgb: [239, 68, 68] },
];

function heatColor(wPerM2: number, alpha = 1): string {
  const v = Math.max(0, Math.min(200, wPerM2));
  let lo = HEAT_STOPS[0], hi = HEAT_STOPS[HEAT_STOPS.length - 1];
  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    if (v >= HEAT_STOPS[i].at && v <= HEAT_STOPS[i + 1].at) {
      lo = HEAT_STOPS[i]; hi = HEAT_STOPS[i + 1]; break;
    }
  }
  const span = hi.at - lo.at || 1;
  const t = (v - lo.at) / span;
  const c = lo.rgb.map((ch, i) => Math.round(ch + (hi.rgb[i] - ch) * t));
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

// ============================================================
// Per-tile heat field (inverse-distance weighted from sources)
// ============================================================
function buildHeatField(state: RoomState, result: SimulationResult) {
  const cols = Math.max(1, Math.round(state.geometry.widthM));
  const rows = Math.max(1, Math.round(state.geometry.depthM));

  // Ambient component: envelope + solar spread evenly across the floor
  const ambient = (result.qSolarW + Math.max(0, result.qConductionW + result.qVentilationW))
    / Math.max(1, result.floorAreaM2);

  const field: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(ambient));

  for (const item of state.items) {
    const eq = getEquipment(item.equipmentId);
    if (!eq || eq.heatWatts <= 0) continue;
    const src = eq.heatWatts * eq.dutyCycle;

    for (let z = 0; z < rows; z++) {
      for (let x = 0; x < cols; x++) {
        const d2 = (x - item.gx) ** 2 + (z - item.gz) ** 2;
        // Spread each source over roughly a 3x3 neighbourhood
        field[z][x] += src / (1 + d2 * 2.2);
      }
    }
  }

  // Cooling pulls the whole field down proportionally
  if (result.acDeliveredW > 0) {
    const relief = result.acDeliveredW / Math.max(1, result.floorAreaM2);
    for (let z = 0; z < rows; z++) {
      for (let x = 0; x < cols; x++) {
        field[z][x] = Math.max(0, field[z][x] - relief * 0.55);
      }
    }
  }

  return { field, cols, rows };
}

// ============================================================
// Small UI helpers
// ============================================================
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

function Slider({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="text-[10px] font-mono font-semibold" style={{ color: 'var(--accent-blue)' }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ background: 'var(--bg-primary)' }} />
    </div>
  );
}

// ============================================================
// Main component
// ============================================================
let uidSeq = 10000;

export default function RoomSimulator() {
  const [state, setState] = useState<RoomState>(() =>
    JSON.parse(JSON.stringify(ROOM_PRESETS[1].state)) as RoomState
  );
  const [activePreset, setActivePreset] = useState('office');
  const [selectedEquipment, setSelectedEquipment] = useState<string>('bulb_led');
  const [openCategory, setOpenCategory] = useState<EquipmentCategory>('lighting');
  const [hoverTile, setHoverTile] = useState<{ x: number; z: number } | null>(null);
  const [swapBanner, setSwapBanner] = useState<{ text: string; ok: boolean } | null>(null);
  const [viewMode, setViewMode] = useState<'design' | 'day' | 'challenge'>('design');
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [schedule, setSchedule] = useState<ScheduleMap>(() =>
    buildDefaultSchedule(JSON.parse(JSON.stringify(ROOM_PRESETS[1].state)))
  );

  // Keep the schedule map in step with whatever equipment is currently placed
  const syncedSchedule = useMemo(() => {
    const next: ScheduleMap = { ...schedule };
    let changed = false;
    for (const item of state.items) {
      if (!next[item.equipmentId]) {
        next[item.equipmentId] = defaultScheduleFor(item.equipmentId);
        changed = true;
      }
    }
    return changed ? next : schedule;
  }, [state.items, schedule]);

  const result = useMemo(() => simulateRoom(state), [state]);
  // Daily and annual figures always come from the transient 24-hour model, so
  // the Design Hour and 24-Hour tabs never disagree. The design hour is a
  // sizing snapshot; it is not a valid basis for energy totals.
  const dayResult = useMemo(() => simulateDay(state, syncedSchedule), [state, syncedSchedule]);
  const { field, cols, rows } = useMemo(() => buildHeatField(state, result), [state, result]);

  // ----- SVG bounds -----
  const wallH = state.geometry.heightM * WALL_PX_PER_M;
  const minX = -rows * (TILE_W / 2);
  const maxX = cols * (TILE_W / 2);
  const maxY = (cols + rows) * (TILE_H / 2);
  const pad = 24;
  const vbW = (maxX - minX) + pad * 2;
  const vbH = maxY + wallH + pad * 2;
  const offX = -minX + pad;
  const offY = wallH + pad;

  const P = useCallback((gx: number, gz: number) => {
    const p = iso(gx, gz);
    return { x: p.x + offX, y: p.y + offY };
  }, [offX, offY]);

  // ----- Actions -----
  const loadPreset = (id: string) => {
    const preset = ROOM_PRESETS.find(p => p.id === id);
    if (!preset) return;
    const fresh = JSON.parse(JSON.stringify(preset.state)) as RoomState;
    setState(fresh);
    setSchedule(buildDefaultSchedule(fresh));
    setActivePreset(id);
    setSwapBanner(null);
  };

  const handleSelectChallenge = (c: Challenge | null) => {
    setActiveChallenge(c);
    if (c) {
      const fresh = JSON.parse(JSON.stringify(c.startState)) as RoomState;
      setState(fresh);
      setSchedule(buildDefaultSchedule(fresh));
      setActivePreset('challenge');
      setSwapBanner(null);
    }
  };

  const handleResetChallenge = () => {
    if (!activeChallenge) return;
    const fresh = JSON.parse(JSON.stringify(activeChallenge.startState)) as RoomState;
    setState(fresh);
    setSchedule(buildDefaultSchedule(fresh));
    setSwapBanner(null);
  };

  const placeAt = (gx: number, gz: number) => {
    const existing = state.items.find(i => i.gx === gx && i.gz === gz);
    if (existing) {
      // Clicking an occupied tile removes the top item
      setState(s => ({ ...s, items: s.items.filter(i => i.uid !== existing.uid) }));
      return;
    }
    setState(s => ({
      ...s,
      items: [...s.items, { uid: `u${uidSeq++}`, equipmentId: selectedEquipment, gx, gz }],
    }));
    setActivePreset('custom');
  };

  const clearRoom = () => {
    setState(s => ({ ...s, items: [] }));
    setActivePreset('custom');
  };

  const doSwap = (fromId: string, toId: string, label: string) => {
    const count = state.items.filter(i => i.equipmentId === fromId).length;
    if (count === 0) {
      setSwapBanner({ text: `There is no ${getEquipment(fromId)?.shortName} in this room to swap.`, ok: false });
      return;
    }
    const before = simulateRoom(state);
    const next = swapEquipment(state, fromId, toId);
    const after = simulateRoom(next);

    const dW = before.totalElectricalW - after.totalElectricalW;
    const dDirect = before.directElectricalW - after.directElectricalW;
    const dCooling = before.acElectricalW - after.acElectricalW;
    const dAnnualCo2 = (before.annualCo2Kg - after.annualCo2Kg) / 1000;

    setState(next);
    setSchedule(s => ({ ...s, [toId]: s[toId] ?? defaultScheduleFor(toId) }));
    setActivePreset('custom');
    setSwapBanner({
      ok: true,
      text:
        `${label}: swapped ${count} unit${count > 1 ? 's' : ''}. ` +
        `Saved ${dW.toFixed(0)} W total, which is ${dDirect.toFixed(0)} W directly ` +
        `plus ${dCooling.toFixed(0)} W of cooling you no longer need. ` +
        `That is ${dAnnualCo2.toFixed(2)} tonnes CO2 per year.`,
    });
  };

  // ----- Derived display values -----
  const comfortColor = {
    comfortable: 'var(--accent-teal)',
    warm: 'var(--accent-amber)',
    hot: 'var(--accent-red)',
    cold: 'var(--accent-blue)',
  }[result.comfortStatus];

  const grouped = useMemo(() => {
    const g: Record<string, Equipment[]> = {};
    for (const eq of EQUIPMENT_LIBRARY) {
      (g[eq.category] ||= []).push(eq);
    }
    return g;
  }, []);

  const selectedEq = getEquipment(selectedEquipment);

  return (
    <div className="space-y-4">

      {/* ============ Mode tabs ============ */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {([
          { id: 'design' as const, label: 'Design Hour', hint: 'Single worst-case snapshot' },
          { id: 'day' as const, label: '24-Hour Day', hint: 'Full daily profile with schedules' },
          { id: 'challenge' as const, label: 'Challenges', hint: 'Budget-constrained design problems' },
        ]).map(t => (
          <button key={t.id} onClick={() => setViewMode(t.id)} title={t.hint}
            className="px-4 py-2.5 text-xs font-medium relative transition-colors"
            style={{ color: viewMode === t.id ? 'var(--accent-teal)' : 'var(--text-muted)' }}>
            {t.label}
            {viewMode === t.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--accent-teal)' }} />
            )}
          </button>
        ))}
        <span className="ml-auto text-[10px] pr-1" style={{ color: 'var(--text-muted)' }}>
          {viewMode === 'design'
            ? 'Peak sun, peak outdoor temperature, steady state'
            : viewMode === 'day'
            ? 'Transient hourly simulation with thermal mass'
            : 'Fixed budget, competing objectives'}
        </span>
      </div>

      {/* ============ Banner ============ */}
      {swapBanner && (
        <div className="rounded-xl p-3 flex items-start gap-2"
          style={{
            background: swapBanner.ok ? 'var(--accent-green-dim)' : 'var(--accent-amber-dim)',
            border: `1px solid ${swapBanner.ok ? 'var(--accent-teal)' : 'var(--accent-amber)'}`,
          }}>
          <span style={{ color: swapBanner.ok ? 'var(--accent-teal)' : 'var(--accent-amber)' }}>
            {swapBanner.ok ? '\u2713' : '\u26A0'}
          </span>
          <p className="text-xs flex-1" style={{ color: swapBanner.ok ? 'var(--accent-teal)' : 'var(--accent-amber)' }}>
            {swapBanner.text}
          </p>
          <button onClick={() => setSwapBanner(null)} className="text-xs"
            style={{ color: swapBanner.ok ? 'var(--accent-teal)' : 'var(--accent-amber)' }}>&times;</button>
        </div>
      )}

      <div className={`grid grid-cols-1 gap-5 ${viewMode === 'day' ? 'xl:grid-cols-[240px_1fr]' : 'xl:grid-cols-[240px_1fr_320px]'}`}>

      {/* ============ LEFT: palette ============ */}
      <div className="space-y-3">
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Room Presets</div>
          <div className="space-y-1">
            {ROOM_PRESETS.map(p => (
              <button key={p.id} onClick={() => loadPreset(p.id)}
                className="w-full text-left rounded-lg px-2.5 py-2 text-xs transition-colors"
                style={{
                  background: activePreset === p.id ? 'var(--accent-teal)' : 'var(--bg-primary)',
                  color: activePreset === p.id ? '#0a0f1a' : 'var(--text-secondary)',
                }}>
                <div className="font-medium">{p.name}</div>
                <div className="text-[9px] mt-0.5 opacity-70 leading-snug">{p.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Place Equipment</div>
            <button onClick={clearRoom} className="text-[9px] px-2 py-0.5 rounded"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>Clear</button>
          </div>

          {(Object.keys(CATEGORY_LABELS) as EquipmentCategory[]).map(cat => (
            <div key={cat} className="mb-1.5">
              <button onClick={() => setOpenCategory(openCategory === cat ? ('' as EquipmentCategory) : cat)}
                className="w-full flex items-center justify-between text-[10px] font-medium px-1 py-1.5 rounded"
                style={{ color: openCategory === cat ? 'var(--accent-teal)' : 'var(--text-secondary)' }}>
                <span>{CATEGORY_LABELS[cat]}</span>
                <span className="opacity-50">{openCategory === cat ? '\u2212' : '+'}</span>
              </button>
              {openCategory === cat && (
                <div className="space-y-1 mt-1">
                  {(grouped[cat] || []).map(eq => (
                    <button key={eq.id} onClick={() => setSelectedEquipment(eq.id)}
                      title={eq.note}
                      className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] transition-colors"
                      style={{
                        background: selectedEquipment === eq.id ? 'var(--accent-blue-dim)' : 'transparent',
                        border: `1px solid ${selectedEquipment === eq.id ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
                      }}>
                      <span style={{ color: eq.color, fontSize: 13 }}>{eq.icon}</span>
                      <span className="flex-1 text-left truncate" style={{ color: 'var(--text-secondary)' }}>{eq.shortName}</span>
                      <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
                        {eq.coolingCapacityW ? `${(eq.coolingCapacityW / 1000).toFixed(1)}kW\u2744` : eq.watts === 0 ? '75W\u2668' : `${eq.watts}W`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Quick demos */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>One-Click Retrofits</div>
          <div className="space-y-1.5">
            <button onClick={() => doSwap('bulb_incandescent', 'bulb_led', 'Incandescent to LED')}
              className="w-full text-left rounded-lg px-2.5 py-2 text-[10px]"
              style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-teal)' }}>
              Incandescent &rarr; LED
            </button>
            <button onClick={() => doSwap('light_fluorescent_tube', 'bulb_led', 'Fluorescent tube to LED')}
              className="w-full text-left rounded-lg px-2.5 py-2 text-[10px]"
              style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-teal)' }}>
              Fluorescent tube &rarr; LED
            </button>
            <button onClick={() => doSwap('ac_split_3500', 'ac_inverter_3500', 'Fixed-speed to inverter AC')}
              className="w-full text-left rounded-lg px-2.5 py-2 text-[10px]"
              style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-teal)' }}>
              Fixed AC &rarr; Inverter AC
            </button>
            <button onClick={() => doSwap('desktop_pc', 'laptop', 'Desktop to laptop')}
              className="w-full text-left rounded-lg px-2.5 py-2 text-[10px]"
              style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-teal)' }}>
              Desktop &rarr; Laptop
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'day' ? (
        <DayProfilePanel state={state} schedule={syncedSchedule} onScheduleChange={setSchedule} />
      ) : (
      <>
      {/* ============ CENTRE: isometric room ============ */}
      <div className="space-y-4">
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Room View &mdash; click a tile to place {selectedEq?.shortName}, click an item to remove it
            </div>
            <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {state.geometry.widthM} &times; {state.geometry.depthM} &times; {state.geometry.heightM} m
            </div>
          </div>

          <svg viewBox={`0 0 ${vbW} ${vbH}`} className="w-full select-none" style={{ maxHeight: 420 }}>
            <defs>
              <linearGradient id="wallGradL" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={heatColor(result.heatDensityWPerM2, 0.32)} />
                <stop offset="100%" stopColor={heatColor(result.heatDensityWPerM2, 0.10)} />
              </linearGradient>
              <linearGradient id="wallGradR" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={heatColor(result.heatDensityWPerM2, 0.24)} />
                <stop offset="100%" stopColor={heatColor(result.heatDensityWPerM2, 0.07)} />
              </linearGradient>
            </defs>

            {/* Left wall (along the depth axis) */}
            {(() => {
              const a = P(0, 0), b = P(0, rows);
              return (
                <polygon
                  points={`${a.x},${a.y - wallH} ${b.x},${b.y - wallH} ${b.x},${b.y} ${a.x},${a.y}`}
                  fill="url(#wallGradL)" stroke="var(--border-subtle)" strokeWidth="1" />
              );
            })()}

            {/* Right wall (along the width axis) */}
            {(() => {
              const a = P(0, 0), b = P(cols, 0);
              return (
                <polygon
                  points={`${a.x},${a.y - wallH} ${b.x},${b.y - wallH} ${b.x},${b.y} ${a.x},${a.y}`}
                  fill="url(#wallGradR)" stroke="var(--border-subtle)" strokeWidth="1" />
              );
            })()}

            {/* Window on the right wall */}
            {state.geometry.windowAreaM2 > 0 && (() => {
              const winCells = Math.max(1, Math.min(cols - 1, Math.round(state.geometry.windowAreaM2 / state.geometry.heightM)));
              const a = P(0.4, 0), b = P(0.4 + winCells, 0);
              const top = wallH * 0.72, bot = wallH * 0.28;
              return (
                <polygon
                  points={`${a.x},${a.y - top} ${b.x},${b.y - top} ${b.x},${b.y - bot} ${a.x},${a.y - bot}`}
                  fill="rgba(96,165,250,0.30)" stroke="rgba(96,165,250,0.7)" strokeWidth="1.2" />
              );
            })()}

            {/* Floor tiles */}
            {Array.from({ length: rows }).map((_, z) =>
              Array.from({ length: cols }).map((__, x) => {
                const p0 = P(x, z), p1 = P(x + 1, z), p2 = P(x + 1, z + 1), p3 = P(x, z + 1);
                const w = field[z][x];
                const isHover = hoverTile?.x === x && hoverTile?.z === z;
                return (
                  <polygon key={`t${x}-${z}`}
                    points={`${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
                    fill={heatColor(w, 0.85)}
                    stroke={isHover ? '#ffffff' : 'rgba(255,255,255,0.07)'}
                    strokeWidth={isHover ? 1.6 : 0.6}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoverTile({ x, z })}
                    onMouseLeave={() => setHoverTile(null)}
                    onClick={() => placeAt(x, z)}
                  />
                );
              })
            )}

            {/* Placed items, drawn back-to-front for correct overlap */}
            {[...state.items]
              .sort((a, b) => (a.gx + a.gz) - (b.gx + b.gz))
              .map(item => {
                const eq = getEquipment(item.equipmentId);
                if (!eq) return null;
                const c = P(item.gx + 0.5, item.gz + 0.5);
                const isAC = !!eq.coolingCapacityW;
                const lift = isAC ? wallH * 0.55 : eq.category === 'lighting' ? wallH * 0.75 : 10;
                return (
                  <g key={item.uid} style={{ cursor: 'pointer' }}
                    onClick={() => setState(s => ({ ...s, items: s.items.filter(i => i.uid !== item.uid) }))}>
                    {/* Drop line for ceiling-mounted items */}
                    {lift > 20 && (
                      <line x1={c.x} y1={c.y - lift} x2={c.x} y2={c.y}
                        stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="2 2" />
                    )}
                    <circle cx={c.x} cy={c.y - lift} r={eq.category === 'occupant' ? 7 : 10}
                      fill="rgba(10,15,26,0.75)" stroke={eq.color} strokeWidth="1.5" />
                    <text x={c.x} y={c.y - lift + 4} textAnchor="middle"
                      fontSize={eq.category === 'occupant' ? 9 : 12} fill={eq.color}>
                      {eq.icon}
                    </text>
                  </g>
                );
              })}

            {/* Compass / orientation marker */}
            {(() => {
              const c = P(cols + 0.6, -0.6);
              return (
                <text x={c.x} y={c.y} fontSize="9" fill="var(--text-muted)" textAnchor="middle">
                  {state.geometry.orientation.toUpperCase()} facing
                </text>
              );
            })()}
          </svg>

          {/* Heat legend */}
          <div className="flex items-center gap-3 mt-3">
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Heat density</span>
            <div className="flex-1 h-2 rounded-full" style={{
              background: `linear-gradient(90deg, ${heatColor(0)}, ${heatColor(25)}, ${heatColor(50)}, ${heatColor(80)}, ${heatColor(120)}, ${heatColor(200)})`,
            }} />
            <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>0 &rarr; 200 W/m&sup2;</span>
          </div>
          {hoverTile && (
            <div className="text-[9px] font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
              Tile ({hoverTile.x}, {hoverTile.z}): {field[hoverTile.z][hoverTile.x].toFixed(0)} W/m&sup2;
            </div>
          )}
        </div>

        {/* Room controls */}
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-[10px] uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Room & Fabric</div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-3">
            <Slider label="Width" value={state.geometry.widthM} min={3} max={14} step={1} unit=" m"
              onChange={v => setState(s => ({ ...s, geometry: { ...s.geometry, widthM: v } }))} />
            <Slider label="Depth" value={state.geometry.depthM} min={3} max={12} step={1} unit=" m"
              onChange={v => setState(s => ({ ...s, geometry: { ...s.geometry, depthM: v } }))} />
            <Slider label="Ceiling height" value={state.geometry.heightM} min={2.4} max={4.5} step={0.1} unit=" m"
              onChange={v => setState(s => ({ ...s, geometry: { ...s.geometry, heightM: v } }))} />
            <Slider label="Window area" value={state.geometry.windowAreaM2} min={0} max={20} step={1} unit=" m2"
              onChange={v => setState(s => ({ ...s, geometry: { ...s.geometry, windowAreaM2: v } }))} />
            <Slider label="Outdoor temp" value={state.conditions.outdoorTempC} min={18} max={38} step={1} unit=" C"
              onChange={v => setState(s => ({ ...s, conditions: { ...s.conditions, outdoorTempC: v } }))} />
            <Slider label="AC setpoint" value={state.conditions.setpointTempC} min={18} max={28} step={0.5} unit=" C"
              onChange={v => setState(s => ({ ...s, conditions: { ...s.conditions, setpointTempC: v } }))} />
            <Slider label="Air changes/hr" value={state.fabric.ach} min={0.3} max={8} step={0.1} unit=" ACH"
              onChange={v => setState(s => ({ ...s, fabric: { ...s.fabric, ach: v } }))} />
            <Slider label="External walls" value={state.geometry.externalWalls} min={1} max={4} step={1} unit=""
              onChange={v => setState(s => ({ ...s, geometry: { ...s.geometry, externalWalls: v as 1 | 2 | 3 | 4 } }))} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
            <div>
              <div className="text-[10px] mb-1" style={{ color: 'var(--text-secondary)' }}>Wall construction</div>
              <select value={WALL_OPTIONS.find(w => w.uValue === state.fabric.wallUValue)?.id ?? 'standard'}
                onChange={e => {
                  const opt = WALL_OPTIONS.find(w => w.id === e.target.value);
                  if (opt) setState(s => ({ ...s, fabric: { ...s.fabric, wallUValue: opt.uValue } }));
                }}
                className="w-full text-[10px] rounded px-2 py-1.5"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                {WALL_OPTIONS.map(w => <option key={w.id} value={w.id}>{w.name} (U={w.uValue})</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] mb-1" style={{ color: 'var(--text-secondary)' }}>Glazing</div>
              <select value={state.fabric.glazingId}
                onChange={e => {
                  const opt = GLAZING_OPTIONS.find(w => w.id === e.target.value);
                  if (opt) setState(s => ({ ...s, fabric: { ...s.fabric, glazingId: opt.id, glazingUValue: opt.uValue } }));
                }}
                className="w-full text-[10px] rounded px-2 py-1.5"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                {GLAZING_OPTIONS.map(w => <option key={w.id} value={w.id}>{w.name} (U={w.uValue})</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] mb-1" style={{ color: 'var(--text-secondary)' }}>Thermal mass</div>
              <select value={THERMAL_MASS_OPTIONS.find(m => m.kjPerM2K === (state.fabric.thermalMassKjPerM2K ?? 80))?.id ?? 'medium'}
                onChange={e => {
                  const opt = THERMAL_MASS_OPTIONS.find(m => m.id === e.target.value);
                  if (opt) setState(s => ({ ...s, fabric: { ...s.fabric, thermalMassKjPerM2K: opt.kjPerM2K } }));
                }}
                className="w-full text-[10px] rounded px-2 py-1.5"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                {THERMAL_MASS_OPTIONS.map(m => <option key={m.id} value={m.id}>{m.name} ({m.kjPerM2K} kJ/m2K)</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] mb-1" style={{ color: 'var(--text-secondary)' }}>Adjacent spaces</div>
              <select value={
                  (state.fabric.adjacentSpaceTempC ?? 26) === 26 ? 'conditioned'
                  : (state.fabric.adjacentSpaceTempC ?? 26) === 29 ? 'semi' : 'unconditioned'
                }
                onChange={e => {
                  const opt = ADJACENT_SPACE_OPTIONS.find(a => a.id === e.target.value);
                  if (!opt) return;
                  const t = opt.tempC === 'outdoor' ? state.conditions.outdoorTempC : opt.tempC;
                  setState(s => ({ ...s, fabric: { ...s.fabric, adjacentSpaceTempC: t } }));
                }}
                className="w-full text-[10px] rounded px-2 py-1.5"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                {ADJACENT_SPACE_OPTIONS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] mb-1" style={{ color: 'var(--text-secondary)' }}>Orientation</div>
              <select value={state.geometry.orientation}
                onChange={e => setState(s => ({ ...s, geometry: { ...s.geometry, orientation: e.target.value as any } }))}
                className="w-full text-[10px] rounded px-2 py-1.5"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                {Object.keys(ORIENTATION_SOLAR).map(k => (
                  <option key={k} value={k}>{ORIENTATION_SOLAR[k].label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ============ RIGHT: live readouts or challenge ============ */}
      {viewMode === 'challenge' ? (
        <ChallengePanel
          state={state}
          schedule={syncedSchedule}
          activeChallengeId={activeChallenge?.id ?? null}
          onSelectChallenge={handleSelectChallenge}
          onReset={handleResetChallenge}
        />
      ) : (
      <div className="space-y-4">
        {/* Headline numbers */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-[10px] uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Live Results</div>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Total power" value={(result.totalElectricalW / 1000).toFixed(2)} unit="kW" color="var(--accent-teal)"
              hint="Instantaneous electrical draw at design conditions" />
            <Metric label="Daily energy" value={dayResult.dailyKwh.toFixed(1)} unit="kWh" color="var(--accent-blue)"
              hint="From the transient 24-hour simulation, not extrapolated from this peak hour" />
            <Metric label="Daily CO2" value={dayResult.dailyCo2Kg.toFixed(1)} unit="kg" color="var(--accent-amber)"
              hint="Hour-by-hour grid carbon intensity across the full day" />
            <Metric label="Room temp" value={result.indoorTempC.toFixed(1)} unit="C" color={comfortColor}
              hint="Steady-state indoor air temperature" />
          </div>

          {/* Comfort bar */}
          <div className="mt-3">
            <div className="flex justify-between text-[9px] mb-1">
              <span style={{ color: 'var(--text-muted)' }}>Comfort</span>
              <span style={{ color: comfortColor, textTransform: 'capitalize' }}>{result.comfortStatus}</span>
            </div>
            <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
              <div className="absolute inset-y-0" style={{
                left: `${((COMFORT_MIN_C - 18) / 20) * 100}%`,
                width: `${((COMFORT_MAX_C - COMFORT_MIN_C) / 20) * 100}%`,
                background: 'rgba(45,212,191,0.25)',
              }} />
              <div className="absolute top-0 h-2 w-1 rounded" style={{
                left: `${Math.max(0, Math.min(100, ((result.perceivedTempC - 18) / 20) * 100))}%`,
                background: comfortColor,
              }} />
            </div>
            <div className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Feels like {result.perceivedTempC.toFixed(1)} C
              {result.perceivedTempC < result.indoorTempC && ' (fan air movement)'}
            </div>
          </div>

          {result.acUndersized && (
            <div className="mt-3 rounded-lg p-2 text-[10px]" style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)' }}>
              AC is undersized. It needs {(result.qTotalW / 1000).toFixed(1)} kW of cooling but only
              {' '}{(result.acCapacityW / 1000).toFixed(1)} kW is installed, so the room drifts above setpoint.
            </div>
          )}
          {result.acCapacityW === 0 && state.items.length > 0 && (
            <div className="mt-3 rounded-lg p-2 text-[10px]" style={{ background: 'var(--accent-amber-dim)', color: 'var(--accent-amber)' }}>
              No air conditioning placed. The room heats up until envelope losses balance the internal gains.
            </div>
          )}
        </div>

        {/* Heat balance */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Heat Balance</div>
          {[
            { label: 'Equipment & lighting', w: result.qEquipmentW, c: '#a78bfa' },
            { label: `Occupants (${result.occupantCount})`, w: result.qPeopleW, c: '#fcd34d' },
            { label: 'Solar through glazing', w: result.qSolarW, c: '#fb923c' },
            { label: 'Conduction (external + adjacent)', w: result.qConductionW, c: '#f87171' },
            { label: 'Ventilation & infiltration', w: result.qVentilationW, c: '#60a5fa' },
          ].map(row => {
            const pct = result.qTotalW > 0 ? Math.abs(row.w) / result.qTotalW * 100 : 0;
            return (
              <div key={row.label} className="mb-2">
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                  <span className="font-mono" style={{ color: row.c }}>{row.w >= 0 ? '+' : ''}{row.w.toFixed(0)} W</span>
                </div>
                <div className="h-1 rounded-full" style={{ background: 'var(--bg-primary)' }}>
                  <div className="h-1 rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: row.c }} />
                </div>
              </div>
            );
          })}
          <div className="flex justify-between text-[10px] pt-2 mt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <span className="font-medium">Total heat to remove</span>
            <span className="font-mono font-bold" style={{ color: 'var(--accent-red)' }}>{(result.qTotalW / 1000).toFixed(2)} kW</span>
          </div>
          <div className="flex justify-between text-[10px] mt-1">
            <span style={{ color: 'var(--text-muted)' }}>AC electricity (COP {result.effectiveCop.toFixed(1)})</span>
            <span className="font-mono" style={{ color: 'var(--accent-blue)' }}>{(result.acElectricalW / 1000).toFixed(2)} kW</span>
          </div>
        </div>

        {/* The cooling penalty: the key teaching moment */}
        <div className="rounded-xl p-4" style={{ background: 'var(--accent-blue-dim)', border: '1px solid var(--accent-blue)' }}>
          <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--accent-blue)' }}>The Cooling Penalty</div>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>Equipment draws directly</span>
              <span className="font-mono">{result.directElectricalW.toFixed(0)} W</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>Extra AC work to remove that heat</span>
              <span className="font-mono" style={{ color: 'var(--accent-amber)' }}>+{result.coolingPenaltyW.toFixed(0)} W</span>
            </div>
            <div className="flex justify-between pt-1.5 font-semibold" style={{ borderTop: '1px solid rgba(96,165,250,0.3)' }}>
              <span>True cost of the equipment</span>
              <span className="font-mono" style={{ color: 'var(--accent-blue)' }}>
                {(result.directElectricalW + result.coolingPenaltyW).toFixed(0)} W
              </span>
            </div>
          </div>
          <p className="text-[9px] mt-2 leading-snug" style={{ color: 'var(--text-secondary)' }}>
            Every watt of equipment in an air-conditioned room actually costs about
            {' '}{(1 + 1 / result.effectiveCop).toFixed(2)} watts once cooling is included.
            This is why efficient equipment saves more than its nameplate suggests.
          </p>
        </div>

        {/* Intensity metrics tying back to the portfolio analytics */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Benchmarking</div>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Power density" value={result.powerDensityWPerM2.toFixed(0)} unit="W/m2"
              hint="Electrical demand per square metre at design conditions" />
            <Metric label="Cooling load" value={(result.qTotalW / result.floorAreaM2).toFixed(0)} unit="W/m2"
              color={(result.qTotalW / result.floorAreaM2) > 120 ? 'var(--accent-red)' : (result.qTotalW / result.floorAreaM2) > 70 ? 'var(--accent-amber)' : 'var(--accent-teal)'}
              hint="Heat that must be removed per square metre. This is what sizes the equipment." />
          </div>
          <p className="text-[9px] mt-2 leading-snug" style={{ color: 'var(--text-muted)' }}>
            These are design-condition figures used for sizing equipment. Annual energy intensity
            cannot be read off a single peak hour, so for EUI benchmarking against the portfolio
            switch to the <span style={{ color: 'var(--accent-teal)' }}>24-Hour Day</span> tab.
          </p>
        </div>

        {/* Selected equipment note */}
        {selectedEq && (
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span style={{ color: selectedEq.color, fontSize: 15 }}>{selectedEq.icon}</span>
              <span className="text-xs font-medium">{selectedEq.name}</span>
            </div>
            <p className="text-[10px] leading-snug" style={{ color: 'var(--text-secondary)' }}>{selectedEq.note}</p>
            {selectedEq.lumens && (
              <div className="text-[9px] font-mono mt-1.5" style={{ color: 'var(--accent-teal)' }}>
                {selectedEq.lumens} lumens &middot; {(selectedEq.lumens / selectedEq.watts).toFixed(0)} lm/W efficacy
              </div>
            )}
          </div>
        )}
      </div>
      )}
      </>
      )}
      </div>
    </div>
  );
}
