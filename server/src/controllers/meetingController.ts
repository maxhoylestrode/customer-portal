import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

function toUtcMidnight(dateInput: string | Date): Date {
  const d = new Date(dateInput);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isValidTime(t: string): boolean {
  return /^\d{2}:\d{2}$/.test(t);
}

function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const next = (h + 1) % 24;
  return `${String(next).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─── Available Slots ─────────────────────────────────────────────────────

// GET /api/meetings/available-slots?month=YYYY-MM  or  ?date=YYYY-MM-DD
export async function listAvailableSlots(req: Request, res: Response, next: NextFunction) {
  try {
    const { month, date } = req.query;
    const where: Prisma.AvailableSlotWhereInput = {};

    if (date) {
      where.date = toUtcMidnight(date as string);
    } else if (month) {
      const [year, mon] = (month as string).split('-').map(Number);
      const start = new Date(Date.UTC(year, mon - 1, 1));
      const end = new Date(Date.UTC(year, mon, 1));
      where.date = { gte: start, lt: end };
    }

    const slots = await prisma.availableSlot.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, role: true } },
        meeting: { select: { id: true, clientName: true, serviceType: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    res.json(slots);
  } catch (err) {
    next(err);
  }
}

// POST /api/meetings/available-slots — staff/admin add a time slot
export async function addAvailableSlot(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role === 'sales') {
      return res.status(403).json({ error: 'Sales team cannot manage availability' });
    }

    const { date, startTime } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required' });
    if (!startTime) return res.status(400).json({ error: 'startTime is required' });
    if (!isValidTime(startTime)) return res.status(400).json({ error: 'startTime must be "HH:MM"' });

    const normalised = toUtcMidnight(date);
    const endTime = addOneHour(startTime);

    const slot = await prisma.availableSlot.upsert({
      where: { userId_date_startTime: { userId: req.user!.userId, date: normalised, startTime } },
      create: { userId: req.user!.userId, date: normalised, startTime, endTime },
      update: {},
      include: {
        user: { select: { id: true, name: true, role: true } },
        meeting: { select: { id: true, clientName: true, serviceType: true } },
      },
    });

    res.status(201).json(slot);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/meetings/available-slots/:id
export async function removeAvailableSlot(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role === 'sales') {
      return res.status(403).json({ error: 'Sales team cannot manage availability' });
    }

    const id = parseInt(req.params.id);
    const existing = await prisma.availableSlot.findUnique({ where: { id }, include: { meeting: true } });
    if (!existing) return res.status(404).json({ error: 'Slot not found' });

    if (existing.userId !== req.user!.userId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'You can only remove your own slots' });
    }
    if (existing.meeting) {
      return res.status(409).json({ error: 'Cannot remove a slot that already has a meeting booked' });
    }

    await prisma.availableSlot.delete({ where: { id } });
    res.json({ message: 'Slot removed' });
  } catch (err) {
    next(err);
  }
}

// ─── Meetings ─────────────────────────────────────────────────────────────

const meetingInclude = {
  staffUser: { select: { id: true, name: true, role: true } },
  bookedBy: { select: { id: true, name: true } },
  slot: { select: { id: true, startTime: true, endTime: true } },
};

// GET /api/meetings?month=YYYY-MM
export async function listMeetings(req: Request, res: Response, next: NextFunction) {
  try {
    const { month } = req.query;
    const where: Prisma.MeetingWhereInput = {};
    if (month) {
      const [year, mon] = (month as string).split('-').map(Number);
      const start = new Date(Date.UTC(year, mon - 1, 1));
      const end = new Date(Date.UTC(year, mon, 1));
      where.date = { gte: start, lt: end };
    }
    const meetings = await prisma.meeting.findMany({
      where,
      include: meetingInclude,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    res.json(meetings);
  } catch (err) {
    next(err);
  }
}

// POST /api/meetings — book a meeting on a specific slot
export async function createMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const { slotId, clientName, clientPhone, clientEmail, notes, serviceType } = req.body;

    if (!slotId) return res.status(400).json({ error: 'slotId is required' });
    if (!clientName?.trim()) return res.status(400).json({ error: 'clientName is required' });
    if (!serviceType) return res.status(400).json({ error: 'serviceType is required' });
    if (!['Websites', 'Cyber Essentials'].includes(serviceType)) {
      return res.status(400).json({ error: 'serviceType must be "Websites" or "Cyber Essentials"' });
    }

    const slot = await prisma.availableSlot.findUnique({
      where: { id: parseInt(slotId) },
      include: { meeting: true },
    });
    if (!slot) return res.status(404).json({ error: 'Time slot not found' });
    if (slot.meeting) return res.status(409).json({ error: 'This time slot is already booked' });

    const meeting = await prisma.meeting.create({
      data: {
        staffUserId: slot.userId,
        slotId: slot.id,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        clientName: clientName.trim(),
        clientPhone: clientPhone?.trim() || null,
        clientEmail: clientEmail?.trim() || null,
        notes: notes?.trim() || null,
        serviceType,
        createdBy: req.user?.userId ?? null,
      },
      include: meetingInclude,
    });

    res.status(201).json(meeting);
  } catch (err) {
    next(err);
  }
}

// PUT /api/meetings/:id (client details only, not time/staff)
export async function updateMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const { clientName, clientPhone, clientEmail, notes, serviceType } = req.body;

    if (serviceType && !['Websites', 'Cyber Essentials'].includes(serviceType)) {
      return res.status(400).json({ error: 'serviceType must be "Websites" or "Cyber Essentials"' });
    }

    const existing = await prisma.meeting.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Meeting not found' });

    if (existing.createdBy !== req.user!.userId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'You can only edit meetings you booked' });
    }

    const meeting = await prisma.meeting.update({
      where: { id },
      data: {
        ...(clientName ? { clientName: clientName.trim() } : {}),
        ...(clientPhone !== undefined ? { clientPhone: clientPhone?.trim() || null } : {}),
        ...(clientEmail !== undefined ? { clientEmail: clientEmail?.trim() || null } : {}),
        ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
        ...(serviceType ? { serviceType } : {}),
      },
      include: meetingInclude,
    });
    res.json(meeting);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Meeting not found' });
    next(err);
  }
}

// DELETE /api/meetings/:id
export async function deleteMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.meeting.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Meeting not found' });

    if (existing.createdBy !== req.user!.userId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'You can only delete meetings you booked' });
    }
    await prisma.meeting.delete({ where: { id } });
    res.json({ message: 'Meeting deleted' });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Meeting not found' });
    next(err);
  }
}
