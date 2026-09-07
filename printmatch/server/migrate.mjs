import { readFile } from 'node:fs/promises';
import { readConfig } from './config.mjs';

async function migrate() {
  const config=readConfig();
  if (!config.database) throw new Error('DATABASE_URL is required');
  const {default:pg}=await import('pg');
  const pool=new pg.Pool(config.database);
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('polypod:initial-schema'))");
    await client.query(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
    await client.query('COMMIT');
    console.info('Poly Pod Pro schema migration completed; no accounts or sample orders were created.');
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release();await pool.end(); }
}
migrate().catch(()=>{
  console.error('Migration failed. Check the database configuration, permissions and server dependencies.');
  process.exitCode=1;
});

