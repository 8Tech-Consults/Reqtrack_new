import { GraphQLError } from 'graphql';
import { JSONResolver } from 'graphql-scalars';
import saveData from '../../utils/db/saveData.js';
import { db } from '../../config/config.js';
import { getUsers } from '../user/resolvers.js';
import { fetchPrograms } from '../programs/resolvers.js';
import saveUpload from '../../helpers/saveUpload.js';
import checkPermission from '../../helpers/checkPermission.js';
import hasPermission from '../../helpers/hasPermission.js';
import { notifyUser, notifyUsersWithPermission } from '../../helpers/notifications.js';

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toIso = (value) => (value instanceof Date ? value.toISOString() : value);

const sameUser = (a, b) => a != null && b != null && String(a) === String(b);

// Who may edit a requisition, by its current status.
const OWNER_EDITABLE_STATUSES = ['Pending', 'Amendment Requested'];
const REVIEWER_EDITABLE_STATUSES = ['Pending', 'Amended'];

// Legal decisions: current status -> permission needed -> statuses it may move to.
const DECISIONS = ['Accepted', 'Rejected', 'Amendment Requested'];
const TRANSITIONS = {
  Pending: { permission: 'can_accept_requisitions', next: DECISIONS },
  Amended: { permission: 'can_accept_requisitions', next: DECISIONS },
  Accepted: { permission: 'can_approve_requisitions', next: ['Approved', 'Rejected', 'Amendment Requested'] },
};
const REASON_REQUIRED = ['Rejected', 'Amendment Requested'];

// Stored status -> the wording shown to people (first approval is "Approved",
// final sign-off is "Authorized").
const DECISION_WORDING = {
  Accepted: 'approved',
  Approved: 'authorized',
  Rejected: 'rejected',
  'Amendment Requested': 'returned for amendment',
};

const requireUser = (context) => {
  const user = context?.req?.user;
  if (!user?.id) {
    throw new GraphQLError('Authentication required.', { extensions: { code: 'UNAUTHENTICATED' } });
  }
  return user;
};

// People who act on requisitions always see everyone's; otherwise
// can_view_own_requisitions narrows the view to the caller's own.
const viewScope = (permissions) => {
  const canAccept = hasPermission(permissions, 'can_accept_requisitions');
  const canApprove = hasPermission(permissions, 'can_approve_requisitions');
  return {
    ownOnly: hasPermission(permissions, 'can_view_own_requisitions') && !canAccept && !canApprove,
    approverOnly: canApprove && !canAccept,
  };
};

const parseReasonLog = (value) => {
  if (Array.isArray(value)) return value;
  try {
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getUserName = async (userId) => {
  const [[row]] = await db.execute(`SELECT name FROM users WHERE id = ? LIMIT 1`, [userId]);
  return row?.name || null;
};

const logEntry = ({ action, userId, userName, reason }) => ({
  action,
  at: new Date().toISOString(),
  ...(reason ? { reason } : {}),
  by: String(userId),
  ...(userName ? { byName: userName } : {}),
});

const mapRequisitionItem = (row) => ({
  id: String(row.id),
  budgetLineId: row.budget_line_id ? String(row.budget_line_id) : null,
  description: row.description,
  quantity: toNumber(row.quantity, 1),
  frequency: toNumber(row.frequency, 1),
  unitCost: toNumber(row.unit_cost, 0),
  units: row.units || '',
  amount: toNumber(row.amount, 0),
  // sortOrder: toNumber(row.sort_order, 0),
});

const mapRequisition = (row) => ({
  id: String(row.id),
  requisitionNo: row.requisition_no,
  programId: String(row.program_id),
  outcomeId: row.outcome_id ? String(row.outcome_id) : null,
  outputId: row.output_id ? String(row.output_id) : null,
  activityId: row.activity_id ? String(row.activity_id) : null,
  requestedById: String(row.requested_by),
  title: row.title,
  purpose: row.purpose,
  conceptNotePath: row.concept_note_path || null,
  conceptNoteName: row.concept_note_name || null,
  status: row.status,
  rejectionReason: row.rejection_reason || null,
  reason: row.reason ? (typeof row.reason === 'string' ? row.reason : JSON.stringify(row.reason)) : null,
  totalRequestedAmount: toNumber(row.total_requested_amount, 0),
  createdAt: toIso(row.created_at),
});

const fetchRequisitionItems = async (requisitionId) => {
  const [rows] = await db.execute(
    `SELECT id, budget_line_id, description, quantity, frequency, unit_cost, units, amount
     FROM requisition_items
     WHERE requisition_id = ?
     ORDER BY id ASC`,
    [requisitionId]
  );

  return rows.map(mapRequisitionItem);
};

// Shared by the list and its count so the two can never disagree.
const buildRequisitionsWhere = ({ search, userId, approverOnly }) => {
  const trimmed = search ? String(search).trim() : null;
  const values = [];
  let where = 'WHERE r.deleted = 0';

  if (approverOnly) {
    where += ' AND r.status IN (?, ?, ?)';
    values.push('Approved', 'Accepted', 'Closed');
  }

  if (userId) {
    where += " AND r.requested_by = ?";
    values.push(userId);
  }

  if (trimmed) {
    where += ' AND (r.title LIKE ? OR r.requisition_no LIKE ? OR r.status LIKE ?)';
    const like = `%${trimmed}%`;
    values.push(like, like, like);
  }

  return { where, values };
};

const getRequisitions = async ({ limit, offset, search, userId, approverOnly }) => {
  const { where, values } = buildRequisitionsWhere({ search, userId, approverOnly });

  let sql = `SELECT r.* FROM requisitions r ${where} ORDER BY r.id DESC`;
  if (typeof limit === 'number') {
    sql += ' LIMIT ?';
    values.push(limit);
  }
  if (typeof offset === 'number') {
    sql += ' OFFSET ?';
    values.push(offset);
  }

  const [results] = await db.execute(sql, values);
  return results.map(mapRequisition);
};

const getNextRequisitionNo = async () => {
  const [rows] = await db.execute(`SELECT MAX(id) AS max_id FROM requisitions`);
  const next = Number(rows?.[0]?.max_id || 0) + 1;
  const padded = String(next).padStart(4, '0');
  return `REQ-${new Date().getFullYear()}-${padded}`;
};

const requisitionResolvers = {
  JSON: JSONResolver,
  Query: {
    requisitions: async (_parent, args, context) => {
      const { limit, offset, search } = args;
      const userPermissions = context.req.user.permissions;
      const user_id = context.req.user.id;

      checkPermission(
        userPermissions,
        "can_view_requisitions",
        "You dont have permissions to view requisitions"
      );

      const { ownOnly, approverOnly } = viewScope(userPermissions);

      return await getRequisitions({
        limit,
        offset,
        search,
        userId: ownOnly ? user_id : null,
        approverOnly,
      });

    },
    requisitionsCount: async (_parent, { search }, context) => {
      const user = requireUser(context);
      checkPermission(
        user.permissions,
        "can_view_requisitions",
        "You dont have permissions to view requisitions"
      );

      const { ownOnly, approverOnly } = viewScope(user.permissions);
      const { where, values } = buildRequisitionsWhere({
        search,
        userId: ownOnly ? user.id : null,
        approverOnly,
      });
      const [[row]] = await db.execute(`SELECT COUNT(*) AS c FROM requisitions r ${where}`, values);
      return Number(row?.c || 0);
    },
    requisition: async (_parent, { id }, context) => {
      const user = requireUser(context);
      checkPermission(
        user.permissions,
        "can_view_requisitions",
        "You dont have permissions to view requisitions"
      );

      const [[row]] = await db.execute(
        `SELECT * FROM requisitions WHERE id = ? AND deleted = 0 LIMIT 1`,
        [id]
      );
      if (!row) return null;

      if (viewScope(user.permissions).ownOnly && !sameUser(row.requested_by, user.id)) {
        throw new GraphQLError('You do not have permission to view this requisition.', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      return mapRequisition(row);
    },
    requisitionPrograms: async () => {
      const [rows] = await db.execute(
        `SELECT py.id AS project_year_id, py.template_id, pt.name AS program_name, py.financial_year
         FROM project_years py
         INNER JOIN project_templates pt ON pt.id = py.template_id AND pt.deleted = 0
         WHERE py.deleted = 0
         ORDER BY py.financial_year DESC, pt.name ASC`
      );

      return rows.map((row) => ({
        projectYearId: String(row.project_year_id),
        templateId: String(row.template_id),
        programName: row.program_name,
        financialYear: Number(row.financial_year),
      }));
    },
    requisitionOutcomes: async (_parent, { projectYearId }) => {
      const [rows] = await db.execute(
        `SELECT DISTINCT o.id, o.name
         FROM project_years py
         INNER JOIN template_outcomes o ON o.template_id = py.template_id AND o.deleted = 0
         WHERE py.id = ? AND py.deleted = 0
         ORDER BY o.id ASC, o.created_at ASC`,
        [projectYearId]
      );

      return rows.map((row) => ({ id: String(row.id), name: row.name }));
    },
    requisitionOutputs: async (_parent, { outcomeId }) => {
      const [rows] = await db.execute(
        `SELECT id, name
         FROM template_outputs
         WHERE outcome_id = ? AND deleted = 0
         ORDER BY id ASC, created_at ASC`,
        [outcomeId]
      );

      return rows.map((row) => ({ id: String(row.id), name: row.name }));
    },
    requisitionActivities: async (_parent, { outputId }) => {
      const [rows] = await db.execute(
        `SELECT id, name
         FROM template_activities
         WHERE output_id = ? AND deleted = 0
         ORDER BY id ASC, created_at ASC`,
        [outputId]
      );

      return rows.map((row) => ({ id: String(row.id), name: row.name }));
    },
    requisitionBudgetLines: async (_parent, { projectYearId, activityId }) => {
      const [rows] = await db.execute(
        `SELECT tbl.id, tbl.activity_id, tbl.name,
                COALESCE(abi.quantity, 1) AS quantity,
                COALESCE(abi.frequency, 1) AS frequency,
                COALESCE(abi.unit_cost, 0) AS unit_cost,
                COALESCE(abi.units, '') AS units,
                COALESCE(abi.planned_amount, 0) AS planned_amount,
                COALESCE(abi.actual_amount, 0) AS actual_amount
         FROM template_budget_lines tbl
         LEFT JOIN annual_budget_inputs abi
           ON abi.budget_line_id = tbl.id
          AND abi.project_year_id = ?
         WHERE tbl.activity_id = ? AND tbl.deleted = 0
         ORDER BY tbl.created_at ASC`,
        [projectYearId, activityId]
      );

      return rows.map((row) => ({
        id: String(row.id),
        activityId: String(row.activity_id),
        name: row.name,
        quantity: toNumber(row.quantity, 1),
        frequency: toNumber(row.frequency, 1),
        unitCost: toNumber(row.unit_cost, 0),
        units: row.units || '',
        plannedAmount: toNumber(row.planned_amount, 0),
        actualAmount: toNumber(row.actual_amount, 0),
      }));
    },
  },
  Requisition: {
    items: async (parent) => {
      return await fetchRequisitionItems(parent.id);
    },
    // The decision log with each actor resolved to a name and signature here,
    // so viewers don't need permission to list users to see who did what.
    history: async (parent) => {
      const log = parseReasonLog(parent.reason);
      if (!log.length) return [];

      const ids = [...new Set(log.map((entry) => entry.by).filter(Boolean).map(String))];
      const people = new Map();
      if (ids.length) {
        const [rows] = await db.execute(
          `SELECT u.id, u.name, s.signature
           FROM users u
           LEFT JOIN staff s ON s.user_id = u.id
           WHERE u.id IN (${ids.map(() => '?').join(', ')})`,
          ids
        );
        rows.forEach((row) => people.set(String(row.id), row));
      }

      return log.map((entry) => {
        const person = entry.by ? people.get(String(entry.by)) : null;
        return {
          action: String(entry.action || ''),
          at: entry.at || null,
          reason: entry.reason || null,
          byId: entry.by ? String(entry.by) : null,
          byName: person?.name || entry.byName || null,
          bySignature: person?.signature || null,
        };
      });
    },
    requestedBy: async (parent) => {
      const [user] = await getUsers({ id: parent.requestedById });
      return user || null;
    },
    program: async (parent) => {
      const [program] = await fetchPrograms({ id: parent.programId });
      
      return program || null;
    },
    outcome: async (parent) => {
      const [outcome] = await db.execute(
        `SELECT id, name FROM program_outcomes WHERE id = ? AND deleted = 0 LIMIT 1`,
        [parent.outcomeId]
      );
      return outcome?.[0] ? { id: String(outcome[0].id), name: outcome[0].name } : null;
    },
    output: async (parent) => {
      const [output] = await db.execute(
        `SELECT id, name FROM program_outputs WHERE id = ? AND deleted = 0 LIMIT 1`,
        [parent.outputId]
      );
      return output?.[0] ? { id: String(output[0].id), name: output[0].name } : null;
    },
    activity: async (parent) => {
      const [activity] = await db.execute(
        `SELECT id, name FROM program_activities WHERE id = ? AND deleted = 0 LIMIT 1`,
        [parent.activityId]
      );
      return activity?.[0] ? { id: String(activity[0].id), name: activity[0].name } : null;
    }
  },
  Mutation: {
    createRequisition: async (_parent, { input }, context) => {
      const {
        id,
        programId,
        outcomeId,
        outputId,
        activityId,
        title,
        purpose,
        items,
        conceptNote,
      } = input;

      const user = requireUser(context);
      const userId = user.id;

      if (!programId || !Array.isArray(items) || !items.length) {
        throw new GraphQLError('Program, title, and at least one item are required.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      let existing = null;
      let isOwner = true;
      if (id) {
        checkPermission(
          user.permissions,
          'can_edit_requisitions',
          'You do not have permission to edit requisitions'
        );

        const [[row]] = await db.execute(
          `SELECT id, requested_by, status, reason, total_requested_amount
           FROM requisitions WHERE id = ? AND deleted = 0 LIMIT 1`,
          [id]
        );
        if (!row) {
          throw new GraphQLError('Requisition not found.', { extensions: { code: 'NOT_FOUND' } });
        }

        isOwner = sameUser(row.requested_by, userId);
        if (!isOwner && viewScope(user.permissions).ownOnly) {
          throw new GraphQLError('You can only edit your own requisitions.', {
            extensions: { code: 'FORBIDDEN' },
          });
        }

        const editable = isOwner ? OWNER_EDITABLE_STATUSES : REVIEWER_EDITABLE_STATUSES;
        if (!editable.includes(row.status)) {
          throw new GraphQLError(
            `This requisition is ${row.status} and can no longer be edited.`,
            { extensions: { code: 'BAD_USER_INPUT' } }
          );
        }
        existing = row;
      } else {
        checkPermission(
          user.permissions,
          'can_create_requisitions',
          'You do not have permission to create requisitions'
        );
        if (!conceptNote) {
          throw new GraphQLError('Concept note is required.', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
      }

      const totalRequestedAmount = items.reduce((sum, item) => {
        const quantity = toNumber(item.quantity, 1);
        const frequency = toNumber(item.frequency, 1);
        const unitCost = toNumber(item.unitCost, 0);
        return sum + quantity * frequency * unitCost;
      }, 0);

      // A requester saving after an amendment request is resubmitting for review.
      const resubmitting = Boolean(existing) && isOwner && existing.status === 'Amendment Requested';
      const nextStatus = !existing ? 'Pending' : resubmitting ? 'Amended' : existing.status;

      const userName = await getUserName(userId);
      const reasonLog = parseReasonLog(existing?.reason);
      if (!existing) {
        reasonLog.push(logEntry({ action: 'Submitted', userId, userName }));
      } else if (resubmitting) {
        reasonLog.push(logEntry({ action: 'Amended', userId, userName }));
      } else if (!isOwner) {
        // A reviewer changed someone else's requisition: keep a record of it.
        const before = toNumber(existing.total_requested_amount, 0);
        reasonLog.push(
          logEntry({
            action: 'Adjusted',
            userId,
            userName,
            reason:
              before === totalRequestedAmount
                ? 'Requisition details edited; total unchanged.'
                : `Total changed from ${before} to ${totalRequestedAmount}.`,
          })
        );
      }

      const requisitionNo = id ? null : await getNextRequisitionNo();

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        const requisitionId = await saveData({
          table: 'requisitions',
          id: id ?? null,
          data: {
            ...(requisitionNo ? { requisition_no: requisitionNo } : {}),
            program_id: programId,
            outcome_id: outcomeId || null,
            output_id: outputId || null,
            activity_id: activityId || null,
            title: String(title).trim(),
            purpose: purpose || null,
            status: nextStatus,
            reason: JSON.stringify(reasonLog),
            total_requested_amount: totalRequestedAmount,
            updated_at: new Date(),
            // The requester and creation time are fixed at creation.
            ...(id ? {} : { requested_by: userId, deleted: 0, created_at: new Date() }),
          },
          connection,
        });

        const requisitionIdString = String(requisitionId);

        //upload concept note file if provided
        let conceptInfo = null;
        if (conceptNote) {
          try {
            conceptInfo = await saveUpload({
              file: conceptNote,
              subdir: "concept_notes",
            });
          } catch (e) {
            // If upload fails, rollback and bubble up
            throw new GraphQLError(`Concept note upload failed: ${e.message}`);
          }
        }

        // Lines the caller dropped from the form are removed; the rest are
        // updated in place and new ones inserted.
        const existingItemIds = new Set();
        if (id) {
          const [itemRows] = await connection.execute(
            `SELECT id FROM requisition_items WHERE requisition_id = ?`,
            [requisitionIdString]
          );
          itemRows.forEach((row) => existingItemIds.add(String(row.id)));

          const keptIds = new Set(items.map((item) => (item.id ? String(item.id) : null)));
          for (const itemId of existingItemIds) {
            if (!keptIds.has(itemId)) {
              await connection.execute(
                `DELETE FROM requisition_items WHERE id = ? AND requisition_id = ?`,
                [itemId, requisitionIdString]
              );
            }
          }
        }

        for (const item of items) {
          const quantity = toNumber(item.quantity, 1);
          const frequency = toNumber(item.frequency, 1);
          const unitCost = toNumber(item.unitCost, 0);
          const units = toNumber(item.units, 1);
          const amount = quantity * frequency * unitCost;
          // Only update a line that really belongs to this requisition.
          const itemId = item.id && existingItemIds.has(String(item.id)) ? item.id : null;

          await saveData({
            table: 'requisition_items',
            id: itemId,
            data: {
              requisition_id: requisitionIdString,
              budget_line_id: item.budgetLineId,
              description: item.description || '',
              quantity,
              frequency,
              unit_cost: unitCost,
              units,
              amount,
              updated_at: new Date(),
              ...(itemId ? {} : { created_at: new Date() }),
            },
            connection,
          });
        }

        if (conceptInfo) {
          try {
            await saveData({
              table: 'requisitions',
              id: requisitionIdString,
              data: {
                concept_note_name: conceptInfo?.filename || null,
                updated_at: new Date(),
              },
              connection,
            });
          } catch (e) {
            throw new GraphQLError(`Failed to save concept note info: ${e.message}`);
          }
        }

        await connection.commit();

        const [[saved]] = await db.execute(
          `SELECT * FROM requisitions WHERE id = ? LIMIT 1`,
          [requisitionIdString]
        );

        // New and resubmitted requisitions notify whoever reviews them first.
        if (saved && (!id || resubmitting)) {
          notifyUsersWithPermission({
            permissionKey: 'can_accept_requisitions',
            excludeUserId: userId,
            type: resubmitting ? 'RequisitionAmended' : 'RequisitionSubmitted',
            title: resubmitting
              ? 'Amended requisition awaiting approval'
              : 'New requisition awaiting approval',
            message: resubmitting
              ? `${saved.title} (${saved.requisition_no}) was amended and resubmitted for approval.`
              : `${saved.title} (${saved.requisition_no}) was submitted for approval.`,
            entityType: 'Requisition',
            entityId: requisitionIdString,
            createdBy: userId,
          });
        }

        return {
          success: true,
          message: resubmitting
            ? 'Requisition resubmitted successfully'
            : id ? 'Requisition updated successfully' : 'Requisition created successfully',
          requisition: saved ? mapRequisition(saved) : null,
        };
      } catch (error) {
        await connection.rollback();
        throw new GraphQLError(error.message || 'Failed to save requisition.');
      } finally {
        connection.release();
      }
    },
    updateRequisitionStatus: async (_parent, { id, status, reason }, context) => {
      const user = requireUser(context);
      const userId = user.id;

      const [[current]] = await db.execute(
        `SELECT status, reason, requested_by, title, requisition_no FROM requisitions WHERE id = ? AND deleted = 0 LIMIT 1`,
        [id]
      );

      if (!current) {
        throw new GraphQLError('Requisition not found.', { extensions: { code: 'NOT_FOUND' } });
      }

      const transition = TRANSITIONS[current.status];
      if (!transition || !transition.next.includes(status)) {
        throw new GraphQLError(
          `A requisition that is ${current.status} cannot be moved to ${status}.`,
          { extensions: { code: 'BAD_USER_INPUT' } }
        );
      }
      checkPermission(
        user.permissions,
        transition.permission,
        'You do not have permission to act on this requisition at its current stage'
      );

      const trimmedReason = String(reason || '').trim();
      if (REASON_REQUIRED.includes(status) && !trimmedReason) {
        throw new GraphQLError('A reason is required for this decision.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const reasonLog = parseReasonLog(current.reason);
      reasonLog.push(
        logEntry({
          action: status,
          userId,
          userName: await getUserName(userId),
          reason: trimmedReason || null,
        })
      );

      await db.execute(
        `UPDATE requisitions SET status = ?, reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted = 0`,
        [status, JSON.stringify(reasonLog), id]
      );

      const [[updated]] = await db.execute(
        `SELECT * FROM requisitions WHERE id = ? AND deleted = 0 LIMIT 1`,
        [id]
      );

      if (!updated) {
        throw new GraphQLError('Requisition not found.', { extensions: { code: 'NOT_FOUND' } });
      }

      const label = `${current.title} (${current.requisition_no})`;
      const wording = DECISION_WORDING[status] || status.toLowerCase();

      // Let the requester know once a decision has been made on their request.
      if (current.requested_by) {
        notifyUser({
          userId: current.requested_by,
          type: `Requisition${status.replace(/\s+/g, '')}`,
          title: `Requisition ${wording}`,
          message: `${label} was ${wording}.${trimmedReason ? ` Reason: ${trimmedReason}` : ''}`,
          entityType: 'Requisition',
          entityId: id,
          createdBy: userId,
        });
      }

      // First approval hands the requisition on to whoever gives final authorization.
      if (status === 'Accepted') {
        notifyUsersWithPermission({
          permissionKey: 'can_approve_requisitions',
          excludeUserId: userId,
          type: 'RequisitionAwaitingAuthorization',
          title: 'Requisition awaiting authorization',
          message: `${label} was approved and is awaiting your authorization.`,
          entityType: 'Requisition',
          entityId: id,
          createdBy: userId,
        });
      }

      return mapRequisition(updated);
    },
    deleteRequisition: async (_parent, { id }, context) => {
      const user = requireUser(context);
      checkPermission(
        user.permissions,
        'can_edit_requisitions',
        'You do not have permission to delete requisitions'
      );

      const [[current]] = await db.execute(
        `SELECT requested_by, status FROM requisitions WHERE id = ? AND deleted = 0 LIMIT 1`,
        [id]
      );
      if (!current) return false;

      const isOwner = sameUser(current.requested_by, user.id);
      if (!isOwner && viewScope(user.permissions).ownOnly) {
        throw new GraphQLError('You can only delete your own requisitions.', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
      if (!OWNER_EDITABLE_STATUSES.includes(current.status)) {
        throw new GraphQLError(`This requisition is ${current.status} and can no longer be deleted.`, {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const [result] = await db.execute(
        `UPDATE requisitions SET deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted = 0`,
        [id]
      );

      return Boolean(result?.affectedRows);
    },
  },
};

export default requisitionResolvers;
