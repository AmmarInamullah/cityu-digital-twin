// ============================================================
// FIXED DECISIONS - Do not change these without explicit reason
// ============================================================

// CLP Power Hong Kong grid emissions intensity
// Source: CLP 2025 Sustainability/Finance Report
// CityU/Kowloon Tong is served by CLP, NOT HK Electric (0.59)
export const CLP_HK_EMISSION_FACTOR_KG_PER_KWH = 0.34;

export function calculateCO2Emissions(energyKwh: number): number {
  return energyKwh * CLP_HK_EMISSION_FACTOR_KG_PER_KWH;
}

// ============================================================
// Real CityU Data (from Environmental Reports 2017-18 to 2023-24)
// ============================================================

export interface YearlyData {
  year: string;
  yeungKwh: number;       // millions
  campusTotalKwh: number; // millions
  ghgPerFloorArea: number | null; // tCO2e/m2
}

export const CITYU_HISTORICAL_DATA: YearlyData[] = [
  { year: '2017-18', yeungKwh: 45.4, campusTotalKwh: 62.9, ghgPerFloorArea: null },
  { year: '2018-19', yeungKwh: 46.6, campusTotalKwh: 65.2, ghgPerFloorArea: 0.13 },
  { year: '2019-20', yeungKwh: 47.4, campusTotalKwh: 65.5, ghgPerFloorArea: 0.13 },
  { year: '2020-21', yeungKwh: 46.1, campusTotalKwh: 65.3, ghgPerFloorArea: 0.10 },
  { year: '2021-22', yeungKwh: 48.2, campusTotalKwh: 68.2, ghgPerFloorArea: 0.10 },
  { year: '2022-23', yeungKwh: 49.1, campusTotalKwh: 70.2, ghgPerFloorArea: 0.11 },
  { year: '2023-24', yeungKwh: 53.1, campusTotalKwh: 75.6, ghgPerFloorArea: 0.14 },
];

// Baseline year for the 2030 target
export const BASELINE_YEAR = '2018-19';
export const BASELINE_GHG_PER_FLOOR_AREA = 0.13; // tCO2e/m2

// CityU's stated 2030 target: 8% reduction in GHG per floor area vs 2018-19
export const GHG_REDUCTION_TARGET_2030 = 0.08;
export const TARGET_GHG_PER_FLOOR_AREA_2030 = BASELINE_GHG_PER_FLOOR_AREA * (1 - GHG_REDUCTION_TARGET_2030);

// Current status: 7.69% ABOVE baseline (2023-24 report)
export const CURRENT_GHG_DEVIATION = 0.0769;

// YEUNG Building energy zone breakdown (2023-24)
export const YEUNG_ZONE_BREAKDOWN = {
  generalLightingAC: 0.357,
  laboratoryPower: 0.279,
  chillerPlant: 0.271,
  otherBuildingServices: 0.093,
};

// Derived daily baseline from most recent year
// 53.1 million kWh / 365 days
export const YEUNG_BASELINE_DAILY_KWH = (53.1e6) / 365; // ~145,479 kWh/day

// YEUNG Building profile data
export const YEUNG_BUILDING_PROFILE = {
  name: 'YEUNG Building (Yeung Kin Man Academic Building)',
  location: 'City University of Hong Kong, Kowloon Tong, Hong Kong',
  gridProvider: 'CLP' as const,
  floorAreaSqm: 200000, // approximate, from campus data
  baselineDailyKwh: YEUNG_BASELINE_DAILY_KWH,
  zoneBreakdown: YEUNG_ZONE_BREAKDOWN,
  baselineYear: '2023-24',
};

// ============================================================
// Resilience Score Weights (three-pillar framework)
// Inspired by Chopra's S-DReP methodology
// ============================================================

export const RESILIENCE_WEIGHTS = {
  energyPerformance: 0.40,    // Efficiency vs baseline
  co2Trajectory: 0.35,        // CO2 emissions relative to 2030 target
  operationalAdaptability: 0.25, // Anomaly frequency, response capacity
};

// ============================================================
// Real Scope 1/2/3 GHG data (campus-wide, from 2022-23 report)
// ============================================================

export const CAMPUS_GHG_SCOPES = {
  scope1: 2380,    // tonnes CO2e (direct emissions)
  scope2: 26920,   // tonnes CO2e (energy indirect - electricity)
  scope3: 61,      // tonnes CO2e (other indirect)
  total: 29361,
  reportYear: '2022-23',
};
