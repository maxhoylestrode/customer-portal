import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { PRIVATE_UPLOAD_DIR } from '../config/paths';

const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    const clientDir = path.join(PRIVATE_UPLOAD_DIR, 'clients', String(req.params.id));
    fs.mkdirSync(clientDir, { recursive: true });
    cb(null, clientDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['.txt', '.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only .txt, .pdf, .docx, and image files are allowed'));
  }
};

export const clientFileUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});
