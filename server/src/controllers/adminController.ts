import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import fs from 'fs';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { sendInviteEmail } from '../services/emailService';

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const now = new Date();
    const users = await prisma.user.findMany({
      where: { role: 'client' },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        company_name: u.companyName,
        website_url: u.websiteUrl,
        role: u.role,
        is_active: u.isActive,
        has_pending_invite: !!(u.inviteToken && u.inviteTokenExpires && u.inviteTokenExpires > now),
        has_pending_reset: !!(u.passwordResetToken && u.passwordResetExpires && u.passwordResetExpires > now),
        created_at: u.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, phone, company_name, website_url, client_notes } = req.body;

    if (!email) throw new AppError('Email is required', 400);
    if (!name) throw new AppError('Name is required', 400);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        companyName: company_name || null,
        websiteUrl: website_url || null,
        clientNotes: client_notes || null,
        passwordHash: '',
        role: 'client',
        inviteToken: rawToken,
        inviteTokenExpires: expires,
      },
      select: { id: true, name: true, email: true },
    });

    sendInviteEmail(email, rawToken).catch(console.error);

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

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.passwordHash) {
      throw new AppError('A user with that email already has an account', 409);
    }

    if (existing) {
      await prisma.user.update({
        where: { email },
        data: { inviteToken: rawToken, inviteTokenExpires: expires },
      });
    } else {
      const safeName = name || email.split('@')[0];
      await prisma.user.create({
        data: {
          name: safeName,
          email,
          passwordHash: '',
          role: 'client',
          inviteToken: rawToken,
          inviteTokenExpires: expires,
        },
      });
    }

    sendInviteEmail(email, rawToken).catch(console.error);
    res.json({ ok: true, message: `Invite sent to ${email}` });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(req.params.id);
    const { name, email, phone, company_name, website_url, client_notes, is_active } = req.body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone || null;
    if (company_name !== undefined) data.companyName = company_name || null;
    if (website_url !== undefined) data.websiteUrl = website_url || null;
    if (client_notes !== undefined) data.clientNotes = client_notes || null;
    if (is_active !== undefined) data.isActive = is_active;

    if (Object.keys(data).length === 0) throw new AppError('No fields to update', 400);

    const user = await prisma.user.update({ where: { id: userId }, data }).catch(() => null);
    if (!user) throw new AppError('User not found', 404);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        company_name: user.companyName,
        website_url: user.websiteUrl,
        client_notes: user.clientNotes,
        is_active: user.isActive,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(req.params.id);
    const now = new Date();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);

    const [pending, in_progress, complete, total] = await Promise.all([
      prisma.ticket.count({ where: { userId, status: 'pending' } }),
      prisma.ticket.count({ where: { userId, status: 'in_progress' } }),
      prisma.ticket.count({ where: { userId, status: 'complete' } }),
      prisma.ticket.count({ where: { userId } }),
    ]);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        company_name: user.companyName,
        website_url: user.websiteUrl,
        client_notes: user.clientNotes,
        role: user.role,
        is_active: user.isActive,
        has_pending_invite: !!(user.inviteToken && user.inviteTokenExpires && user.inviteTokenExpires > now),
        has_pending_reset: !!(user.passwordResetToken && user.passwordResetExpires && user.passwordResetExpires > now),
        created_at: user.createdAt,
      },
      stats: { pending, in_progress, complete, total },
    });
  } catch (err) {
    next(err);
  }
}

export async function getDashboardStats(req: Request, res: Response, next: NextFunction) {
  try {
    const [pending, in_progress, total_complete, total_out_of_scope, total, total_clients] = await Promise.all([
      prisma.ticket.count({ where: { status: 'pending' } }),
      prisma.ticket.count({ where: { status: 'in_progress' } }),
      prisma.ticket.count({ where: { status: 'complete' } }),
      prisma.ticket.count({ where: { status: 'out_of_scope' } }),
      prisma.ticket.count(),
      prisma.user.count({ where: { role: 'client', isActive: true } }),
    ]);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const completed_this_month = await prisma.ticket.count({
      where: { status: 'complete', updatedAt: { gte: startOfMonth } },
    });

    const recentActivityRows = await prisma.ticketActivity.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { ticket: { select: { title: true } }, user: { select: { name: true } } },
    });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);
    const recentTickets = await prisma.ticket.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    });
    const monthlyCounts = new Map<string, { month_date: Date; count: number }>();
    for (const t of recentTickets) {
      const key = `${t.createdAt.getFullYear()}-${t.createdAt.getMonth()}`;
      const monthDate = new Date(t.createdAt.getFullYear(), t.createdAt.getMonth(), 1);
      const existing = monthlyCounts.get(key);
      if (existing) existing.count += 1;
      else monthlyCounts.set(key, { month_date: monthDate, count: 1 });
    }
    const monthlyTrend = Array.from(monthlyCounts.values())
      .sort((a, b) => a.month_date.getTime() - b.month_date.getTime())
      .map((m) => ({
        month: m.month_date.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        month_date: m.month_date,
        count: m.count,
      }));

    const priorityGroups = await prisma.ticket.groupBy({ by: ['priority'], _count: { priority: true } });
    const priorityBreakdown = priorityGroups
      .map((p) => ({ priority: p.priority, count: p._count.priority }))
      .sort((a, b) => a.priority.localeCompare(b.priority));

    res.json({
      stats: {
        pending,
        in_progress,
        completed_this_month,
        total_complete,
        total_out_of_scope,
        total,
        total_clients,
      },
      recentActivity: recentActivityRows.map((a) => ({
        id: a.id,
        ticket_id: a.ticketId,
        user_id: a.userId,
        action: a.action,
        detail: a.detail,
        created_at: a.createdAt,
        ticket_title: a.ticket.title,
        user_name: a.user?.name,
      })),
      monthlyTrend,
      priorityBreakdown,
    });
  } catch (err) {
    next(err);
  }
}

export async function listAdmins(req: Request, res: Response, next: NextFunction) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'admin' },
      orderBy: { createdAt: 'asc' },
    });
    res.json({
      admins: admins.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        is_active: a.isActive,
        created_at: a.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function createAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) throw new AppError('Name, email, and password are required', 400);
    if (password.length < 8) throw new AppError('Password must be at least 8 characters', 400);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError('An account with that email already exists', 409);

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: 'admin' },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    res.status(201).json({ user: { ...user, created_at: user.createdAt } });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(req.params.id);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);
    if (user.role !== 'client') throw new AppError('Cannot delete admin accounts', 403);

    const attachments = await prisma.attachment.findMany({
      where: { ticket: { userId } },
      select: { filepath: true },
    });
    const filepaths = attachments.map((a) => a.filepath);

    // DB cascades handle tickets, attachments, ticket_activity, refresh_tokens
    await prisma.user.delete({ where: { id: userId } });

    for (const filepath of filepaths) {
      try {
        fs.unlinkSync(filepath);
      } catch {
        /* ignore missing files */
      }
    }

    res.json({ ok: true, message: 'Client account deleted' });
  } catch (err) {
    next(err);
  }
}
