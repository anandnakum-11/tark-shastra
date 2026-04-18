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

// Run SQL migration files
async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../../migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    logger.warn('Migrations directory not found');
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    
    try {
      await sequelize.query(sql, { raw: true });
      logger.info(`✓ Migration executed: ${file}`);
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        logger.info(`⊛ Migration skipped (already exists): ${file}`);
      } else {
        logger.error(`✗ Migration failed: ${file}`, err.message);
        throw err;
      }
    }
  }
}

async function connectDB() {
  try {
    await sequelize.authenticate();
    logger.info('✓ PostgreSQL connected');
    
    await runMigrations();
    logger.info('✓ All migrations executed');
    
    return sequelize;
  } catch (err) {
    logger.error('Failed to connect to PostgreSQL:', err);
    throw err;
  }
}

module.exports = { sequelize, connectDB };
