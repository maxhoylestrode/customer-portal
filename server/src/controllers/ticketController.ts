import { Request, Response, NextFunction } from 'express';
import { query } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { sendNewTicketNotification, sendTicketStatusUpdate } from '../services/emailService';
import path from 'path';
import fs from 'fs';

export async function getTickets(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    const { status, scope_flag, client_id, sort = 'created_at', order = 'desc' } = req.query;

    const allowedSort = ['created_at', 'updated_at', 'priority', 'status'];
    const sortCol = allowedSort.includes(sort as string) ? sort : 'created_at';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (role === 'client') {
      conditions.push(`t.user_id = $${paramIdx++}`);
      params.push(userId);
    } else if (client_id) {
      conditions.push(`t.user_id = $${paramIdx++}`);
      params.push(client_id);
    }

    if (status) {
      conditions.push(`t.status = $${paramIdx++}`);
      params.push(status);
    }
    if (scope_flag && role === 'admin') {
      conditions.push(`t.scope_flag = $${paramIdx++}`);
      params.push(scope_flag);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT t.*, u.name as client_name, u.email as client_email, u.company_name,
              (SELECT COUNT(*) FROM attachments WHERE ticket_id = t.id)::int as attachment_count
       FROM tickets t
       JOIN users u ON t.user_id = u.id
       ${where}
       ORDER BY t.${sortCol} ${sortDir}`,
      params
    );

    res.json({ tickets: result.rows });
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

    const result = await query(
      `INSERT INTO tickets (user_id, title, description) VALUES ($1, $2, $3) RETURNING *`,
      [userId, title.trim(), description.trim()]
    );
    const ticket = result.rows[0];

    // Log activity
    await query(
      `INSERT INTO ticket_activity (ticket_id, user_id, action, detail) VALUES ($1, $2, $3, $4)`,
      [ticket.id, userId, 'ticket_created', `Ticket "${title}" submitted`]
    );

    // Handle file attachments
    const files = req.files as Express.Multer.File[];
    if (files && files.length > 0) {
      for (const file of files) {
        await query(
          `INSERT INTO attachments (ticket_id, filename, filepath) VALUES ($1, $2, $3)`,
          [ticket.id, file.originalname, file.filename]
        );
      }
      await query(
        `INSERT INTO ticket_activity (ticket_id, user_id, action, detail) VALUES ($1, $2, $3, $4)`,
        [ticket.id, userId, 'attachment_uploaded', `${files.length} file(s) attached`]
      );
    }

    // Email admin
    const userResult = await query(`SELECT name, email FROM users WHERE id = $1`, [userId]);
    if (userResult.rows.length > 0) {
      const { name, email } = userResult.rows[0];
      sendNewTicketNotification(ticket.id, ticket.title, name, email).catch(console.error);
    }

    res.status(201).json({ ticket });
  } catch (err) {
    next(err);
  }
}

export async function getTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    const ticketId = parseInt(req.params.id);

    const result = await query(
      `SELECT t.*, u.name as client_name, u.email as client_email, u.company_name, u.website_url
       FROM tickets t JOIN users u ON t.user_id = u.id WHERE t.id = $1`,
      [ticketId]
    );

    if (result.rows.length === 0) throw new AppError('Ticket not found', 404);
    const ticket = result.rows[0];

    if (role === 'client' && ticket.user_id !== userId) {
      throw new AppError('Not authorised', 403);
    }

    const attachments = await query(
      `SELECT * FROM attachments WHERE ticket_id = $1 ORDER BY uploaded_at DESC`,
      [ticketId]
    );

    const activity = await query(
      `SELECT ta.*, u.name as user_name, u.role as user_role
       FROM ticket_activity ta
       LEFT JOIN users u ON ta.user_id = u.id
       WHERE ta.ticket_id = $1
       ORDER BY ta.created_at ASC`,
      [ticketId]
    );

    res.json({
      ticket,
      attachments: attachments.rows,
      activity: activity.rows,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    const ticketId = parseInt(req.params.id);

    const existing = await query(`SELECT * FROM tickets WHERE id = $1`, [ticketId]);
    if (existing.rows.length === 0) throw new AppError('Ticket not found', 404);
    const ticket = existing.rows[0];

    if (role === 'client' && ticket.user_id !== userId) {
      throw new AppError('Not authorised', 403);
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (role === 'admin') {
      const { status, scope_flag, priority, admin_notes } = req.body;

      if (status !== undefined) {
        updates.push(`status = $${paramIdx++}`);
        params.push(status);

        if (status !== ticket.status) {
          await query(
            `INSERT INTO ticket_activity (ticket_id, user_id, action, detail) VALUES ($1, $2, $3, $4)`,
            [ticketId, userId, 'status_changed', `Status changed from "${ticket.status}" to "${status}"`]
          );
          // Notify client
          const clientResult = await query(`SELECT name, email FROM users WHERE id = $1`, [ticket.user_id]);
          if (clientResult.rows.length > 0) {
            const { name, email } = clientResult.rows[0];
            sendTicketStatusUpdate(email, name, ticketId, ticket.title, status).catch(console.error);
          }
        }
      }
      if (scope_flag !== undefined) {
        updates.push(`scope_flag = $${paramIdx++}`);
        params.push(scope_flag);
        if (scope_flag !== ticket.scope_flag) {
          await query(
            `INSERT INTO ticket_activity (ticket_id, user_id, action, detail) VALUES ($1, $2, $3, $4)`,
            [ticketId, userId, 'scope_updated', `Scope set to "${scope_flag}"`]
          );
        }
      }
      if (priority !== undefined) {
        updates.push(`priority = $${paramIdx++}`);
        params.push(priority);
        if (priority !== ticket.priority) {
          await query(
            `INSERT INTO ticket_activity (ticket_id, user_id, action, detail) VALUES ($1, $2, $3, $4)`,
            [ticketId, userId, 'priority_changed', `Priority set to "${priority}"`]
          );
        }
      }
      if (admin_notes !== undefined) {
        updates.push(`admin_notes = $${paramIdx++}`);
        params.push(admin_notes);
        await query(
          `INSERT INTO ticket_activity (ticket_id, user_id, action, detail) VALUES ($1, $2, $3, $4)`,
          [ticketId, userId, 'note_added', 'Admin notes updated']
        );
      }
    } else {
      // Client can only edit pending tickets
      if (ticket.status !== 'pending') {
        throw new AppError('You can only edit tickets that are still pending', 403);
      }
      const { title, description } = req.body;
      if (title !== undefined) { updates.push(`title = $${paramIdx++}`); params.push(title); }
      if (description !== undefined) { updates.push(`description = $${paramIdx++}`); params.push(description); }
    }

    if (updates.length === 0) {
      res.json({ ticket });
      return;
    }

    params.push(ticketId);
    const updated = await query(
      `UPDATE tickets SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      params
    );

    res.json({ ticket: updated.rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function deleteTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const ticketId = parseInt(req.params.id);

    // Delete physical files
    const attachments = await query(`SELECT filepath FROM attachments WHERE ticket_id = $1`, [ticketId]);
    for (const att of attachments.rows) {
      const filePath = path.join(__dirname, '../../uploads', att.filepath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await query(`DELETE FROM tickets WHERE id = $1`, [ticketId]);
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

    // Check existing attachment count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM attachments WHERE ticket_id = $1`,
      [ticketId]
    );
    const existing = parseInt(countResult.rows[0].count);
    if (existing + files.length > 5) {
      // Clean up uploaded files
      for (const f of files) {
        const fp = path.join(__dirname, '../../uploads', f.filename);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
      throw new AppError('Maximum 5 attachments per ticket', 400);
    }

    const inserted = [];
    for (const file of files) {
      const result = await query(
        `INSERT INTO attachments (ticket_id, filename, filepath) VALUES ($1, $2, $3) RETURNING *`,
        [ticketId, file.originalname, file.filename]
      );
      inserted.push(result.rows[0]);
    }

    await query(
      `INSERT INTO ticket_activity (ticket_id, user_id, action, detail) VALUES ($1, $2, $3, $4)`,
      [ticketId, userId, 'attachment_uploaded', `${files.length} file(s) uploaded`]
    );

    res.status(201).json({ attachments: inserted });
  } catch (err) {
    next(err);
  }
}

export async function deleteAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    const ticketId = parseInt(req.params.id);
    const attachmentId = parseInt(req.params.attachmentId);

    const result = await query(
      `SELECT a.*, t.user_id FROM attachments a JOIN tickets t ON a.ticket_id = t.id WHERE a.id = $1 AND a.ticket_id = $2`,
      [attachmentId, ticketId]
    );

    if (result.rows.length === 0) throw new AppError('Attachment not found', 404);
    const att = result.rows[0];

    if (role === 'client' && att.user_id !== userId) {
      throw new AppError('Not authorised', 403);
    }

    // Delete physical file
    const filePath = path.join(__dirname, '../../uploads', att.filepath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await query(`DELETE FROM attachments WHERE id = $1`, [attachmentId]);
    await query(
      `INSERT INTO ticket_activity (ticket_id, user_id, action, detail) VALUES ($1, $2, $3, $4)`,
      [ticketId, userId, 'attachment_deleted', `File "${att.filename}" removed`]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
