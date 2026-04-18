-- Migration 005: Create verification_logs table
-- Records the outcome of each verification attempt (GPS + AI + IVR combined)

CREATE TABLE verification_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grievance_id    UUID            NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
    evidence_id     UUID            REFERENCES field_evidence(id) ON DELETE SET NULL,
    ivr_id          UUID            REFERENCES ivr_responses(id) ON DELETE SET NULL,
    status          VARCHAR(20)     NOT NULL DEFAULT 'pending' CHECK (status IN (
                        'verified', 'failed', 'pending'
                    )),
    gps_result      BOOLEAN,
    ai_score        DECIMAL(5, 2),
    ai_result       VARCHAR(20)     CHECK (ai_result IN ('resolved', 'not_resolved', 'inconclusive')),
    ivr_result      VARCHAR(20)     CHECK (ivr_result IN ('resolved', 'not_resolved', 'no_answer')),
    reason          TEXT,
    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vlog_grievance ON verification_logs(grievance_id);
CREATE INDEX IF NOT EXISTS idx_vlog_status    ON verification_logs(status);
