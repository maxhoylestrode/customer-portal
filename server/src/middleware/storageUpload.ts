import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { decodeUploadName } from '../utils/files';
import { AppError } from './errorHandler';

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  file.originalname = decodeUploadName(file.originalname);
  const allowed = ['.txt', '.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.heic', '.heif', '.csv', '.xlsx', '.zip'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new AppError('File type not allowed', 400));
  }
};

// In-memory: bytes go straight into Postgres (req.file.buffer), never to disk.
export const storageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});
