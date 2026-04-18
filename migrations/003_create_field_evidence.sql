-- Migration 003: Create field_evidence table
-- Stores geo-tagged images uploaded by field officers during on-site verification

CREATE TABLE field_evidence (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grievance_id    UUID            NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
    officer_id      UUID            REFERENCES users(id) ON DELETE SET NULL,
    image_url       TEXT            NOT NULL,
    lat             DECIMAL(10, 8)  NOT NULL,
    lng             DECIMAL(11, 8)  NOT NULL,
    gps_match       BOOLEAN,
    gps_distance_m  DECIMAL(10, 2),
    timestamp       TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_field_evidence_grievance ON field_evidence(grievance_id);
CREATE INDEX IF NOT EXISTS idx_field_evidence_officer   ON field_evidence(officer_id);
