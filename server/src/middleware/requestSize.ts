import { Request, Response, NextFunction } from 'express';

// Multer buffers uploads in memory, so bound each request's total size before
// it reads anything; per-file limits alone still let one request hold several
// hundred MB. Browsers (and CapRover's nginx) always send Content-Length for
// uploads, so a request without one is refused rather than read unbounded.
export function maxRequestSize(maxMb: number) {
  const max = maxMb * 1024 * 1024;
  return (req: Request, res: Response, next: NextFunction): void => {
    const length = Number(req.headers['content-length']);
    if (!Number.isFinite(length)) {
      res.status(411).json({ error: 'Upload size missing' });
      return;
    }
    if (length > max) {
      // Discard the body without keeping it, and only answer once it has all
      // arrived: replying mid-upload makes browsers report a network error
      // instead of showing this message.
      const reply = () => {
        if (!res.headersSent) res.status(413).json({ error: `Uploads are limited to ${maxMb}MB in total at a time` });
      };
      req.on('end', reply);
      req.on('error', () => res.destroy());
      req.resume();
      return;
    }
    next();
  };
}
