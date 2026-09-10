import { GraphQLError } from 'graphql';
import saveData from '../../utils/db/saveData.js';
import saveUpload from '../../helpers/saveUpload.js';
import { db } from '../../config/config.js';
import checkPermission from '../../helpers/checkPermission.js';

const REVIEW_STATUSES = ['Closed', 'Amend'];

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  reportDate: row.report_date || null,
  summary: row.summary || null,
  totalAccountedAmount: toNumber(row.total_accounted_amount, 0),
  varianceAmount: toNumber(row.variance_amount, 0),
  reviewedAt: row.reviewed_at || null,
  reviewNotes: row.review_notes || null,
  reviewedById: row.reviewed_by ? String(row.reviewed_by) : null,
  createdAt: row.created_at,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fetchItems = async (accountabilityId) => {
  const [rows] = await db.execute(
    `SELECT * FROM accountability_items WHERE accountability_id = ? ORDER BY sort_order ASC, id ASC`,
    [accountabilityId]
  );
  return rows.map(mapItem);
};

const getNextAccountNo = async () => {
  const [rows] = await db.execute(`SELECT MAX(id) AS max_id FROM accountability_records`);
  const next = Number(rows?.[0]?.max_id || 0) + 1;
  return `ACC-${new Date().getFullYear()}-${String(next).padStart(4, '0')}`;
};

// ─── Resolvers ────────────────────────────────────────────────────────────────

const accountabilityResolvers = {
  Query: {
    accountabilities: async (_parent, { limit, offset, search, requisitionId }) => {
      const values = [];
      let where = 'WHERE ar.id IS NOT NULL';

      if (requisitionId) {
        where += ' AND ar.requisition_id = ?';
        values.push(requisitionId);
      }

      if (search) {
        const like = `%${String(search).trim()}%`;
        where += ' AND (ar.summary LIKE ? OR ar.status LIKE ?)';
        values.push(like, like);
        values.push(like, like, like);
      }

      let sql = `SELECT ar.* FROM accountability_records ar ${where} ORDER BY ar.id DESC`;
      if (typeof limit === 'number') { sql += ' LIMIT ?'; values.push(limit); }
      if (typeof offset === 'number') { sql += ' OFFSET ?'; values.push(offset); }

      const [rows] = await db.execute(sql, values);
      return rows.map(mapRecord);
    },

    accountability: async (_parent, { id }) => {
      const [[row]] = await db.execute(
        `SELECT * FROM accountability_records WHERE id = ? LIMIT 1`,
        [id]
      );
      return row ? mapRecord(row) : null;
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

      const userId = context?.req?.user?.id;
      if (!userId) throw new GraphQLError('Authentication required.');

      if (!requisitionId || !Array.isArray(items) || !items.length) {
        throw new GraphQLError('Requisition and at least one item are required.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const totalAccountedAmount = items.reduce(
        (sum, item) => sum + toNumber(item.accountedAmount, 0) + toNumber(item.bankCharges, 0),
        0
      );

      // Compute variance against the linked requisition's total
      let varianceAmount = 0;
      const [[reqRow]] = await db.execute(
        `SELECT total_requested_amount FROM requisitions WHERE id = ? AND deleted = 0 LIMIT 1`,
        [requisitionId]
      );
      if (reqRow) {
        varianceAmount = toNumber(reqRow.total_requested_amount, 0) - totalAccountedAmount;
      }

      const accountNo = id ? null : await getNextAccountNo();

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        const accountabilityId = await saveData({
          table: 'accountability_records',
          id: id ?? null,
          data: {
            
            requisition_id: requisitionId,
            reported_by: userId,
            status: status || 'Draft',
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

        if (id) {
          await connection.execute(
            `DELETE FROM accountability_items WHERE accountability_id = ?`,
            [accountabilityIdStr]
          );
        }

        for (const [index, item] of items.entries()) {
          // Save uploads if provided
          let invoiceInfo = null;
          let popInfo = null;
          let receiptInfo = null;

          if (item.invoice) {
            try { invoiceInfo = await saveUpload({ file: item.invoice, subdir: 'accountability_docs' }); } catch {}
          }
          if (item.proofOfPayment) {
            try { popInfo = await saveUpload({ file: item.proofOfPayment, subdir: 'accountability_docs' }); } catch {}
          }
          if (item.receipt) {
            try { receiptInfo = await saveUpload({ file: item.receipt, subdir: 'accountability_docs' }); } catch {}
          }

          const savedItem = await saveData({
            table: 'accountability_items',
            data: {
              accountability_id: accountabilityIdStr,
              requisition_item_id: item.requisitionItemId || null,
              description: item.description,
              accounted_amount: toNumber(item.accountedAmount, 0),
              bank_charges: toNumber(item.bankCharges, 0),
              sort_order: index,
              updated_at: new Date(),
              created_at: new Date(),
            },
            connection,
          });

          if (invoiceInfo || popInfo || receiptInfo) {
            await saveData({
              table: 'accountability_items',
              id: savedItem,
              data: {
                ...(invoiceInfo ? {invoice_name: invoiceInfo.filename } : {}),
                ...(popInfo ? { proof_of_payment_name: popInfo.filename } : {}),
                ...(receiptInfo ? { receipt_name: receiptInfo.filename } : {}),
              },
              connection,
            });
          }
        }

        await connection.commit();

        const [[saved]] = await db.execute(
          `SELECT * FROM accountability_records WHERE id = ? LIMIT 1`,
          [accountabilityIdStr]
        );

        return {
          success: true,
          message: id ? 'Accountability updated successfully.' : 'Accountability created successfully.',
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
      const userId = context?.req?.user?.id;
      const userPermissions = context?.req?.user?.permissions;

      console.log('status', status)

      if (REVIEW_STATUSES.includes(status)) {
        checkPermission(
          userPermissions,
          'can_review_accountability',
          'You do not have permission to review accountabilities'
        );
      }

      const [[current]] = await db.execute(
        `SELECT requisition_id FROM accountability_records WHERE id = ? LIMIT 1`,
        [id]
      );
      if (!current) {
        throw new GraphQLError('Accountability record not found.', { extensions: { code: 'NOT_FOUND' } });
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
      if (userId && (status === 'Reviewed' || status === 'Approved' || REVIEW_STATUSES.includes(status))) {
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

      const [[updated]] = await db.execute(
        `SELECT * FROM accountability_records WHERE id = ? LIMIT 1`,
        [id]
      );

      return mapRecord(updated);
    },

    deleteAccountability: async (_parent, { id }) => {
      const [result] = await db.execute(
        `DELETE FROM accountability_records WHERE id = ?`,
        [id]
      );
      return Boolean(result?.affectedRows);
    },
  },
};

export default accountabilityResolvers;
