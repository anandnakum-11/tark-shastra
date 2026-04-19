CREATE TABLE IF NOT EXISTS departments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255)    NOT NULL,
    code            VARCHAR(50)     UNIQUE,
    contact_email   VARCHAR(255),
    contact_phone   VARCHAR(30),
    district        VARCHAR(100)    DEFAULT 'Ahmedabad',
    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
