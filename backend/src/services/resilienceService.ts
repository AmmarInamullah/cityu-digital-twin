import {
  RESILIENCE_WEIGHTS,
  YEUNG_BASELINE_DAILY_KWH,
  calculateCO2Emissions,
  BASELINE_GHG_PER_FLOOR_AREA,
  TARGET_GHG_PER_FLOOR_AREA_2030,
  YEUNG_BUILDING_PROFILE,
} from '../constants';

/**
 * Resilience Score Calculation Service
 *
 * Three-pillar framework inspired by Chopra's S-DReP methodology:
 * 1. Energy Performance (40%) - how far above/below the daily kWh baseline
 * 2. CO2 Trajectory (35%) - emissions relative to the 2030 target path
 * 3. Operational Adaptability (25%) - anomaly frequency, system stability
 *
 * Each pillar produces a 0-100 sub-score. The composite score is a
 * weighted sum of the three pillars.
 *
 * Weight rationale (be ready to defend in interview):
 * - Energy gets the highest weight because it's the primary controllable input
 *   and the metric with the most granular real data.
 * - CO2 trajectory is weighted heavily because CityU's own KPI is framed
 *   in GHG terms, and Chopra's research centers on sustainability indicators.
 * - Operational adaptability gets the smallest weight because it's derived
 *   from the other two (anomalies in energy readings) and has less
 *   independent real data behind it in this prototype.
 */

export interface ResilienceInput {
  dailyKwh: number;
  anomalyCountLast24h: number;
  // Optional overrides for what-if scenarios
  adjustments?: {
    occupancyDelta?: number;        // e.g., +50 people
    solarPanelInstalled?: boolean;  // CityU's 1.15 GWh/year initiative
    acSetpointDelta?: number;       // degrees C above default 22
    lightingEfficiency?: number;    // multiplier, e.g., 0.85 for 15% savings
  };
}

export interface ResilienceResult {
  score: number;
  breakdown: {
    energyPerformance: number;
    co2Trajectory: number;
    operationalAdaptability: number;
  };
  metadata: {
    dailyKwh: number;
    dailyCo2Kg: number;
    anomalyCount: number;
    baselineDeviation: number;
  };
}

/**
 * Apply what-if adjustments to the raw daily kWh figure.
 *
 * Each multiplier is a simple, transparent assumption:
 * - Occupancy: +0.8% per 10 additional people (based on typical HVAC load
 *   scaling in commercial buildings; conservative estimate)
 * - Solar: reduces consumption by CityU's real 1.15 GWh/year / 365 days
 *   = ~3,150 kWh/day offset
 * - AC setpoint: each +1C reduces cooling load by ~3% (DOE guideline)
 * - Lighting: direct multiplier on the lighting+AC zone share (35.7%)
 */
function applyAdjustments(
  baseKwh: number,
  adjustments?: ResilienceInput['adjustments']
): number {
  if (!adjustments) return baseKwh;

  let adjusted = baseKwh;

  // Occupancy impact
  if (adjustments.occupancyDelta) {
    const occupancyFactor = 1 + (adjustments.occupancyDelta / 10) * 0.008;
    adjusted *= occupancyFactor;
  }

  // Solar panel offset (CityU's real 2,000-panel / 1.15 GWh/year initiative)
  if (adjustments.solarPanelInstalled) {
    const solarDailyOffset = (1.15e6) / 365; // ~3,150 kWh/day
    adjusted = Math.max(0, adjusted - solarDailyOffset);
  }

  // AC setpoint (each +1C above 22C saves ~3% of chiller load)
  if (adjustments.acSetpointDelta && adjustments.acSetpointDelta > 0) {
    const chillerShare = 0.271; // YEUNG zone breakdown
    const coolingReduction = adjustments.acSetpointDelta * 0.03;
    adjusted -= baseKwh * chillerShare * coolingReduction;
  }

  // Lighting efficiency
  if (adjustments.lightingEfficiency && adjustments.lightingEfficiency < 1) {
    const lightingShare = 0.357; // general lighting & AC zone
    const lightingSavings = lightingShare * (1 - adjustments.lightingEfficiency);
    adjusted -= baseKwh * lightingSavings;
  }

  return Math.max(0, adjusted);
}

/**
 * Pillar 1: Energy Performance (0-100)
 * 100 = at or below baseline; drops as you exceed it.
 * Penalty function: linear drop, losing 2 points per 1% above baseline,
 * floored at 0.
 */
function calcEnergyPerformance(dailyKwh: number): number {
  const deviation = (dailyKwh - YEUNG_BASELINE_DAILY_KWH) / YEUNG_BASELINE_DAILY_KWH;
  if (deviation <= 0) {
    // At or below baseline: score 80-100, bonus for being under
    return Math.min(100, 80 + Math.abs(deviation) * 100);
  }
  // Above baseline: penalty
  const penalty = deviation * 200; // 2 points per 1% over
  return Math.max(0, 80 - penalty);
}

/**
 * Pillar 2: CO2 Trajectory (0-100)
 * Measures how the current day's CO2 intensity compares to where
 * the building SHOULD be on its path to the 2030 target.
 *
 * Uses a linear interpolation from the 2018-19 baseline to the 2030 target.
 */
function calcCO2Trajectory(dailyCo2Kg: number): number {
  const dailyCo2PerSqm = dailyCo2Kg / (YEUNG_BUILDING_PROFILE.floorAreaSqm * 1000); // tonnes
  const annualizedPerSqm = dailyCo2PerSqm * 365;

  // Linear target path: baseline -> target over 12 years (2018 to 2030)
  const currentYear = new Date().getFullYear();
  const yearsElapsed = Math.min(12, Math.max(0, currentYear - 2018));
  const targetThisYear =
    BASELINE_GHG_PER_FLOOR_AREA -
    (BASELINE_GHG_PER_FLOOR_AREA - TARGET_GHG_PER_FLOOR_AREA_2030) * (yearsElapsed / 12);

  if (annualizedPerSqm <= targetThisYear) {
    return 100; // On or below target trajectory
  }

  const overshoot = (annualizedPerSqm - targetThisYear) / targetThisYear;
  const penalty = overshoot * 300; // steeper penalty for missing trajectory
  return Math.max(0, 100 - penalty);
}

/**
 * Pillar 3: Operational Adaptability (0-100)
 * Based on system stability: fewer anomalies = more resilient.
 * 0 anomalies in 24h = 100; each anomaly costs 15 points.
 */
function calcOperationalAdaptability(anomalyCount: number): number {
  const penalty = anomalyCount * 15;
  return Math.max(0, 100 - penalty);
}

/**
 * Main calculation: compute the composite resilience score.
 */
export function calculateResilience(input: ResilienceInput): ResilienceResult {
  const adjustedKwh = applyAdjustments(input.dailyKwh, input.adjustments);
  const dailyCo2Kg = calculateCO2Emissions(adjustedKwh);
  const baselineDeviation =
    ((adjustedKwh - YEUNG_BASELINE_DAILY_KWH) / YEUNG_BASELINE_DAILY_KWH) * 100;

  const energyPerformance = calcEnergyPerformance(adjustedKwh);
  const co2Trajectory = calcCO2Trajectory(dailyCo2Kg);
  const operationalAdaptability = calcOperationalAdaptability(input.anomalyCountLast24h);

  const score = Math.round(
    energyPerformance * RESILIENCE_WEIGHTS.energyPerformance +
    co2Trajectory * RESILIENCE_WEIGHTS.co2Trajectory +
    operationalAdaptability * RESILIENCE_WEIGHTS.operationalAdaptability
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: {
      energyPerformance: Math.round(energyPerformance),
      co2Trajectory: Math.round(co2Trajectory),
      operationalAdaptability: Math.round(operationalAdaptability),
    },
    metadata: {
      dailyKwh: Math.round(adjustedKwh),
      dailyCo2Kg: Math.round(dailyCo2Kg),
      anomalyCount: input.anomalyCountLast24h,
      baselineDeviation: Math.round(baselineDeviation * 100) / 100,
    },
  };
}
