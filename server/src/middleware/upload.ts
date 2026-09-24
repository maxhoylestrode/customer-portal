import multer from 'multer';
import { Request } from 'express';

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Accepted: images, PDF, DOCX, TXT'));
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
