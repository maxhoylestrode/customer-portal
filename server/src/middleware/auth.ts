import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload, Role } from '../types';
import prisma from '../config/prisma';

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.access_token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Check the account on every request so deactivation and role changes
  // apply immediately rather than when the access token expires.
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true, isActive: true },
    });
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Account is no longer active' });
      return;
    }
    req.user = { userId: payload.userId, role: user.role as Role };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

// Any internal team role (i.e. not a client) — admin, staff, or sales
export function requireStaff(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role === 'client') {
    res.status(403).json({ error: 'Staff access required' });
    return;
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'You do not have access to this resource' });
      return;
    }
    next();
  };
}

// Block specific role(s) — e.g. denyRole('sales') to keep sales out of a resource
export function denyRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Access restricted for your role' });
      return;
    }
    next();
  };
}
