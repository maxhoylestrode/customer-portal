import { Router } from 'express';
import * as projects from '../controllers/projectController';
import { authenticate, requireStaff, denyRole } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireStaff);
router.use(denyRole('sales')); // Sales staff cannot access projects

router.get('/', projects.list);
router.get('/:id', projects.getById);
router.post('/', projects.create);
router.put('/:id', projects.update);
router.delete('/:id', projects.remove);

export default router;
