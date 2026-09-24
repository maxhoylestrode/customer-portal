import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../config/prisma';

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
        filepath: req.file.path,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
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

    const absolute = path.resolve(file.filepath);
    if (!fs.existsSync(absolute)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.download(absolute, file.filename);
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

    const absolute = path.resolve(file.filepath);
    if (!fs.existsSync(absolute)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    const mime = file.mimetype || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    fs.createReadStream(absolute).pipe(res);
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

    const absolute = path.resolve(file.filepath);
    if (fs.existsSync(absolute)) {
      fs.unlinkSync(absolute);
    }

    await prisma.file.delete({ where: { id: file.id } });
    res.json({ message: 'File deleted' });
  } catch (err) {
    next(err);
  }
}
