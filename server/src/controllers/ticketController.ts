import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { sendNewTicketNotification, sendTicketStatusUpdate } from '../services/emailService';
import { sendPushToUser, sendPushToRole } from '../services/pushService';
import path from 'path';
import fs from 'fs';

const SORTABLE: Record<string, keyof Prisma.TicketOrderByWithRelationInput> = {
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  priority: 'priority',
  status: 'status',
};

function serializeTicket(t: {
  id: number;
  userId: number;
  title: string;
  description: string;
  status: string;
  scopeFlag: string;
  priority: string;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: { name: string; email: string; companyName: string | null; websiteUrl?: string | null };
  _count?: { attachments: number };
}) {
  return {
    id: t.id,
    user_id: t.userId,
    title: t.title,
    description: t.description,
    status: t.status,
    scope_flag: t.scopeFlag,
    priority: t.priority,
    admin_notes: t.adminNotes,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
    ...(t.user
      ? {
          client_name: t.user.name,
          client_email: t.user.email,
          company_name: t.user.companyName,
          ...(t.user.websiteUrl !== undefined ? { website_url: t.user.websiteUrl } : {}),
        }
      : {}),
    ...(t._count ? { attachment_count: t._count.attachments } : {}),
  };
}

export async function getTickets(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    const { status, scope_flag, client_id, sort = 'created_at', order = 'desc' } = req.query;

    const sortField = SORTABLE[sort as string] || 'createdAt';
    const sortDir = order === 'asc' ? 'asc' : 'desc';

    const where: Prisma.TicketWhereInput = {};
    if (role === 'client') {
      where.userId = userId;
    } else if (client_id) {
      where.userId = parseInt(client_id as string);
    }
    if (status) where.status = status as string;
    if (scope_flag && role === 'admin') where.scopeFlag = scope_flag as string;

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { [sortField]: sortDir },
      include: {
        user: { select: { name: true, email: true, companyName: true } },
        _count: { select: { attachments: true } },
      },
    });

    res.json({ tickets: tickets.map(serializeTicket) });
  } catch (err) {
    next(err);
  }
}

export async function createTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.user!;
    const { title, description } = req.body;

    if (!title?.trim()) throw new AppError('Title is required', 400);
    if (!description?.trim()) throw new AppError('Description is required', 400);

    const ticket = await prisma.ticket.create({
      data: { userId, title: title.trim(), description: description.trim() },
    });

    await prisma.ticketActivity.create({
      data: { ticketId: ticket.id, userId, action: 'ticket_created', detail: `Ticket "${title}" submitted` },
    });

    const files = req.files as Express.Multer.File[];
    if (files && files.length > 0) {
      await prisma.$transaction(
        files.map((file) =>
          prisma.attachment.create({
            data: {
              ticketId: ticket.id,
              filename: file.originalname,
              filepath: file.originalname,
              data: Buffer.from(file.buffer),
              mimetype: file.mimetype,
            },
          })
        )
      );
      await prisma.ticketActivity.create({
        data: {
          ticketId: ticket.id,
          userId,
          action: 'attachment_uploaded',
          detail: `${files.length} file(s) attached`,
        },
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    if (user) {
      sendNewTicketNotification(ticket.id, ticket.title, user.name, user.email).catch(console.error);
    }
    sendPushToRole('admin', {
      title: 'New ticket submitted',
      body: `${user?.name || 'A client'}: ${ticket.title}`,
      url: `/admin/tickets/${ticket.id}`,
    }).catch(console.error);

    res.status(201).json({ ticket: serializeTicket(ticket) });
  } catch (err) {
    next(err);
  }
}

export async function getTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    const ticketId = parseInt(req.params.id);

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { user: { select: { name: true, email: true, companyName: true, websiteUrl: true } } },
    });

    if (!ticket) throw new AppError('Ticket not found', 404);

    if (role === 'client' && ticket.userId !== userId) {
      throw new AppError('Not authorised', 403);
    }

    const attachments = await prisma.attachment.findMany({
      where: { ticketId },
      orderBy: { uploadedAt: 'desc' },
    });

    const activity = await prisma.ticketActivity.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { name: true, role: true } } },
    });

    res.json({
      ticket: serializeTicket(ticket),
      attachments: attachments.map((a) => ({
        id: a.id,
        ticket_id: a.ticketId,
        filename: a.filename,
        filepath: a.filepath,
        uploaded_at: a.uploadedAt,
      })),
      activity: activity.map((a) => ({
        id: a.id,
        ticket_id: a.ticketId,
        user_id: a.userId,
        action: a.action,
        detail: a.detail,
        created_at: a.createdAt,
        user_name: a.user?.name,
        user_role: a.user?.role,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    const ticketId = parseInt(req.params.id);

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new AppError('Ticket not found', 404);

    if (role === 'client' && ticket.userId !== userId) {
      throw new AppError('Not authorised', 403);
    }

    const data: Prisma.TicketUpdateInput = {};

    if (role === 'admin') {
      const { status, scope_flag, priority, admin_notes } = req.body;

      if (status !== undefined) {
        data.status = status;

        if (status !== ticket.status) {
          await prisma.ticketActivity.create({
            data: {
              ticketId,
              userId,
              action: 'status_changed',
              detail: `Status changed from "${ticket.status}" to "${status}"`,
            },
          });
          const client = await prisma.user.findUnique({ where: { id: ticket.userId }, select: { name: true, email: true } });
          if (client) {
            const finalPriority = priority !== undefined ? priority : ticket.priority;
            const finalScope = scope_flag !== undefined ? scope_flag : ticket.scopeFlag;
            const finalNotes = admin_notes !== undefined ? admin_notes : ticket.adminNotes;
            sendTicketStatusUpdate(
              client.email,
              client.name,
              ticketId,
              ticket.title,
              status,
              finalPriority,
              finalScope,
              finalNotes
            ).catch(console.error);
            sendPushToUser(ticket.userId, {
              title: `Ticket #${ticketId} updated`,
              body: `${ticket.title} — now ${status.replace('_', ' ')}`,
              url: `/tickets/${ticketId}`,
            }).catch(console.error);
          }
        }
      }
      if (scope_flag !== undefined) {
        data.scopeFlag = scope_flag;
        if (scope_flag !== ticket.scopeFlag) {
          await prisma.ticketActivity.create({
            data: { ticketId, userId, action: 'scope_updated', detail: `Scope set to "${scope_flag}"` },
          });
        }
      }
      if (priority !== undefined) {
        data.priority = priority;
        if (priority !== ticket.priority) {
          await prisma.ticketActivity.create({
            data: { ticketId, userId, action: 'priority_changed', detail: `Priority set to "${priority}"` },
          });
        }
      }
      if (admin_notes !== undefined) {
        data.adminNotes = admin_notes;
        await prisma.ticketActivity.create({
          data: { ticketId, userId, action: 'note_added', detail: 'Admin notes updated' },
        });
      }
    } else {
      if (ticket.status !== 'pending') {
        throw new AppError('You can only edit tickets that are still pending', 403);
      }
      const { title, description } = req.body;
      if (title !== undefined) data.title = title;
      if (description !== undefined) data.description = description;
    }

    if (Object.keys(data).length === 0) {
      res.json({ ticket: serializeTicket(ticket) });
      return;
    }

    const updated = await prisma.ticket.update({ where: { id: ticketId }, data });
    res.json({ ticket: serializeTicket(updated) });
  } catch (err) {
    next(err);
  }
}

export async function deleteTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const ticketId = parseInt(req.params.id);

    // Best-effort cleanup of pre-migration attachments that still only exist on disk
    const attachments = await prisma.attachment.findMany({ where: { ticketId, data: null }, select: { filepath: true } });
    for (const att of attachments) {
      const filePath = path.join(__dirname, '../../uploads', att.filepath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await prisma.ticket.delete({ where: { id: ticketId } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function uploadAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.user!;
    const ticketId = parseInt(req.params.id);
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) throw new AppError('No files uploaded', 400);

    const existing = await prisma.attachment.count({ where: { ticketId } });
    if (existing + files.length > 5) {
      throw new AppError('Maximum 5 attachments per ticket', 400);
    }

    const inserted = await prisma.$transaction(
      files.map((file) =>
        prisma.attachment.create({
          data: {
            ticketId,
            filename: file.originalname,
            filepath: file.originalname,
            data: Buffer.from(file.buffer),
            mimetype: file.mimetype,
          },
        })
      )
    );

    await prisma.ticketActivity.create({
      data: { ticketId, userId, action: 'attachment_uploaded', detail: `${files.length} file(s) uploaded` },
    });

    res.status(201).json({
      attachments: inserted.map((a) => ({
        id: a.id,
        ticket_id: a.ticketId,
        filename: a.filename,
        filepath: a.filepath,
        uploaded_at: a.uploadedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function downloadAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    const ticketId = parseInt(req.params.id);
    const attachmentId = parseInt(req.params.attachmentId);

    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, ticketId },
      include: { ticket: { select: { userId: true } } },
    });
    if (!attachment) throw new AppError('Attachment not found', 404);
    if (role === 'client' && attachment.ticket.userId !== userId) {
      throw new AppError('Not authorised', 403);
    }

    if (attachment.data) {
      res.setHeader('Content-Type', attachment.mimetype || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${attachment.filename}"`);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.send(Buffer.from(attachment.data));
      return;
    }

    // Fall back to disk for pre-migration attachments
    const filePath = path.join(__dirname, '../../uploads', attachment.filepath);
    if (!fs.existsSync(filePath)) throw new AppError('Attachment file not found', 404);
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
}

export async function deleteAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    const ticketId = parseInt(req.params.id);
    const attachmentId = parseInt(req.params.attachmentId);

    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, ticketId },
      include: { ticket: { select: { userId: true } } },
    });

    if (!attachment) throw new AppError('Attachment not found', 404);

    if (role === 'client' && attachment.ticket.userId !== userId) {
      throw new AppError('Not authorised', 403);
    }

    if (!attachment.data) {
      // Pre-migration attachment — clean up its on-disk file too
      const filePath = path.join(__dirname, '../../uploads', attachment.filepath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await prisma.attachment.delete({ where: { id: attachmentId } });
    await prisma.ticketActivity.create({
      data: { ticketId, userId, action: 'attachment_deleted', detail: `File "${attachment.filename}" removed` },
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
