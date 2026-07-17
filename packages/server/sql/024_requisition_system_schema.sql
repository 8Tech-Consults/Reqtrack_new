-- Requisition system core schema
-- Covers template design, annual programs, year budget inputs, requisitions, and accountability.
-- Designed for MariaDB/MySQL using UUID-style CHAR(36) keys.

-- =====================================
-- 1) TEMPLATE DESIGN (Admin)
-- =====================================

CREATE TABLE IF NOT EXISTS project_templates (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  name VARCHAR(180) NOT NULL,
  description TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_project_templates_name (name),
  KEY idx_project_templates_status (status),
  KEY idx_project_templates_deleted (deleted),
  CONSTRAINT fk_project_templates_created_by FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_project_templates_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS template_outcomes (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  template_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_template_outcomes_template_id (template_id),
  KEY idx_template_outcomes_sort_order (sort_order),
  CONSTRAINT fk_template_outcomes_template FOREIGN KEY (template_id) REFERENCES project_templates(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS template_outputs (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  outcome_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_template_outputs_outcome_id (outcome_id),
  KEY idx_template_outputs_sort_order (sort_order),
  CONSTRAINT fk_template_outputs_outcome FOREIGN KEY (outcome_id) REFERENCES template_outcomes(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS template_activities (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  output_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_template_activities_output_id (output_id),
  KEY idx_template_activities_sort_order (sort_order),
  CONSTRAINT fk_template_activities_output FOREIGN KEY (output_id) REFERENCES template_outputs(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS template_budget_lines (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  activity_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_template_budget_lines_activity_id (activity_id),
  KEY idx_template_budget_lines_sort_order (sort_order),
  CONSTRAINT fk_template_budget_lines_activity FOREIGN KEY (activity_id) REFERENCES template_activities(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================
-- 2) ANNUAL PROGRAMS (Operations)
-- =====================================

CREATE TABLE IF NOT EXISTS project_years (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  template_id CHAR(36) NOT NULL,
  financial_year INT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Planning',
  start_date DATE NULL,
  end_date DATE NULL,
  assigned_staff_id CHAR(36) NULL,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_project_years_template_financial_year (template_id, financial_year),
  KEY idx_project_years_financial_year (financial_year),
  KEY idx_project_years_status (status),
  KEY idx_project_years_assigned_staff_id (assigned_staff_id),
  CONSTRAINT fk_project_years_template FOREIGN KEY (template_id) REFERENCES project_templates(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_project_years_assigned_staff FOREIGN KEY (assigned_staff_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_project_years_created_by FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_project_years_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS annual_budget_inputs (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  project_year_id CHAR(36) NOT NULL,
  budget_line_id CHAR(36) NOT NULL,
  quantity DECIMAL(18,2) NOT NULL DEFAULT 1.00,
  frequency DECIMAL(18,2) NOT NULL DEFAULT 1.00,
  unit_cost DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  units DECIMAL(18,2) NOT NULL DEFAULT 1.00,
  planned_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  actual_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_annual_budget_inputs_year_line (project_year_id, budget_line_id),
  KEY idx_annual_budget_inputs_project_year_id (project_year_id),
  KEY idx_annual_budget_inputs_budget_line_id (budget_line_id),
  CONSTRAINT fk_annual_budget_inputs_project_year FOREIGN KEY (project_year_id) REFERENCES project_years(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_annual_budget_inputs_budget_line FOREIGN KEY (budget_line_id) REFERENCES template_budget_lines(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================
-- 3) REQUISITIONS
-- =====================================

CREATE TABLE IF NOT EXISTS requisitions (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  requisition_no VARCHAR(50) NULL,
  project_year_id CHAR(36) NOT NULL,
  requested_by CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  purpose TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Draft',
  requested_at DATETIME NULL,
  submitted_at DATETIME NULL,
  approved_at DATETIME NULL,
  approved_by CHAR(36) NULL,
  rejected_at DATETIME NULL,
  rejected_by CHAR(36) NULL,
  rejection_reason TEXT NULL,
  total_requested_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_requisitions_no (requisition_no),
  KEY idx_requisitions_project_year_id (project_year_id),
  KEY idx_requisitions_status (status),
  KEY idx_requisitions_requested_by (requested_by),
  CONSTRAINT fk_requisitions_project_year FOREIGN KEY (project_year_id) REFERENCES project_years(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_requisitions_requested_by FOREIGN KEY (requested_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_requisitions_approved_by FOREIGN KEY (approved_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_requisitions_rejected_by FOREIGN KEY (rejected_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS requisition_items (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  requisition_id CHAR(36) NOT NULL,
  budget_line_id CHAR(36) NULL,
  description VARCHAR(255) NOT NULL,
  quantity DECIMAL(18,2) NOT NULL DEFAULT 1.00,
  frequency DECIMAL(18,2) NOT NULL DEFAULT 1.00,
  unit_cost DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  units DECIMAL(18,2) NOT NULL DEFAULT 1.00,
  amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_requisition_items_requisition_id (requisition_id),
  KEY idx_requisition_items_budget_line_id (budget_line_id),
  CONSTRAINT fk_requisition_items_requisition FOREIGN KEY (requisition_id) REFERENCES requisitions(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_requisition_items_budget_line FOREIGN KEY (budget_line_id) REFERENCES template_budget_lines(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================
-- 4) ACCOUNTABILITY
-- =====================================

CREATE TABLE IF NOT EXISTS accountability_records (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  requisition_id CHAR(36) NOT NULL,
  account_no VARCHAR(50) NULL,
  reported_by CHAR(36) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Draft',
  report_date DATE NULL,
  summary TEXT NULL,
  total_accounted_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  variance_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  reviewed_by CHAR(36) NULL,
  reviewed_at DATETIME NULL,
  review_notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_accountability_account_no (account_no),
  KEY idx_accountability_requisition_id (requisition_id),
  KEY idx_accountability_status (status),
  CONSTRAINT fk_accountability_requisition FOREIGN KEY (requisition_id) REFERENCES requisitions(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_accountability_reported_by FOREIGN KEY (reported_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_accountability_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS accountability_items (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  accountability_id CHAR(36) NOT NULL,
  requisition_item_id CHAR(36) NULL,
  description VARCHAR(255) NOT NULL,
  accounted_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  reference_no VARCHAR(120) NULL,
  remarks TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_accountability_items_accountability_id (accountability_id),
  KEY idx_accountability_items_requisition_item_id (requisition_item_id),
  CONSTRAINT fk_accountability_items_accountability FOREIGN KEY (accountability_id) REFERENCES accountability_records(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_accountability_items_requisition_item FOREIGN KEY (requisition_item_id) REFERENCES requisition_items(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================
-- 5) BASIC REPORTING VIEWS
-- =====================================

CREATE OR REPLACE VIEW vw_project_year_budget_summary AS
SELECT
  py.id AS project_year_id,
  py.financial_year,
  py.status AS project_year_status,
  pt.id AS template_id,
  pt.name AS template_name,
  COALESCE(SUM(abi.planned_amount), 0) AS total_planned,
  COALESCE(SUM(abi.actual_amount), 0) AS total_actual,
  COALESCE(SUM(abi.planned_amount), 0) - COALESCE(SUM(abi.actual_amount), 0) AS total_variance
FROM project_years py
INNER JOIN project_templates pt ON pt.id = py.template_id
LEFT JOIN annual_budget_inputs abi ON abi.project_year_id = py.id
WHERE py.deleted = 0 AND pt.deleted = 0
GROUP BY py.id, py.financial_year, py.status, pt.id, pt.name;

CREATE OR REPLACE VIEW vw_requisition_summary AS
SELECT
  r.id AS requisition_id,
  r.requisition_no,
  r.project_year_id,
  py.financial_year,
  pt.name AS template_name,
  r.status,
  r.total_requested_amount,
  r.requested_by,
  r.requested_at,
  r.submitted_at,
  r.approved_at
FROM requisitions r
INNER JOIN project_years py ON py.id = r.project_year_id
INNER JOIN project_templates pt ON pt.id = py.template_id
WHERE r.deleted = 0;
