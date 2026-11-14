-- Help Centre (FAQ) module with AI assistant.
-- Run this against the reqtrack_new database. Safe to re-run.
--
-- help_categories     : groups shown as chips on the Help Centre page.
-- help_articles       : the FAQ entries. The AI assistant answers ONLY from
--                       published articles (matched via the FULLTEXT index).
-- help_assistant_logs : every question asked of the assistant, so admins can
--                       see what the FAQ doesn't cover yet.

CREATE TABLE IF NOT EXISTS help_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  icon VARCHAR(60) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_help_categories_sort (deleted, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS help_articles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id BIGINT UNSIGNED NULL,
  question VARCHAR(255) NOT NULL,
  answer TEXT NOT NULL,
  keywords VARCHAR(500) NULL,
  published TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  view_count INT UNSIGNED NOT NULL DEFAULT 0,
  helpful_yes INT UNSIGNED NOT NULL DEFAULT 0,
  helpful_no INT UNSIGNED NOT NULL DEFAULT 0,
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_help_articles_question (question),
  KEY idx_help_articles_category (category_id),
  KEY idx_help_articles_listing (deleted, published, sort_order),
  FULLTEXT KEY ft_help_articles (question, answer, keywords),
  CONSTRAINT fk_help_articles_category FOREIGN KEY (category_id) REFERENCES help_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS help_assistant_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NULL,
  question TEXT NOT NULL,
  answer TEXT NULL,
  source_article_ids TEXT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'fallback',
  helpful TINYINT(1) NULL,
  provider VARCHAR(40) NULL,
  model VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_help_assistant_logs_user (user_id),
  KEY idx_help_assistant_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── Starter categories ────────────────────────────────────────────────────
INSERT INTO help_categories (name, description, icon, sort_order)
SELECT * FROM (
  SELECT 'Getting started' AS name, 'Finding your way around the system' AS description, 'rocket' AS icon, 0 AS sort_order UNION ALL
  SELECT 'Requisitions', 'Raising and tracking requisitions', 'note-2', 1 UNION ALL
  SELECT 'Approvals', 'Approving, authorizing and returning requisitions', 'check-circle', 2 UNION ALL
  SELECT 'Accountabilities', 'Reporting on how funds were used', 'document', 3 UNION ALL
  SELECT 'Program budgets', 'Programs, outcomes, activities and budget lines', 'questionnaire-tablet', 4 UNION ALL
  SELECT 'Account & password', 'Signing in and managing your account', 'lock', 5
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM help_categories WHERE help_categories.name = seed.name AND deleted = 0);

-- ─── Starter articles (admins can edit these from Settings > Help Centre) ──
INSERT IGNORE INTO help_articles (category_id, question, answer, keywords, sort_order)
SELECT c.id, a.question, a.answer, a.keywords, a.sort_order
FROM (
  SELECT 'Getting started' AS category,
         'What can I do in the system?' AS question,
         'The system manages the full cycle of program funds:\n\n1. **Programs** - each program has outcomes, outputs, activities and budget lines.\n2. **Requisitions** - staff request funds against a budget line.\n3. **Approvals** - requisitions are approved and then authorized.\n4. **Accountabilities** - after funds are used, the requester reports how they were spent.\n\nWhat you see in the sidebar depends on the permissions of your role. If a menu item you need is missing, ask your system administrator.' AS answer,
         'overview menu sidebar modules start introduction' AS keywords,
         0 AS sort_order
  UNION ALL SELECT 'Getting started',
         'Why can''t I see a menu item or button?',
         'Menus and buttons are shown based on the permissions assigned to your role. For example, only users with "Can Approve Requisitions" see the Authorize button.\n\nIf you need access, ask your system administrator to update your role under **Staff > Roles & permissions**. After your role is changed, sign out and sign in again so the change takes effect.',
         'permission access missing hidden role cannot see button menu',
         1
  UNION ALL SELECT 'Getting started',
         'Where do I see my notifications?',
         'Click the bell icon at the top of the page. You are notified when a decision is made on your requisition (approved, authorized, rejected or returned for amendment), when a requisition is waiting for your authorization, and when an accountability is reviewed.',
         'notification bell alert message update',
         2
  UNION ALL SELECT 'Requisitions',
         'How do I submit a requisition?',
         '1. Open **Requisitions** from the sidebar.\n2. Click **New Requisition** at the top of the page.\n3. Choose the program, then the outcome, output and activity the request falls under.\n4. Add one or more items, picking the budget line for each and entering the quantity and amount.\n5. Fill in the title and any concept note or supporting details.\n6. Click submit.\n\nYour requisition starts as **Pending** and is sent for approval. You will get a notification when a decision is made.',
         'submit create new raise request requisition funds',
         0
  UNION ALL SELECT 'Requisitions',
         'What do the requisition statuses mean?',
         '- **Pending** - submitted and waiting for first approval.\n- **Approved** - passed first approval and is waiting for final authorization.\n- **Authorized** - fully signed off; funds can be released.\n- **Amendment requested** - returned to you with a reason; edit and resubmit it.\n- **Amended** - you have resubmitted it after changes; it goes back for approval.\n- **Rejected** - declined; the reason is shown in the requisition history.',
         'status pending approved authorized rejected amended amendment meaning stage',
         1
  UNION ALL SELECT 'Requisitions',
         'My requisition was returned for amendment. What do I do?',
         '1. Open the requisition from the **Requisitions** list. The reason it was returned is shown at the top of the details.\n2. Click edit, make the requested changes and save.\n3. The requisition moves to **Amended** and goes back to the approver.\n\nYou can only edit your own requisition while it is **Pending** or **Amendment requested**.',
         'amendment returned edit resubmit change fix requisition',
         2
  UNION ALL SELECT 'Requisitions',
         'Where can I see who approved my requisition?',
         'Open the requisition from the **Requisitions** list. The history section lists every decision with the person, the date and any reason given. You can also print the requisition, which shows the approval and authorization signatures.',
         'history approved by who authorized print log trail',
         3
  UNION ALL SELECT 'Approvals',
         'How do I approve or authorize a requisition?',
         'Approval has two stages:\n\n1. **Approve** (first approval) - users with "Can Accept Requisitions" act on **Pending** and **Amended** requisitions.\n2. **Authorize** (final sign-off) - users with "Can Approve Requisitions" act on requisitions that are already **Approved**.\n\nTo act on one: open **Requisitions**, click the requisition, review the items and budget lines, then click **Approve** / **Authorize**, **Reject**, or **Request amendment**. Rejecting or requesting an amendment requires a reason, which the requester will see.',
         'approve authorize reject decision sign off approver amendment budget',
         0
  UNION ALL SELECT 'Accountabilities',
         'How do I submit an accountability?',
         '1. Open **Requisitions** and find the authorized requisition.\n2. Open its accountability page.\n3. Enter what was spent against each item and attach receipts or supporting documents.\n4. Write the **narrative report** - it is required before you can submit.\n5. Save as a draft if you need to come back later, or submit it for review.\n\nA reviewer will then either close it or request more information.',
         'accountability submit report receipts spent narrative expenditure',
         0
  UNION ALL SELECT 'Accountabilities',
         'A reviewer asked for more information on my accountability. What now?',
         'When a reviewer requests more information, your accountability is returned to you with their notes. Open the accountability, read the notes, update the figures, attachments or narrative report, and submit it again. It goes back to the reviewer, who can then close it.',
         'accountability more information amend returned request info review',
         1
  UNION ALL SELECT 'Program budgets',
         'How do I upload a program budget from Excel?',
         '1. Open **Programs** and select the program.\n2. Click the budget upload option and **Download template**.\n3. Fill in the Outcome, Output and Activity columns (only on the row where they change), then one row per budget line with Cost type, Units, Unit cost, Quantity and Frequency.\n4. Choose the completed file. A preview shows which items are new, which budget lines will be updated, and which are unchanged.\n5. Click **Save changes**.\n\nItems are matched by name, so existing budget lines keep their history and links to requisitions. Nothing is deleted by an upload.',
         'budget upload excel template import program budget lines outcome output activity',
         0
  UNION ALL SELECT 'Account & password',
         'I forgot my password. How do I reset it?',
         '1. On the sign-in page, click **Forgot password?**\n2. Enter the email address on your account.\n3. Open the email you receive and click the reset link.\n4. Choose a new password and sign in.\n\nIf the email doesn''t arrive, check your spam folder or ask your system administrator to reset your password for you.',
         'forgot password reset login sign in locked email link',
         0
  UNION ALL SELECT 'Account & password',
         'How do I change my password?',
         'Click your profile picture or name, open **My Profile**, and use the **Change password** section. Enter your current password, then your new password twice, and save.',
         'change password update profile account security',
         1
) AS a
JOIN help_categories c ON c.name = a.category AND c.deleted = 0;

-- ─── Permission ────────────────────────────────────────────────────────────
-- Give the Super Admin role the new can_manage_help_centre permission
-- (permissions are stored as a JSON array of {"key": true} objects).
UPDATE roles
SET permissions = JSON_ARRAY_APPEND(COALESCE(NULLIF(permissions, ''), '[]'), '$', JSON_OBJECT('can_manage_help_centre', TRUE))
WHERE name = 'Super Admin'
  AND deleted = 0
  AND (permissions IS NULL OR permissions NOT LIKE '%"can_manage_help_centre"%');
