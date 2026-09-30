import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

const projectInclude = {
  milestones: true,
  client: { select: { id: true, name: true, company: true } },
  assignedUsers: { select: { id: true, name: true, email: true } },
};

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { clientId, status, assignedUserId } = req.query;
    const where: Prisma.ProjectWhereInput = {};
    if (clientId) where.clientId = parseInt(clientId as string);
    if (status) where.status = status as string;
    if (assignedUserId) where.assignedUsers = { some: { id: parseInt(assignedUserId as string) } };

    const projects = await prisma.project.findMany({
      where,
      include: projectInclude,
      orderBy: { startDate: 'asc' },
    });

    res.json(projects);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: parseInt(req.params.id) },
      include: projectInclude,
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { clientId, name, description, status, startDate, endDate, milestones, assignedUserIds } = req.body;
    if (!clientId || !name || !startDate) {
      return res.status(400).json({ error: 'clientId, name, and startDate are required' });
    }

    const project = await prisma.project.create({
      data: {
        clientId: parseInt(clientId),
        name,
        description,
        status: status || 'active',
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        milestones: milestones?.length
          ? { create: milestones.map((m: { title: string; date: string }) => ({ title: m.title, date: new Date(m.date) })) }
          : undefined,
        assignedUsers: assignedUserIds?.length
          ? { connect: assignedUserIds.map((uid: number | string) => ({ id: parseInt(String(uid)) })) }
          : undefined,
      },
      include: projectInclude,
    });

    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, description, status, startDate, endDate, milestones, assignedUserIds } = req.body;

    const data: Prisma.ProjectUpdateInput = {
      name,
      description,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined,
    };

    if (assignedUserIds !== undefined) {
      data.assignedUsers = {
        set: assignedUserIds.map((uid: number | string) => ({ id: parseInt(String(uid)) })),
      };
    }

    const project = await prisma.project.update({
      where: { id: parseInt(req.params.id) },
      data,
    });

    if (milestones !== undefined) {
      await prisma.milestone.deleteMany({ where: { projectId: project.id } });
      if (milestones.length > 0) {
        await prisma.milestone.createMany({
          data: milestones.map((m: { title: string; date: string }) => ({
            projectId: project.id,
            title: m.title,
            date: new Date(m.date),
          })),
        });
      }
    }

    const updated = await prisma.project.findUnique({
      where: { id: project.id },
      include: projectInclude,
    });

    res.json(updated);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Project not found' });
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.project.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Project deleted' });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Project not found' });
    next(err);
  }
}
