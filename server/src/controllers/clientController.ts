import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

function toAvatarUrl(clientId: number, avatarPath: string | null): string | null {
  if (!avatarPath) return null;
  return `/uploads/avatars/${path.basename(avatarPath)}`;
}

function withAvatarUrl<T extends { id: number; avatarPath: string | null }>(client: T | null) {
  if (!client) return client;
  return { ...client, avatarUrl: toAvatarUrl(client.id, client.avatarPath) };
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
      include: {
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
      include: {
        projects: {
          include: {
            milestones: true,
            assignedUsers: { select: { id: true, name: true, email: true } },
          },
          orderBy: { startDate: 'desc' },
        },
        files: { orderBy: { uploadedAt: 'desc' } },
        salesPerson: { select: { id: true, name: true } },
      },
    });

    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(withAvatarUrl(client));
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
    });

    res.status(201).json(client);
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
    });

    res.json(client);
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

    // Delete old avatar file(s) with a different extension
    const existing = await prisma.client.findUnique({ where: { id: clientId }, select: { avatarPath: true } });
    if (existing?.avatarPath && existing.avatarPath !== req.file.path) {
      const oldAbs = path.resolve(existing.avatarPath);
      if (fs.existsSync(oldAbs)) fs.unlinkSync(oldAbs);
    }

    await prisma.client.update({
      where: { id: clientId },
      data: { avatarPath: req.file.path },
    });

    res.json({ avatarUrl: `/uploads/avatars/${req.file.filename}` });
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
      await prisma.client.update({ where: { id: clientId }, data: { avatarPath: null } });
    }

    res.json({ message: 'Avatar removed' });
  } catch (err) {
    next(err);
  }
}
