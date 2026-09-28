import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(err);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof multer.MulterError) {
    const messages: Partial<Record<multer.ErrorCode, string>> = {
      LIMIT_FILE_SIZE: 'That file is too large',
      LIMIT_FILE_COUNT: 'Too many files in one upload',
      LIMIT_UNEXPECTED_FILE: 'Too many files in one upload',
    };
    res.status(400).json({ error: messages[err.code] || 'Upload failed' });
    return;
  }

  const code = (err as { code?: string }).code;

  // Postgres unique violation (raised directly, outside Prisma)
  if (code === '23505') {
    res.status(409).json({ error: 'A record with that value already exists' });
    return;
  }

  // Prisma known-request errors
  if (code === 'P2002') {
    res.status(409).json({ error: 'A record with that value already exists' });
    return;
  }
  if (code === 'P2025') {
    res.status(404).json({ error: 'Record not found' });
    return;
  }
  if (code === 'P2003') {
    res.status(409).json({ error: 'This is still linked to other records, so it can\'t be deleted yet' });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
