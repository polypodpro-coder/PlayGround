import { readFile } from 'node:fs/promises';
import { readConfig } from './config.mjs';

// Decide which schema files to apply, in order. schema.sql is always required.
// creations.sql is the separate, opt-in private-sharing schema: it is applied
// only when explicitly requested with --with-creations or CREATION_SHARING_ENABLED=true,
// preserving the deliberate separation documented in docs/BACKEND-SETUP.md.
export function planMigration(argv = [], env = {}) {
  const steps = [{ file: './schema.sql', lock: 'polypod:initial-schema' }];
  const wantsCreations = argv.includes('--with-creations') || env.CREATION_SHARING_ENABLED === 'true';
  if (wantsCreations) steps.push({ file: './creations.sql', lock: 'polypod:creations-schema' });
  return steps;
}

async function migrate() {
  const config=readConfig();
  if (!config.database) throw new Error('DATABASE_URL is required');
  const steps=planMigration(process.argv.slice(2),process.env);
  const {default:pg}=await import('pg');
  const pool=new pg.Pool(config.database);
  const client=await pool.connect();
  try {
    for (const step of steps) {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[step.lock]);
      await client.query(await readFile(new URL(step.file,import.meta.url),'utf8'));
      await client.query('COMMIT');
    }
    const applied=steps.map(step=>step.file.replace('./','')).join(', ');
    console.info(`Poly Pod Pro schema migration completed (${applied}); no accounts or sample orders were created.`);
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release();await pool.end(); }
}

// Only run when invoked directly, so the planner can be unit-tested without a database.
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().catch(()=>{
    console.error('Migration failed. Check the database configuration, permissions and server dependencies.');
    process.exitCode=1;
  });
}
