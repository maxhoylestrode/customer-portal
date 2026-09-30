import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../config/prisma';
import { sendStoredFile, readLegacyFile } from '../utils/files';

export async function upload(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const clientId = parseInt(req.params.id);
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const file = await prisma.file.create({
      data: {
        clientId,
        filename: req.file.originalname,
        filepath: req.file.originalname,
        data: Buffer.from(req.file.buffer),
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
      select: { id: true, clientId: true, filename: true, mimetype: true, size: true, uploadedAt: true },
    });

    res.status(201).json(file);
  } catch (err) {
    next(err);
  }
}

export async function download(req: Request, res: Response, next: NextFunction) {
  try {
    const file = await prisma.file.findUnique({
      where: { id: parseInt(req.params.fileId) },
    });

    if (!file) return res.status(404).json({ error: 'File not found' });

    const data = file.data ?? readLegacyFile(file.filepath);
    if (!data) return res.status(404).json({ error: 'File not found' });
    sendStoredFile(res, { data, filename: file.filename, mimetype: file.mimetype }, { disposition: 'attachment' });
  } catch (err) {
    next(err);
  }
}

// Serve file inline so the browser can render it (e.g. PDF preview)
export async function view(req: Request, res: Response, next: NextFunction) {
  try {
    const file = await prisma.file.findUnique({
      where: { id: parseInt(req.params.fileId) },
    });

    if (!file) return res.status(404).json({ error: 'File not found' });

    const data = file.data ?? readLegacyFile(file.filepath);
    if (!data) return res.status(404).json({ error: 'File not found' });
    sendStoredFile(res, { data, filename: file.filename, mimetype: file.mimetype });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const file = await prisma.file.findUnique({
      where: { id: parseInt(req.params.fileId) },
    });

    if (!file) return res.status(404).json({ error: 'File not found' });

    if (!file.data) {
      // Pre-migration file — clean up its on-disk copy too
      const absolute = path.resolve(file.filepath);
      if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
    }

    await prisma.file.delete({ where: { id: file.id } });
    res.json({ message: 'File deleted' });
  } catch (err) {
    next(err);
  }
}
