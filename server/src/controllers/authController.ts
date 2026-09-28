import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { sendPasswordResetEmail } from '../services/emailService';
import { JwtPayload, Role } from '../types';
import { normalizeEmail, emailMatches, revokeSessions } from '../utils/users';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;

function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function generateRefreshToken(payload: JwtPayload): string {
  // jwtid keeps two sessions issued in the same second from getting identical tokens
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    jwtid: crypto.randomBytes(16).toString('hex'),
  });
}

function setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
  });
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_EXPIRY_MS,
    path: '/api/auth/refresh',
  });
}

export async function startSession(res: Response, userId: number, role: Role) {
  const accessToken = generateAccessToken({ userId, role });
  const refreshToken = generateRefreshToken({ userId, role });

  await prisma.refreshToken.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  await prisma.refreshToken.create({
    data: { userId, token: refreshToken, expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS) },
  });

  setTokenCookies(res, accessToken, refreshToken);
}

function clearTokenCookies(res: Response) {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
}

async function issuePasswordReset(user: { id: number; email: string; name: string }) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: hashedToken, passwordResetExpires: expires },
  });

  sendPasswordResetEmail(user.email, user.name, rawToken).catch(console.error);
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, password, phone, company_name, website_url, invite } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!name || !email || !password) {
      throw new AppError('Name, email and password are required', 400);
    }
    if (String(password).length < MIN_PASSWORD_LENGTH) {
      throw new AppError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`, 400);
    }

    if (!invite) {
      throw new AppError('A valid invite token is required to register', 403);
    }

    // Check for a pending invite (placeholder user row with empty password hash)
    const openInvite = await prisma.user.findFirst({
      where: { inviteToken: invite, inviteTokenExpires: { gt: new Date() } },
    });
    if (!openInvite) {
      throw new AppError('Invalid or expired invite link', 403);
    }
    const userId = openInvite.id;

    // Check email not already taken (by another real user)
    const emailTaken = await prisma.user.findFirst({
      where: { email: emailMatches(email), id: { not: userId } },
    });
    if (emailTaken) {
      throw new AppError('Email address is already registered', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        passwordHash,
        phone: phone || null,
        companyName: company_name || null,
        websiteUrl: website_url || null,
        inviteToken: null,
        inviteTokenExpires: null,
      },
      select: { id: true, name: true, email: true, role: true },
    });

    await startSession(res, user.id, user.role as Role);
    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);
    if (!email || !password) throw new AppError('Email and password are required', 400);

    const user = await prisma.user.findFirst({ where: { email: emailMatches(email) } });
    if (!user) throw new AppError('Invalid email or password', 401);

    if (!user.isActive) {
      throw new AppError('Your account has been deactivated. Please contact support.', 403);
    }

    if (!user.passwordHash) {
      throw new AppError('Account setup is incomplete. Please use your invite link to set a password.', 403);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError('Invalid email or password', 401);

    await startSession(res, user.id, user.role as Role);
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.refresh_token;
    if (!token) throw new AppError('No refresh token', 401);

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as JwtPayload;
    } catch {
      throw new AppError('Invalid refresh token', 401);
    }

    const stored = await prisma.refreshToken.findFirst({
      where: { token, expiresAt: { gt: new Date() } },
    });
    if (!stored) throw new AppError('Refresh token not found or expired', 401);

    await prisma.refreshToken.delete({ where: { id: stored.id } });

    // Re-read the account rather than trusting the old token: a deactivated
    // user must not be able to refresh, and a role change must take effect.
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, isActive: true, passwordHash: true },
    });
    if (!user || !user.isActive || !user.passwordHash) {
      clearTokenCookies(res);
      throw new AppError('Session is no longer valid', 401);
    }

    await startSession(res, user.id, user.role as Role);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.refresh_token;
    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } });
    }
    clearTokenCookies(res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        companyName: true,
        websiteUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!user) throw new AppError('User not found', 404);
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        company_name: user.companyName,
        website_url: user.websiteUrl,
        role: user.role,
        is_active: user.isActive,
        created_at: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

// Admin-triggered reset for a specific account
export async function requestPasswordReset(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(req.params.id);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);

    await issuePasswordReset(user);
    res.json({ ok: true, message: 'Password reset email sent' });
  } catch (err) {
    next(err);
  }
}

// Public self-service reset. Always gives the same answer so it can't be
// used to find out which emails have accounts.
export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) throw new AppError('Email is required', 400);

    const user = await prisma.user.findFirst({ where: { email: emailMatches(email) } });
    if (user && user.isActive && user.passwordHash) {
      await issuePasswordReset(user);
    }

    res.json({ ok: true, message: 'If an account exists for that email, a reset link is on its way.' });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { name, email, phone, company_name, website_url } = req.body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = normalizeEmail(email);
    if (phone !== undefined) data.phone = phone || null;
    if (company_name !== undefined) data.companyName = company_name || null;
    if (website_url !== undefined) data.websiteUrl = website_url || null;

    if (Object.keys(data).length === 0) throw new AppError('No fields to update', 400);

    if (email !== undefined) {
      if (!data.email) throw new AppError('Email cannot be empty', 400);
      const existing = await prisma.user.findFirst({ where: { email: emailMatches(email), id: { not: userId } } });
      if (existing) throw new AppError('Email address is already in use', 409);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, phone: true, companyName: true, websiteUrl: true, role: true },
    });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        company_name: user.companyName,
        website_url: user.websiteUrl,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      throw new AppError('Current password and new password are required', 400);
    }
    if (new_password.length < MIN_PASSWORD_LENGTH) {
      throw new AppError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`, 400);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);

    const valid = await bcrypt.compare(current_password, user.passwordHash);
    if (!valid) throw new AppError('Current password is incorrect', 400);

    const newHash = await bcrypt.hash(new_password, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });

    // Sign out every other device, keep this one logged in
    await revokeSessions(userId);
    await startSession(res, userId, user.role as Role);

    res.json({ ok: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
}

export async function confirmPasswordReset(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, password } = req.body;
    if (!token || !password) throw new AppError('Token and new password are required', 400);
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new AppError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`, 400);
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await prisma.user.findFirst({
      where: { passwordResetToken: hashedToken, passwordResetExpires: { gt: new Date() } },
    });

    if (!user) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpires: null },
    });
    await revokeSessions(user.id);

    res.json({ ok: true, message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
}
