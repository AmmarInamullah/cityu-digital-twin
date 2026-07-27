/**
 * Synthetic Data Generator
 *
 * Generates a full year of hourly energy readings for the YEUNG Building,
 * calibrated so the annual total matches the real 2023-24 figure of 53.1M kWh.
 *
 * Key design decisions:
 * 1. Hourly shape uses a realistic university building profile:
 *    - Low overnight (11pm-6am): ~40-50% of hourly average
 *    - Morning ramp (6am-9am): climbing to peak
 *    - Daytime plateau (9am-6pm): 120-140% of average
 *    - Evening decay (6pm-11pm): gradual decline
 * 2. Weekdays consume ~15% more than weekends
 * 3. Semester months (Sep-May) consume ~10% more than summer (Jun-Aug)
 * 4. Each reading is assigned to a zone matching real YEUNG breakdown percentages
 * 5. Gaussian noise (std = 5% of value) added so no two hours are identical
 *
 * Run with: npm run generate-data
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import BuildingProfile from '../models/BuildingProfile';
import SensorReading from '../models/SensorReading';
import { YEUNG_ZONE_BREAKDOWN } from '../constants';

// ============================================================
// Hourly shape profile (normalized so average across 24 hours = 1.0)
// Based on typical university building load patterns
// ============================================================

const WEEKDAY_HOURLY_SHAPE = [
  // Hour: 0    1     2     3     4     5     6     7     8     9     10    11
  0.42, 0.38, 0.36, 0.35, 0.36, 0.40, 0.55, 0.78, 1.05, 1.30, 1.38, 1.42,
  // Hour: 12   13    14    15    16    17    18    19    20    21    22    23
  1.40, 1.44, 1.42, 1.38, 1.32, 1.20, 1.02, 0.85, 0.72, 0.60, 0.52, 0.45,
];

const WEEKEND_HOURLY_SHAPE = [
  // Weekends: lower overall, flatter profile, no sharp morning ramp
  0.40, 0.38, 0.36, 0.35, 0.35, 0.38, 0.42, 0.50, 0.62, 0.72, 0.78, 0.80,
  0.82, 0.80, 0.78, 0.76, 0.72, 0.68, 0.62, 0.55, 0.50, 0.46, 0.43, 0.41,
];

// Normalize each shape so its 24-hour sum = 24 (i.e., average = 1.0)
function normalizeShape(shape: number[]): number[] {
  const sum = shape.reduce((a, b) => a + b, 0);
  const factor = 24 / sum;
  return shape.map(v => v * factor);
}

const WEEKDAY_NORM = normalizeShape(WEEKDAY_HOURLY_SHAPE);
const WEEKEND_NORM = normalizeShape(WEEKEND_HOURLY_SHAPE);

// ============================================================
// Monthly seasonality factors
// Semester months (Sep-May) are ~1.05x; summer (Jun-Aug) ~0.88x
// Slight variations for exam periods and holidays
// ============================================================

const MONTHLY_FACTORS: Record<number, number> = {
  0: 1.02,  // January (exam period, then break)
  1: 0.95,  // February (Chinese New Year break)
  2: 1.06,  // March (full semester)
  3: 1.08,  // April (full semester)
  4: 1.04,  // May (exams)
  5: 0.88,  // June (summer)
  6: 0.85,  // July (summer)
  7: 0.87,  // August (summer)
  8: 1.08,  // September (semester start)
  9: 1.10,  // October (full semester)
  10: 1.08, // November (full semester)
  11: 1.02, // December (exams, then break)
};

// ============================================================
// Zone names matching the YEUNG breakdown
// ============================================================

const ZONES = [
  { id: 'general_lighting_ac', share: YEUNG_ZONE_BREAKDOWN.generalLightingAC },
  { id: 'laboratory_power', share: YEUNG_ZONE_BREAKDOWN.laboratoryPower },
  { id: 'chiller_plant', share: YEUNG_ZONE_BREAKDOWN.chillerPlant },
  { id: 'other_services', share: YEUNG_ZONE_BREAKDOWN.otherBuildingServices },
];

// ============================================================
// Gaussian noise helper
// ============================================================

function gaussianRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

// ============================================================
// Main generator
// ============================================================

async function generate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB');

    // Find the YEUNG building
    const building = await BuildingProfile.findOne({ name: /YEUNG/i });
    if (!building) {
      console.error('YEUNG Building not found. Run "npm run seed" first.');
      process.exit(1);
    }

    console.log(`Generating data for: ${building.name} (${building._id})`);
    console.log(`Target annual: 53,100,000 kWh`);
    console.log(`Target daily average: ${Math.round(building.baselineDailyKwh).toLocaleString()} kWh`);

    // Clear existing synthetic readings
    const deleted = await SensorReading.deleteMany({
      buildingId: building._id,
      isRealSensor: false,
    });
    console.log(`Cleared ${deleted.deletedCount} existing synthetic readings`);

    // Generate one full year: July 2023 through June 2024 (matching 2023-24 report year)
    const startDate = new Date('2023-07-01T00:00:00Z');
    const endDate = new Date('2024-06-30T23:59:59Z');

    const baseHourlyKwh = building.baselineDailyKwh / 24; // ~6,062 kWh/hour
    let totalKwh = 0;
    let readingCount = 0;
    const batchSize = 5000;
    let batch: any[] = [];

    const current = new Date(startDate);

    while (current <= endDate) {
      const hour = current.getUTCHours();
      const dayOfWeek = current.getUTCDay(); // 0=Sunday, 6=Saturday
      const month = current.getUTCMonth();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Select hourly shape
      const shape = isWeekend ? WEEKEND_NORM : WEEKDAY_NORM;
      const hourFactor = shape[hour];

      // Weekend vs weekday factor (weekends ~15% lower)
      const dayTypeFactor = isWeekend ? 0.85 : 1.0;

      // Monthly seasonality
      const monthFactor = MONTHLY_FACTORS[month] || 1.0;

      // Compute total building consumption for this hour
      const rawHourlyKwh = baseHourlyKwh * hourFactor * dayTypeFactor * monthFactor;

      // Add noise (5% standard deviation)
      const noisyHourlyKwh = Math.max(0, gaussianRandom(rawHourlyKwh, rawHourlyKwh * 0.05));

      // Split into zone readings
      for (const zone of ZONES) {
        const zoneKwh = noisyHourlyKwh * zone.share;
        // Add a bit of zone-specific noise too
        const zoneNoisyKwh = Math.max(0, gaussianRandom(zoneKwh, zoneKwh * 0.03));

        batch.push({
          buildingId: building._id,
          timestamp: new Date(current),
          metricType: 'energy_kwh',
          value: Math.round(zoneNoisyKwh * 100) / 100,
          zoneId: zone.id,
          isRealSensor: false,
        });

        totalKwh += zoneNoisyKwh;
        readingCount++;
      }

      // Flush batch periodically
      if (batch.length >= batchSize) {
        await SensorReading.insertMany(batch, { ordered: false });
        process.stdout.write(
          `\rInserted ${readingCount.toLocaleString()} readings... ` +
          `(${current.toISOString().split('T')[0]}) ` +
          `Running total: ${(totalKwh / 1e6).toFixed(1)}M kWh`
        );
        batch = [];
      }

      // Advance by 1 hour
      current.setUTCHours(current.getUTCHours() + 1);
    }

    // Insert remaining batch
    if (batch.length > 0) {
      await SensorReading.insertMany(batch, { ordered: false });
    }

    const targetKwh = 53.1e6;
    const deviationPct = ((totalKwh - targetKwh) / targetKwh) * 100;

    console.log('\n\n========== Generation Complete ==========');
    console.log(`Total readings:    ${readingCount.toLocaleString()}`);
    console.log(`Total kWh:         ${(totalKwh / 1e6).toFixed(2)}M`);
    console.log(`Target kWh:        ${(targetKwh / 1e6).toFixed(2)}M`);
    console.log(`Deviation:         ${deviationPct > 0 ? '+' : ''}${deviationPct.toFixed(2)}%`);
    console.log(`Date range:        ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    console.log(`Zones:             ${ZONES.map(z => z.id).join(', ')}`);
    console.log('=========================================');

    if (Math.abs(deviationPct) > 5) {
      console.warn('\nWARNING: Deviation exceeds 5%. Consider adjusting monthly factors or noise levels.');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Generation failed:', error);
    process.exit(1);
  }
}

generate();
