import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Alert from '../models/Alert';

export class AlertController {
  /**
   * GET /api/alerts/:buildingId
   * Get alerts for a building, optionally filtered
   */
  static async getAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const buildingId = req.params.buildingId as string;
      const { resolved, severity, limit } = req.query;

      const query: any = {
        buildingId: new mongoose.Types.ObjectId(buildingId),
      };

      if (resolved !== undefined) query.resolved = resolved === 'true';
      if (severity) query.severity = severity;

      const alerts = await Alert.find(query)
        .sort({ timestamp: -1 })
        .limit(limit ? parseInt(limit as string, 10) : 50)
        .lean();

      res.json({ success: true, count: alerts.length, data: alerts });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/alerts/:alertId/resolve
   * Mark an alert as resolved
   */
  static async resolveAlert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const alert = await Alert.findByIdAndUpdate(
        req.params.alertId,
        { resolved: true, resolvedAt: new Date() },
        { new: true }
      );

      if (!alert) {
        res.status(404).json({ success: false, message: 'Alert not found' });
        return;
      }

      res.json({ success: true, data: alert });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/alerts/:buildingId/stats
   * Get alert statistics
   */
  static async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const buildingId = req.params.buildingId as string;
      const bId = new mongoose.Types.ObjectId(buildingId);

      const [total, unresolved, bySeverity] = await Promise.all([
        Alert.countDocuments({ buildingId: bId }),
        Alert.countDocuments({ buildingId: bId, resolved: false }),
        Alert.aggregate([
          { $match: { buildingId: bId } },
          { $group: { _id: '$severity', count: { $sum: 1 } } },
        ]),
      ]);

      const severityCounts = Object.fromEntries(
        bySeverity.map(s => [s._id, s.count])
      );

      res.json({
        success: true,
        data: { total, unresolved, bySeverity: severityCounts },
      });
    } catch (error) {
      next(error);
    }
  }
}
