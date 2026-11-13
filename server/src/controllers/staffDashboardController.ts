// NOTE: "Project" in the database/API is shown to users as a "Task".
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { TASK_STATUSES } from '../constants/tasks';

// ── Response shape (documented here; the front end reads exactly this) ──────

interface Kpi {
  key: string;
  label: string;
  value: number | string;
  context: string; // already a sentence, e.g. "2 new this week"
  trend?: 'up' | 'down' | 'flat';
  href: string;
}

interface ComingUpItem {
  kind: 'task' | 'milestone' | 'meeting';
  id: number;
  date: string; // ISO
  time?: string; // meetings only, "09:00"
  title: string;
  subtitle: string;
  href: string;
}

interface DashboardOverview {
  role: 'admin' | 'staff' | 'sales';
  userName: string;
  attention: {
    overdueTasks: number;
    dueTodayTasks: number;
    ticketsWaiting: number | null; // admin only
  } | null; // null for sales
  kpis: Kpi[];
  myTasks: Array<{
    id: number;
    name: string;
    status: string;
    priority: string;
    endDate: Date | null;
    clientName: string;
  }> | null;
  myTasksTotal: number | null;
  comingUp: ComingUpItem[];
  pipeline: Array<{ status: string; count: number }> | null;
  workload: Array<{ userId: number; name: string; open: number; overdue: number }> | null;
  tickets: {
    byStatus: Array<{ status: string; count: number }>;
    monthly: Array<{ label: string; count: number }>; // exactly 6, oldest first
    oldestWaiting: Array<{ id: number; title: string; clientName: string; daysWaiting: number }>;
  } | null; // admin only
  recentClients: Array<{ id: number; name: string; company: string | null; createdAt: Date }>;
  referredClients: Array<{ id: number; name: string; company: string | null }> | null; // sales only
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const DAY = 24 * 60 * 60 * 1000;
const TICKET_STATUSES = ['pending', 'in_progress', 'complete', 'out_of_scope'] as const;

// Due dates are stored as UTC midnight and the server runs in UTC (CapRover),
// so local midnight lines up with them.
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

// ── GET /api/dashboard/overview ─────────────────────────────────────────────

export async function overview(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    const isAdmin = role === 'admin';
    const isSales = role === 'sales';
    const seesTasks = !isSales;

    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = addDays(today, 1);
    const weekAhead = addDays(today, 7);
    const fortnightEnd = addDays(today, 15); // exclusive, so day 14 is included
    const weekAgo = addDays(now, -7);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);

    const open: Prisma.ProjectWhereInput = { status: { not: 'complete' } };
    const mineOpen: Prisma.ProjectWhereInput = { ...open, assignedUsers: { some: { id: userId } } };
    const clientScope: Prisma.ClientWhereInput = isSales ? { salesPersonId: userId } : {};

    const none = Promise.resolve(null);

    const [
      me,
      totalClients,
      clientsThisMonth,
      recentClients,
      referredClients,
      // tasks
      activeTasks,
      dueThisWeek,
      overdueTasks,
      dueTodayTasks,
      myOpenCount,
      myOverdueCount,
      doneThisMonth,
      doneLastMonth,
      myTasks,
      pipelineGroups,
      workloadUsers,
      comingTasks,
      comingMilestones,
      // meetings (every role)
      comingMeetings,
      // tickets (admin)
      openTickets,
      newTicketsThisWeek,
      ticketGroups,
      recentTicketDates,
      oldestPending,
    ] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
      prisma.client.count(),
      prisma.client.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.client.findMany({
        where: clientScope,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, company: true, createdAt: true },
      }),
      isSales
        ? prisma.client.findMany({
            where: { salesPersonId: userId },
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, company: true },
          })
        : none,

      seesTasks ? prisma.project.count({ where: open }) : none,
      seesTasks ? prisma.project.count({ where: { ...open, endDate: { gte: today, lt: weekAhead } } }) : none,
      seesTasks ? prisma.project.count({ where: { ...open, endDate: { lt: today } } }) : none,
      seesTasks ? prisma.project.count({ where: { ...open, endDate: { gte: today, lt: tomorrow } } }) : none,
      seesTasks ? prisma.project.count({ where: mineOpen }) : none,
      seesTasks ? prisma.project.count({ where: { ...mineOpen, endDate: { lt: today } } }) : none,
      seesTasks ? prisma.project.count({ where: { completedAt: { gte: monthStart } } }) : none,
      seesTasks ? prisma.project.count({ where: { completedAt: { gte: lastMonthStart, lt: monthStart } } }) : none,
      seesTasks
        ? prisma.project.findMany({
            where: mineOpen,
            orderBy: [{ endDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
            take: 6,
            select: {
              id: true,
              name: true,
              status: true,
              priority: true,
              endDate: true,
              client: { select: { name: true } },
            },
          })
        : none,
      seesTasks ? prisma.project.groupBy({ by: ['status'], _count: { _all: true } }) : none,
      seesTasks
        ? prisma.user.findMany({
            where: { role: { in: ['admin', 'staff'] }, isActive: true },
            select: {
              id: true,
              name: true,
              assignedProjects: { where: open, select: { endDate: true } },
            },
          })
        : none,
      seesTasks
        ? prisma.project.findMany({
            where: { ...open, endDate: { gte: today, lt: fortnightEnd } },
            orderBy: { endDate: 'asc' },
            take: 20,
            select: { id: true, name: true, endDate: true, client: { select: { name: true } } },
          })
        : none,
      seesTasks
        ? prisma.milestone.findMany({
            where: { date: { gte: today, lt: fortnightEnd }, project: { status: { not: 'complete' } } },
            orderBy: { date: 'asc' },
            take: 20,
            select: { id: true, title: true, date: true, project: { select: { id: true, name: true } } },
          })
        : none,

      prisma.meeting.findMany({
        where: { staffUserId: userId, date: { gte: today, lt: fortnightEnd } },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        take: 20,
        select: { id: true, date: true, startTime: true, clientName: true, serviceType: true },
      }),

      isAdmin ? prisma.ticket.count({ where: { status: { in: ['pending', 'in_progress'] } } }) : none,
      isAdmin ? prisma.ticket.count({ where: { createdAt: { gte: weekAgo } } }) : none,
      isAdmin ? prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }) : none,
      isAdmin ? prisma.ticket.findMany({ where: { createdAt: { gte: sixMonthsAgo } }, select: { createdAt: true } }) : none,
      isAdmin
        ? prisma.ticket.findMany({
            where: { status: 'pending' },
            orderBy: { createdAt: 'asc' },
            take: 3,
            select: { id: true, title: true, createdAt: true, user: { select: { name: true } } },
          })
        : none,
    ]);

    // ── KPI tiles ──
    const kpis: Kpi[] = [];
    const clientsTile: Kpi = {
      key: 'clients',
      label: 'Clients',
      value: totalClients,
      context: clientsThisMonth ? `+${clientsThisMonth} this month` : 'none added this month',
      href: '/staff/clients',
    };

    if (isSales) {
      kpis.push(
        {
          key: 'referred',
          label: 'My referred clients',
          value: referredClients?.length ?? 0,
          context: 'clients you introduced',
          href: '/staff/clients',
        },
        {
          key: 'totalClients',
          label: 'Total clients',
          value: totalClients,
          context: 'all clients in the system',
          href: '/staff/clients',
        },
        { key: 'commission', label: 'Commission rate', value: '10%', context: 'per referred client deal', href: '/staff/clients' }
      );
    } else {
      const done = doneThisMonth ?? 0;
      const last = doneLastMonth ?? 0;
      const diff = done - last;
      const doneTile: Kpi = {
        key: 'doneThisMonth',
        label: 'Done this month',
        value: done,
        context: diff === 0 ? 'same as last month' : `${diff > 0 ? '↑' : '↓'} ${Math.abs(diff)} vs last month`,
        trend: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
        href: '/staff/tasks?includeComplete=1',
      };
      const activeTile: Kpi = {
        key: 'activeTasks',
        label: 'Active tasks',
        value: activeTasks ?? 0,
        context: dueThisWeek ? `${dueThisWeek} due this week` : 'none due this week',
        href: '/staff/tasks',
      };

      if (isAdmin) {
        kpis.push(
          {
            key: 'openTickets',
            label: 'Open tickets',
            value: openTickets ?? 0,
            context: newTicketsThisWeek ? `${newTicketsThisWeek} new this week` : 'none new this week',
            href: '/admin/tickets',
          },
          activeTile,
          doneTile,
          clientsTile
        );
      } else {
        kpis.push(
          activeTile,
          {
            key: 'myOpenTasks',
            label: 'My open tasks',
            value: myOpenCount ?? 0,
            context: myOverdueCount ? `${myOverdueCount} overdue` : 'none overdue',
            href: '/staff/tasks?mine=1',
          },
          doneTile,
          clientsTile
        );
      }
    }

    // ── Pipeline (all five statuses, zero-filled, in order) ──
    const pipeline = pipelineGroups
      ? TASK_STATUSES.map((status) => ({
          status,
          count: pipelineGroups.find((g) => g.status === status)?._count._all ?? 0,
        }))
      : null;

    // ── Workload ──
    const workload = workloadUsers
      ? workloadUsers
          .map((u) => ({
            userId: u.id,
            name: u.name,
            open: u.assignedProjects.length,
            overdue: u.assignedProjects.filter((p) => p.endDate && p.endDate < today).length,
          }))
          .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name))
      : null;

    // ── Coming up (next 14 days) ──
    const comingUp: ComingUpItem[] = [
      ...(comingTasks ?? []).map((t): ComingUpItem => ({
        kind: 'task',
        id: t.id,
        date: t.endDate!.toISOString(),
        title: t.name,
        subtitle: `Task due · ${t.client.name}`,
        href: `/staff/tasks/${t.id}`,
      })),
      ...(comingMilestones ?? []).map((m): ComingUpItem => ({
        kind: 'milestone',
        id: m.id,
        date: m.date.toISOString(),
        title: m.title,
        subtitle: `Milestone · ${m.project.name}`,
        href: `/staff/tasks/${m.project.id}`,
      })),
      ...comingMeetings.map((m): ComingUpItem => ({
        kind: 'meeting',
        id: m.id,
        date: m.date.toISOString(),
        time: m.startTime ?? undefined,
        title: m.clientName,
        subtitle: `Meeting${m.startTime ? ` · ${m.startTime}` : ''} · ${m.serviceType}`,
        href: '/staff/meetings',
      })),
    ]
      .sort((a, b) => {
        const byDay = a.date.slice(0, 10).localeCompare(b.date.slice(0, 10));
        return byDay !== 0 ? byDay : (a.time ?? '').localeCompare(b.time ?? '');
      })
      .slice(0, 8);

    // ── Tickets (admin only) ──
    let tickets: DashboardOverview['tickets'] = null;
    if (isAdmin && ticketGroups && recentTicketDates && oldestPending) {
      // Build the 6 month buckets first, then fill them, so months with no
      // tickets still show up as zero.
      const buckets: Array<{ key: string; label: string; count: number }> = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        buckets.push({
          key: `${d.getFullYear()}-${d.getMonth()}`,
          label: d.toLocaleString('en-GB', { month: 'short' }),
          count: 0,
        });
      }
      for (const t of recentTicketDates) {
        const bucket = buckets.find((b) => b.key === `${t.createdAt.getFullYear()}-${t.createdAt.getMonth()}`);
        if (bucket) bucket.count += 1;
      }

      tickets = {
        byStatus: TICKET_STATUSES.map((status) => ({
          status,
          count: ticketGroups.find((g) => g.status === status)?._count._all ?? 0,
        })),
        monthly: buckets.map(({ label, count }) => ({ label, count })),
        oldestWaiting: oldestPending.map((t) => ({
          id: t.id,
          title: t.title,
          clientName: t.user.name,
          daysWaiting: Math.floor((now.getTime() - t.createdAt.getTime()) / DAY),
        })),
      };
    }

    const ticketsWaiting = tickets ? tickets.byStatus.find((s) => s.status === 'pending')?.count ?? 0 : null;

    const body: DashboardOverview = {
      role: role as DashboardOverview['role'],
      userName: me?.name ?? '',
      attention: isSales
        ? null
        : {
            overdueTasks: overdueTasks ?? 0,
            dueTodayTasks: dueTodayTasks ?? 0,
            ticketsWaiting,
          },
      kpis,
      myTasks: myTasks
        ? myTasks.map((t) => ({
            id: t.id,
            name: t.name,
            status: t.status,
            priority: t.priority,
            endDate: t.endDate,
            clientName: t.client.name,
          }))
        : null,
      myTasksTotal: seesTasks ? myOpenCount : null,
      comingUp,
      pipeline,
      workload,
      tickets,
      recentClients,
      referredClients: referredClients ?? null,
    };

    res.json(body);
  } catch (err) {
    next(err);
  }
}
