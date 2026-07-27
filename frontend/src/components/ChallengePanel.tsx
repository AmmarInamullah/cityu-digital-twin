'use client';
import { useMemo } from 'react';
import { CHALLENGES, Challenge, evaluateChallenge, costOf, RoomState, ScheduleMap } from '@/lib/roomPhysics';
import { getEquipment } from '@/lib/equipmentLibrary';

export default function ChallengePanel({
  state, schedule, activeChallengeId, onSelectChallenge, onReset,
}: {
  state: RoomState;
  schedule: ScheduleMap;
  activeChallengeId: string | null;
  onSelectChallenge: (c: Challenge) => void;
  onReset: () => void;
}) {
  const challenge = CHALLENGES.find(c => c.id === activeChallengeId) ?? null;

  const evaluation = useMemo(
    () => (challenge ? evaluateChallenge(challenge, state, schedule) : null),
    [challenge, state, schedule]
  );

  // ---------- Challenge picker ----------
  if (!challenge) {
    return (
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
          Choose a Challenge
        </div>
        <p className="text-[10px] mb-4" style={{ color: 'var(--text-muted)' }}>
          Each scenario starts with a real problem, a fixed capital budget, and objectives that
          pull against each other. The same competing-constraint mechanic BESSE used, applied to
          a real room.
        </p>
        <div className="space-y-2">
          {CHALLENGES.map(c => (
            <button key={c.id} onClick={() => onSelectChallenge(c)}
              className="w-full text-left rounded-lg p-3 transition-colors"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">{c.title}</span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--accent-teal)' }}>
                  ${c.budgetUsd.toLocaleString()}
                </span>
              </div>
              <p className="text-[10px] leading-snug" style={{ color: 'var(--text-muted)' }}>{c.brief}</p>
              <div className="text-[9px] mt-1.5" style={{ color: 'var(--accent-blue)' }}>
                {c.objectives.length} objectives
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const ev = evaluation!;
  const budgetPct = Math.min(100, (ev.spend / challenge.budgetUsd) * 100);
  const overBudget = ev.spend > challenge.budgetUsd;

  return (
    <div className="space-y-4">
      {/* ---------- Brief ---------- */}
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Challenge</div>
            <h3 className="text-sm font-semibold mt-0.5">{challenge.title}</h3>
          </div>
          <div className="flex gap-1.5">
            <button onClick={onReset} className="text-[9px] px-2 py-1 rounded"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
              Restart
            </button>
            <button onClick={() => onSelectChallenge(null as any)} className="text-[9px] px-2 py-1 rounded"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
              Exit
            </button>
          </div>
        </div>
        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{challenge.brief}</p>
        <p className="text-[9px] leading-relaxed mt-2 pt-2" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)' }}>
          {challenge.realWorldNote}
        </p>
      </div>

      {/* ---------- Success banner ---------- */}
      {ev.allPassed && (
        <div className="rounded-xl p-4" style={{ background: 'var(--accent-green-dim)', border: '1px solid var(--accent-teal)' }}>
          <div className="text-sm font-semibold mb-1" style={{ color: 'var(--accent-teal)' }}>
            All objectives met
          </div>
          <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
            Solved with ${ev.spend.toLocaleString()} of the ${challenge.budgetUsd.toLocaleString()} budget,
            leaving ${(challenge.budgetUsd - ev.spend).toLocaleString()} unspent.
            Try solving it again for less.
          </p>
        </div>
      )}

      {/* ---------- Budget ---------- */}
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Capital Budget</span>
          <span className="text-sm font-bold font-mono" style={{ color: overBudget ? 'var(--accent-red)' : 'var(--accent-teal)' }}>
            ${ev.spend.toLocaleString()}
            <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}> / ${challenge.budgetUsd.toLocaleString()}</span>
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
          <div className="h-2 rounded-full transition-all duration-300"
            style={{ width: `${budgetPct}%`, background: overBudget ? 'var(--accent-red)' : budgetPct > 80 ? 'var(--accent-amber)' : 'var(--accent-teal)' }} />
        </div>
        <p className="text-[9px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
          Only additions cost money. Removing equipment neither costs nor refunds, the same way
          ripping out old fittings does not recover capital.
        </p>
      </div>

      {/* ---------- Objectives ---------- */}
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Objectives</span>
          <span className="text-[10px] font-mono" style={{ color: ev.allPassed ? 'var(--accent-teal)' : 'var(--text-muted)' }}>
            {ev.passedCount} of {ev.results.length}
          </span>
        </div>
        <div className="space-y-2">
          {ev.results.map(o => (
            <div key={o.id} className="flex items-start gap-2.5 rounded-lg p-2.5"
              style={{ background: 'var(--bg-primary)', border: `1px solid ${o.passed ? 'var(--accent-teal)' : 'var(--border-subtle)'}` }}>
              <span className="text-xs flex-shrink-0 mt-px"
                style={{ color: o.passed ? 'var(--accent-teal)' : 'var(--text-muted)' }}>
                {o.passed ? '\u2713' : '\u25CB'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-medium" style={{ color: o.passed ? 'var(--accent-teal)' : 'var(--text-secondary)' }}>
                  {o.label}
                </div>
                <div className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>{o.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- Live vitals ---------- */}
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Room Vitals</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { l: 'Daily energy', v: ev.day.dailyKwh.toFixed(1), u: 'kWh' },
            { l: 'Peak demand', v: ev.day.peakKw.toFixed(2), u: 'kW' },
            { l: 'Annual EUI', v: ev.day.euiKwhPerM2Yr.toFixed(0), u: 'kWh/m2/yr' },
            { l: 'Daily CO2', v: ev.day.dailyCo2Kg.toFixed(1), u: 'kg' },
          ].map(m => (
            <div key={m.l} className="rounded-lg p-2.5" style={{ background: 'var(--bg-primary)' }}>
              <div className="text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>{m.l}</div>
              <div className="text-sm font-bold font-mono mt-0.5">
                {m.v}<span className="text-[9px] font-normal ml-1" style={{ color: 'var(--text-muted)' }}>{m.u}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- Price list ---------- */}
      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Unit Costs</div>
        <div className="space-y-1">
          {['bulb_led', 'light_fluorescent_tube', 'fan_ceiling', 'ac_inverter_3500', 'ac_split_3500', 'laptop']
            .map(id => {
              const eq = getEquipment(id);
              if (!eq) return null;
              return (
                <div key={id} className="flex justify-between text-[9px]">
                  <span style={{ color: 'var(--text-secondary)' }}>
                    <span style={{ color: eq.color }}>{eq.icon}</span> {eq.shortName}
                  </span>
                  <span className="font-mono" style={{ color: 'var(--text-muted)' }}>${costOf(id).toLocaleString()}</span>
                </div>
              );
            })}
        </div>
        <p className="text-[9px] mt-2" style={{ color: 'var(--text-muted)' }}>
          Changing wall, glazing or ventilation settings is free in this exercise, so the budget
          reflects equipment decisions only.
        </p>
      </div>
    </div>
  );
}
