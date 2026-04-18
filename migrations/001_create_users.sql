-- Migration 001: Create users table
-- Stores all system users with role-based access

DROP TABLE IF EXISTS department_scores CASCADE;
DROP TABLE IF EXISTS verification_logs CASCADE;
DROP TABLE IF EXISTS ivr_responses CASCADE;
DROP TABLE IF EXISTS field_evidence CASCADE;
DROP TABLE IF EXISTS grievances CASCADE;
DROP TABLE IF EXISTS verifications CASCADE;
DROP TABLE IF EXISTS ivr_logs CASCADE;
DROP TABLE IF EXISTS complaints CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255)    NOT NULL,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    phone           VARCHAR(20),
    password        TEXT            NOT NULL,
    role            VARCHAR(30)     NOT NULL CHECK (role IN (
                        'citizen', 'field_officer', 'department_officer', 'collector'
                    )),
    department      VARCHAR(100),
    is_active       BOOLEAN         DEFAULT true,
    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);
