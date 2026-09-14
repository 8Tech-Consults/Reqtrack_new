import { GraphQLError } from "graphql";
import { db } from "../../config/config.js";

const mapNotification = (row) => ({
  id: String(row.id),
  userId: String(row.user_id),
  type: row.type,
  title: row.title,
  message: row.message || null,
  entityType: row.entity_type || null,
  entityId: row.entity_id != null ? String(row.entity_id) : null,
  isRead: Boolean(row.is_read),
  readAt: row.read_at || null,
  createdAt: row.created_at,
});

const requireUserId = (context) => {
  const userId = context?.req?.user?.id;
  if (!userId) throw new GraphQLError("Authentication required.");
  return userId;
};

const notificationResolvers = {
  Query: {
    notifications: async (_parent, { limit, offset, unreadOnly }, context) => {
      const userId = requireUserId(context);

      const values = [userId];
      let where = "WHERE user_id = ? AND deleted = 0";
      if (unreadOnly) {
        where += " AND is_read = 0";
      }

      let sql = `SELECT * FROM notifications ${where} ORDER BY created_at DESC, id DESC`;
      if (typeof limit === "number") { sql += " LIMIT ?"; values.push(limit); }
      if (typeof offset === "number") { sql += " OFFSET ?"; values.push(offset); }

      const [rows] = await db.execute(sql, values);
      return rows.map(mapNotification);
    },

    unreadNotificationsCount: async (_parent, _args, context) => {
      const userId = requireUserId(context);
      const [[row]] = await db.execute(
        `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0 AND deleted = 0`,
        [userId]
      );
      return Number(row?.count || 0);
    },
  },

  Mutation: {
    markNotificationRead: async (_parent, { id }, context) => {
      const userId = requireUserId(context);

      const [result] = await db.execute(
        `UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ? AND deleted = 0`,
        [id, userId]
      );
      if (!result?.affectedRows) {
        throw new GraphQLError("Notification not found.", { extensions: { code: "NOT_FOUND" } });
      }

      const [[row]] = await db.execute(`SELECT * FROM notifications WHERE id = ? LIMIT 1`, [id]);
      return mapNotification(row);
    },

    markAllNotificationsRead: async (_parent, _args, context) => {
      const userId = requireUserId(context);
      await db.execute(
        `UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND is_read = 0 AND deleted = 0`,
        [userId]
      );
      return true;
    },
  },
};

export default notificationResolvers;
