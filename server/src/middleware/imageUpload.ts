import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { decodeUploadName } from '../utils/files';
import { AppError } from './errorHandler';

const imageFileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  file.originalname = decodeUploadName(file.originalname);
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.ico', '.gif', '.heic', '.heif'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new AppError('Only image files are allowed (.jpg, .png, .webp, .svg, .gif, .ico)', 400));
  }
};

// In-memory: bytes go straight into Postgres (req.file.buffer), never to disk.
export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

export const logoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});
