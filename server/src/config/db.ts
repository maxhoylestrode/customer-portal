import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

function buildPoolConfig() {
  const url = process.env.DATABASE_URL;

  // If a full URL with host is given (production / TCP), use it directly
  if (url && url.match(/postgresql?:\/\/[^/]+\//)) {
    return { connectionString: url, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false };
  }

  // Development: connect via Unix socket (avoids SCRAM auth on TCP)
  const dbName = url ? url.replace(/^postgresql?:\/\/\//, '') : 'apex_portal';
  return {
    host: process.env.PG_SOCKET_PATH || '/var/run/postgresql',
    database: dbName,
  };
}

const pool = new Pool(buildPoolConfig());

pool.on('error', (err) => {
  console.error('Unexpected error on idle db client', err);
  process.exit(-1);
});

export const query = (text: string, params?: unknown[]) => pool.query(text, params);
export default pool;
