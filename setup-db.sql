-- Run this as the postgres superuser to set up the project database
-- Usage: sudo -u postgres psql -f scripts/setup-db.sql

CREATE DATABASE grievance_db;

-- Optional: create a dedicated user (uncomment if you prefer)
-- CREATE USER grievance_user WITH PASSWORD 'grievance_pass';
-- GRANT ALL PRIVILEGES ON DATABASE grievance_db TO grievance_user;

\c grievance_db

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

SELECT 'Database grievance_db created successfully!' AS status;
