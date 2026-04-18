-- Migration 006: Create department_scores table
-- Tracks performance scores per department based on resolution & verification metrics

CREATE TABLE department_scores (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_name     VARCHAR(100)    NOT NULL UNIQUE,
    total_grievances    INT             DEFAULT 0,
    resolved_count      INT             DEFAULT 0,
    verified_count      INT             DEFAULT 0,
    reopened_count      INT             DEFAULT 0,
    avg_resolution_hrs  DECIMAL(10, 2)  DEFAULT 0,
    score               DECIMAL(5, 2)   DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    updated_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dept_scores_name ON department_scores(department_name);
