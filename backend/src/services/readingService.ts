import mongoose from 'mongoose';
import SensorReading, { ISensorReading } from '../models/SensorReading';
import Alert from '../models/Alert';
import ResilienceScore from '../models/ResilienceScore';
import { calculateResilience } from './resilienceService';
import { WebSocketService } from './websocketService';
import { calculateCO2Emissions, YEUNG_BASELINE_DAILY_KWH } from '../constants';

export class ReadingService {
  /**
   * Store one or more sensor readings and trigger downstream effects:
   * - Broadcast via Socket.IO
   * - Check for anomalies (simple threshold for now; ML-based in Tier 1)
   * - Recompute resilience score periodically
   */
  static async createReadings(
    readings: Array<{
      buildingId: string;
      timestamp: string | Date;
      metricType: 'energy_kwh' | 'occupancy' | 'temperature';
      value: number;
      zoneId?: string;
      isRealSensor?: boolean;
    }>
  ): Promise<ISensorReading[]> {
    const docs = readings.map(r => ({
      buildingId: new mongoose.Types.ObjectId(r.buildingId),
      timestamp: new Date(r.timestamp),
      metricType: r.metricType,
      value: r.value,
      zoneId: r.zoneId,
      isRealSensor: r.isRealSensor || false,
    }));

    const saved = await SensorReading.insertMany(docs);

    // Broadcast each reading
    for (const reading of saved) {
      WebSocketService.broadcastReading(
        reading.buildingId.toString(),
        reading.toObject()
      );
    }

    // Simple threshold-based anomaly check for energy readings
    for (const reading of saved) {
      if (reading.metricType === 'energy_kwh') {
        await this.checkThresholdAnomaly(reading);
      }
    }

    return saved;
  }

  /**
   * Query readings with filters
   */
  static async getReadings(params: {
    buildingId: string;
    from?: string | Date;
    to?: string | Date;
    metricType?: string;
    zoneId?: string;
    limit?: number;
  }): Promise<ISensorReading[]> {
    const query: any = {
      buildingId: new mongoose.Types.ObjectId(params.buildingId),
    };

    if (params.metricType) query.metricType = params.metricType;
    if (params.zoneId) query.zoneId = params.zoneId;

    if (params.from || params.to) {
      query.timestamp = {};
      if (params.from) query.timestamp.$gte = new Date(params.from);
      if (params.to) query.timestamp.$lte = new Date(params.to);
    }

    return SensorReading.find(query)
      .sort({ timestamp: -1 })
      .limit(params.limit || 1000)
      .lean() as any;
  }

  /**
   * Get aggregated daily consumption for a building
   */
  static async getDailyConsumption(
    buildingId: string,
    days: number = 30
  ): Promise<Array<{ date: string; totalKwh: number; co2Kg: number }>> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const pipeline = [
      {
        $match: {
          buildingId: new mongoose.Types.ObjectId(buildingId),
          metricType: 'energy_kwh',
          timestamp: { $gte: fromDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
          },
          totalKwh: { $sum: '$value' },
        },
      },
      {
        $sort: { _id: 1 as const },
      },
    ];

    const results = await SensorReading.aggregate(pipeline);

    return results.map(r => ({
      date: r._id,
      totalKwh: Math.round(r.totalKwh),
      co2Kg: Math.round(calculateCO2Emissions(r.totalKwh)),
    }));
  }

  /**
   * Get hourly consumption for a specific day (for the chart)
   */
  static async getHourlyConsumption(
    buildingId: string,
    date: string // YYYY-MM-DD
  ): Promise<Array<{ hour: number; kwh: number }>> {
    const dayStart = new Date(date + 'T00:00:00Z');
    const dayEnd = new Date(date + 'T23:59:59Z');

    const pipeline = [
      {
        $match: {
          buildingId: new mongoose.Types.ObjectId(buildingId),
          metricType: 'energy_kwh',
          timestamp: { $gte: dayStart, $lte: dayEnd },
        },
      },
      {
        $group: {
          _id: { $hour: '$timestamp' },
          kwh: { $sum: '$value' },
        },
      },
      {
        $sort: { _id: 1 as const },
      },
    ];

    const results = await SensorReading.aggregate(pipeline);

    return results.map(r => ({
      hour: r._id,
      kwh: Math.round(r.kwh),
    }));
  }

  /**
   * Get zone breakdown for a time period
   */
  static async getZoneBreakdown(
    buildingId: string,
    from?: Date,
    to?: Date
  ): Promise<Array<{ zoneId: string; totalKwh: number; percentage: number }>> {
    const match: any = {
      buildingId: new mongoose.Types.ObjectId(buildingId),
      metricType: 'energy_kwh',
      zoneId: { $exists: true, $ne: null },
    };

    if (from || to) {
      match.timestamp = {};
      if (from) match.timestamp.$gte = from;
      if (to) match.timestamp.$lte = to;
    }

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: '$zoneId',
          totalKwh: { $sum: '$value' },
        },
      },
      { $sort: { totalKwh: -1 as const } },
    ];

    const results = await SensorReading.aggregate(pipeline);
    const grandTotal = results.reduce((sum, r) => sum + r.totalKwh, 0);

    return results.map(r => ({
      zoneId: r._id,
      totalKwh: Math.round(r.totalKwh),
      percentage: grandTotal > 0 ? Math.round((r.totalKwh / grandTotal) * 1000) / 10 : 0,
    }));
  }

  /**
   * Simple threshold anomaly check (pre-ML).
   * Flags if a single hourly reading exceeds 1.5x the expected hourly average.
   * This gets replaced by the proper z-score residual approach in Tier 1.
   */
  private static async checkThresholdAnomaly(reading: ISensorReading): Promise<void> {
    const expectedHourlyKwh = YEUNG_BASELINE_DAILY_KWH / 24;
    const ratio = reading.value / expectedHourlyKwh;

    if (ratio > 1.5) {
      const severity = ratio > 2.0 ? 'high' : ratio > 1.75 ? 'medium' : 'low';
      const alert = await Alert.create({
        buildingId: reading.buildingId,
        timestamp: reading.timestamp,
        type: 'threshold_breach',
        severity,
        message: `Energy reading ${Math.round(reading.value)} kWh exceeds expected ${Math.round(expectedHourlyKwh)} kWh by ${Math.round((ratio - 1) * 100)}%`,
        resolved: false,
        metadata: {
          actualValue: reading.value,
          expectedValue: expectedHourlyKwh,
          residual: reading.value - expectedHourlyKwh,
          zoneId: reading.zoneId,
        },
      });

      WebSocketService.broadcastAlert(
        reading.buildingId.toString(),
        alert.toObject()
      );
    }
  }
}
