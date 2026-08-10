import { GraphQLError } from 'graphql';
import { JSONResolver } from 'graphql-scalars';
import saveData from '../../utils/db/saveData.js';
import { db } from '../../config/config.js';

const mapProgramNode = (row) => ({
  id: String(row.id),
  name: row.name,
  quantity: Number(row.quantity || 1),
  frequency: Number(row.frequency || 1),
  unitPrice: Number(row.unit_price || 0),
  units: row.units || null,
  totalAmount: Number(row.total_amount || 0),
  sortOrder: Number(row.sort_order || 0)
});

const buildStructure = async (programIds) => {
  if (!programIds.length) return [];

  const placeholders = programIds.map(() => '?').join(', ');
  const [outcomes] = await db.execute(
    `SELECT id, program_id, name, sort_order
     FROM program_outcomes
     WHERE deleted = 0 AND program_id IN (${placeholders})
     ORDER BY sort_order ASC, created_at ASC`,
    programIds
  );

  const outcomeIds = outcomes.map((row) => String(row.id));
  let outputs = [];
  let activities = [];
  let budgetLines = [];

  if (outcomeIds.length) {
    const outcomePlaceholders = outcomeIds.map(() => '?').join(', ');
    [outputs] = await db.execute(
      `SELECT id, outcome_id, name, sort_order
       FROM program_outputs
       WHERE deleted = 0 AND outcome_id IN (${outcomePlaceholders})
       ORDER BY sort_order ASC, created_at ASC`,
      outcomeIds
    );

    const outputIds = outputs.map((row) => String(row.id));
    if (outputIds.length) {
      const outputPlaceholders = outputIds.map(() => '?').join(', ');
      [activities] = await db.execute(
        `SELECT id, output_id, name, sort_order
         FROM program_activities
         WHERE deleted = 0 AND output_id IN (${outputPlaceholders})
         ORDER BY sort_order ASC, created_at ASC`,
        outputIds
      );

      const activityIds = activities.map((row) => String(row.id));
      if (activityIds.length) {
        const activityPlaceholders = activityIds.map(() => '?').join(', ');
        [budgetLines] = await db.execute(
          `SELECT id, activity_id, name, quantity, frequency, unit_price, units, total_amount, sort_order
           FROM program_budget_lines
           WHERE deleted = 0 AND activity_id IN (${activityPlaceholders})
           ORDER BY sort_order ASC, created_at ASC`,
          activityIds
        );
      }
    }
  }

  const budgetLinesByActivity = budgetLines.reduce((acc, row) => {
    const key = String(row.activity_id);
    if (!acc[key]) acc[key] = [];
    acc[key].push(mapProgramNode(row));
    return acc;
  }, {});

  const activitiesByOutput = activities.reduce((acc, row) => {
    const key = String(row.output_id);
    if (!acc[key]) acc[key] = [];
    acc[key].push({
      ...mapProgramNode(row),
      budgetLines: budgetLinesByActivity[String(row.id)] || []
    });
    return acc;
  }, {});

  const outputsByOutcome = outputs.reduce((acc, row) => {
    const key = String(row.outcome_id);
    if (!acc[key]) acc[key] = [];
    acc[key].push({
      ...mapProgramNode(row),
      activities: activitiesByOutput[String(row.id)] || []
    });
    return acc;
  }, {});

  return outcomes.reduce((acc, row) => {
    const key = String(row.program_id);
    if (!acc[key]) acc[key] = [];
    acc[key].push({
      ...mapProgramNode(row),
      outputs: outputsByOutcome[String(row.id)] || []
    });
    return acc;
  }, {});
};

const syncStructureLevel = async ({ connection, table, parentColumn, parentId, items }) => {
  const [existingRows] = await connection.execute(
    `SELECT * FROM ${table} WHERE ${parentColumn} = ?`,
    [parentId]
  );

  const existingById = new Map(existingRows.map((row) => [String(row.id), row]));
  const keptIds = [];

  for (const [index, item] of items.entries()) {
    const rawId = item?.id ? String(item.id) : null;
    const existing = rawId ? existingById.get(rawId) : null;
    const name = String(item?.name || '').trim();
    if (!name) {
      throw new GraphQLError('Structure labels are required.', { extensions: { code: 'BAD_USER_INPUT' } });
    }

    const sortOrder = Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : index;
    const quantity = Number.isFinite(Number(item?.quantity)) ? Number(item.quantity) : 1;
    const frequency = Number.isFinite(Number(item?.frequency)) ? Number(item.frequency) : 1;
    const unitPrice = Number.isFinite(Number(item?.unitPrice)) ? Number(item.unitPrice) : 0;
    const units = String(item?.units || '').trim();
    const totalAmount = Number.isFinite(Number(item?.totalAmount))
      ? Number(item.totalAmount)
      : quantity * frequency * unitPrice;

    let resolvedId = rawId;
    if (existing) {
      await connection.execute(
        `UPDATE ${table}
         SET name = ?, quantity = ?, frequency = ?, unit_price = ?, units = ?, total_amount = ?, sort_order = ?, deleted = 0, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name, quantity, frequency, unitPrice, units, totalAmount, sortOrder, resolvedId]
      );
    } else {
      const [insertResult] = await connection.execute(
        `INSERT INTO ${table} (${parentColumn}, name, quantity, frequency, unit_price, units, total_amount, sort_order, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [parentId, name, quantity, frequency, unitPrice, units, totalAmount, sortOrder]
      );
      resolvedId = String(insertResult.insertId);
    }

    keptIds.push(resolvedId);
  }

  for (const row of existingRows) {
    const rowId = String(row.id);
    if (!keptIds.includes(rowId) && Number(row.deleted) === 0) {
      await connection.execute(
        `UPDATE ${table}
         SET deleted = 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [rowId]
      );
    }
  }

  return keptIds;
};

export const fetchPrograms = async ({id}) => {
  try {
    let values = [];
    let where = "WHERE p.deleted = 0";

    if (id) {
      where += " AND p.id = ?";
      values.push(id);
    }

    const [rows] = await db.execute(
      `SELECT p.id, p.name, p.description, p.budget_amount, p.program_manager_id, p.status, p.created_at,
              u.name AS program_manager_name
      FROM programs p
      LEFT JOIN users u ON u.id = p.program_manager_id
      ${where}
      ORDER BY p.created_at DESC`,
      values
    );

    if (!rows.length) return [];

    const programIds = rows.map((row) => String(row.id));
    const structureByProgram = await buildStructure(programIds);

    return rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      description: row.description || '',
      budgetAmount: Number(row.budget_amount || 0),
      programManagerId: row.program_manager_id || null,
      programManagerName: row.program_manager_name || null,
      status: row.status,
      createdAt: row.created_at,
      outcomes: structureByProgram[String(row.id)] || []
    }));
  } catch (error) {
    throw new GraphQLError(error.message || 'Failed to fetch programs.');
  }
};

const fetchProgramManagers = async () => {
  const [rows] = await db.execute(
    `SELECT u.id, u.name, r.name AS role_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.deleted = 0
     ORDER BY u.name ASC`
  );

  return rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    role: row.role_name || 'Staff'
  }));
};

const programsResolvers = {
  JSON: JSONResolver,
  Query: {
    programs: async () => fetchPrograms({id: null}),
    programManagers: async () => fetchProgramManagers()
  },
  Mutation: {
    createProgram: async (_parent, { input }, context) => {
      const userId = context?.req?.user?.id || null;
      const data = {
        name: String(input?.name || '').trim(),
        description: input?.description ? String(input.description).trim() : null,
        budget_amount: Number(input?.budgetAmount || 0),
        program_manager_id: input?.programManagerId || null,
        status: input?.status || 'active',
        deleted: 0,
        created_by: userId,
        updated_by: userId,
        created_at: new Date(),
        updated_at: new Date()
      };

      if (!data.name) {
        throw new GraphQLError('Program name is required.', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      const [[existing]] = await db.execute(
        `SELECT id FROM programs WHERE deleted = 0 AND LOWER(name) = LOWER(?) LIMIT 1`,
        [data.name]
      );

      if (existing && !input?.id) {
        throw new GraphQLError('A program with this name already exists.', {
          extensions: { code: 'BAD_USER_INPUT' }
        });
      }

      const saveId = input?.id || null;
      const savedId = await saveData({ table: 'programs', id: saveId, data, connection: null });
      const [programs] = await db.execute(
        `SELECT p.id, p.name, p.description, p.budget_amount, p.program_manager_id, p.status, p.created_at,
                u.name AS program_manager_name
         FROM programs p
         LEFT JOIN users u ON u.id = p.program_manager_id
         WHERE p.id = ?
         LIMIT 1`,
        [savedId]
      );

      return {
        success: true,
        message: input?.id ? 'Program updated successfully.' : 'Program created successfully.',
        program: {
          id: String(programs[0].id),
          name: programs[0].name,
          description: programs[0].description || '',
          budgetAmount: Number(programs[0].budget_amount || 0),
          programManagerId: programs[0].program_manager_id || null,
          programManagerName: programs[0].program_manager_name || null,
          status: programs[0].status,
          createdAt: programs[0].created_at,
          outcomes: []
        }
      };
    },
    saveProgramStructure: async (_parent, { input }, _context) => {
      const programId = String(input?.programId || '').trim();
      if (!programId) {
        throw new GraphQLError('Program is required.', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      const [[program]] = await db.execute(`SELECT id FROM programs WHERE id = ? AND deleted = 0 LIMIT 1`, [programId]);
      if (!program) {
        throw new GraphQLError('Program not found.', { extensions: { code: 'NOT_FOUND' } });
      }

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        const outcomeIds = await syncStructureLevel({
          connection,
          table: 'program_outcomes',
          parentColumn: 'program_id',
          parentId: programId,
          items: Array.isArray(input?.outcomes) ? input.outcomes : []
        });

        for (const [outcomeIndex, outcome] of (Array.isArray(input?.outcomes) ? input.outcomes : []).entries()) {
          const outcomeId = outcomeIds[outcomeIndex];
          const outputs = Array.isArray(outcome?.outputs) ? outcome.outputs : [];
          const outputIds = await syncStructureLevel({
            connection,
            table: 'program_outputs',
            parentColumn: 'outcome_id',
            parentId: outcomeId,
            items: outputs
          });

          for (const [outputIndex, output] of outputs.entries()) {
            const outputId = outputIds[outputIndex];
            const activities = Array.isArray(output?.activities) ? output.activities : [];
            const activityIds = await syncStructureLevel({
              connection,
              table: 'program_activities',
              parentColumn: 'output_id',
              parentId: outputId,
              items: activities
            });

            for (const [activityIndex, activity] of activities.entries()) {
              const activityId = activityIds[activityIndex];
              await syncStructureLevel({
                connection,
                table: 'program_budget_lines',
                parentColumn: 'activity_id',
                parentId: activityId,
                items: Array.isArray(activity?.budgetLines) ? activity.budgetLines : []
              });
            }
          }
        }

        await connection.commit();
        return { success: true, message: 'Program structure saved successfully.' };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
  }
};

export default programsResolvers;