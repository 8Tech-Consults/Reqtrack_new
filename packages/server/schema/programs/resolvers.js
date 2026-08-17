import { GraphQLError } from 'graphql';
import { JSONResolver } from 'graphql-scalars';
import saveData from '../../utils/db/saveData.js';
import { db } from '../../config/config.js';
import checkPermission from '../../helpers/checkPermission.js';
import hasPermission from '../../helpers/hasPermission.js';

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


export const fetchPrograms = async ({id, programManager_id}) => {
  try {
    let values = [];
    let where = "WHERE p.deleted = 0";
    
    if (id) {
      where += " AND p.id = ?";
      values.push(id);
    }

    if (programManager_id) {
      where += " AND p.program_manager_id = ?";
      values.push(programManager_id);
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
    programs: async (_parent, args, context) => {
      const { limit, offset, search } = args;
      const userPermissions = context.req.user.permissions;
      const user_id = context.req.user.id;

      checkPermission(
        userPermissions,
        "can_view_programs", 
        "You dont have permissions to view programs"
      );

      const canViewOwnPrograms = hasPermission(
        userPermissions,
        "can_view_own_programs"
      );

      console.log(canViewOwnPrograms, user_id)

      const canManageAllPrograms = hasPermission(
        userPermissions,
        "can_manage_programs"
      );

      return await fetchPrograms({
        id: null,
        programManager_id : canViewOwnPrograms? user_id: null
      })
    },
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

      if (existing && String(existing.id) !== String(input?.id || '')) {
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
        for (const row of input?.outcomes || []) {
          const data = {
            id: row?.id ? String(row.id) : null,
            program_id: programId,
            name: String(row?.name || '').trim(),
            sort_order: Number.isFinite(Number(row?.sortOrder)) ? Number(row.sortOrder) : 0,
            deleted: 0,
            created_at: new Date(),
            updated_at: new Date()
          };

          const outcomeId = await saveData({
            connection,
            table: 'program_outcomes',
            id: row?.id ? String(row.id) : null,
            data: data
          });

          for (const output of row?.outputs || []) {
            // const outcomeId = outcomeId;
            const outputData = {
              id: output?.id ? String(output.id) : null,
              outcome_id: outcomeId,
              name: String(output?.name || '').trim(),
              sort_order: Number.isFinite(Number(output?.sortOrder)) ? Number(output.sortOrder) : 0,
              deleted: 0
            };
            // const outputs = Array.isArray(row?.outputs) ? row.outputs : [];
            const outputId = await saveData({
              connection,
              table: 'program_outputs',
              id: output?.id ? String(output.id) : null,
              data: outputData
            });

            console.log('outputId', outputId)

            for (const activities of output?.activities || []) {
              const activityData = {
                id: activities?.id ? String(activities.id) : null,
                output_id: outputId,
                name: String(activities?.name || '').trim(),
                sort_order: Number.isFinite(Number(activities?.sortOrder)) ? Number(activities.sortOrder) : 0,
                deleted: 0
              }

              const activityId = await saveData({
                connection,
                table: 'program_activities',
                id: activities?.id ? String(activities.id) : null,
                data: activityData,
              });
              console.log('activityId', activityId)

              for (const budgetLine of activities?.budgetLines || []) {
                const budgetLineData = {
                  id: budgetLine?.id ? String(budgetLine.id) : null,
                  activity_id: activityId,
                  name: String(budgetLine?.name || '').trim(),
                  sort_order: Number.isFinite(Number(budgetLine?.sortOrder)) ? Number(budgetLine.sortOrder) : 0,
                  quantity: Number.isFinite(Number(budgetLine?.quantity)) ? Number(budgetLine.quantity) : 1,
                  frequency: Number.isFinite(Number(budgetLine?.frequency)) ? Number(budgetLine.frequency) : 1,
                  unit_price: Number.isFinite(Number(budgetLine?.unitPrice)) ? Number(budgetLine.unitPrice) : 0,
                  units: String(budgetLine?.units || '').trim(),
                  total_amount: Number.isFinite(Number(budgetLine?.totalAmount))
                    ? Number(budgetLine.totalAmount)
                    : (Number.isFinite(Number(budgetLine?.quantity)) ? Number(budgetLine.quantity) : 1) *
                      (Number.isFinite(Number(budgetLine?.frequency)) ? Number(budgetLine.frequency) : 1) *
                      (Number.isFinite(Number(budgetLine?.unitPrice)) ? Number(budgetLine.unitPrice) : 0),

                }

                await saveData({
                  connection,
                  table: 'program_budget_lines',
                  id: budgetLine?.id ? String(budgetLine.id) : null,
                  data: budgetLineData
                });
              }
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
    },
    deleteProgram: async (_parent, { id }, context) => {
      const userPermissions = context?.req?.user?.permissions;
      checkPermission(
        userPermissions,
        'can_manage_programs',
        "You don't have permission to delete programs."
      );

      const programId = String(id || '').trim();
      if (!programId) {
        throw new GraphQLError('Program is required.', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      const [[program]] = await db.execute(
        `SELECT id FROM programs WHERE id = ? AND deleted = 0 LIMIT 1`,
        [programId]
      );
      if (!program) {
        throw new GraphQLError('Program not found.', { extensions: { code: 'NOT_FOUND' } });
      }

      await saveData({
        table: 'programs',
        id: programId,
        data: {
          deleted: 1,
          updated_by: context?.req?.user?.id || null,
          updated_at: new Date()
        }
      });

      return {
        success: true,
        message: 'Program deleted successfully.',
        program: null
      };
    }
  }
};

export default programsResolvers;