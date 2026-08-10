-- Add concept note metadata columns to requisitions
ALTER TABLE requisitions
  ADD COLUMN concept_note_path VARCHAR(500) NULL AFTER purpose,
  ADD COLUMN concept_note_name VARCHAR(255) NULL AFTER concept_note_path;
