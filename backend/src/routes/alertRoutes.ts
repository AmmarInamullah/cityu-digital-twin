import { Router } from 'express';
import { AlertController } from '../controllers/alertController';

const router = Router();

router.get('/:buildingId', AlertController.getAlerts);
router.get('/:buildingId/stats', AlertController.getStats);
router.patch('/:alertId/resolve', AlertController.resolveAlert);

export default router;
