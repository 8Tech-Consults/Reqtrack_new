-- Add JSON audit log column to requisitions
-- Each entry: { action, reason?, by?, at }
ALTER TABLE requisitions
  ADD COLUMN IF NOT EXISTS reason JSON NULL AFTER rejection_reason;
