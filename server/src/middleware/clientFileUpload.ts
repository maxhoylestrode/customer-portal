import multer from 'multer';
import path from 'path';
import { Request } from 'express';

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['.txt', '.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only .txt, .pdf, .docx, and image files are allowed'));
  }
};

// In-memory: bytes go straight into Postgres (req.file.buffer), never to disk.
export const clientFileUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});
