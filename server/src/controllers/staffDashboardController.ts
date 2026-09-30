import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';

export async function stats(req: Request, res: Response, next: NextFunction) {
  try {
    const isSales = req.user?.role === 'sales';
    const userId = req.user?.userId;

    const salesClientWhere = isSales ? { salesPersonId: userId } : {};

    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      totalClients,
      activeProjects,
      completeProjects,
      onHoldProjects,
      totalNotes,
      upcomingDeadlines,
      recentClients,
      recentProjects,
      rawMonthlyClients,
      salesMyClients,
    ] = await Promise.all([
      prisma.client.count({ where: salesClientWhere }),
      isSales ? 0 : prisma.project.count({ where: { status: 'active' } }),
      isSales ? 0 : prisma.project.count({ where: { status: 'complete' } }),
      isSales ? 0 : prisma.project.count({ where: { status: 'on-hold' } }),
      prisma.note.count(),
      isSales
        ? []
        : prisma.project.findMany({
            where: {
              endDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
              status: { not: 'complete' },
            },
            include: { client: { select: { name: true } } },
            orderBy: { endDate: 'asc' },
            take: 5,
          }),
      prisma.client.findMany({
        where: salesClientWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, company: true, createdAt: true, salesPerson: { select: { name: true } } },
      }),
      isSales
        ? []
        : prisma.project.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { client: { select: { id: true, name: true } } },
          }),
      prisma.client.findMany({
        where: { createdAt: { gte: sixMonthsAgo }, ...salesClientWhere },
        select: { createdAt: true },
      }),
      isSales
        ? prisma.client.findMany({
            where: { salesPersonId: userId },
            select: { id: true, name: true, company: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          })
        : [],
    ]);

    const monthlyMap: Record<string, { label: string; count: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleString('default', { month: 'short' });
      monthlyMap[key] = { label, count: 0 };
    }
    rawMonthlyClients.forEach((c) => {
      const d = new Date(c.createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (monthlyMap[key]) monthlyMap[key].count++;
    });
    const monthlyClients = Object.values(monthlyMap);

    res.json({
      totalClients,
      activeProjects,
      completeProjects,
      onHoldProjects,
      totalNotes,
      upcomingDeadlines,
      recentClients,
      recentProjects,
      monthlyClients,
      myReferredClients: salesMyClients,
      estimatedCommission: salesMyClients.length,
    });
  } catch (err) {
    next(err);
  }
}
