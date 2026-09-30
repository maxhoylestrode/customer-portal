import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import contentDisposition from 'content-disposition';

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  // Only kept if conversion to JPEG failed; served as a download
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
};

const KNOWN_TYPES = new Set(Object.values(MIME_BY_EXT));

const INLINE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'application/pdf',
  'text/plain; charset=utf-8',
]);

// Blocks scripts even if a file is opened directly (e.g. an SVG). PDFs are
// exempt because Chrome's built-in viewer refuses to render in a sandbox.
const FILE_CSP = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; frame-ancestors 'self'; sandbox";

// Pre-migration ticket attachments were written to server/uploads with only
// their basename recorded; basename() keeps a crafted value from escaping it.
const LEGACY_UPLOAD_DIR = path.join(__dirname, '../../uploads');
export function legacyUploadPath(filepath: string): string {
  return path.join(LEGACY_UPLOAD_DIR, path.basename(filepath));
}

// Multer (busboy) decodes multipart filenames as latin1, which garbles any
// UTF-8 name — e.g. every macOS screenshot, which contains U+202F.
export function decodeUploadName(name: string): string {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? name : decoded;
}

// Never trust the uploader's claimed Content-Type: derive it from the
// extension, and only fall back to a stored type if it's one we recognise.
export function mimeFor(filename: string | null | undefined, storedType?: string | null): string {
  const ext = filename ? path.extname(filename).toLowerCase() : '';
  if (ext) return MIME_BY_EXT[ext] ?? 'application/octet-stream';
  if (storedType === 'text/plain') return 'text/plain; charset=utf-8';
  if (storedType && KNOWN_TYPES.has(storedType)) return storedType;
  return 'application/octet-stream';
}

export function sendStoredFile(
  res: Response,
  file: { data: Uint8Array; filename?: string | null; mimetype?: string | null },
  opts: { disposition?: 'inline' | 'attachment'; cacheControl?: string } = {}
): void {
  const type = mimeFor(file.filename, file.mimetype);
  const inline = (opts.disposition ?? 'inline') === 'inline' && INLINE_TYPES.has(type);

  res.setHeader('Content-Type', type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (type === 'application/pdf') res.removeHeader('Content-Security-Policy');
  else res.setHeader('Content-Security-Policy', FILE_CSP);
  res.setHeader('Cache-Control', opts.cacheControl ?? 'private, max-age=3600');
  if (file.filename) {
    res.setHeader('Content-Disposition', contentDisposition(file.filename, { type: inline ? 'inline' : 'attachment' }));
  } else if (!inline) {
    res.setHeader('Content-Disposition', 'attachment');
  }
  res.send(Buffer.from(file.data));
}

// Staff-portal files uploaded before storage moved into Postgres recorded a
// path relative to the server's working directory.
export function readLegacyFile(filepath: string): Buffer | null {
  const absolute = path.resolve(filepath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute) : null;
}
