import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const readingSchema = z.object({
  buildingId: z.string().min(1),
  timestamp: z.string().or(z.date()),
  metricType: z.enum(['energy_kwh', 'occupancy', 'temperature']),
  value: z.number().min(0),
  zoneId: z.string().optional(),
  isRealSensor: z.boolean().optional(),
});

const readingsArraySchema = z.array(readingSchema).min(1).max(1000);

export function validateReadings(req: Request, res: Response, next: NextFunction): void {
  try {
    const data = Array.isArray(req.body) ? req.body : [req.body];
    const result = readingsArraySchema.safeParse(data);
    if (!result.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid reading data',
        errors: result.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  } catch {
    res.status(400).json({ success: false, message: 'Invalid request body' });
  }
}

const simulateSchema = z.object({
  adjustments: z.object({
    occupancyDelta: z.number().optional(),
    solarPanelInstalled: z.boolean().optional(),
    acSetpointDelta: z.number().optional(),
    lightingEfficiency: z.number().min(0).max(1).optional(),
  }).optional(),
});

export function validateSimulate(req: Request, res: Response, next: NextFunction): void {
  try {
    const result = simulateSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid simulation parameters',
        errors: result.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  } catch {
    res.status(400).json({ success: false, message: 'Invalid request body' });
  }
}
