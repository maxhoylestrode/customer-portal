import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

// Every field except avatarData (the bytes themselves) — reused everywhere
// a client record is returned as JSON, so the blob never gets pulled into
// a response body. Only the dedicated avatar-serving route selects it.
const CLIENT_SAFE_SELECT = {
  id: true,
  name: true,
  company: true,
  email: true,
  phone: true,
  address: true,
  notes: true,
  tags: true,
  hostingTier: true,
  avatarPath: true,
  avatarMimetype: true,
  salesPersonId: true,
  portalUserId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClientSelect;

// Presence is read from avatarMimetype (cheap) rather than avatarData (the
// bytes themselves) so queries never need to fetch the blob just to decide
// whether an <img> tag should render.
function withAvatarUrl<T extends { id: number; avatarPath: string | null; avatarMimetype?: string | null }>(
  client: T | null
) {
  if (!client) return client;
  const hasAvatar = !!client.avatarMimetype || !!client.avatarPath;
  return { ...client, avatarUrl: hasAvatar ? `/api/clients/${client.id}/avatar` : null };
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { search, tag } = req.query;
    const where: Prisma.ClientWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { company: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (tag) {
      where.tags = { has: tag as string };
    }

    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        ...CLIENT_SAFE_SELECT,
        _count: { select: { projects: true, files: true } },
        salesPerson: { select: { id: true, name: true } },
      },
    });

    res.json(clients.map(withAvatarUrl));
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const client = await prisma.client.findUnique({
      where: { id: parseInt(req.params.id) },
      select: {
        ...CLIENT_SAFE_SELECT,
        projects: {
          include: {
            milestones: true,
            assignedUsers: { select: { id: true, name: true, email: true } },
          },
          orderBy: { startDate: 'desc' },
        },
        files: {
          select: { id: true, clientId: true, filename: true, mimetype: true, size: true, uploadedAt: true },
          orderBy: { uploadedAt: 'desc' },
        },
        salesPerson: { select: { id: true, name: true } },
        portalUser: { select: { id: true, name: true, email: true, companyName: true, isActive: true } },
      },
    });

    if (!client) return res.status(404).json({ error: 'Client not found' });

    let portalTicketSummary = null;
    if (client.portalUser) {
      const [pending, in_progress, complete] = await Promise.all([
        prisma.ticket.count({ where: { userId: client.portalUser.id, status: 'pending' } }),
        prisma.ticket.count({ where: { userId: client.portalUser.id, status: 'in_progress' } }),
        prisma.ticket.count({ where: { userId: client.portalUser.id, status: 'complete' } }),
      ]);
      portalTicketSummary = { pending, in_progress, complete };
    }

    res.json({ ...withAvatarUrl(client), portalTicketSummary });
  } catch (err) {
    next(err);
  }
}

// GET /api/clients/portal-users?search= — client-role portal logins, for linking to a CRM record
export async function listPortalUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const { search } = req.query;
    const where: Prisma.UserWhereInput = { role: 'client' };
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { companyName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
        clientProfile: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
      take: 25,
    });

    res.json(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        company_name: u.companyName,
        linked_client_id: u.clientProfile?.id ?? null,
      }))
    );
  } catch (err) {
    next(err);
  }
}

// PUT /api/clients/:id/portal-link — link or clear this client's portal login
export async function linkPortalUser(req: Request, res: Response, next: NextFunction) {
  try {
    const clientId = parseInt(req.params.id);
    const { portalUserId } = req.body;

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return res.status(404).json({ error: 'Client not found' });

    if (portalUserId === null || portalUserId === undefined) {
      const updated = await prisma.client.update({
        where: { id: clientId },
        data: { portalUserId: null },
        select: {
          ...CLIENT_SAFE_SELECT,
          portalUser: { select: { id: true, name: true, email: true, companyName: true, isActive: true } },
        },
      });
      return res.json(withAvatarUrl(updated));
    }

    const targetId = parseInt(portalUserId);
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return res.status(404).json({ error: 'Portal user not found' });
    if (target.role !== 'client') return res.status(400).json({ error: 'Only client-role portal accounts can be linked' });

    const existingLink = await prisma.client.findUnique({ where: { portalUserId: targetId } });
    if (existingLink && existingLink.id !== clientId) {
      return res.status(409).json({ error: `That portal account is already linked to "${existingLink.name}"` });
    }

    const updated = await prisma.client.update({
      where: { id: clientId },
      data: { portalUserId: targetId },
      select: {
        ...CLIENT_SAFE_SELECT,
        portalUser: { select: { id: true, name: true, email: true, companyName: true, isActive: true } },
      },
    });
    res.json(withAvatarUrl(updated));
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, company, email, phone, address, notes, tags, hostingTier, salesPersonId } = req.body;
    if (!name) return res.status(400).json({ error: 'Client name is required' });

    // If the creator is a sales user and no salesPersonId is given, auto-assign them
    const resolvedSalesPersonId =
      salesPersonId != null
        ? parseInt(salesPersonId, 10) || null
        : req.user!.role === 'sales'
        ? req.user!.userId
        : null;

    const client = await prisma.client.create({
      data: {
        name,
        company,
        email,
        phone,
        address,
        notes,
        tags: tags || [],
        hostingTier: hostingTier || null,
        salesPersonId: resolvedSalesPersonId,
      },
      select: CLIENT_SAFE_SELECT,
    });

    res.status(201).json(withAvatarUrl(client));
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, company, email, phone, address, notes, tags, hostingTier, salesPersonId } = req.body;
    const data: Prisma.ClientUncheckedUpdateInput = {
      name,
      company,
      email,
      phone,
      address,
      notes,
      tags,
      hostingTier: hostingTier ?? null,
    };
    if (salesPersonId !== undefined) {
      data.salesPersonId = salesPersonId ? parseInt(salesPersonId, 10) : null;
    }
    const client = await prisma.client.update({
      where: { id: parseInt(req.params.id) },
      data,
      select: CLIENT_SAFE_SELECT,
    });

    res.json(withAvatarUrl(client));
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Client not found' });
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.client.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Client deleted' });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Client not found' });
    next(err);
  }
}

export async function uploadAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const clientId = parseInt(req.params.id);

    // Clean up any pre-migration on-disk avatar
    const existing = await prisma.client.findUnique({ where: { id: clientId }, select: { avatarPath: true } });
    if (existing?.avatarPath) {
      const oldAbs = path.resolve(existing.avatarPath);
      if (fs.existsSync(oldAbs)) fs.unlinkSync(oldAbs);
    }

    await prisma.client.update({
      where: { id: clientId },
      data: { avatarData: Buffer.from(req.file.buffer), avatarMimetype: req.file.mimetype, avatarPath: null },
    });

    res.json({ avatarUrl: `/api/clients/${clientId}/avatar` });
  } catch (err) {
    next(err);
  }
}

export async function getAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    const clientId = parseInt(req.params.id);
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { avatarData: true, avatarMimetype: true, avatarPath: true },
    });
    if (!client) return res.status(404).json({ error: 'Client not found' });

    if (client.avatarData) {
      res.setHeader('Content-Type', client.avatarMimetype || 'image/png');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.send(Buffer.from(client.avatarData));
      return;
    }

    // Fall back to disk for a pre-migration avatar
    if (client.avatarPath) {
      const abs = path.resolve(client.avatarPath);
      if (fs.existsSync(abs)) {
        res.sendFile(abs);
        return;
      }
    }

    res.status(404).json({ error: 'No avatar set' });
  } catch (err) {
    next(err);
  }
}

export async function deleteAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    const clientId = parseInt(req.params.id);
    const existing = await prisma.client.findUnique({ where: { id: clientId }, select: { avatarPath: true } });

    if (existing?.avatarPath) {
      const abs = path.resolve(existing.avatarPath);
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    }

    await prisma.client.update({
      where: { id: clientId },
      data: { avatarData: null, avatarMimetype: null, avatarPath: null },
    });

    res.json({ message: 'Avatar removed' });
  } catch (err) {
    next(err);
  }
}
