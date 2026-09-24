import { Router } from 'express';
import { search } from '../controllers/searchController';
import { authenticate, requireStaff } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireStaff);

router.get('/', search);

export default router;
