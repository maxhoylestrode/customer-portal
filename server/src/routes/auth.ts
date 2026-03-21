import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  getMe,
  confirmPasswordReset,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.post('/reset-password/confirm', confirmPasswordReset);

export default router;
