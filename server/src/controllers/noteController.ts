import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';

const noteInclude = {
  author: { select: { id: true, name: true } },
};

// GET /api/clients/:clientId/notes
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const clientId = parseInt(req.params.clientId);
    const notes = await prisma.note.findMany({
      where: { clientId },
      include: noteInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json(notes);
  } catch (err) {
    next(err);
  }
}

// POST /api/clients/:clientId/notes
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const clientId = parseInt(req.params.clientId);
    const { title, content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content is required' });

    const note = await prisma.note.create({
      data: {
        clientId,
        title: title?.trim() || null,
        content: content.trim(),
        createdBy: req.user?.userId ?? null,
      },
      include: noteInclude,
    });
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
}

// PUT /api/notes/:id
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const { title, content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content is required' });

    const note = await prisma.note.update({
      where: { id },
      data: { title: title?.trim() || null, content: content.trim() },
      include: noteInclude,
    });
    res.json(note);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Note not found' });
    next(err);
  }
}

// DELETE /api/notes/:id
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.note.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Note deleted' });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Note not found' });
    next(err);
  }
}
