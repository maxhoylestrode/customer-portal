// NOTE: "Project" in the database/API is shown to users as a "Task".
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import { sendPushToUsers } from '../services/pushService';
import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  TASK_TYPES,
  STATUS_LABELS,
  PRIORITY_LABELS,
  formatDateGB,
} from '../constants/tasks';

// ── Includes ────────────────────────────────────────────────────────────────

// List view: keep it light. The front end counts done/total subtasks.
const listInclude = {
  client: { select: { id: true, name: true, company: true } },
  assignedUsers: { select: { id: true, name: true } },
  subtasks: { select: { id: true, isDone: true } },
} satisfies Prisma.ProjectInclude;

// Detail view
const detailInclude = {
  client: { select: { id: true, name: true, company: true } },
  assignedUsers: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true } },
  milestones: { orderBy: { date: 'asc' } },
  subtasks: {
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    include: { assignee: { select: { id: true, name: true } } },
  },
  updates: {
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { id: true, name: true } } },
  },
} satisfies Prisma.ProjectInclude;

// ── Helpers ─────────────────────────────────────────────────────────────────

// Returns the value if it's one of `allowed`, undefined if not supplied, or throws a 400.
function pick<T extends readonly string[]>(value: unknown, allowed: T, field: string): T[number] | undefined {
  if (value === undefined) return undefined;
  if (!allowed.includes(value as string)) throw new AppError(`Invalid ${field}`, 400);
  return value as T[number];
}

function idParam(value: string, what = 'id'): number {
  const n = parseInt(value, 10);
  if (!Number.isInteger(n)) throw new AppError(`Invalid ${what}`, 400);
  return n;
}

// undefined → not supplied (leave alone); null/'' → clear; otherwise a valid Date
function parseDate(value: unknown, field: string): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) throw new AppError(`Invalid ${field}`, 400);
  return d;
}

function clampProgress(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  const n = Math.round(Number(value));
  if (Number.isNaN(n)) throw new AppError('Invalid progress', 400);
  return Math.min(100, Math.max(0, n));
}

// Only active admin/staff accounts can be assigned (sales can't see tasks).
async function validateAssignees(value: unknown): Promise<number[] | undefined> {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new AppError('assignedUserIds must be a list', 400);
  const ids = Array.from(new Set(value.map((v) => parseInt(String(v), 10))));
  if (ids.some((n) => !Number.isInteger(n))) throw new AppError('Invalid assignee', 400);
  if (ids.length === 0) return [];
  const found = await prisma.user.count({
    where: { id: { in: ids }, role: { in: ['admin', 'staff'] }, isActive: true },
  });
  if (found !== ids.length) throw new AppError('Invalid assignee', 400);
  return ids;
}

function cleanName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) throw new AppError('Task name is required', 400);
  if (name.length > 255) throw new AppError('Task name is too long', 400);
  return name;
}

function parseMilestones(value: unknown): { title: string; date: Date }[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((m) => m && typeof m.title === 'string' && m.title.trim())
    .map((m) => {
      const date = parseDate(m.date, 'milestone date');
      if (!date) throw new AppError('Each milestone needs a date', 400);
      return { title: m.title.trim(), date };
    });
}

function startOfToday(): Date {
  // Dates are stored as UTC midnight; the server runs in UTC (CapRover), so
  // local midnight lines up with them.
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const dayKey = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

// ── Read ────────────────────────────────────────────────────────────────────

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { clientId, status, priority, taskType, assignedUserId, mine, q, includeComplete, overdue, dueToday } = req.query;
    const and: Prisma.ProjectWhereInput[] = [];

    if (clientId) and.push({ clientId: idParam(clientId as string, 'clientId') });
    if (status) {
      const statuses = (status as string).split(',').map((s) => s.trim()).filter(Boolean);
      and.push({ status: { in: statuses } });
    }
    if (includeComplete === '0') and.push({ status: { not: 'complete' } });
    if (priority) and.push({ priority: priority as string });
    if (taskType) and.push({ taskType: taskType as string });
    if (assignedUserId) and.push({ assignedUsers: { some: { id: idParam(assignedUserId as string, 'assignedUserId') } } });
    if (mine === '1') and.push({ assignedUsers: { some: { id: req.user!.userId } } });
    if (q) and.push({ name: { contains: String(q), mode: 'insensitive' } });

    if (overdue === '1') {
      and.push({ endDate: { lt: startOfToday() } }, { status: { not: 'complete' } });
    }
    if (dueToday === '1') {
      const today = startOfToday();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      and.push({ endDate: { gte: today, lt: tomorrow } }, { status: { not: 'complete' } });
    }

    const tasks = await prisma.project.findMany({
      where: and.length ? { AND: and } : {},
      include: listInclude,
      orderBy: [{ endDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    });

    res.json(tasks);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const task = await prisma.project.findUnique({
      where: { id: idParam(req.params.id) },
      include: detailInclude,
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
}

// ── Create ──────────────────────────────────────────────────────────────────

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const body = req.body;

    if (!body.clientId) throw new AppError('A client is required', 400);
    const clientId = idParam(String(body.clientId), 'clientId');
    const name = cleanName(body.name);

    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) throw new AppError('Client not found', 404);

    const status = pick(body.status, TASK_STATUSES, 'status') ?? 'to_do';
    const priority = pick(body.priority, TASK_PRIORITIES, 'priority') ?? 'normal';
    const taskType = pick(body.taskType, TASK_TYPES, 'task type') ?? 'other';
    const isComplete = status === 'complete';
    const progress = isComplete ? 100 : clampProgress(body.progress) ?? 0;
    const startDate = parseDate(body.startDate, 'start date') ?? null;
    const endDate = parseDate(body.endDate, 'due date') ?? null;
    const assigneeIds = (await validateAssignees(body.assignedUserIds)) ?? [];
    const milestones = parseMilestones(body.milestones);
    const description = typeof body.description === 'string' ? body.description.trim() || null : null;

    const task = await prisma.project.create({
      data: {
        clientId,
        name,
        description,
        status,
        priority,
        taskType,
        progress,
        startDate,
        endDate,
        completedAt: isComplete ? new Date() : null,
        createdById: userId,
        milestones: milestones.length ? { create: milestones } : undefined,
        assignedUsers: assigneeIds.length ? { connect: assigneeIds.map((id) => ({ id })) } : undefined,
        updates: { create: { userId, type: 'created', body: 'created this task' } },
      },
      include: detailInclude,
    });

    const toNotify = assigneeIds.filter((id) => id !== userId);
    if (toNotify.length) {
      sendPushToUsers(toNotify, {
        title: 'New task assigned',
        body: `${task.name} (${task.client.name})`,
        url: `/staff/tasks/${task.id}`,
      }).catch(() => {});
    }

    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
}

// ── Update ──────────────────────────────────────────────────────────────────

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = idParam(req.params.id);
    const body = req.body;

    const existing = await prisma.project.findUnique({
      where: { id },
      include: { assignedUsers: { select: { id: true, name: true } }, client: { select: { name: true } } },
    });
    if (!existing) throw new AppError('Task not found', 404);

    const status = pick(body.status, TASK_STATUSES, 'status');
    const priority = pick(body.priority, TASK_PRIORITIES, 'priority');
    const taskType = pick(body.taskType, TASK_TYPES, 'task type');
    const progressIn = clampProgress(body.progress);
    const startDate = parseDate(body.startDate, 'start date');
    const endDate = parseDate(body.endDate, 'due date');
    const assigneeIds = await validateAssignees(body.assignedUserIds);
    const milestones = body.milestones !== undefined ? parseMilestones(body.milestones) : undefined;

    const data: Prisma.ProjectUpdateInput = {};
    const log: { type: string; body: string }[] = [];

    if (body.name !== undefined) data.name = cleanName(body.name);
    if (body.description !== undefined) {
      data.description = typeof body.description === 'string' ? body.description.trim() || null : null;
    }
    if (taskType !== undefined) data.taskType = taskType;
    if (startDate !== undefined) data.startDate = startDate;
    if (endDate !== undefined) data.endDate = endDate;

    // Status (and the completed/progress side effects)
    let autoCompleted = false;
    let finalProgress = progressIn;
    if (status !== undefined && status !== existing.status) {
      data.status = status;
      log.push({
        type: 'status_changed',
        body: `changed status from ${STATUS_LABELS[existing.status] ?? existing.status} to ${STATUS_LABELS[status]}`,
      });
      if (status === 'complete') {
        data.completedAt = new Date();
        finalProgress = 100;
        autoCompleted = true;
      } else if (existing.status === 'complete') {
        data.completedAt = null;
      }
    }

    if (priority !== undefined && priority !== existing.priority) {
      data.priority = priority;
      log.push({ type: 'priority_changed', body: `set priority to ${PRIORITY_LABELS[priority]}` });
    }

    if (finalProgress !== undefined && finalProgress !== existing.progress) {
      data.progress = finalProgress;
      // Only log meaningful jumps so dragging the slider doesn't flood the feed
      const big = Math.abs(finalProgress - existing.progress) >= 10 || finalProgress === 100;
      if (big && !autoCompleted) {
        log.push({ type: 'progress_changed', body: `updated progress to ${finalProgress}%` });
      }
    }

    if (endDate !== undefined && dayKey(endDate) !== dayKey(existing.endDate)) {
      log.push({
        type: 'due_date_changed',
        body: endDate ? `changed due date to ${formatDateGB(endDate)}` : 'removed the due date',
      });
    }

    // Assignees
    let addedIds: number[] = [];
    if (assigneeIds !== undefined) {
      const oldIds = existing.assignedUsers.map((u) => u.id);
      addedIds = assigneeIds.filter((n) => !oldIds.includes(n));
      const removed = existing.assignedUsers.filter((u) => !assigneeIds.includes(u.id));
      data.assignedUsers = { set: assigneeIds.map((n) => ({ id: n })) };
      if (addedIds.length) {
        const added = await prisma.user.findMany({ where: { id: { in: addedIds } }, select: { name: true } });
        log.push({ type: 'assignees_changed', body: `assigned ${added.map((u) => u.name).join(', ')}` });
      }
      if (removed.length) {
        log.push({ type: 'assignees_changed', body: `unassigned ${removed.map((u) => u.name).join(', ')}` });
      }
    }

    const task = await prisma.$transaction(async (tx) => {
      await tx.project.update({ where: { id }, data });

      if (milestones !== undefined) {
        await tx.milestone.deleteMany({ where: { projectId: id } });
        if (milestones.length) {
          await tx.milestone.createMany({ data: milestones.map((m) => ({ projectId: id, ...m })) });
        }
      }

      if (log.length) {
        await tx.taskUpdate.createMany({ data: log.map((l) => ({ projectId: id, userId, ...l })) });
      }

      return tx.project.findUniqueOrThrow({ where: { id }, include: detailInclude });
    });

    const toNotify = addedIds.filter((n) => n !== userId);
    if (toNotify.length) {
      sendPushToUsers(toNotify, {
        title: 'New task assigned',
        body: `${task.name} (${existing.client.name})`,
        url: `/staff/tasks/${id}`,
      }).catch(() => {});
    }

    res.json(task);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Task not found' });
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.project.delete({ where: { id: idParam(req.params.id) } });
    res.json({ message: 'Task deleted' });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Task not found' });
    next(err);
  }
}

// ── Updates feed (comments) ─────────────────────────────────────────────────

export async function addUpdate(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.user!;
    const id = idParam(req.params.id);
    const text = typeof req.body.body === 'string' ? req.body.body.trim() : '';
    if (!text) throw new AppError('Write something before posting', 400);
    if (text.length > 5000) throw new AppError('Update is too long (max 5,000 characters)', 400);

    const task = await prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true, assignedUsers: { select: { id: true } } },
    });
    if (!task) throw new AppError('Task not found', 404);

    const created = await prisma.taskUpdate.create({
      data: { projectId: id, userId, type: 'comment', body: text },
      include: { user: { select: { id: true, name: true } } },
    });

    const toNotify = task.assignedUsers.map((u) => u.id).filter((n) => n !== userId);
    if (toNotify.length) {
      const preview = text.length > 100 ? `${text.slice(0, 100)}…` : text;
      sendPushToUsers(toNotify, {
        title: `${created.user?.name ?? 'Someone'} updated "${task.name}"`,
        body: preview,
        url: `/staff/tasks/${id}`,
      }).catch(() => {});
    }

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

export async function removeUpdate(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    const id = idParam(req.params.id);
    const updateId = idParam(req.params.updateId, 'update id');

    const found = await prisma.taskUpdate.findFirst({ where: { id: updateId, projectId: id } });
    if (!found) throw new AppError('Update not found', 404);
    if (found.type !== 'comment') throw new AppError('Only comments can be deleted', 403);
    if (found.userId !== userId && role !== 'admin') throw new AppError('You can only delete your own comments', 403);

    await prisma.taskUpdate.delete({ where: { id: updateId } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ── Subtasks ────────────────────────────────────────────────────────────────

const subtaskInclude = { assignee: { select: { id: true, name: true } } } satisfies Prisma.SubtaskInclude;

async function validateSubtaskAssignee(value: unknown): Promise<number | null | undefined> {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const ids = await validateAssignees([value]);
  return ids![0];
}

export async function addSubtask(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.user!;
    const id = idParam(req.params.id);
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    if (!title) throw new AppError('Subtask title is required', 400);
    if (title.length > 255) throw new AppError('Subtask title is too long', 400);

    const exists = await prisma.project.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new AppError('Task not found', 404);

    const assigneeId = (await validateSubtaskAssignee(req.body.assigneeId)) ?? null;
    const dueDate = parseDate(req.body.dueDate, 'due date') ?? null;

    const last = await prisma.subtask.aggregate({ where: { projectId: id }, _max: { position: true } });
    const position = (last._max.position ?? -1) + 1;

    const [subtask] = await prisma.$transaction([
      prisma.subtask.create({
        data: { projectId: id, title, assigneeId, dueDate, position },
        include: subtaskInclude,
      }),
      prisma.taskUpdate.create({
        data: { projectId: id, userId, type: 'subtask_added', body: `added subtask "${title}"` },
      }),
    ]);

    res.status(201).json(subtask);
  } catch (err) {
    next(err);
  }
}

export async function updateSubtask(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.user!;
    const id = idParam(req.params.id);
    const subtaskId = idParam(req.params.subtaskId, 'subtask id');

    const existing = await prisma.subtask.findFirst({ where: { id: subtaskId, projectId: id } });
    if (!existing) throw new AppError('Subtask not found', 404);

    const data: Prisma.SubtaskUncheckedUpdateInput = {};
    if (req.body.title !== undefined) {
      const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
      if (!title) throw new AppError('Subtask title is required', 400);
      if (title.length > 255) throw new AppError('Subtask title is too long', 400);
      data.title = title;
    }
    const assigneeId = await validateSubtaskAssignee(req.body.assigneeId);
    if (assigneeId !== undefined) data.assigneeId = assigneeId;
    const dueDate = parseDate(req.body.dueDate, 'due date');
    if (dueDate !== undefined) data.dueDate = dueDate;
    if (req.body.position !== undefined) {
      const position = parseInt(String(req.body.position), 10);
      if (!Number.isInteger(position)) throw new AppError('Invalid position', 400);
      data.position = position;
    }

    let completedNow = false;
    if (req.body.isDone !== undefined) {
      const isDone = Boolean(req.body.isDone);
      data.isDone = isDone;
      if (isDone && !existing.isDone) {
        data.completedAt = new Date();
        completedNow = true;
      } else if (!isDone && existing.isDone) {
        data.completedAt = null;
      }
    }

    const subtask = await prisma.subtask.update({ where: { id: subtaskId }, data, include: subtaskInclude });

    if (completedNow) {
      await prisma.taskUpdate.create({
        data: { projectId: id, userId, type: 'subtask_completed', body: `completed subtask "${subtask.title}"` },
      });
    }

    res.json(subtask);
  } catch (err) {
    next(err);
  }
}

export async function removeSubtask(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idParam(req.params.id);
    const subtaskId = idParam(req.params.subtaskId, 'subtask id');

    const existing = await prisma.subtask.findFirst({ where: { id: subtaskId, projectId: id }, select: { id: true } });
    if (!existing) throw new AppError('Subtask not found', 404);

    await prisma.subtask.delete({ where: { id: subtaskId } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
