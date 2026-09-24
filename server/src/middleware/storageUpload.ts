import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { PRIVATE_UPLOAD_DIR } from '../config/paths';

const storageDir = path.join(PRIVATE_UPLOAD_DIR, 'storage');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(storageDir, { recursive: true });
    cb(null, storageDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['.txt', '.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.csv', '.xlsx', '.zip'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'));
  }
};

export const storageUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});
