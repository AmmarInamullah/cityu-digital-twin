import { Router } from 'express';
import { BuildingController } from '../controllers/buildingController';

const router = Router();

router.get('/', BuildingController.listBuildings);
router.get('/config', BuildingController.getConfig);
router.get('/historical-data', BuildingController.getHistoricalData);
router.get('/ghg-scopes', BuildingController.getGHGScopes);
router.get('/:buildingId', BuildingController.getBuilding);

export default router;
