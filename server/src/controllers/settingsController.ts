import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';

// Branding is a single row (id=1) in the database — logo bytes and portal
// name live there instead of local files, so they survive redeploys.
async function getOrCreateBranding() {
  return prisma.branding.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

// ── Branding ─────────────────────────────────────────────────────────────

export async function getLogo(_req: Request, res: Response, next: NextFunction) {
  try {
    const branding = await getOrCreateBranding();
    res.json({ logoUrl: branding.logoData ? '/api/settings/logo/image' : null });
  } catch (err) {
    next(err);
  }
}

export async function getLogoImage(_req: Request, res: Response, next: NextFunction) {
  try {
    const branding = await prisma.branding.findUnique({ where: { id: 1 }, select: { logoData: true, logoMimetype: true } });
    if (!branding?.logoData) return res.status(404).json({ error: 'No logo set' });
    res.setHeader('Content-Type', branding.logoMimetype || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(branding.logoData));
  } catch (err) {
    next(err);
  }
}

export async function uploadLogo(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    await prisma.branding.upsert({
      where: { id: 1 },
      update: { logoData: Buffer.from(req.file.buffer), logoMimetype: req.file.mimetype },
      create: { id: 1, logoData: Buffer.from(req.file.buffer), logoMimetype: req.file.mimetype },
    });
    res.json({ logoUrl: '/api/settings/logo/image' });
  } catch (err) {
    next(err);
  }
}

export async function deleteLogo(_req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.branding.upsert({
      where: { id: 1 },
      update: { logoData: null, logoMimetype: null },
      create: { id: 1 },
    });
    res.json({ message: 'Logo removed' });
  } catch (err) {
    next(err);
  }
}

export async function getBranding(_req: Request, res: Response, next: NextFunction) {
  try {
    const branding = await getOrCreateBranding();
    res.json({
      portalName: branding.portalName || 'Apex Portal',
      logoUrl: branding.logoData ? '/api/settings/logo/image' : null,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateBranding(req: Request, res: Response, next: NextFunction) {
  try {
    const { portalName } = req.body;
    const current = await getOrCreateBranding();
    const nextName = portalName?.trim() || current.portalName;
    await prisma.branding.update({ where: { id: 1 }, data: { portalName: nextName } });
    res.json({ portalName: nextName });
  } catch (err) {
    next(err);
  }
}

// ── Internal user management (admin only — client accounts live under /api/admin) ──

const STAFF_ROLES = ['admin', 'staff', 'sales'];

export async function getUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: STAFF_ROLES } },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ users });
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (!STAFF_ROLES.includes(role)) {
      return res.status(400).json({ error: 'role must be admin, staff, or sales' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
      select: { id: true, name: true, email: true, role: true },
    });

    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, email, role, password } = req.body;

    if (id === req.user!.userId && role && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot change your own role.' });
    }
    if (role && !STAFF_ROLES.includes(role)) {
      return res.status(400).json({ error: 'role must be admin, staff, or sales' });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || !STAFF_ROLES.includes(target.role)) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const data: { name?: string; email?: string; role?: string; passwordHash?: string } = {};
    if (name) data.name = name;
    if (email) data.email = email;
    if (role) data.role = role;
    if (password) data.passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true },
    });
    res.json({ user });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email already in use.' });
    if (err.code === 'P2025') return res.status(404).json({ error: 'User not found.' });
    next(err);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    if (id === req.user!.userId) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || !STAFF_ROLES.includes(target.role)) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted.' });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'User not found.' });
    next(err);
  }
}

// ── Own profile (any authenticated staff user) ──────────────────────────

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.user!.userId;
    const { name, email, currentPassword, newPassword } = req.body;
    const data: { name?: string; email?: string; passwordHash?: string } = {};
    if (name?.trim()) data.name = name.trim();
    if (email?.trim()) data.email = email.trim();

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to change password.' });
      }
      const existing = await prisma.user.findUnique({ where: { id }, select: { passwordHash: true } });
      const valid = await bcrypt.compare(currentPassword, existing!.passwordHash);
      if (!valid) return res.status(400).json({ error: 'Current password is incorrect.' });
      if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      data.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true },
    });
    res.json({ user });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email already in use.' });
    next(err);
  }
}
