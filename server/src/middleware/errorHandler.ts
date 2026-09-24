import { Request, Response, NextFunction } from 'express';

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

  res.status(500).json({ error: 'Internal server error' });
}
