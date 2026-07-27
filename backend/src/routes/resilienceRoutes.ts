import { Router } from 'express';
import { ResilienceController } from '../controllers/resilienceController';

const router = Router();

router.get('/:buildingId/current', ResilienceController.getCurrentScore);
router.post('/:buildingId/simulate', ResilienceController.simulateScenario);
router.get('/:buildingId/history', ResilienceController.getHistory);

export default router;
