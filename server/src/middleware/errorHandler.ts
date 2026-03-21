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

  // Postgres unique violation
  if ((err as NodeJS.ErrnoException).code === '23505') {
    res.status(409).json({ error: 'A record with that value already exists' });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
