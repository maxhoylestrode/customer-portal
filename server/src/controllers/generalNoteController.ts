import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';

const noteInclude = {
  author: { select: { id: true, name: true } },
};

// GET /api/general-notes — public notes + the current user's own private notes
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const notes = await prisma.generalNote.findMany({
      where: { OR: [{ isPrivate: false }, { isPrivate: true, createdBy: userId }] },
      include: noteInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json(notes);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, content, isPrivate } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content is required' });

    const note = await prisma.generalNote.create({
      data: {
        title: title?.trim() || null,
        content: content.trim(),
        isPrivate: Boolean(isPrivate),
        createdBy: req.user?.userId ?? null,
      },
      include: noteInclude,
    });
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user?.userId;
    const { title, content, isPrivate } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content is required' });

    const existing = await prisma.generalNote.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Note not found' });
    if (existing.createdBy !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorised to edit this note' });
    }

    const note = await prisma.generalNote.update({
      where: { id },
      data: { title: title?.trim() || null, content: content.trim(), isPrivate: Boolean(isPrivate) },
      include: noteInclude,
    });
    res.json(note);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Note not found' });
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user?.userId;

    const existing = await prisma.generalNote.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Note not found' });
    if (existing.createdBy !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorised to delete this note' });
    }

    await prisma.generalNote.delete({ where: { id } });
    res.json({ message: 'Note deleted' });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Note not found' });
    next(err);
  }
}
