/**
 * Migration Runner
 * Executes all SQL migration files in order against the PostgreSQL database.
 *
 * Usage: node migrations/run.js
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

const MIGRATIONS_DIR = path.join(__dirname);

const runMigrations = async () => {
  console.log('🔄 Starting database migrations...\n');

  // Get all .sql files sorted by name (numeric prefix ensures order)
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && f !== 'setup-db.sql')
    .sort();

  if (files.length === 0) {
    console.log('⚠️  No migration files found.');
    process.exit(0);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const file of files) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`  ▶ Running: ${file}`);
      await client.query(sql);
      console.log(`  ✅ Done:   ${file}`);
    }

    await client.query('COMMIT');
    console.log('\n✅ All migrations completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`\n❌ Migration failed: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

runMigrations();
