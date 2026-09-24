import { Router } from 'express';
import { authenticate, requireStaff } from '../middleware/auth';
import * as notes from '../controllers/noteController';

const router = Router();

router.use(authenticate, requireStaff);

// Standalone note operations (nested client-notes list/create live under /api/clients)
router.put('/:id', notes.update);
router.delete('/:id', notes.remove);

export default router;
