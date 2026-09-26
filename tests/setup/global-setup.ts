import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/** Migrates the test database once, then wipes every table so each run starts clean. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL!;
  if (!/localhost|127\.0\.0\.1/.test(url) && !process.env.CI) {
    throw new Error(`Refusing to run tests against non-local database: ${url}`);
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
    const { rows } = await pool.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public'",
    );
    if (rows.length) {
      await pool.query(`truncate ${rows.map((r) => `"${r.tablename}"`).join(", ")} restart identity cascade`);
    }
  } finally {
    await pool.end();
  }
}
