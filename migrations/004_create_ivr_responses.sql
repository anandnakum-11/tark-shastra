-- Migration 004: Create ivr_responses table
-- Tracks Twilio IVR calls and citizen keypress responses

CREATE TABLE ivr_responses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grievance_id    UUID            NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
    citizen_phone   VARCHAR(20)     NOT NULL,
    call_sid        VARCHAR(100),
    response        VARCHAR(20)     CHECK (response IN ('resolved', 'not_resolved', 'no_answer')),
    call_status     VARCHAR(50),
    timestamp       TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ivr_grievance ON ivr_responses(grievance_id);
CREATE INDEX IF NOT EXISTS idx_ivr_call_sid  ON ivr_responses(call_sid);
