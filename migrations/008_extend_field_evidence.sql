ALTER TABLE field_evidence
  ADD COLUMN IF NOT EXISTS photo_path TEXT,
  ADD COLUMN IF NOT EXISTS image_hash VARCHAR(128),
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'invalid',
  ADD COLUMN IF NOT EXISTS verification_reason TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes INT,
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS blur_score DECIMAL(12, 4),
  ADD COLUMN IF NOT EXISTS brightness_score DECIMAL(12, 4);

UPDATE field_evidence
SET
  photo_path = COALESCE(photo_path, image_url),
  image_hash = COALESCE(image_hash, md5(COALESCE(image_url, id::text))),
  verification_status = COALESCE(verification_status, CASE WHEN gps_match = true THEN 'valid' ELSE 'invalid' END),
  verification_reason = COALESCE(verification_reason, CASE
    WHEN gps_match = true THEN 'Legacy evidence migrated as valid GPS evidence.'
    ELSE 'Legacy evidence migrated without full photo validation.'
  END),
  file_size_bytes = COALESCE(file_size_bytes, 0),
  captured_at = COALESCE(captured_at, timestamp),
  blur_score = COALESCE(blur_score, 0),
  brightness_score = COALESCE(brightness_score, 0);

ALTER TABLE field_evidence
  ALTER COLUMN photo_path SET NOT NULL,
  ALTER COLUMN image_hash SET NOT NULL,
  ALTER COLUMN verification_status SET NOT NULL,
  ALTER COLUMN captured_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_field_evidence_hash ON field_evidence(image_hash);
CREATE INDEX IF NOT EXISTS idx_field_evidence_status ON field_evidence(verification_status);
