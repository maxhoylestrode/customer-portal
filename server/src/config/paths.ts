import path from 'path';
import fs from 'fs';

// Publicly (statically) served — ticket attachments, avatars, portal logo.
// Nothing access-controlled may live under here.
export const UPLOAD_DIR = path.join(__dirname, '../../uploads');

// Never statically mounted — client documents and internal storage files,
// served only through authenticated/permission-checked controller routes.
export const PRIVATE_UPLOAD_DIR = path.join(__dirname, '../../private-uploads');

for (const dir of [UPLOAD_DIR, PRIVATE_UPLOAD_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
