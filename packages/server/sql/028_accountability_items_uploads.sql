-- Update accountability_items: remove reference_no & remarks, add invoice/proof_of_payment/receipt uploads and bank_charges
ALTER TABLE accountability_items
  DROP COLUMN IF EXISTS reference_no,
  DROP COLUMN IF EXISTS remarks,
  ADD COLUMN IF NOT EXISTS bank_charges DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER accounted_amount,
  ADD COLUMN IF NOT EXISTS invoice_path VARCHAR(500) NULL AFTER bank_charges,
  ADD COLUMN IF NOT EXISTS invoice_name VARCHAR(255) NULL AFTER invoice_path,
  ADD COLUMN IF NOT EXISTS proof_of_payment_path VARCHAR(500) NULL AFTER invoice_name,
  ADD COLUMN IF NOT EXISTS proof_of_payment_name VARCHAR(255) NULL AFTER proof_of_payment_path,
  ADD COLUMN IF NOT EXISTS receipt_path VARCHAR(500) NULL AFTER proof_of_payment_name,
  ADD COLUMN IF NOT EXISTS receipt_name VARCHAR(255) NULL AFTER receipt_path;
