import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import ResilienceScore from '../models/ResilienceScore';
import Alert from '../models/Alert';
import { ReadingService } from '../services/readingService';
import { calculateResilience, ResilienceInput } from '../services/resilienceService';
import { WebSocketService } from '../services/websocketService';
import { YEUNG_BASELINE_DAILY_KWH } from '../constants';

export class ResilienceController {
  /**
   * GET /api/resilience/:buildingId/current
   * Compute and return the current resilience score
   */
  static async getCurrentScore(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const buildingId = req.params.buildingId as string;

      // Get today's consumption
      const today = new Date().toISOString().split('T')[0];
      const hourlyData = await ReadingService.getHourlyConsumption(buildingId, today);
      const dailyKwh = hourlyData.reduce((sum, h) => sum + h.kwh, 0) || YEUNG_BASELINE_DAILY_KWH;

      // Get anomaly count in last 24h
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const anomalyCount = await Alert.countDocuments({
        buildingId: new mongoose.Types.ObjectId(buildingId),
        type: 'anomaly',
        timestamp: { $gte: twentyFourHoursAgo },
      });

      const result = calculateResilience({ dailyKwh, anomalyCountLast24h: anomalyCount });

      WebSocketService.broadcastResilienceScore(buildingId, result);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/resilience/:buildingId/simulate
   * What-if scenario: compute resilience with adjustments
   */
  static async simulateScenario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const buildingId = req.params.buildingId as string;
      const { adjustments } = req.body;

      const input: ResilienceInput = {
        dailyKwh: YEUNG_BASELINE_DAILY_KWH,
        anomalyCountLast24h: 0,
        adjustments,
      };

      const result = calculateResilience(input);

      WebSocketService.broadcastResilienceScore(buildingId, result);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
  }

  /**
   * GET /api/resilience/:buildingId/history
   * Get historical resilience scores
   */
  static async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const buildingId = req.params.buildingId as string;
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;

      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      const scores = await ResilienceScore.find({
        buildingId: new mongoose.Types.ObjectId(buildingId),
        timestamp: { $gte: fromDate },
      })
        .sort({ timestamp: 1 })
        .lean();

      res.json({ success: true, data: scores });
    } catch (error) {
      next(error);
    }
  }
}
