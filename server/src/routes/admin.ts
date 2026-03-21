import { Router } from 'express';
import {
  listUsers,
  createUser,
  updateUser,
  getUser,
  getDashboardStats,
  generateInviteLink,
} from '../controllers/adminController';
import { requestPasswordReset } from '../controllers/authController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/stats', getDashboardStats);
router.get('/users', listUsers);
router.post('/users', createUser);
router.post('/users/invite', generateInviteLink);
router.get('/users/:id', getUser);
router.patch('/users/:id', updateUser);
router.post('/users/:id/reset-password', requestPasswordReset);

export default router;
