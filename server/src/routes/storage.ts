import { Router } from 'express';
import * as storage from '../controllers/storageController';
import { storageUpload } from '../middleware/storageUpload';
import { authenticate, requireStaff } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireStaff);

router.get('/', storage.list);
router.get('/folders', storage.folders);
router.post('/', storageUpload.array('files', 20), storage.upload);
router.patch('/:fileId/permissions', storage.setPermissions);
router.get('/:fileId/view', storage.view);
router.get('/:fileId/download', storage.download);
router.delete('/:fileId', storage.remove);

export default router;
