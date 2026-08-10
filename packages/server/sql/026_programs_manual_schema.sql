-- Standalone programs module
-- Programs are created first with a budget amount and manager, then the hierarchy is built manually.

CREATE TABLE IF NOT EXISTS programs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  budget_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  program_manager_id CHAR(36) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_programs_status (status),
  KEY idx_programs_program_manager_id (program_manager_id),
  CONSTRAINT fk_programs_program_manager FOREIGN KEY (program_manager_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_programs_created_by FOREIGN KEY (created_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_programs_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS program_outcomes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  program_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_program_outcomes_program_id (program_id),
  KEY idx_program_outcomes_sort_order (sort_order),
  CONSTRAINT fk_program_outcomes_program FOREIGN KEY (program_id) REFERENCES programs(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS program_outputs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  outcome_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_program_outputs_outcome_id (outcome_id),
  KEY idx_program_outputs_sort_order (sort_order),
  CONSTRAINT fk_program_outputs_outcome FOREIGN KEY (outcome_id) REFERENCES program_outcomes(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS program_activities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  output_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_program_activities_output_id (output_id),
  KEY idx_program_activities_sort_order (sort_order),
  CONSTRAINT fk_program_activities_output FOREIGN KEY (output_id) REFERENCES program_outputs(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS program_budget_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  activity_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  quantity DECIMAL(18,2) NOT NULL DEFAULT 1.00,
  frequency DECIMAL(18,2) NOT NULL DEFAULT 1.00,
  unit_price DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  units DECIMAL(18,2) NOT NULL DEFAULT 1.00,
  total_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  sort_order INT NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_program_budget_lines_activity_id (activity_id),
  KEY idx_program_budget_lines_sort_order (sort_order),
  CONSTRAINT fk_program_budget_lines_activity FOREIGN KEY (activity_id) REFERENCES program_activities(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;