import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { authenticate, requireStaff } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireStaff);

// GET /api/users — internal staff/admin/sales accounts, for assignee pickers.
// Deliberately excludes client-role portal users.
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: ['admin', 'staff', 'sales'] } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

export default router;
