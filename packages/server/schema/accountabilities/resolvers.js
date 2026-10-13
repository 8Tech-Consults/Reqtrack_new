import { GraphQLError } from 'graphql';
import saveData from '../../utils/db/saveData.js';
import saveUpload from '../../helpers/saveUpload.js';
import { db } from '../../config/config.js';
import checkPermission from '../../helpers/checkPermission.js';
import hasPermission from '../../helpers/hasPermission.js';
import tryParseJSON from '../../helpers/tryParseJSON.js';
import { notifyUser, notifyUsersWithPermission } from '../../helpers/notifications.js';

const REVIEW_STATUSES = ['Closed', 'Amend'];
// Statuses the reporter may still edit, and the ones a reviewer may act on.
const EDITABLE_STATUSES = ['Draft', 'Amend'];
const REVIEWABLE_STATUSES = ['Pending', 'Amended'];
const FILE_FIELDS = [
  ['invoice', 'invoice_name'],
  ['proofOfPayment', 'proof_of_payment_name'],
  ['receipt', 'receipt_name'],
];

const sameUser = (a, b) => a != null && b != null && String(a) === String(b);

const parseAttachments = (value) => {
  if (!value) return [];
  const parsed = tryParseJSON(value);
  return Array.isArray(parsed) ? parsed.map(String) : [];
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toIso = (value) => (value instanceof Date ? value.toISOString() : value);

// DATE columns come back as local-midnight Date objects; format them without
// going through UTC so the day doesn't shift.
const toDateOnly = (value) => {
  if (!(value instanceof Date)) return value || null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

// ─── Mappers ─────────────────────────────────────────────────────────────────

const mapItem = (row) => ({
  id: String(row.id),
  accountabilityId: String(row.accountability_id),
  requisitionItemId: row.requisition_item_id ? String(row.requisition_item_id) : null,
  description: row.description,
  accountedAmount: toNumber(row.accounted_amount, 0),
  bankCharges: toNumber(row.bank_charges, 0),
  invoicePath: row.invoice_path || null,
  invoiceName: row.invoice_name || null,
  proofOfPaymentPath: row.proof_of_payment_path || null,
  proofOfPaymentName: row.proof_of_payment_name || null,
  receiptPath: row.receipt_path || null,
  receiptName: row.receipt_name || null,
  sortOrder: toNumber(row.sort_order, 0),
});

const mapRecord = (row) => ({
  id: String(row.id),
  requisitionId: String(row.requisition_id),
  reportedById: String(row.reported_by),
  status: row.status,
  reportDate: toDateOnly(row.report_date),
  summary: row.summary || null,
  narrativeReport: row.narrative_report || null,
  attachments: parseAttachments(row.attachments),
  totalAccountedAmount: toNumber(row.total_accounted_amount, 0),
  varianceAmount: toNumber(row.variance_amount, 0),
  reviewedAt: toIso(row.reviewed_at) || null,
  reviewNotes: row.review_notes || null,
  reviewedById: row.reviewed_by ? String(row.reviewed_by) : null,
  createdAt: toIso(row.created_at),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fetchItems = async (accountabilityId) => {
  const [rows] = await db.execute(
    `SELECT * FROM accountability_items WHERE accountability_id = ? ORDER BY sort_order ASC, id ASC`,
    [accountabilityId]
  );
  return rows.map(mapItem);
};

const requireUser = (context) => {
  const user = context?.req?.user;
  if (!user?.id) {
    throw new GraphQLError('Authentication required.', { extensions: { code: 'UNAUTHENTICATED' } });
  }
  return user;
};

// Reviewers and people who can see every requisition see every accountability;
// everyone else only the ones they reported or that belong to their own requisitions.
const canSeeAll = (user) =>
  hasPermission(user.permissions, 'can_review_accountability') ||
  (hasPermission(user.permissions, 'can_view_requisitions') &&
    !hasPermission(user.permissions, 'can_view_own_requisitions'));

const notifyReviewers = ({ requisitionId, userId, resubmitted }) =>
  notifyUsersWithPermission({
    permissionKey: 'can_review_accountability',
    excludeUserId: userId,
    type: resubmitted ? 'AccountabilityAmended' : 'AccountabilitySubmitted',
    title: resubmitted ? 'Accountability resubmitted' : 'Accountability submitted',
    message: resubmitted
      ? 'An accountability report was updated with the requested information and is ready for review.'
      : 'An accountability report was submitted and is ready for review.',
    entityType: 'Accountability',
    entityId: requisitionId,
    createdBy: userId,
  });

// ─── Resolvers ────────────────────────────────────────────────────────────────

const accountabilityResolvers = {
  Query: {
    accountabilities: async (_parent, { limit, offset, search, requisitionId }, context) => {
      const user = requireUser(context);
      const values = [];
      let where = 'WHERE ar.id IS NOT NULL';

      if (!canSeeAll(user)) {
        where += ` AND (ar.reported_by = ? OR ar.requisition_id IN
          (SELECT id FROM requisitions WHERE requested_by = ?))`;
        values.push(user.id, user.id);
      }

      if (requisitionId) {
        where += ' AND ar.requisition_id = ?';
        values.push(requisitionId);
      }

      if (search) {
        const like = `%${String(search).trim()}%`;
        where += ' AND (ar.summary LIKE ? OR ar.status LIKE ?)';
        values.push(like, like);
      }

      let sql = `SELECT ar.* FROM accountability_records ar ${where} ORDER BY ar.id DESC`;
      if (typeof limit === 'number') { sql += ' LIMIT ?'; values.push(limit); }
      if (typeof offset === 'number') { sql += ' OFFSET ?'; values.push(offset); }

      const [rows] = await db.execute(sql, values);
      return rows.map(mapRecord);
    },

    accountability: async (_parent, { id }, context) => {
      const user = requireUser(context);
      const [[row]] = await db.execute(
        `SELECT ar.*, r.requested_by FROM accountability_records ar
         LEFT JOIN requisitions r ON r.id = ar.requisition_id
         WHERE ar.id = ? LIMIT 1`,
        [id]
      );
      if (!row) return null;
      if (!canSeeAll(user) && !sameUser(row.reported_by, user.id) && !sameUser(row.requested_by, user.id)) {
        throw new GraphQLError('You do not have permission to view this accountability.', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      return mapRecord(row);
    },
  },

  AccountabilityRecord: {
    items: async (parent) => fetchItems(parent.id),

    reportedBy: async (parent) => {
      const [[row]] = await db.execute(
        `SELECT id, name, email FROM users WHERE id = ? LIMIT 1`,
        [parent.reportedById]
      );
      return row ? { id: row.id, name: row.name, email: row.email } : null;
    },

    reviewedBy: async (parent) => {
      if (!parent.reviewedById) return null;
      const [[row]] = await db.execute(
        `SELECT id, name, email FROM users WHERE id = ? LIMIT 1`,
        [parent.reviewedById]
      );
      return row ? { id: row.id, name: row.name, email: row.email } : null;
    },

    requisition: async (parent) => {
      const [[row]] = await db.execute(
        `SELECT r.*, p.id AS program_id FROM requisitions r
         LEFT JOIN programs p ON p.id = r.program_id
         WHERE r.id = ? AND r.deleted = 0 LIMIT 1`,
        [parent.requisitionId]
      );
      if (!row) return null;
      return {
        id: String(row.id),
        requisitionNo: row.requisition_no,
        title: row.title,
        status: row.status,
        totalRequestedAmount: toNumber(row.total_requested_amount, 0),
      };
    },
  },

  Mutation: {
    saveAccountability: async (_parent, { input }, context) => {
      const { id, requisitionId, reportDate, summary, status, items } = input;

      const userId = requireUser(context).id;

      if (!requisitionId || !Array.isArray(items) || !items.length) {
        throw new GraphQLError('Requisition and at least one item are required.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const [[reqRow]] = await db.execute(
        `SELECT total_requested_amount, requested_by, status FROM requisitions WHERE id = ? AND deleted = 0 LIMIT 1`,
        [requisitionId]
      );
      if (!reqRow) {
        throw new GraphQLError('Requisition not found.', { extensions: { code: 'NOT_FOUND' } });
      }

      let existing = null;
      if (id) {
        const [[row]] = await db.execute(
          `SELECT id, requisition_id, reported_by, status FROM accountability_records WHERE id = ? LIMIT 1`,
          [id]
        );
        if (!row || String(row.requisition_id) !== String(requisitionId)) {
          throw new GraphQLError('Accountability record not found.', { extensions: { code: 'NOT_FOUND' } });
        }
        if (!sameUser(row.reported_by, userId)) {
          throw new GraphQLError('Only the person who reported this accountability can edit it.', {
            extensions: { code: 'FORBIDDEN' },
          });
        }
        if (!EDITABLE_STATUSES.includes(row.status)) {
          throw new GraphQLError('This accountability has been submitted and can no longer be edited.', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
        existing = row;
      } else {
        if (!sameUser(reqRow.requested_by, userId)) {
          throw new GraphQLError('Only the requester can account for this requisition.', {
            extensions: { code: 'FORBIDDEN' },
          });
        }
        if (reqRow.status !== 'Approved') {
          throw new GraphQLError('Accountability is only available once the requisition has been approved.', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
        const [[duplicate]] = await db.execute(
          `SELECT id FROM accountability_records WHERE requisition_id = ? LIMIT 1`,
          [requisitionId]
        );
        if (duplicate) {
          throw new GraphQLError('An accountability already exists for this requisition.', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
      }

      // Anything other than an explicit draft save is a submission for review.
      const submitting = Boolean(status) && status !== 'Draft';
      const currentStatus = existing?.status || 'Draft';
      const nextStatus = !submitting
        ? currentStatus
        : currentStatus === 'Amend'
          ? 'Amended'
          : 'Pending';

      const totalAccountedAmount = items.reduce(
        (sum, item) => sum + toNumber(item.accountedAmount, 0) + toNumber(item.bankCharges, 0),
        0
      );

      // Variance against the linked requisition's total
      const varianceAmount = toNumber(reqRow.total_requested_amount, 0) - totalAccountedAmount;

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        const accountabilityId = await saveData({
          table: 'accountability_records',
          id: id ?? null,
          data: {
            requisition_id: requisitionId,
            reported_by: userId,
            status: nextStatus,
            report_date: reportDate || null,
            summary: summary || null,
            total_accounted_amount: totalAccountedAmount,
            variance_amount: varianceAmount,
            updated_at: new Date(),
            ...(id ? {} : { created_at: new Date() }),
          },
          connection,
        });

        const accountabilityIdStr = String(accountabilityId);

        // Items are replaced wholesale on edit, so remember the files already on
        // record and carry them over unless the caller replaced or cleared them.
        const previousFiles = new Map();
        if (id) {
          const [previousRows] = await connection.execute(
            `SELECT id, invoice_name, proof_of_payment_name, receipt_name
             FROM accountability_items WHERE accountability_id = ?`,
            [accountabilityIdStr]
          );
          previousRows.forEach((row) => previousFiles.set(String(row.id), row));

          await connection.execute(
            `DELETE FROM accountability_items WHERE accountability_id = ?`,
            [accountabilityIdStr]
          );
        }

        for (const [index, item] of items.entries()) {
          const previous = item.id ? previousFiles.get(String(item.id)) : null;
          const fileColumns = {};

          for (const [field, column] of FILE_FIELDS) {
            if (item[field]) {
              // A new upload replaces whatever was there.
              const info = await saveUpload({ file: item[field], subdir: 'accountability_docs' });
              fileColumns[column] = info.filename;
            } else if (item[field] === undefined && previous?.[column]) {
              // Field omitted: keep the existing file. An explicit null clears it.
              fileColumns[column] = previous[column];
            }
          }

          await saveData({
            table: 'accountability_items',
            data: {
              accountability_id: accountabilityIdStr,
              requisition_item_id: item.requisitionItemId || null,
              description: item.description,
              accounted_amount: toNumber(item.accountedAmount, 0),
              bank_charges: toNumber(item.bankCharges, 0),
              ...fileColumns,
              sort_order: index,
              updated_at: new Date(),
              created_at: new Date(),
            },
            connection,
          });
        }

        await connection.commit();

        if (submitting) {
          notifyReviewers({ requisitionId, userId, resubmitted: nextStatus === 'Amended' });
        }

        const [[saved]] = await db.execute(
          `SELECT * FROM accountability_records WHERE id = ? LIMIT 1`,
          [accountabilityIdStr]
        );

        return {
          success: true,
          message: submitting
            ? 'Accountability submitted successfully.'
            : id ? 'Accountability updated successfully.' : 'Accountability created successfully.',
          accountability: saved ? mapRecord(saved) : null,
        };
      } catch (error) {
        await connection.rollback();
        throw new GraphQLError(error.message || 'Failed to save accountability.');
      } finally {
        connection.release();
      }
    },

    updateAccountabilityStatus: async (_parent, { id, status, notes }, context) => {
      const user = requireUser(context);
      const userId = user.id;
      const isReview = REVIEW_STATUSES.includes(status);

      if (isReview) {
        checkPermission(
          user.permissions,
          'can_review_accountability',
          'You do not have permission to review accountabilities'
        );
      }

      const [[current]] = await db.execute(
        `SELECT requisition_id, reported_by, status FROM accountability_records WHERE id = ? LIMIT 1`,
        [id]
      );
      if (!current) {
        throw new GraphQLError('Accountability record not found.', { extensions: { code: 'NOT_FOUND' } });
      }

      if (isReview) {
        if (!REVIEWABLE_STATUSES.includes(current.status)) {
          throw new GraphQLError('Only a submitted accountability can be reviewed.', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
        if (status === 'Amend' && !String(notes || '').trim()) {
          throw new GraphQLError('Please describe what additional information is needed.', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
      } else {
        // The only other transition is the reporter submitting their own report.
        const expected = current.status === 'Amend' ? 'Amended' : 'Pending';
        if (status !== expected || !EDITABLE_STATUSES.includes(current.status)) {
          throw new GraphQLError(`An accountability cannot be moved from ${current.status} to ${status}.`, {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
        if (!sameUser(current.reported_by, userId)) {
          throw new GraphQLError('Only the person who reported this accountability can submit it.', {
            extensions: { code: 'FORBIDDEN' },
          });
        }
      }

      const updateFields = [
        'status = ?',
        'updated_at = CURRENT_TIMESTAMP',
      ];
      const values = [status];

      if (notes) {
        updateFields.push('review_notes = ?');
        values.push(notes);
      }
      if (isReview) {
        updateFields.push('reviewed_by = ?', 'reviewed_at = CURRENT_TIMESTAMP');
        values.push(userId);
      }

      values.push(id);
      await db.execute(
        `UPDATE accountability_records SET ${updateFields.join(', ')} WHERE id = ?`,
        values
      );

      if (status === 'Closed' && current.requisition_id) {
        await db.execute(
          `UPDATE requisitions SET status = 'Closed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted = 0`,
          [current.requisition_id]
        );
      }

      // Let the person who reported this accountability know a review decision was made.
      // entityId is the *requisition* id, not the accountability record's own id -
      // accountabilities only have a route through their requisition
      // (/requisitions/:id/accountability), so that's what the client needs to navigate.
      if (!isReview) {
        notifyReviewers({
          requisitionId: current.requisition_id,
          userId,
          resubmitted: status === 'Amended',
        });
      }

      if (isReview && current.reported_by && current.requisition_id) {
        notifyUser({
          userId: current.reported_by,
          type: `Accountability${status}`,
          title: status === 'Closed' ? 'Accountability closed' : 'Accountability needs more information',
          message:
            status === 'Closed'
              ? 'Your accountability report was reviewed and closed.'
              : `Additional information was requested on your accountability report.${notes ? ` Note: ${notes}` : ''}`,
          entityType: 'Accountability',
          entityId: current.requisition_id,
          createdBy: userId || null,
        });
      }

      const [[updated]] = await db.execute(
        `SELECT * FROM accountability_records WHERE id = ? LIMIT 1`,
        [id]
      );

      return mapRecord(updated);
    },

    deleteAccountability: async (_parent, { id }, context) => {
      const user = requireUser(context);
      const [[current]] = await db.execute(
        `SELECT reported_by, status FROM accountability_records WHERE id = ? LIMIT 1`,
        [id]
      );
      if (!current) return false;
      if (!sameUser(current.reported_by, user.id)) {
        throw new GraphQLError('Only the person who reported this accountability can delete it.', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      if (current.status !== 'Draft') {
        throw new GraphQLError('Only a draft accountability can be deleted.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        await connection.execute(`DELETE FROM accountability_items WHERE accountability_id = ?`, [id]);
        const [result] = await connection.execute(`DELETE FROM accountability_records WHERE id = ?`, [id]);
        await connection.commit();
        return Boolean(result?.affectedRows);
      } catch (error) {
        await connection.rollback();
        throw new GraphQLError(error.message || 'Failed to delete accountability.');
      } finally {
        connection.release();
      }
    },
  },
};

export default accountabilityResolvers;
