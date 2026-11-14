import { db } from "../config/config.js";
import tryParseJSON from "./tryParseJSON.js";
import hasPermission from "./hasPermission.js";
import sendEmail from "../utils/emails/email_server.js";

/**
 * Send a branded email to one user, looked up by id.
 * Never throws - email problems are logged, not surfaced to the caller.
 *
 * email: { subject?, template } - template is the buildBrandedEmail content
 * (heading, paragraphs, details, action, ...). The greeting defaults to the user's name.
 */
export async function emailUser({ userId, email }) {
  if (!userId || !email) return;
  try {
    const [[user]] = await db.execute(
      `SELECT name, email FROM users WHERE id = ? AND deleted = 0 LIMIT 1`,
      [userId]
    );
    if (!user?.email) return;
    await sendEmail({
      to: user.email,
      subject: email.subject || email.template?.heading || "NAD notification",
      template: {
        greeting: `Hello ${user.name || "there"},`,
        ...email.template,
      },
    });
  } catch (error) {
    console.error("emailUser failed:", error?.extensions?.reason || error.message);
  }
}

/**
 * Insert one notification row for a single recipient, and optionally email them
 * (pass `email: { subject, template }`).
 * Never throws - a notification failing to write should never break the
 * business operation that triggered it, so callers can fire this after a
 * commit without wrapping it in their own try/catch.
 */
export async function notifyUser({
  userId,
  type,
  title,
  message = null,
  entityType = null,
  entityId = null,
  createdBy = null,
  email = null,
}) {
  if (!userId) return;
  // Email is sent in the background so a slow mail server never delays the request.
  if (email) void emailUser({ userId, email });
  try {
    await db.execute(
      `INSERT INTO notifications
         (user_id, type, title, message, entity_type, entity_id, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        userId,
        type,
        title,
        message,
        entityType,
        entityId != null ? String(entityId) : null,
        createdBy,
      ]
    );
  } catch (error) {
    console.error("notifyUser failed:", error.message);
  }
}

/**
 * Insert one notification row for every active user whose role carries the
 * given permission key (e.g. 'can_approve_requisitions'). Used for events
 * that should reach "whoever can act on this", not one specific person.
 */
export async function notifyUsersWithPermission({
  permissionKey,
  excludeUserId = null,
  ...notification
}) {
  let rows;
  try {
    [rows] = await db.execute(
      `SELECT users.id, roles.permissions
       FROM users
       LEFT JOIN roles ON roles.id = users.role_id
       WHERE users.deleted = 0 AND users.status = 'active'`
    );
  } catch (error) {
    console.error("notifyUsersWithPermission failed to load recipients:", error.message);
    return;
  }

  const recipientIds = rows
    .filter((row) => String(row.id) !== String(excludeUserId))
    .filter((row) => hasPermission(tryParseJSON(tryParseJSON(row.permissions)), permissionKey))
    .map((row) => row.id);

  await Promise.all(recipientIds.map((userId) => notifyUser({ userId, ...notification })));
}
