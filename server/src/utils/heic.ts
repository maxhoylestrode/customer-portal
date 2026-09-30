import { Request, Response, NextFunction } from 'express';
import { Worker } from 'worker_threads';
import path from 'path';

// iPhones save photos as HEIC, which Chrome/Edge/Firefox can't display, so
// they're converted to JPEG on upload. The decoder is synchronous WebAssembly
// (~4s for a 12MP photo), so it runs in a worker thread instead of freezing
// every other request. One worker, one photo at a time, keeps memory bounded.

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);
const HEIC_EXTS = new Set(['.heic', '.heif']);
const JOB_TIMEOUT_MS = 60_000;

export function isHeic(file: { originalname: string; mimetype: string; buffer: Buffer }): boolean {
  const buf = file.buffer;
  const brand = buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp' ? buf.toString('ascii', 8, 12) : '';
  if (HEIC_BRANDS.has(brand)) return true;
  return HEIC_EXTS.has(path.extname(file.originalname).toLowerCase()) || /^image\/hei[cf]/.test(file.mimetype);
}

const WORKER_SOURCE = `
const { parentPort } = require('worker_threads');
const convert = require(${JSON.stringify(require.resolve('heic-convert'))});
parentPort.on('message', async ({ id, buffer }) => {
  try {
    const out = Buffer.from(await convert({ buffer: Buffer.from(buffer), format: 'JPEG', quality: 0.85 }));
    parentPort.postMessage({ id, ok: true, data: out });
  } catch (err) {
    parentPort.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
});
`;

type Pending = { resolve: (b: Buffer) => void; reject: (e: Error) => void; timer: NodeJS.Timeout };
let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function failAll(err: Error) {
  for (const [id, p] of pending) {
    clearTimeout(p.timer);
    p.reject(err);
    pending.delete(id);
  }
  worker = null;
}

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(WORKER_SOURCE, { eval: true });
  w.on('message', ({ id, ok, data, error }: { id: number; ok: boolean; data?: Uint8Array; error?: string }) => {
    const p = pending.get(id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(id);
    if (ok && data) p.resolve(Buffer.from(data));
    else p.reject(new Error(error || 'HEIC conversion failed'));
  });
  w.on('error', (err) => failAll(err));
  w.on('exit', () => failAll(new Error('HEIC worker exited')));
  w.unref();
  worker = w;
  return w;
}

export function heicToJpeg(buffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('HEIC conversion timed out'));
      // A stuck decode would block every later job, so start a fresh worker
      worker?.terminate();
    }, JOB_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    getWorker().postMessage({ id, buffer });
  });
}

// Runs after multer. Converts any HEIC upload in place; if a photo can't be
// decoded it's kept as the original file (downloadable, just not previewable)
// rather than rejecting the client's upload.
export async function convertHeicUploads(req: Request, _res: Response, next: NextFunction) {
  const files: Express.Multer.File[] = [
    ...(req.file ? [req.file] : []),
    ...(Array.isArray(req.files) ? req.files : Object.values(req.files ?? {}).flat()),
  ];
  for (const file of files) {
    if (!isHeic(file)) continue;
    try {
      const jpeg = await heicToJpeg(file.buffer);
      const base = path.basename(file.originalname, path.extname(file.originalname));
      file.buffer = jpeg;
      file.size = jpeg.length;
      file.mimetype = 'image/jpeg';
      file.originalname = `${base}.jpg`;
    } catch (err) {
      console.error(`Could not convert HEIC "${file.originalname}", storing original:`, err);
    }
  }
  next();
}
