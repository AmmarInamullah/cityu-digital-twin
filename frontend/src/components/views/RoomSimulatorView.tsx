'use client';
import RoomSimulator from '@/components/RoomSimulator';

const LESSONS = [
  { n: 1, title: 'Power is not energy', body: 'A 2 kW kettle used five minutes a day uses far less energy than a 150 W computer left on for ten hours. Place both and compare the daily kWh.' },
  { n: 2, title: 'Everything becomes heat', body: 'Every watt of electricity consumed inside the room is released as heat. The First Law of Thermodynamics, made visible in the floor colour.' },
  { n: 3, title: 'The AC amplifies every load', body: 'Removing heat costs electricity. At a COP of 3.2, every 100 W of equipment costs an extra 31 W of cooling.' },
  { n: 4, title: 'LEDs save twice', body: 'Swapping a 60 W incandescent for a 9 W LED saves 51 W directly plus about 16 W of cooling. Use the one-click retrofit to see it.' },
  { n: 5, title: 'People are a major load', body: 'Each person gives off about 75 W of heat while consuming no electricity. Thirty students is a 2.25 kW cooling load before any equipment is switched on.' },
  { n: 6, title: 'Comfort is a constraint', body: 'Undersize the AC or raise the setpoint and watch the room drift out of the comfort band. Energy cannot be optimised in isolation.' },
  { n: 7, title: 'Magnitude intuition', body: 'An air conditioner is roughly fifty times a LED bulb. Seeing them side by side recalibrates your sense of scale permanently.' },
];

export default function RoomSimulatorView() {
  return (
    <div>
      <div className="border-b px-8 py-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-xl font-semibold tracking-tight">Room Energy Simulator</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Build a room, place equipment, and watch the thermal and electrical consequences in real time.
          An educational tool for understanding where building energy actually goes.
        </p>
      </div>

      <div className="p-8">
        <RoomSimulator />

        {/* Teaching panel */}
        <div className="mt-8">
          <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            What this simulator teaches
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {LESSONS.map(l => (
              <div key={l.n} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={{ background: 'var(--accent-teal)', color: '#0a0f1a' }}>{l.n}</span>
                  <span className="text-xs font-medium">{l.title}</span>
                </div>
                <p className="text-[10px] leading-snug" style={{ color: 'var(--text-muted)' }}>{l.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Model transparency */}
        <div className="mt-6 rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            The model behind the numbers
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="text-[10px] font-medium mb-2" style={{ color: 'var(--accent-teal)' }}>Heat balance</div>
              <div className="rounded-lg p-3 font-mono text-[10px] leading-relaxed" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
Q_total = Q_equipment + Q_people + Q_solar<br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ Q_external + Q_adjacent<br /><br />
                K_ext = UA_ext + 0.335 &times; ACH &times; V<br />
                K_adj = A_partition &times; 2.0 + 2 &times; A_floor &times; 1.2<br />
                T_eff = (K_ext&middot;T_out + K_adj&middot;T_adj) / (K_ext + K_adj)<br /><br />
                <span style={{ color: 'var(--accent-teal)' }}>Design hour (steady state):</span><br />
                T_in = T_eff + (Q_internal &minus; Q_ac) / K<br /><br />
                <span style={{ color: 'var(--accent-teal)' }}>24-hour (transient):</span><br />
                C &middot; dT/dt = Q_gain &minus; Q_ac<br />
                T(h+1) = T(h) + (Q_gain &minus; Q_ac) &middot; 3600 / C
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium mb-2" style={{ color: 'var(--accent-amber)' }}>Assumptions, stated openly</div>
              <ul className="space-y-1.5 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                <li>The Design Hour tab is steady state, which is the correct model for sizing equipment against a sustained peak. The 24-Hour tab is transient and steps temperature forward using the room&rsquo;s thermal mass. All daily and annual figures come from the transient model, so the two tabs never disagree.</li>
                <li>Heat is exchanged with outdoor air through the external envelope and with neighbouring indoor spaces through internal partitions and the floor and ceiling slabs. That second path is zero while the room sits at the same temperature as its neighbours, so it only matters when the room drifts.</li>
                <li>Sensible heat only. Latent (humidity) load is not modelled, which understates real Hong Kong cooling loads by roughly 20 to 30 percent.</li>
                <li>Occupant heat is 75 W sensible per person, seated light work, from ASHRAE Fundamentals Chapter 18.</li>
                <li>Solar gain on the Design Hour tab uses peak vertical-surface irradiance for the selected orientation. The 24-hour model applies an orientation-dependent curve across daylight hours instead.</li>
                <li>Each hour is solved independently within the transient loop, so sub-hourly control behaviour such as compressor cycling is not represented.</li>
              </ul>
            </div>
          </div>
          <p className="text-[10px] mt-4 pt-3" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)' }}>
            Every coefficient is traceable to ASHRAE Fundamentals or manufacturer nameplate data. The full source list is on the Methodology page.
          </p>
        </div>
      </div>
    </div>
  );
}
