import { Router } from 'express';
import * as dashboard from '../controllers/staffDashboardController';
import { authenticate, requireStaff } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireStaff);

router.get('/stats', dashboard.stats);

export default router;
