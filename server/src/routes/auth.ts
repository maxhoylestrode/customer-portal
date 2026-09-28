import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  getMe,
  updateProfile,
  changePassword,
  confirmPasswordReset,
  forgotPassword,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { loginLimiter, passwordResetLimiter, registerLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.patch('/profile', authenticate, updateProfile);
router.patch('/password', authenticate, changePassword);
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/reset-password/confirm', passwordResetLimiter, confirmPasswordReset);

export default router;
