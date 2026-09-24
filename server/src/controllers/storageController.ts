import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

// Visibility rules:
//   - admins see everything
//   - uploaders always see their own files
//   - shareMode 'everyone' → visible to all
//   - shareMode 'specific' → visible to users in accessList
//   - shareMode 'none'     → only uploader / admin
function visibilityWhere(userId: number, role: string): Prisma.StorageFileWhereInput {
  if (role === 'admin') return {};
  return {
    OR: [
      { uploadedBy: userId },
      { shareMode: 'everyone' },
      { shareMode: 'specific', accessList: { some: { userId } } },
    ],
  };
}

// Excludes `data` (the file bytes) — used for list/upload/permissions
// responses so the blob is never pulled into a JSON payload.
const fileSafeSelect = {
  id: true,
  filename: true,
  mimetype: true,
  size: true,
  folder: true,
  shareMode: true,
  uploadedBy: true,
  uploadedAt: true,
  uploader: { select: { id: true, name: true } },
  accessList: { select: { id: true, userId: true, user: { select: { id: true, name: true } } } },
} satisfies Prisma.StorageFileSelect;

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { search, folder, sort = 'date', dir = 'desc' } = req.query;

    const visWhere = visibilityWhere(req.user!.userId, req.user!.role);
    const where: Prisma.StorageFileWhereInput = { AND: [visWhere] };

    if (search) {
      (where.AND as Prisma.StorageFileWhereInput[]).push({ filename: { contains: search as string, mode: 'insensitive' } });
    }
    if (folder) {
      (where.AND as Prisma.StorageFileWhereInput[]).push({ folder: folder as string });
    }

    const orderByMap: Record<string, Prisma.StorageFileOrderByWithRelationInput> = {
      date: { uploadedAt: dir as Prisma.SortOrder },
      name: { filename: dir as Prisma.SortOrder },
      size: { size: dir as Prisma.SortOrder },
    };
    const orderBy = orderByMap[sort as string] || { uploadedAt: 'desc' };

    const files = await prisma.storageFile.findMany({ where, select: fileSafeSelect, orderBy });
    res.json(files);
  } catch (err) {
    next(err);
  }
}

export async function folders(req: Request, res: Response, next: NextFunction) {
  try {
    const visWhere = visibilityWhere(req.user!.userId, req.user!.role);
    const result = await prisma.storageFile.findMany({
      where: visWhere,
      select: { folder: true },
      distinct: ['folder'],
      orderBy: { folder: 'asc' },
    });
    res.json(result.map((r) => r.folder));
  } catch (err) {
    next(err);
  }
}

export async function upload(req: Request, res: Response, next: NextFunction) {
  try {
    const rawFiles = (req.files as Express.Multer.File[] | undefined)?.length
      ? (req.files as Express.Multer.File[])
      : req.file
      ? [req.file]
      : [];
    if (!rawFiles.length) return res.status(400).json({ error: 'No files uploaded' });

    const folder = (req.body.folder as string)?.trim() || 'General';
    const shareMode = ['none', 'everyone', 'specific'].includes(req.body.shareMode) ? req.body.shareMode : 'everyone';

    let specificUserIds: number[] = [];
    if (shareMode === 'specific' && req.body.userIds) {
      try {
        specificUserIds = JSON.parse(req.body.userIds).map(Number).filter(Boolean);
      } catch {
        specificUserIds = [];
      }
    }

    const created = await Promise.all(
      rawFiles.map((f) =>
        prisma.storageFile.create({
          data: {
            filename: f.originalname,
            filepath: f.originalname,
            data: Buffer.from(f.buffer),
            mimetype: f.mimetype,
            size: f.size,
            folder,
            shareMode,
            uploadedBy: req.user!.userId,
            ...(shareMode === 'specific' && specificUserIds.length
              ? { accessList: { create: specificUserIds.map((uid) => ({ userId: uid })) } }
              : {}),
          },
          select: fileSafeSelect,
        })
      )
    );

    res.status(201).json(created.length === 1 ? created[0] : created);
  } catch (err) {
    next(err);
  }
}

export async function setPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const fileId = parseInt(req.params.fileId);
    const file = await prisma.storageFile.findUnique({ where: { id: fileId } });
    if (!file) return res.status(404).json({ error: 'File not found' });

    if (file.uploadedBy !== req.user!.userId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only the uploader or an admin can change permissions' });
    }

    const { shareMode, userIds = [] } = req.body;
    if (!['none', 'everyone', 'specific'].includes(shareMode)) {
      return res.status(400).json({ error: 'shareMode must be "none", "everyone", or "specific"' });
    }

    const parsedIds: number[] = Array.isArray(userIds) ? userIds.map(Number).filter(Boolean) : [];

    await prisma.$transaction(async (tx) => {
      await tx.storageFile.update({ where: { id: fileId }, data: { shareMode } });
      await tx.storageFileAccess.deleteMany({ where: { fileId } });
      if (shareMode === 'specific' && parsedIds.length) {
        await tx.storageFileAccess.createMany({
          data: parsedIds.map((uid) => ({ fileId, userId: uid })),
          skipDuplicates: true,
        });
      }
    });

    const updated = await prisma.storageFile.findUnique({ where: { id: fileId }, select: fileSafeSelect });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

function canSeeFile(
  file: { uploadedBy: number; shareMode: string; accessList: { userId: number }[] },
  userId: number,
  role: string
) {
  return (
    role === 'admin' ||
    file.uploadedBy === userId ||
    file.shareMode === 'everyone' ||
    (file.shareMode === 'specific' && file.accessList.some((a) => a.userId === userId))
  );
}

export async function download(req: Request, res: Response, next: NextFunction) {
  try {
    const file = await prisma.storageFile.findUnique({
      where: { id: parseInt(req.params.fileId) },
      include: { accessList: true },
    });
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (!canSeeFile(file, req.user!.userId, req.user!.role)) return res.status(403).json({ error: 'Access denied' });

    if (file.data) {
      res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
      res.send(Buffer.from(file.data));
      return;
    }

    const absolute = path.resolve(file.filepath);
    if (!fs.existsSync(absolute)) return res.status(404).json({ error: 'File not found on disk' });
    res.download(absolute, file.filename);
  } catch (err) {
    next(err);
  }
}

export async function view(req: Request, res: Response, next: NextFunction) {
  try {
    const file = await prisma.storageFile.findUnique({
      where: { id: parseInt(req.params.fileId) },
      include: { accessList: true },
    });
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (!canSeeFile(file, req.user!.userId, req.user!.role)) return res.status(403).json({ error: 'Access denied' });

    const mime = file.mimetype || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    if (file.data) {
      res.send(Buffer.from(file.data));
      return;
    }

    const absolute = path.resolve(file.filepath);
    if (!fs.existsSync(absolute)) return res.status(404).json({ error: 'File not found on disk' });
    fs.createReadStream(absolute).pipe(res);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const file = await prisma.storageFile.findUnique({ where: { id: parseInt(req.params.fileId) } });
    if (!file) return res.status(404).json({ error: 'File not found' });

    if (file.uploadedBy !== req.user!.userId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only the uploader or an admin can delete this file' });
    }

    if (!file.data) {
      // Pre-migration file — clean up its on-disk copy too
      const absolute = path.resolve(file.filepath);
      if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
    }

    await prisma.storageFile.delete({ where: { id: file.id } });
    res.json({ message: 'File deleted' });
  } catch (err) {
    next(err);
  }
}
