import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import fs from 'fs';
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
        COUNT(*) FILTER (WHERE status = 'complete') as total_complete,
        COUNT(*) FILTER (WHERE status = 'out_of_scope') as total_out_of_scope,
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

    const monthlyTrend = await query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as month,
        DATE_TRUNC('month', created_at) as month_date,
        COUNT(*) as count
      FROM tickets
      WHERE created_at >= DATE_TRUNC('month', NOW() - INTERVAL '5 months')
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month_date ASC
    `);

    const priorityBreakdown = await query(`
      SELECT priority, COUNT(*) as count
      FROM tickets
      GROUP BY priority
      ORDER BY priority
    `);

    res.json({
      stats: {
        ...statsResult.rows[0],
        total_clients: clientCount.rows[0].total,
      },
      recentActivity: recentActivity.rows,
      monthlyTrend: monthlyTrend.rows,
      priorityBreakdown: priorityBreakdown.rows,
    });
  } catch (err) {
    next(err);
  }
}

export async function listAdmins(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await query(
      `SELECT id, name, email, is_active, created_at FROM users WHERE role = 'admin' ORDER BY created_at ASC`
    );
    res.json({ admins: result.rows });
  } catch (err) {
    next(err);
  }
}

export async function createAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) throw new AppError('Name, email, and password are required', 400);
    if (password.length < 8) throw new AppError('Password must be at least 8 characters', 400);

    const existing = await query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing.rows.length > 0) throw new AppError('An account with that email already exists', 409);

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin') RETURNING id, name, email, role, created_at`,
      [name, email, passwordHash]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(req.params.id);

    const userResult = await query(`SELECT id, role FROM users WHERE id = $1`, [userId]);
    if (userResult.rows.length === 0) throw new AppError('User not found', 404);
    if (userResult.rows[0].role !== 'client') throw new AppError('Cannot delete admin accounts', 403);

    // Collect attachment filepaths before cascade-delete removes the DB records
    const attachmentResult = await query(
      `SELECT a.filepath FROM attachments a JOIN tickets t ON a.ticket_id = t.id WHERE t.user_id = $1`,
      [userId]
    );
    const filepaths = attachmentResult.rows.map((r: { filepath: string }) => r.filepath);

    // Delete user — DB cascades handle tickets, attachments, ticket_activity, refresh_tokens
    await query(`DELETE FROM users WHERE id = $1`, [userId]);

    // Remove physical files
    for (const filepath of filepaths) {
      try { fs.unlinkSync(filepath); } catch { /* ignore missing files */ }
    }

    res.json({ ok: true, message: 'Client account deleted' });
  } catch (err) {
    next(err);
  }
}
