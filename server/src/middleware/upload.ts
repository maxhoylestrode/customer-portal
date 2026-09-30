import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { decodeUploadName } from '../utils/files';
import { AppError } from './errorHandler';

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  file.originalname = decodeUploadName(file.originalname);
  const allowed = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];
  // Desktop browsers often send HEIC with a blank or generic type, so trust the extension for those
  const heic = ['.heic', '.heif'].includes(path.extname(file.originalname).toLowerCase());
  if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/hei') || heic) {
    cb(null, true);
  } else {
    cb(new AppError('File type not allowed. Accepted: photos and images (including iPhone HEIC), PDF, DOCX, TXT', 400));
  }
};

// In-memory: bytes go straight into Postgres (req.file.buffer), never to disk.
export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 5,
  },
});
