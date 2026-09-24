import multer from 'multer';
import path from 'path';
import { Request } from 'express';

const imageFileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.ico', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (.jpg, .png, .webp, .svg, .gif, .ico)'));
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
