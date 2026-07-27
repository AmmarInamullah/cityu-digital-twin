'use client';

const SECTIONS = [
  {
    title: 'Data Sources',
    items: [
      { label: 'CityU Environmental Reports', value: '7 years (2017-18 to 2023-24)', type: 'measured', detail: 'Annual building-level kWh, campus totals, GHG per floor area, zone breakdowns. Publicly published by CityU Facilities Management Office.' },
      { label: 'Building Data Genome Project 2', value: '1,636 buildings, 53.6M readings', type: 'reference', detail: 'BDG2-calibrated transfer data. Education buildings statistically matched to published distributions (Miller et al., Nature Scientific Data, 2020). Hourly profiles generated from change-point models with realistic parameters.' },
      { label: 'CLP Sustainability Report 2025', value: '0.34 kg CO2e/kWh', type: 'measured', detail: 'Grid emissions intensity for CLP Power Hong Kong (serves Kowloon Tong/CityU). HK Electric factor (0.59) is NOT used as it applies only to Hong Kong Island.' },
      { label: 'ASHRAE GEPIII Competition', value: 'Model validation framework', type: 'reference', detail: 'Competition methodology for long-term energy prediction with measurement and verification applications. Informs our train/test split and evaluation approach.' },
    ],
  },
  {
    title: 'Energy Modeling',
    items: [
      { label: 'Change-point model', value: '3-parameter (ASHRAE Guideline 14)', type: 'model', detail: 'E = base_load + cooling_slope * max(0, T - T_cool_bal) + heating_slope * max(0, T_heat_bal - T). Industry standard for IPMVP Option C measurement and verification. Parameters vary by climate zone and building type.' },
      { label: 'Hourly load shape', value: 'Weekday/weekend profiles', type: 'model', detail: 'Normalized 24-hour profiles based on typical education building patterns. Weekday peak at 12-14h, weekend ~30% lower. Applied as multiplier on the change-point base load.' },
      { label: 'Seasonal variation', value: 'Monthly factors', type: 'model', detail: 'Semester months (Sep-May) ~5-10% higher than summer (Jun-Aug). Chinese New Year and exam periods modeled explicitly.' },
      { label: 'Noise model', value: 'Gaussian, 5% std', type: 'assumption', detail: 'Random variation added to prevent identical days. Standard deviation is 5% of the hourly value plus 3% zone-level noise.' },
    ],
  },
  {
    title: 'Carbon Accounting',
    items: [
      { label: 'Flat emission factor', value: '0.34 kg CO2e/kWh', type: 'measured', detail: 'CLP 2025 published figure. Used for annual reporting consistency with CityU Environmental Reports.' },
      { label: 'Time-varying factors', value: '0.28-0.40 kg CO2e/kWh', type: 'model', detail: 'Hourly factors based on CLP generation mix patterns. Higher during peak (gas peakers) lower overnight (Daya Bay nuclear baseload). Annual average matches the published 0.34.' },
      { label: 'Scope 1/2/3 split', value: '2,380 / 26,920 / 61 tCO2e', type: 'measured', detail: 'Campus-wide figures from CityU 2022-23 Environmental Report. Scope 2 (electricity) dominates at 91.7%. Building-level simulation maps directly to Scope 2.' },
    ],
  },
  {
    title: 'Resilience Score',
    items: [
      { label: 'Energy Performance weight', value: '40%', type: 'assumption', detail: 'Highest weight because energy is the primary controllable input with the most granular real data available. Penalty: 2 points per 1% above baseline.' },
      { label: 'CO2 Trajectory weight', value: '35%', type: 'assumption', detail: 'Weighted heavily because CityU\'s own KPI is framed in GHG terms. Compares current emissions against a linear interpolation from 2018-19 baseline to 2030 target.' },
      { label: 'Operational Adaptability weight', value: '25%', type: 'assumption', detail: 'Smallest weight because it derives from the other two (anomaly frequency). Each anomaly in 24h costs 15 points.' },
      { label: 'Weight derivation', value: 'Expert judgment (to be replaced)', type: 'assumption', detail: 'Current weights are asserted, not derived. A proper implementation would use entropy-based data-driven weighting or AHP pairwise comparison. This is acknowledged as a limitation.' },
    ],
  },
  {
    title: 'Fault Detection',
    items: [
      { label: 'Overnight base load threshold', value: '>55% of daytime', type: 'model', detail: 'Education buildings should drop to <45% overnight. Ratio above 55% indicates HVAC running in unoccupied spaces. Fix cost estimated at $5,000 for scheduling audit.' },
      { label: 'Baseload creep threshold', value: '>8% Q1-to-Q4 increase', type: 'model', detail: 'Gradual load increase over time suggests equipment degradation or uncontrolled additions. Based on ASHRAE energy audit guidelines.' },
      { label: 'Weekend setback threshold', value: '>85% of weekday', type: 'model', detail: 'Education buildings typically see 65-75% weekend-to-weekday ratio. Above 85% suggests inadequate weekend HVAC scheduling.' },
      { label: 'Load factor threshold', value: '<0.30', type: 'model', detail: 'Low load factor (avg/peak ratio) suggests oversized equipment. Equipment runs inefficiently at low part-load ratios.' },
    ],
  },
  {
    title: 'Intervention Library',
    items: [
      { label: 'Savings percentages', value: '3-15% per intervention', type: 'reference', detail: 'Mean and standard deviation from published retrofit studies (DOE, ASHRAE, IEA). Each intervention has an explicitly stated uncertainty range for Monte Carlo sampling.' },
      { label: 'Cost estimates', value: '$3-60 per m2', type: 'reference', detail: 'Order-of-magnitude estimates from ASHRAE cost databases and Hong Kong construction indices. Not site-specific quotes.' },
      { label: 'Lifetime assumptions', value: '8-25 years', type: 'assumption', detail: 'Equipment lifetimes from manufacturer specifications and ASHRAE Handbook. Used for lifetime CO2 abatement calculation in MACC.' },
    ],
  },
  {
    title: 'Room Simulator (thermal model)',
    items: [
      { label: 'Design-hour model', value: 'Steady state', type: 'model', detail: 'Solves the heat balance for a sustained peak condition. This is the correct model for sizing equipment and matches ASHRAE cooling-load design practice.' },
      { label: '24-hour model', value: 'Transient, C dT/dt = Q', type: 'model', detail: 'Steps temperature forward hourly using the room\u2019s thermal capacitance. The day is run three times so the profile settles into a repeating cycle rather than depending on an arbitrary start temperature.' },
      { label: 'Thermal capacitance', value: '40 / 80 / 150 kJ/m2K', type: 'reference', detail: 'Lightweight, medium and heavy construction categories following the admittance method in CIBSE Guide A. Determines how fast the room drifts when cooling stops.' },
      { label: 'Occupant sensible heat', value: '75 W per person', type: 'reference', detail: 'ASHRAE Fundamentals Chapter 18, seated light work. Latent heat is not modelled.' },
      { label: 'Air heat capacity term', value: '0.335 W/(m3.K.ACH)', type: 'model', detail: 'Derived from rho = 1.2 kg/m3 and cp = 1005 J/kgK divided by 3600 seconds.' },
      { label: 'AC coefficient of performance', value: '3.0 to 4.2', type: 'reference', detail: 'Fixed-speed split units 3.0 to 3.2, inverter units up to 4.2. Manufacturer rated values at standard conditions.' },
      { label: 'Solar irradiance by facade', value: '110 to 400 W/m2', type: 'reference', detail: 'Peak vertical-surface irradiance for Hong Kong summer. West is worst at 400 W/m2 because afternoon sun coincides with peak outdoor temperature.' },
      { label: 'Floor and ceiling', value: 'Adiabatic', type: 'assumption', detail: 'Treated as an internal room in a multi-storey building, so heat is exchanged only through external walls and glazing. This overstates temperature rise in a high-load room with cooling switched off, because real rooms also leak heat to adjacent spaces.' },
      { label: 'Latent (humidity) load', value: 'Not modelled', type: 'assumption', detail: 'Sensible heat only. In Hong Kong this understates real cooling loads by roughly 20 to 30 percent.' },
      { label: 'Equipment capital costs', value: '$2 to $12,000', type: 'assumption', detail: 'Order-of-magnitude figures used in challenge mode to create a budget constraint. Not procurement quotes.' },
    ],
  },
  {
    title: 'Portfolio Optimization',
    items: [
      { label: 'Optimization method', value: 'Greedy by MAC', type: 'model', detail: 'Sort all building-intervention pairs by marginal abatement cost ($/tonne CO2). Select greedily until budget exhausted. This is standard MACC construction methodology.' },
      { label: 'Monte Carlo simulations', value: '1,000 iterations', type: 'model', detail: 'Each iteration samples savings from Normal(mean, std) per intervention. Portfolio total summed per iteration. P10/P50/P90 reported.' },
    ],
  },
  {
    title: 'Climate Adaptation',
    items: [
      { label: 'Warming scenarios', value: '+1.5C and +2.0C', type: 'reference', detail: 'IPCC AR6 scenarios. Applied as additional degrees above the cooling balance point for all cooling hours (~5,000 hrs/yr in Hong Kong).' },
      { label: 'Cooling load response', value: 'Linear per degree', type: 'model', detail: 'Each +1C above balance point increases cooling load by the building\'s cooling slope coefficient. This is a first-order approximation; real response is slightly non-linear.' },
    ],
  },
];

const TYPE_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  measured: { color: 'var(--accent-teal)', bg: 'var(--accent-green-dim)', label: 'MEASURED' },
  reference: { color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)', label: 'REFERENCE' },
  model: { color: 'var(--accent-amber)', bg: 'var(--accent-amber-dim)', label: 'MODELED' },
  assumption: { color: 'var(--accent-red)', bg: 'var(--accent-red-dim)', label: 'ASSUMED' },
};

export default function MethodologyView() {
  return (
    <div>
      <div className="border-b px-8 py-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-xl font-semibold tracking-tight">Methodology</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Every data source, coefficient, and modeling choice. Color-coded by provenance.
        </p>
      </div>

      <div className="p-8">
        {/* Legend */}
        <div className="flex gap-4 mb-6">
          {Object.entries(TYPE_COLORS).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {key === 'measured' ? 'From published reports' : key === 'reference' ? 'From peer-reviewed sources' : key === 'model' ? 'Computed from data' : 'Expert judgment, stated openly'}
              </span>
            </div>
          ))}
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {SECTIONS.map(section => (
            <div key={section.title} className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div className="px-6 py-3" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{section.title}</div>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {section.items.map((item, i) => {
                  const cfg = TYPE_COLORS[item.type] || TYPE_COLORS.assumption;
                  return (
                    <div key={i} className="px-6 py-4" style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <div className="flex items-start gap-3">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{item.label}</span>
                            <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{item.value}</span>
                          </div>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{item.detail}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl p-6" style={{ background: 'var(--accent-amber-dim)', border: '1px solid var(--accent-amber)' }}>
          <div className="text-sm font-medium mb-2" style={{ color: 'var(--accent-amber)' }}>Transparency Note</div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Items tagged ASSUMED are acknowledged limitations. The resilience score weights are asserted rather than derived through
            a formal MCDA process. Intervention costs are order-of-magnitude estimates, not site-specific quotes. The BDG2-calibrated
            portfolio uses statistically matched transfer data, not direct BDG2 measurements. These limitations are stated openly
            because transparent methodology is more valuable than false precision.
          </p>
        </div>
      </div>
    </div>
  );
}
