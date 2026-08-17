import { GraphQLError } from 'graphql';
import { JSONResolver } from 'graphql-scalars';
import saveData from '../../utils/db/saveData.js';
import { db } from '../../config/config.js';
import { getUsers } from '../user/resolvers.js';
import { fetchPrograms } from '../programs/resolvers.js';
import saveUpload from '../../helpers/saveUpload.js';
import checkPermission from '../../helpers/checkPermission.js';
import hasPermission from '../../helpers/hasPermission.js';

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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
  reason: row.reason || null,
  totalRequestedAmount: toNumber(row.total_requested_amount, 0),
  createdAt: row.created_at,
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

const getRequisitions = async ({ limit, offset, search, userId, canApproveRequisitions }) => {
  const trimmed = search ? String(search).trim() : null;
  const values = [];
  let where = 'WHERE r.deleted = 0';

  if (canApproveRequisitions) {
    where += ' AND r.status IN (?, ?)';
    values.push('Approved', 'Accepted');
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

      const canViewRequisitions = hasPermission(
        userPermissions,
        "can_view_own_requisitions"
      );

      const canAcceptRequisitions = hasPermission(
        userPermissions,
        "can_accept_requisitions"
      );
      const canApproveRequisitions = hasPermission(
        userPermissions,
        "can_approve_requisitions"
      );
      
      return await getRequisitions({ 
        limit, 
        offset, 
        search,
        userId : canViewRequisitions ? user_id : null,
        canApproveRequisitions
      });

    },
    requisition: async (_parent, { id }) => {
      const [[row]] = await db.execute(
        `SELECT * FROM requisitions WHERE id = ? AND deleted = 0 LIMIT 1`,
        [id]
      );
      return row ? mapRequisition(row) : null;
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
        status,
        items,
        conceptNote,
      } = input;

      console.log('createRequisition input items:', input.items);

      const userId = context?.req?.user?.id;
      if (!userId) {
        throw new GraphQLError('User is required.');
      }

      if (!programId || !Array.isArray(items) || !items.length) {
        throw new GraphQLError('Program, title, and at least one item are required.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const totalRequestedAmount = items.reduce((sum, item) => {
        const quantity = toNumber(item.quantity, 1);
        const frequency = toNumber(item.frequency, 1);
        const unitCost = toNumber(item.unitCost, 0);
        const units = item.units;
        return sum + quantity * frequency * unitCost ;
      }, 0);

      const requisitionNo = input?.requisitionNo || (id ? null : await getNextRequisitionNo());

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
            requested_by: userId,
            title: String(title).trim(),
            purpose: purpose || null,
            status: 'Pending',
            total_requested_amount: totalRequestedAmount,
            deleted: 0,
            updated_at: new Date(),
            ...(id ? {} : { created_at: new Date() }),
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

        for (const [index, item] of items.entries()) {
          const quantity = toNumber(item.quantity, 1);
          const frequency = toNumber(item.frequency, 1);
          const unitCost = toNumber(item.unitCost, 0);
          const units = toNumber(item.units, 1);
          const amount = quantity * frequency * unitCost;

          await saveData({
            table: 'requisition_items',
            id: item.id ?? null,
            data: {
              requisition_id: requisitionIdString,
              budget_line_id: item.budgetLineId,
              description: item.description || '',
              quantity,
              frequency,
              unit_cost: unitCost,
              units,
              amount,
              // sort_order: index,
              updated_at: new Date(),
              created_at: new Date(),
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

        return {
          success: true,
          message: id ? 'Requisition updated successfully' : 'Requisition created successfully',
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
      const [[current]] = await db.execute(
        `SELECT reason FROM requisitions WHERE id = ? AND deleted = 0 LIMIT 1`,
        [id]
      );

      if (!current) {
        throw new GraphQLError('Requisition not found.', { extensions: { code: 'NOT_FOUND' } });
      }

      let reasonLog = [];
      try {
        reasonLog = current.reason ? JSON.parse(current.reason) : [];
      } catch {
        reasonLog = [];
      }

      reasonLog.push({
        action: status,
        at: new Date().toISOString(),
        ...(reason ? { reason } : {}),
        ...(context?.req?.user?.id ? { by: String(context.req.user.id) } : {}),
      });

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

      return mapRequisition(updated);
    },
    deleteRequisition: async (_parent, { id }) => {
      const [result] = await db.execute(
        `UPDATE requisitions SET deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted = 0`,
        [id]
      );

      return Boolean(result?.affectedRows);
    },
  },
};

export default requisitionResolvers;
