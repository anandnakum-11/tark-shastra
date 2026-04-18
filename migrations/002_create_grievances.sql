-- Migration 002: Create grievances table
-- Core table for all citizen grievances/complaints

CREATE TABLE grievances (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    citizen_id          UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title               VARCHAR(255)    NOT NULL,
    description         TEXT            NOT NULL,
    category            VARCHAR(100)    NOT NULL DEFAULT 'other' CHECK (category IN (
                            'road', 'water', 'sanitation', 'electricity',
                            'drainage', 'street_light', 'garbage', 'other'
                        )),
    status              VARCHAR(30)     NOT NULL DEFAULT 'open' CHECK (status IN (
                            'open', 'in_progress', 'resolved',
                            'verification_pending', 'verified', 'reopened'
                        )),
    priority            VARCHAR(10)     NOT NULL DEFAULT 'medium' CHECK (priority IN (
                            'low', 'medium', 'high', 'critical'
                        )),
    location_lat        DECIMAL(10, 8)  NOT NULL,
    location_lng        DECIMAL(11, 8)  NOT NULL,
    address             TEXT,
    department          VARCHAR(100),
    assigned_officer_id UUID            REFERENCES users(id) ON DELETE SET NULL,
    resolution_notes    TEXT,
    resolved_at         TIMESTAMP,
    reopened_count      INT             DEFAULT 0,
    created_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_grievances_citizen  ON grievances(citizen_id);
CREATE INDEX IF NOT EXISTS idx_grievances_status   ON grievances(status);
CREATE INDEX IF NOT EXISTS idx_grievances_dept     ON grievances(department);
CREATE INDEX IF NOT EXISTS idx_grievances_officer  ON grievances(assigned_officer_id);
CREATE INDEX IF NOT EXISTS idx_grievances_created  ON grievances(created_at DESC);
