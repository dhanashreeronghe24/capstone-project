/**
 * Starts a throwaway local PostgreSQL (no Docker / system install needed) for development and tests.
 * Usage: npx ts-node scripts/dev-db.ts   (keeps running until Ctrl+C)
 * Data lives in ./.pgdata and listens on port 5432 with postgres/postgres and DB bookworm_db.
 */
import fs from 'fs';
import path from 'path';
import EmbeddedPostgres from 'embedded-postgres';

async function main(): Promise<void> {
  const dataDir = path.resolve(__dirname, '..', '.pgdata');
  const fresh = !fs.existsSync(path.join(dataDir, 'PG_VERSION'));
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port: 5432,
    persistent: true,
  });
  if (fresh) await pg.initialise();
  await pg.start();
  if (fresh) await pg.createDatabase('bookworm_db');
  console.log('PostgreSQL ready on postgresql://postgres:postgres@localhost:5432/bookworm_db');

  const stop = async (): Promise<void> => {
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  setInterval(() => undefined, 1 << 30);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
