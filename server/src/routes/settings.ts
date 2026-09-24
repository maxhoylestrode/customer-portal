import { Router } from 'express';
import * as settings from '../controllers/settingsController';
import { authenticate, requireAdmin } from '../middleware/auth';
import { logoUpload } from '../middleware/imageUpload';

const router = Router();

// Branding (logo + portal name) — logo/branding writes are admin only; reads are public
router.get('/logo', settings.getLogo);
router.get('/logo/image', settings.getLogoImage);
router.post('/logo', authenticate, requireAdmin, logoUpload.single('logo'), settings.uploadLogo);
router.delete('/logo', authenticate, requireAdmin, settings.deleteLogo);

router.get('/branding', settings.getBranding);
router.put('/branding', authenticate, requireAdmin, settings.updateBranding);

// Own profile — any authenticated staff user
router.put('/profile', authenticate, settings.updateProfile);

// Internal user management — admin only
router.get('/users', authenticate, requireAdmin, settings.getUsers);
router.post('/users', authenticate, requireAdmin, settings.createUser);
router.put('/users/:id', authenticate, requireAdmin, settings.updateUser);
router.delete('/users/:id', authenticate, requireAdmin, settings.deleteUser);

export default router;
