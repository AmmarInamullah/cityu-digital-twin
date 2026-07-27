import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';

let cachedResults: any = null;
let lastModified = 0;

function getResultsPath(): string {
  return path.resolve(__dirname, '..', '..', '..', 'ml', 'output', 'analysis_results.json');
}

async function loadResults(): Promise<any> {
  const filePath = getResultsPath();
  try {
    const stat = await fs.promises.stat(filePath);
    const mtime = stat.mtimeMs;
    if (cachedResults && mtime === lastModified) {
      return cachedResults;
    }
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    cachedResults = JSON.parse(raw);
    lastModified = mtime;
    return cachedResults;
  } catch {
    return null;
  }
}

export class AnalysisController {
  static async getFullResults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await loadResults();
      if (!data) {
        res.status(404).json({ success: false, message: 'Analysis results not found. Run python run_analysis.py first.' });
        return;
      }
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getBenchmarks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await loadResults();
      if (!data) { res.status(404).json({ success: false, message: 'Run analysis first' }); return; }
      res.json({ success: true, data: data.eui_benchmarks });
    } catch (error) { next(error); }
  }

  static async getFaults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await loadResults();
      if (!data) { res.status(404).json({ success: false, message: 'Run analysis first' }); return; }
      res.json({ success: true, data: data.faults });
    } catch (error) { next(error); }
  }

  static async getMACC(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await loadResults();
      if (!data) { res.status(404).json({ success: false, message: 'Run analysis first' }); return; }
      res.json({ success: true, data: data.macc });
    } catch (error) { next(error); }
  }

  static async getMonteCarlo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await loadResults();
      if (!data) { res.status(404).json({ success: false, message: 'Run analysis first' }); return; }
      res.json({ success: true, data: data.monte_carlo });
    } catch (error) { next(error); }
  }

  static async getClimateAdaptation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await loadResults();
      if (!data) { res.status(404).json({ success: false, message: 'Run analysis first' }); return; }
      res.json({ success: true, data: data.climate_adaptation });
    } catch (error) { next(error); }
  }

  static async getInterventions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await loadResults();
      if (!data) { res.status(404).json({ success: false, message: 'Run analysis first' }); return; }
      res.json({ success: true, data: data.interventions_library });
    } catch (error) { next(error); }
  }

  static async getCarbonComparisons(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await loadResults();
      if (!data) { res.status(404).json({ success: false, message: 'Run analysis first' }); return; }
      res.json({ success: true, data: data.carbon_comparisons });
    } catch (error) { next(error); }
  }
}
