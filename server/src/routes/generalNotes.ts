import { Router } from 'express';
import { authenticate, requireStaff } from '../middleware/auth';
import * as gn from '../controllers/generalNoteController';

const router = Router();

router.use(authenticate, requireStaff);

router.get('/', gn.list);
router.post('/', gn.create);
router.put('/:id', gn.update);
router.delete('/:id', gn.remove);

export default router;
