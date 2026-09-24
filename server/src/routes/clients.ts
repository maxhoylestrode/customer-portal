import { Router } from 'express';
import * as clients from '../controllers/clientController';
import * as fileCtrl from '../controllers/fileController';
import * as notes from '../controllers/noteController';
import { authenticate, requireStaff, denyRole } from '../middleware/auth';
import { clientFileUpload } from '../middleware/clientFileUpload';
import { avatarUpload } from '../middleware/imageUpload';

const router = Router();

router.use(authenticate, requireStaff);

router.get('/', clients.list);
router.get('/:id', clients.getById);
router.post('/', clients.create);
router.put('/:id', clients.update);
router.delete('/:id', denyRole('sales'), clients.remove); // Sales cannot delete clients

// Avatar
router.post('/:id/avatar', avatarUpload.single('avatar'), clients.uploadAvatar);
router.delete('/:id/avatar', clients.deleteAvatar);

// File uploads scoped to client
router.post('/:id/files', clientFileUpload.single('file'), fileCtrl.upload);

// Notes scoped to client
router.get('/:clientId/notes', notes.list);
router.post('/:clientId/notes', notes.create);

export default router;
