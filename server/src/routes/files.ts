import { Router } from 'express';
import * as files from '../controllers/fileController';
import { authenticate, requireStaff } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireStaff);

router.get('/:fileId/view', files.view);
router.get('/:fileId/download', files.download);
router.delete('/:fileId', files.remove);

export default router;
