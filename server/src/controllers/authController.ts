import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { sendPasswordResetEmail } from '../services/emailService';
import { JwtPayload } from '../types';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: REFRESH_TOKEN_EXPIRY });
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

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password, phone, company_name, website_url, invite } = req.body;

    if (!name || !email || !password) {
      throw new AppError('Name, email and password are required', 400);
    }

    if (!invite) {
      throw new AppError('A valid invite token is required to register', 403);
    }

    // Validate invite token
    const inviteResult = await query(
      `SELECT id, email FROM users WHERE invite_token = $1 AND invite_token_expires > NOW() AND password_hash = ''`,
      [invite]
    );

    // Check if it's an open invite (invite record without user)
    // OR a pre-created user placeholder
    let userId: number | null = null;
    let prefilledEmail: string | null = null;

    if (inviteResult.rows.length > 0) {
      // Pre-created placeholder user — update it
      userId = inviteResult.rows[0].id;
      prefilledEmail = inviteResult.rows[0].email;
    } else {
      // Check for standalone invite token (stored in a pending user row with empty hash)
      const openInvite = await query(
        `SELECT id FROM users WHERE invite_token = $1 AND invite_token_expires > NOW()`,
        [invite]
      );
      if (openInvite.rows.length === 0) {
        throw new AppError('Invalid or expired invite link', 403);
      }
      userId = openInvite.rows[0].id;
    }

    // Check email not already taken (by another real user)
    const emailCheck = await query(
      `SELECT id FROM users WHERE email = $1 AND id != $2`,
      [email, userId]
    );
    if (emailCheck.rows.length > 0) {
      throw new AppError('Email address is already registered', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await query(
      `UPDATE users
       SET name=$1, email=$2, password_hash=$3, phone=$4, company_name=$5, website_url=$6,
           invite_token=NULL, invite_token_expires=NULL
       WHERE id=$7
       RETURNING id, name, email, role`,
      [name, email, passwordHash, phone || null, company_name || null, website_url || null, userId]
    );

    const user = result.rows[0];
    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id, role: user.role });

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, refreshToken, expiresAt]
    );

    setTokenCookies(res, accessToken, refreshToken);
    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new AppError('Email and password are required', 400);

    const result = await query(
      `SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid email or password', 401);
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw new AppError('Your account has been deactivated. Please contact support.', 403);
    }

    if (!user.password_hash) {
      throw new AppError('Account setup is incomplete. Please use your invite link to set a password.', 403);
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new AppError('Invalid email or password', 401);

    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id, role: user.role });

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, refreshToken, expiresAt]
    );

    setTokenCookies(res, accessToken, refreshToken);
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

    const result = await query(
      `SELECT id FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );
    if (result.rows.length === 0) throw new AppError('Refresh token not found or expired', 401);

    // Rotate refresh token
    await query(`DELETE FROM refresh_tokens WHERE token = $1`, [token]);
    const newAccessToken = generateAccessToken({ userId: payload.userId, role: payload.role });
    const newRefreshToken = generateRefreshToken({ userId: payload.userId, role: payload.role });
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [payload.userId, newRefreshToken, expiresAt]
    );

    setTokenCookies(res, newAccessToken, newRefreshToken);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.refresh_token;
    if (token) {
      await query(`DELETE FROM refresh_tokens WHERE token = $1`, [token]);
    }
    res.clearCookie('access_token');
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await query(
      `SELECT id, name, email, phone, company_name, website_url, role, is_active, created_at FROM users WHERE id = $1`,
      [req.user!.userId]
    );
    if (result.rows.length === 0) throw new AppError('User not found', 404);
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function requestPasswordReset(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    const result = await query(`SELECT id, name, email FROM users WHERE id = $1`, [userId]);
    if (result.rows.length === 0) throw new AppError('User not found', 404);

    const user = result.rows[0];
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await query(
      `UPDATE users SET password_reset_token=$1, password_reset_expires=$2 WHERE id=$3`,
      [hashedToken, expires, user.id]
    );

    await sendPasswordResetEmail(user.email, user.name, rawToken);
    res.json({ ok: true, message: 'Password reset email sent' });
  } catch (err) {
    next(err);
  }
}

export async function confirmPasswordReset(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, password } = req.body;
    if (!token || !password) throw new AppError('Token and new password are required', 400);
    if (password.length < 8) throw new AppError('Password must be at least 8 characters', 400);

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const result = await query(
      `SELECT id FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()`,
      [hashedToken]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await query(
      `UPDATE users SET password_hash=$1, password_reset_token=NULL, password_reset_expires=NULL WHERE id=$2`,
      [passwordHash, result.rows[0].id]
    );

    res.json({ ok: true, message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
}
