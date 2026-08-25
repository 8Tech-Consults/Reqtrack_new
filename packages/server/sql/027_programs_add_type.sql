-- Adds a type discriminator to programs: 'Activity' (full outcome/output hierarchy)
-- vs 'Admin' (activities + budget lines only, attached under a hidden outcome/output).

ALTER TABLE programs
  ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'Activity' AFTER status;
