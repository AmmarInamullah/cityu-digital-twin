import { Request, Response, NextFunction } from 'express';
import BuildingProfile from '../models/BuildingProfile';
import { CITYU_HISTORICAL_DATA, CAMPUS_GHG_SCOPES, CLP_HK_EMISSION_FACTOR_KG_PER_KWH, RESILIENCE_WEIGHTS, YEUNG_BASELINE_DAILY_KWH, BASELINE_GHG_PER_FLOOR_AREA, TARGET_GHG_PER_FLOOR_AREA_2030 } from '../constants';

export class BuildingController {
  /**
   * GET /api/buildings/:buildingId
   * Returns the building profile
   */
  static async getBuilding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const building = await BuildingProfile.findById(req.params.buildingId as string);
      if (!building) {
        res.status(404).json({ success: false, message: 'Building not found' });
        return;
      }
      res.json({ success: true, data: building });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/buildings
   * List all buildings (just YEUNG for now, extensible later)
   */
  static async listBuildings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const buildings = await BuildingProfile.find();
      res.json({ success: true, data: buildings });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/buildings/historical-data
   * Returns the 7-year real CityU dataset
   */
  static async getHistoricalData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({ success: true, data: CITYU_HISTORICAL_DATA });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/buildings/ghg-scopes
   * Returns the Scope 1/2/3 GHG breakdown (campus-wide reference)
   */
  static async getGHGScopes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({ success: true, data: CAMPUS_GHG_SCOPES });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/buildings/config
   * Returns configuration constants so frontend doesn't hardcode values
   */
  static async getConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          gridEmissionFactor: CLP_HK_EMISSION_FACTOR_KG_PER_KWH,
          gridProvider: 'CLP',
          baselineDailyKwh: YEUNG_BASELINE_DAILY_KWH,
          baselineGhgPerFloorArea: BASELINE_GHG_PER_FLOOR_AREA,
          targetGhgPerFloorArea2030: TARGET_GHG_PER_FLOOR_AREA_2030,
          resilienceWeights: RESILIENCE_WEIGHTS,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
