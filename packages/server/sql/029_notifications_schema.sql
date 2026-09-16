-- Notifications inbox. One row per recipient (fan-out at creation time) so a
-- single event can notify several users (e.g. everyone who can approve
-- requisitions) without any many-to-many table.
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- Who this notification is for.
  user_id CHAR(36) NOT NULL,

  -- Machine-readable event key, e.g. 'RequisitionSubmitted', 'RequisitionApproved'.
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message VARCHAR(500) NULL,

  -- What this notification is about, so the client can route to it on click.
  -- entity_type: 'Program' | 'Requisition' | 'Accountability'.
  -- entity_id is VARCHAR since it just stores the referenced row's id as text
  -- (no FK - the three entity tables are independent, and rows may later be
  -- soft-deleted without needing to touch old notifications).
  entity_type VARCHAR(30) NULL,
  entity_id VARCHAR(64) NULL,

  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME NULL,

  created_by CHAR(36) NULL,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_notifications_user_unread (user_id, is_read, created_at),
  KEY idx_notifications_entity (entity_type, entity_id),
  CONSTRAINT fk_notifications_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
