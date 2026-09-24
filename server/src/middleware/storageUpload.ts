import multer from 'multer';
import path from 'path';
import { Request } from 'express';

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['.txt', '.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.csv', '.xlsx', '.zip'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'));
  }
};

// In-memory: bytes go straight into Postgres (req.file.buffer), never to disk.
export const storageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});
