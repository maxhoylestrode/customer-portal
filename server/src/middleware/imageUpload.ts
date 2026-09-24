import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { UPLOAD_DIR } from '../config/paths';

// Client avatars: stored publicly at uploads/avatars/{clientId}.<ext>
const avatarDir = path.join(UPLOAD_DIR, 'avatars');
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(avatarDir, { recursive: true });
    cb(null, avatarDir);
  },
  filename: (req: Request, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.params.id}${ext}`);
  },
});

// Portal logo: stored at uploads/logo/logo.<ext>
const logoDir = path.join(UPLOAD_DIR, 'logo');
const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(logoDir, { recursive: true });
    cb(null, logoDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo${ext}`);
  },
});

const imageFileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.ico', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (.jpg, .png, .webp, .svg, .gif, .ico)'));
  }
};

export const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

export const logoUpload = multer({
  storage: logoStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});
