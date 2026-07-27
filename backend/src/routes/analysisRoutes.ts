import { Router } from 'express';
import { AnalysisController } from '../controllers/analysisController';

const router = Router();

router.get('/full', AnalysisController.getFullResults);
router.get('/benchmarks', AnalysisController.getBenchmarks);
router.get('/faults', AnalysisController.getFaults);
router.get('/macc', AnalysisController.getMACC);
router.get('/monte-carlo', AnalysisController.getMonteCarlo);
router.get('/climate', AnalysisController.getClimateAdaptation);
router.get('/interventions', AnalysisController.getInterventions);
router.get('/carbon', AnalysisController.getCarbonComparisons);

export default router;
