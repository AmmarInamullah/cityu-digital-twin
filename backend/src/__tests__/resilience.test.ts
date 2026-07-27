import { calculateResilience, ResilienceInput } from '../services/resilienceService';
import { YEUNG_BASELINE_DAILY_KWH } from '../constants';

describe('Resilience Score Calculation', () => {
  describe('calculateResilience', () => {
    it('should return score 100 when at baseline with no anomalies', () => {
      const input: ResilienceInput = {
        dailyKwh: YEUNG_BASELINE_DAILY_KWH,
        anomalyCountLast24h: 0,
      };
      const result = calculateResilience(input);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.breakdown.energyPerformance).toBeGreaterThanOrEqual(80);
      expect(result.breakdown.operationalAdaptability).toBe(100);
    });

    it('should penalize when above baseline', () => {
      const baselineInput: ResilienceInput = {
        dailyKwh: YEUNG_BASELINE_DAILY_KWH,
        anomalyCountLast24h: 0,
      };
      const highInput: ResilienceInput = {
        dailyKwh: YEUNG_BASELINE_DAILY_KWH * 1.5,
        anomalyCountLast24h: 0,
      };
      const baselineResult = calculateResilience(baselineInput);
      const highResult = calculateResilience(highInput);
      expect(highResult.score).toBeLessThan(baselineResult.score);
      expect(highResult.breakdown.energyPerformance).toBeLessThan(baselineResult.breakdown.energyPerformance);
    });

    it('should penalize for anomalies', () => {
      const noAnomaly: ResilienceInput = {
        dailyKwh: YEUNG_BASELINE_DAILY_KWH,
        anomalyCountLast24h: 0,
      };
      const withAnomalies: ResilienceInput = {
        dailyKwh: YEUNG_BASELINE_DAILY_KWH,
        anomalyCountLast24h: 5,
      };
      const noResult = calculateResilience(noAnomaly);
      const withResult = calculateResilience(withAnomalies);
      expect(withResult.score).toBeLessThan(noResult.score);
      expect(withResult.breakdown.operationalAdaptability).toBeLessThan(noResult.breakdown.operationalAdaptability);
    });

    it('should apply solar panel adjustment', () => {
      const withoutSolar: ResilienceInput = {
        dailyKwh: YEUNG_BASELINE_DAILY_KWH,
        anomalyCountLast24h: 0,
      };
      const withSolar: ResilienceInput = {
        dailyKwh: YEUNG_BASELINE_DAILY_KWH,
        anomalyCountLast24h: 0,
        adjustments: { solarPanelInstalled: true },
      };
      const withoutResult = calculateResilience(withoutSolar);
      const withResult = calculateResilience(withSolar);
      expect(withResult.metadata.dailyKwh).toBeLessThan(withoutResult.metadata.dailyKwh);
      expect(withResult.score).toBeGreaterThanOrEqual(withoutResult.score);
    });

    it('should apply AC setpoint adjustment', () => {
      const input: ResilienceInput = {
        dailyKwh: YEUNG_BASELINE_DAILY_KWH,
        anomalyCountLast24h: 0,
        adjustments: { acSetpointDelta: 3 },
      };
      const result = calculateResilience(input);
      expect(result.metadata.dailyKwh).toBeLessThan(YEUNG_BASELINE_DAILY_KWH);
    });

    it('should apply lighting efficiency adjustment', () => {
      const input: ResilienceInput = {
        dailyKwh: YEUNG_BASELINE_DAILY_KWH,
        anomalyCountLast24h: 0,
        adjustments: { lightingEfficiency: 0.85 },
      };
      const result = calculateResilience(input);
      expect(result.metadata.dailyKwh).toBeLessThan(YEUNG_BASELINE_DAILY_KWH);
    });

    it('should apply occupancy adjustment', () => {
      const input: ResilienceInput = {
        dailyKwh: YEUNG_BASELINE_DAILY_KWH,
        anomalyCountLast24h: 0,
        adjustments: { occupancyDelta: 50 },
      };
      const result = calculateResilience(input);
      expect(result.metadata.dailyKwh).toBeGreaterThan(YEUNG_BASELINE_DAILY_KWH);
    });

    it('should never return negative kWh', () => {
      const input: ResilienceInput = {
        dailyKwh: 100,
        anomalyCountLast24h: 0,
        adjustments: {
          solarPanelInstalled: true,
          lightingEfficiency: 0.5,
          acSetpointDelta: 5,
        },
      };
      const result = calculateResilience(input);
      expect(result.metadata.dailyKwh).toBeGreaterThanOrEqual(0);
    });

    it('should clamp score between 0 and 100', () => {
      const extremeInput: ResilienceInput = {
        dailyKwh: YEUNG_BASELINE_DAILY_KWH * 10,
        anomalyCountLast24h: 20,
      };
      const result = calculateResilience(extremeInput);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should compute CO2 from kWh using emission factor', () => {
      const input: ResilienceInput = {
        dailyKwh: 10000,
        anomalyCountLast24h: 0,
      };
      const result = calculateResilience(input);
      expect(result.metadata.dailyCo2Kg).toBe(Math.round(10000 * 0.34));
    });
  });
});
