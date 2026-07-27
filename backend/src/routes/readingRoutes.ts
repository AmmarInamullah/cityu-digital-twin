import { Router } from 'express';
import { ReadingController } from '../controllers/readingController';
import { validateReadings } from '../middleware/validation';
import { writeRateLimit } from '../middleware/rateLimit';

const router = Router();

router.post('/', writeRateLimit, validateReadings, ReadingController.createReadings);
router.get('/:buildingId', ReadingController.getReadings);
router.get('/:buildingId/daily', ReadingController.getDailyConsumption);
router.get('/:buildingId/hourly', ReadingController.getHourlyConsumption);
router.get('/:buildingId/zones', ReadingController.getZoneBreakdown);

export default router;
