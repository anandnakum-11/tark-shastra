const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'grievance_db',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: (msg) => logger.debug(msg),
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000,
    },
  }
);

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../../../migrations');
  if (!fs.existsSync(migrationsDir)) {
    logger.warn('Migrations directory not found');
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [appliedRows] = await sequelize.query('SELECT filename FROM schema_migrations');
  const applied = new Set(appliedRows.map((row) => row.filename));

  if (applied.size === 0) {
    const [tableRows] = await sequelize.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);

    const existingTables = new Set(tableRows.map((row) => row.table_name));
    const legacyTablesDetected = ['users', 'grievances', 'field_evidence', 'verification_logs', 'department_scores']
      .some((tableName) => existingTables.has(tableName));

    if (legacyTablesDetected) {
      const bootstrapFiles = files.filter((file) => /^00[1-6]_/.test(file));
      for (const file of bootstrapFiles) {
        await sequelize.query(
          'INSERT INTO schema_migrations (filename) VALUES (:filename) ON CONFLICT (filename) DO NOTHING',
          { replacements: { filename: file } }
        );
        applied.add(file);
      }
      logger.info('Existing schema detected. Bootstrapped initial migrations as already applied.');
    }
  }

  for (const file of files) {
    if (applied.has(file)) {
      logger.info(`Migration skipped (already applied): ${file}`);
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    try {
      await sequelize.query(sql, { raw: true });
      await sequelize.query(
        'INSERT INTO schema_migrations (filename) VALUES (:filename) ON CONFLICT (filename) DO NOTHING',
        { replacements: { filename: file } }
      );
      logger.info(`Migration executed: ${file}`);
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        await sequelize.query(
          'INSERT INTO schema_migrations (filename) VALUES (:filename) ON CONFLICT (filename) DO NOTHING',
          { replacements: { filename: file } }
        );
        logger.info(`Migration skipped (already exists): ${file}`);
      } else {
        logger.error(`Migration failed: ${file}`, err.message);
        throw err;
      }
    }
  }
}

async function connectDB() {
  try {
    await sequelize.authenticate();
    logger.info('PostgreSQL connected');

    await runMigrations();
    logger.info('All migrations executed');

    return sequelize;
  } catch (err) {
    logger.error('Failed to connect to PostgreSQL:', err);
    throw err;
  }
}

module.exports = { sequelize, connectDB };
