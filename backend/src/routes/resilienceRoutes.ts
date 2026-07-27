import { Router } from 'express';
import { ResilienceController } from '../controllers/resilienceController';
import { validateSimulate } from '../middleware/validation';
import { writeRateLimit } from '../middleware/rateLimit';

const router = Router();

router.get('/:buildingId/current', ResilienceController.getCurrentScore);
router.post('/:buildingId/simulate', writeRateLimit, validateSimulate, ResilienceController.simulateScenario);
router.get('/:buildingId/history', ResilienceController.getHistory);

export default router;
