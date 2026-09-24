import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';
import { UPLOAD_DIR } from '../config/paths';

const logoDir = path.join(UPLOAD_DIR, 'logo');
const metaFile = path.join(logoDir, 'meta.json');
const brandingFile = path.join(UPLOAD_DIR, 'branding.json');

// ── Helpers ──────────────────────────────────────────────────────────────

function readBranding(): { portalName: string } {
  try {
    if (fs.existsSync(brandingFile)) {
      return JSON.parse(fs.readFileSync(brandingFile, 'utf8'));
    }
  } catch {
    /* ignore malformed branding file */
  }
  return { portalName: 'Apex Portal' };
}

function writeBranding(data: { portalName: string }) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(brandingFile, JSON.stringify(data, null, 2));
}

function findLogoFile(): string | null {
  if (!fs.existsSync(logoDir)) return null;
  if (fs.existsSync(metaFile)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      if (meta.file && fs.existsSync(path.join(logoDir, meta.file))) {
        return meta.file;
      }
    } catch {
      /* ignore malformed meta file */
    }
  }
  const exts = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.gif'];
  const files = fs.readdirSync(logoDir).filter((f) => exts.includes(path.extname(f).toLowerCase()));
  return files[0] || null;
}

// ── Branding ─────────────────────────────────────────────────────────────

export function getLogo(_req: Request, res: Response) {
  const file = findLogoFile();
  if (!file) return res.json({ logoUrl: null });
  res.json({ logoUrl: `/uploads/logo/${file}` });
}

export function uploadLogo(req: Request, res: Response) {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

  fs.mkdirSync(logoDir, { recursive: true });
  fs.writeFileSync(metaFile, JSON.stringify({ file: req.file.filename }));

  res.json({ logoUrl: `/uploads/logo/${req.file.filename}` });
}

export function deleteLogo(_req: Request, res: Response) {
  const file = findLogoFile();
  if (file) {
    const fullPath = path.join(logoDir, file);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    if (fs.existsSync(metaFile)) fs.unlinkSync(metaFile);
  }
  res.json({ message: 'Logo removed' });
}

export function getBranding(_req: Request, res: Response) {
  const branding = readBranding();
  const logoFile = findLogoFile();
  res.json({
    portalName: branding.portalName || 'Apex Portal',
    logoUrl: logoFile ? `/uploads/logo/${logoFile}` : null,
  });
}

export function updateBranding(req: Request, res: Response) {
  const { portalName } = req.body;
  const current = readBranding();
  writeBranding({ portalName: portalName?.trim() || current.portalName });
  res.json({ portalName: portalName?.trim() || current.portalName });
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
