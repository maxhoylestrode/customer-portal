import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { sendNewTicketMessage } from '../services/emailService';
import { CLIENT_URL, ADMIN_EMAIL } from '../config/mailer';
import { sendPushToUser, sendPushToRole } from '../services/pushService';

export async function listMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    const ticketId = parseInt(req.params.id);

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { userId: true } });
    if (!ticket) throw new AppError('Ticket not found', 404);
    if (role === 'client' && ticket.userId !== userId) throw new AppError('Not authorised', 403);

    const messages = await prisma.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true, role: true } } },
    });

    res.json({
      messages: messages.map((m) => ({
        id: m.id,
        ticket_id: m.ticketId,
        user_id: m.userId,
        message: m.message,
        created_at: m.createdAt,
        author_name: m.user.name,
        author_role: m.user.role,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function createMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    const ticketId = parseInt(req.params.id);
    const { message } = req.body;

    if (!message?.trim()) throw new AppError('Message cannot be empty', 400);

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!ticket) throw new AppError('Ticket not found', 404);
    if (role === 'client' && ticket.userId !== userId) throw new AppError('Not authorised', 403);

    const created = await prisma.ticketMessage.create({
      data: { ticketId, userId, message: message.trim() },
      include: { user: { select: { id: true, name: true, role: true } } },
    });

    // Notify whichever side didn't send the message — email (unchanged) and push
    if (role === 'client') {
      sendNewTicketMessage(
        ADMIN_EMAIL,
        'Team',
        ticket.user.name,
        ticketId,
        ticket.title,
        message.trim(),
        `${CLIENT_URL}/admin/tickets/${ticketId}`
      ).catch(console.error);
      sendPushToRole('admin', {
        title: `New message — Ticket #${ticketId}`,
        body: `${ticket.user.name}: ${message.trim()}`,
        url: `/admin/tickets/${ticketId}`,
      }).catch(console.error);
    } else {
      sendNewTicketMessage(
        ticket.user.email,
        ticket.user.name,
        created.user.name,
        ticketId,
        ticket.title,
        message.trim(),
        `${CLIENT_URL}/tickets/${ticketId}`
      ).catch(console.error);
      sendPushToUser(ticket.user.id, {
        title: `New message — Ticket #${ticketId}`,
        body: `${created.user.name}: ${message.trim()}`,
        url: `/tickets/${ticketId}`,
      }).catch(console.error);
    }

    res.status(201).json({
      message: {
        id: created.id,
        ticket_id: created.ticketId,
        user_id: created.userId,
        message: created.message,
        created_at: created.createdAt,
        author_name: created.user.name,
        author_role: created.user.role,
      },
    });
  } catch (err) {
    next(err);
  }
}
