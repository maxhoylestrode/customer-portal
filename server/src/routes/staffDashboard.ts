import { Router } from 'express';
import * as dashboard from '../controllers/staffDashboardController';
import { authenticate, requireStaff } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireStaff);

// One role-aware overview for admin, staff and sales (the controller hides
// whatever the caller's role shouldn't see).
router.get('/overview', dashboard.overview);

export default router;
