-- MariaDB schema for PWD Observatory (Auth + RBAC)
-- Run this against the `pwd_observatory` database.

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  -- JSON string (MariaDB JSON is LONGTEXT with validation in some versions)
  permissions LONGTEXT NULL,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  username VARCHAR(100) NOT NULL,
  name VARCHAR(150) NOT NULL,
  company_initials VARCHAR(50) NOT NULL DEFAULT '',
  email VARCHAR(150) NULL,
  district VARCHAR(120) NOT NULL DEFAULT '',
  premises_location VARCHAR(255) NOT NULL DEFAULT '',
  phone_number VARCHAR(50) NULL,
  password VARCHAR(255) NOT NULL,
  image VARCHAR(255) NULL,
  role_id BIGINT UNSIGNED NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',

  -- Flags used by existing JWT payload on server
  is_grower TINYINT(1) NOT NULL DEFAULT 0,
  is_merchant TINYINT(1) NOT NULL DEFAULT 0,
  is_qds_producer TINYINT(1) NOT NULL DEFAULT 0,

  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_id (role_id),
  CONSTRAINT fk_users_role_id FOREIGN KEY (role_id) REFERENCES roles(id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed a default Super Admin role + admin user.
-- NOTE: Replace the password hash below with your own bcrypt hash.
-- You can generate one quickly in Node/Bun:
--   node -e "console.log(require('bcrypt').hashSync('Admin@123', 10))"

SET @super_role_id = NULL;
SET @basic_role_id = NULL;
SET @user_id = '22222222-2222-2222-2222-222222222222';

INSERT IGNORE INTO roles (name, description, permissions)
VALUES (
  'Super Admin',
  'Full access',
  '[{"can_create_users":true},{"can_view_settings":true},{"can_manage_users":true},{"can_manage_roles":true},{"can_view_roles":true},{"can_create_roles":true},{"can_delete_roles":true},{"can_manage_disabilities":true},{"can_update_role_permissions":true},{"can_manage_du":true},{"can_create_du":true},{"can_view_du":true},{"can_delete_du":true},{"can_manage_pwds":true},{"can_create_pwds":true},{"can_view_pwds":true},{"can_delete_pwds":true},{"can_manage_sp":true},{"can_create_sp":true},{"can_view_sp":true},{"can_delete_sp":true},{"can_manage_gc":true},{"can_create_gc":true},{"can_view_gc":true},{"can_delete_gc":true},{"can_manage_ps":true},{"can_create_ps":true},{"can_view_ps":true},{"can_delete_ps":true},{"can_manage_inn":true},{"can_create_inn":true},{"can_view_inn":true},{"can_delete_inn":true},{"can_manage_dis":true},{"can_create_dis":true},{"can_view_dis":true},{"can_delete_dis":true}]'
);

SELECT id INTO @super_role_id FROM roles WHERE name = 'Super Admin' LIMIT 1;

INSERT IGNORE INTO roles (name, description, permissions)
VALUES (
  'PWD',
  'Default role for new accounts',
  '[]'
);

SELECT id INTO @basic_role_id FROM roles WHERE name = 'PWD' LIMIT 1;

-- Example bcrypt hash for 'Admin@123' (replace if you want):
-- This hash value is only a placeholder; generate your own before production use.
SET @bcrypt_hash = '$2b$10$Cq6A8x6bL3bQ0jvQwqGxUe7Q0G2g9m2q3m7k1f3wNwZt2B8mZxw3G';

INSERT IGNORE INTO users (
  id,
  username,
  name,
  company_initials,
  email,
  district,
  premises_location,
  phone_number,
  password,
  role_id
)
VALUES (
  @user_id,
  'admin',
  'System Administrator',
  'PWD',
  'admin@pwd.local',
  'Kampala',
  'Head Office',
  '+256700000000',
  @bcrypt_hash,
  @super_role_id
);
