import { Request, Response, NextFunction } from 'express';
import { ReadingService } from '../services/readingService';

export class ReadingController {
  static async createReadings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const readings = Array.isArray(req.body) ? req.body : [req.body];
      if (readings.length === 0) {
        res.status(400).json({ success: false, message: 'No readings provided' });
        return;
      }
      const saved = await ReadingService.createReadings(readings);
      res.status(201).json({ success: true, count: saved.length, data: saved });
    } catch (error) {
      next(error);
    }
  }

  static async getReadings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const buildingId = req.params.buildingId as string;
      const readings = await ReadingService.getReadings({
        buildingId,
        from: req.query.from as string,
        to: req.query.to as string,
        metricType: req.query.metricType as string,
        zoneId: req.query.zoneId as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      });
      res.json({ success: true, count: readings.length, data: readings });
    } catch (error) {
      next(error);
    }
  }

  static async getDailyConsumption(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const buildingId = req.params.buildingId as string;
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
      const data = await ReadingService.getDailyConsumption(buildingId, days);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getHourlyConsumption(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const buildingId = req.params.buildingId as string;
      const date = req.query.date as string;
      if (!date) {
        res.status(400).json({ success: false, message: 'date query parameter required (YYYY-MM-DD)' });
        return;
      }
      const data = await ReadingService.getHourlyConsumption(buildingId, date);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getZoneBreakdown(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const buildingId = req.params.buildingId as string;
      const from = req.query.from ? new Date(req.query.from as string) : undefined;
      const to = req.query.to ? new Date(req.query.to as string) : undefined;
      const data = await ReadingService.getZoneBreakdown(buildingId, from, to);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
