import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { sendInviteEmail } from '../services/emailService';

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await query(
      `SELECT id, name, email, phone, company_name, website_url, role, is_active,
              invite_token IS NOT NULL AND invite_token_expires > NOW() as has_pending_invite,
              password_reset_token IS NOT NULL AND password_reset_expires > NOW() as has_pending_reset,
              created_at
       FROM users
       WHERE role = 'client'
       ORDER BY created_at DESC`
    );
    res.json({ users: result.rows });
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, phone, company_name, website_url, client_notes } = req.body;

    if (!email) throw new AppError('Email is required', 400);
    if (!name) throw new AppError('Name is required', 400);

    // Generate invite token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    // Create placeholder user (no password yet)
    const result = await query(
      `INSERT INTO users (name, email, phone, company_name, website_url, client_notes, password_hash, role, invite_token, invite_token_expires)
       VALUES ($1, $2, $3, $4, $5, $6, '', 'client', $7, $8)
       RETURNING id, name, email`,
      [name, email, phone || null, company_name || null, website_url || null, client_notes || null, rawToken, expires]
    );

    const user = result.rows[0];

    // Send invite email
    await sendInviteEmail(email, rawToken);

    res.status(201).json({ user, message: 'Invite sent to ' + email });
  } catch (err) {
    next(err);
  }
}

export async function generateInviteLink(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, name } = req.body;
    if (!email) throw new AppError('Email is required', 400);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // Check if user with that email already exists as a full user
    const existing = await query(`SELECT id, password_hash FROM users WHERE email = $1`, [email]);
    if (existing.rows.length > 0 && existing.rows[0].password_hash) {
      throw new AppError('A user with that email already has an account', 409);
    }

    if (existing.rows.length > 0) {
      // Update existing placeholder
      await query(
        `UPDATE users SET invite_token=$1, invite_token_expires=$2 WHERE email=$3`,
        [rawToken, expires, email]
      );
    } else {
      // Create placeholder
      const safeName = name || email.split('@')[0];
      await query(
        `INSERT INTO users (name, email, password_hash, role, invite_token, invite_token_expires) VALUES ($1, $2, '', 'client', $3, $4)`,
        [safeName, email, rawToken, expires]
      );
    }

    await sendInviteEmail(email, rawToken);
    res.json({ ok: true, message: `Invite sent to ${email}` });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(req.params.id);
    const { name, email, phone, company_name, website_url, client_notes, is_active } = req.body;

    const updates: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (name !== undefined) { updates.push(`name = $${i++}`); params.push(name); }
    if (email !== undefined) { updates.push(`email = $${i++}`); params.push(email); }
    if (phone !== undefined) { updates.push(`phone = $${i++}`); params.push(phone || null); }
    if (company_name !== undefined) { updates.push(`company_name = $${i++}`); params.push(company_name || null); }
    if (website_url !== undefined) { updates.push(`website_url = $${i++}`); params.push(website_url || null); }
    if (client_notes !== undefined) { updates.push(`client_notes = $${i++}`); params.push(client_notes || null); }
    if (is_active !== undefined) { updates.push(`is_active = $${i++}`); params.push(is_active); }

    if (updates.length === 0) throw new AppError('No fields to update', 400);

    params.push(userId);
    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, name, email, phone, company_name, website_url, client_notes, is_active, role`,
      params
    );

    if (result.rows.length === 0) throw new AppError('User not found', 404);
    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(req.params.id);
    const result = await query(
      `SELECT id, name, email, phone, company_name, website_url, client_notes, role, is_active,
              invite_token IS NOT NULL AND invite_token_expires > NOW() as has_pending_invite,
              password_reset_token IS NOT NULL AND password_reset_expires > NOW() as has_pending_reset,
              created_at
       FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rows.length === 0) throw new AppError('User not found', 404);

    // Also get ticket stats for this user
    const stats = await query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'complete') as complete,
        COUNT(*) as total
       FROM tickets WHERE user_id = $1`,
      [userId]
    );

    res.json({ user: result.rows[0], stats: stats.rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function getDashboardStats(req: Request, res: Response, next: NextFunction) {
  try {
    const statsResult = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'complete' AND updated_at >= date_trunc('month', NOW())) as completed_this_month,
        COUNT(*) as total
      FROM tickets
    `);

    const clientCount = await query(`SELECT COUNT(*) as total FROM users WHERE role = 'client' AND is_active = true`);

    const recentActivity = await query(`
      SELECT ta.*, t.title as ticket_title, u.name as user_name
      FROM ticket_activity ta
      JOIN tickets t ON ta.ticket_id = t.id
      LEFT JOIN users u ON ta.user_id = u.id
      ORDER BY ta.created_at DESC
      LIMIT 20
    `);

    res.json({
      stats: {
        ...statsResult.rows[0],
        total_clients: clientCount.rows[0].total,
      },
      recentActivity: recentActivity.rows,
    });
  } catch (err) {
    next(err);
  }
}
