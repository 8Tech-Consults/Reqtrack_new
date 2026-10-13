-- accountability_records.narrative_report was added to some databases by hand as
-- NOT NULL with no default, so every insert failed under strict SQL mode with
-- "Field 'narrative_report' doesn't have a default value".
-- Bring every environment to the same shape: both columns present and nullable.
ALTER TABLE accountability_records
  ADD COLUMN IF NOT EXISTS narrative_report TEXT NULL AFTER summary,
  ADD COLUMN IF NOT EXISTS attachments TEXT NULL AFTER narrative_report;

ALTER TABLE accountability_records
  MODIFY COLUMN narrative_report TEXT NULL;
