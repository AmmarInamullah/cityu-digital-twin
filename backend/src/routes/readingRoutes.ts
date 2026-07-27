import { Router } from 'express';
import { ReadingController } from '../controllers/readingController';

const router = Router();

router.post('/', ReadingController.createReadings);
router.get('/:buildingId', ReadingController.getReadings);
router.get('/:buildingId/daily', ReadingController.getDailyConsumption);
router.get('/:buildingId/hourly', ReadingController.getHourlyConsumption);
router.get('/:buildingId/zones', ReadingController.getZoneBreakdown);

export default router;
