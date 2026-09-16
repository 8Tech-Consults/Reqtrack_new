-- program_budget_lines.units was declared DECIMAL(18,2) even though it's
-- always treated as free text everywhere else (GraphQL type is String!, and
-- the NAD budget template's Units column holds values like "days", "pax",
-- "reams"). Fix the column to match what it actually stores.
ALTER TABLE program_budget_lines MODIFY COLUMN units VARCHAR(50) NOT NULL DEFAULT '';
