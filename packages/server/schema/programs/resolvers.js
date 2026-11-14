import { GraphQLError } from 'graphql';
import { JSONResolver } from 'graphql-scalars';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import saveData from '../../utils/db/saveData.js';
import { db } from '../../config/config.js';
import checkPermission from '../../helpers/checkPermission.js';
import hasPermission from '../../helpers/hasPermission.js';
import saveUpload from '../../helpers/saveUpload.js';
import { notifyUser } from '../../helpers/notifications.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── NAD budget template parsing ───────────────────────────────────────────
// Layout of Nad_budget Template.xlsx ("Sheet1"):
//   Rows 1-3: merged header block.
//   Row 4+:   A=Outcome, B=Output, C=Activity, D=Original Budget (unused -
//             we don't track revision history), E=Cost type, F=Units,
//             G=Unit cost, H=Quantity, I=Frequency, J=computed total (unused
//             - we always recompute quantity*frequency*unitCost ourselves).
//   Outcome/Output/Activity are only filled in on the row where they change
//   (an outline, like the source workbook it was modeled on) - every row
//   after that carries the last-seen value forward until the next one. A row
//   only becomes a real budget line once column E (Cost type) has a value.
const BUDGET_TEMPLATE_DATA_START_ROW = 4;

const cellText = (cell) => {
  const raw = cell?.value;
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'object') {
    if (Array.isArray(raw.richText)) return raw.richText.map((part) => part.text).join('');
    if (raw.result !== undefined) return String(raw.result ?? '');
    if (raw.text !== undefined) return String(raw.text ?? '');
  }
  return String(raw);
};

const cellNumber = (cell) => {
  const text = cellText(cell).trim().replace(/,/g, '');
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
};

// Names are matched trimmed + case-insensitively when merging an upload into
// the existing structure.
const nameKey = (value) => String(value ?? '').trim().toLowerCase();

const sameNumber = (a, b) => Math.abs(Number(a || 0) - Number(b || 0)) < 0.005;

const parseBudgetWorkbook = async (filePath, programType) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { errors: ['The uploaded file has no worksheet.'], lines: [] };
  }

  const errors = [];
  const lines = [];
  let currentOutcome = null;
  let currentOutput = null;
  let currentActivity = null;
  const seenLineKeys = new Set();

  const lastRow = Math.max(sheet.actualRowCount || 0, sheet.rowCount || 0);
  for (let rowNumber = BUDGET_TEMPLATE_DATA_START_ROW; rowNumber <= lastRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);

    const outcomeText = cellText(row.getCell(1)).trim();
    const outputText = cellText(row.getCell(2)).trim();
    const activityText = cellText(row.getCell(3)).trim();
    const costTypeText = cellText(row.getCell(5)).trim();

    if (outcomeText) currentOutcome = outcomeText;
    if (outputText) currentOutput = outputText;
    if (activityText) currentActivity = activityText;

    if (!costTypeText) continue; // spacer/carry-forward row, not a budget line

    const unitsText = cellText(row.getCell(6)).trim();
    const unitCost = cellNumber(row.getCell(7));
    const quantity = cellNumber(row.getCell(8));
    const frequency = cellNumber(row.getCell(9));

    const rowErrors = [];
    if (programType === 'Activity') {
      if (!currentOutcome) rowErrors.push('no Outcome set above it');
      if (!currentOutput) rowErrors.push('no Output set above it');
    }
    if (!currentActivity) rowErrors.push('no Activity set above it');
    if (!unitsText) rowErrors.push('Units is required');
    if (unitCost === null || unitCost < 0) rowErrors.push('Unit cost must be a number 0 or greater');
    if (quantity === null || quantity <= 0) rowErrors.push('Quantity must be a number greater than 0');
    if (frequency === null || frequency <= 0) rowErrors.push('Frequency must be a number greater than 0');

    // Admin-type programs are always attached under the hidden
    // General/General outcome+output created at program setup time -
    // Outcome/Output columns are meant to stay blank for them.
    const lineOutcome = programType === 'Admin' ? 'General' : currentOutcome;
    const lineOutput = programType === 'Admin' ? 'General' : currentOutput;

    // Budget lines are merged into the existing structure by name, so a name
    // may only appear once per activity or the match would be ambiguous.
    if (currentActivity) {
      const lineKey = [lineOutcome, lineOutput, currentActivity, costTypeText].map(nameKey).join('|');
      if (seenLineKeys.has(lineKey)) {
        rowErrors.push(`duplicate budget line under activity "${currentActivity}"`);
      }
      seenLineKeys.add(lineKey);
    }

    if (rowErrors.length) {
      errors.push(`Row ${rowNumber} ("${costTypeText}"): ${rowErrors.join(', ')}.`);
      continue;
    }

    lines.push({
      outcome: lineOutcome,
      output: lineOutput,
      activity: currentActivity,
      name: costTypeText,
      units: unitsText,
      unitPrice: unitCost,
      quantity,
      frequency,
    });
  }

  return { errors, lines };
};

// Groups the flat, carry-forward-resolved line list back into the nested
// outcome > output > activity > budgetLines tree saveProgramStructure works
// with, assigning sortOrder by first-seen order at each level.
const buildBudgetTree = (lines) => {
  const outcomes = [];
  const outcomeByName = new Map();

  for (const line of lines) {
    let outcome = outcomeByName.get(nameKey(line.outcome));
    if (!outcome) {
      outcome = { name: line.outcome, sortOrder: outcomes.length, outputs: [], outputByName: new Map() };
      outcomeByName.set(nameKey(line.outcome), outcome);
      outcomes.push(outcome);
    }

    let output = outcome.outputByName.get(nameKey(line.output));
    if (!output) {
      output = { name: line.output, sortOrder: outcome.outputs.length, activities: [], activityByName: new Map() };
      outcome.outputByName.set(nameKey(line.output), output);
      outcome.outputs.push(output);
    }

    let activity = output.activityByName.get(nameKey(line.activity));
    if (!activity) {
      activity = { name: line.activity, sortOrder: output.activities.length, budgetLines: [] };
      output.activityByName.set(nameKey(line.activity), activity);
      output.activities.push(activity);
    }

    activity.budgetLines.push({
      name: line.name,
      units: line.units,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      frequency: line.frequency,
      sortOrder: activity.budgetLines.length,
    });
  }

  return outcomes;
};

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
      `SELECT p.id, p.name, p.description, p.budget_amount, p.program_manager_id, p.status, p.type, p.created_at,
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
      type: row.type || 'Activity',
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
     AND r.name IN ('Program Staff')
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

      // console.log(canViewOwnPrograms, user_id)

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
      const saveId = input?.id || null;

      const requestedType = input?.type || 'Activity';
      if (!['Activity', 'Admin'].includes(requestedType)) {
        throw new GraphQLError('Invalid program type.', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      const data = {
        name: String(input?.name || '').trim(),
        description: input?.description ? String(input.description).trim() : null,
        budget_amount: Number(input?.budgetAmount || 0),
        program_manager_id: input?.programManagerId || null,
        status: input?.status || 'active',
        deleted: 0,
        updated_by: userId,
        updated_at: new Date()
      };

      // type, created_by and created_at are only set at creation time, so an
      // edit never overwrites them.
      if (!saveId) {
        data.type = requestedType;
        data.created_by = userId;
        data.created_at = new Date();
      }

      if (!data.name) {
        throw new GraphQLError('Program name is required.', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      let connection;
      let previous = null;
      let savedId;

      try {
        const [[existing]] = await db.execute(
          `SELECT id FROM programs WHERE deleted = 0 AND LOWER(name) = LOWER(?) LIMIT 1`,
          [data.name]
        );

        if (existing && String(existing.id) !== String(saveId || '')) {
          throw new GraphQLError('A program with this name already exists.', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        if (saveId) {
          [[previous]] = await db.execute(
            `SELECT id, program_manager_id FROM programs WHERE id = ? AND deleted = 0 LIMIT 1`,
            [saveId]
          );
          if (!previous) {
            throw new GraphQLError('Program not found.', { extensions: { code: 'NOT_FOUND' } });
          }
        }

        // The program and (for Admin programs) its General outcome/output are saved
        // together, so a failure never leaves a half-created program behind.
        connection = await db.getConnection();
        await connection.beginTransaction();

        savedId = await saveData({ table: 'programs', id: saveId, data, connection });

        if (!saveId && requestedType === 'Admin') {
          const outcomeId = await saveData({
            table: 'program_outcomes',
            id: null,
            data: { program_id: savedId, name: 'General', sort_order: 0, deleted: 0 },
            connection
          });

          await saveData({
            table: 'program_outputs',
            id: null,
            data: { outcome_id: outcomeId, name: 'General', sort_order: 0, deleted: 0 },
            connection
          });
        }

        await connection.commit();
      } catch (error) {
        if (connection) await connection.rollback().catch(() => undefined);
        if (error instanceof GraphQLError) throw error;
        console.error('createProgram error:', error);
        throw new GraphQLError(saveId ? 'Failed to update the program.' : 'Failed to create the program.', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      } finally {
        if (connection) connection.release();
      }

      const [programs] = await db.execute(
        `SELECT p.id, p.name, p.description, p.budget_amount, p.program_manager_id, p.status, p.type, p.created_at,
                u.name AS program_manager_name
         FROM programs p
         LEFT JOIN users u ON u.id = p.program_manager_id
         WHERE p.id = ?
         LIMIT 1`,
        [savedId]
      );
      const program = programs[0];

      // Tell the program's assigned staff member (in-app + email). Skipped when they
      // made the change themselves. notifyUser never throws, so this can't fail the save.
      const managerId = program?.program_manager_id || null;
      const managerChanged = !saveId || String(previous?.program_manager_id || '') !== String(managerId || '');
      if (managerId && String(managerId) !== String(userId || '')) {
        const isAssignment = managerChanged;
        const title = isAssignment ? 'You have been assigned a program' : 'A program you manage was updated';
        const message = isAssignment
          ? `You have been assigned to manage the program "${program.name}".`
          : `The program "${program.name}" was updated.`;
        const clientUrl = String(process.env.CLIENT_URL || context?.req?.headers?.origin || '').replace(/\/+$/, '');

        notifyUser({
          userId: managerId,
          type: isAssignment ? 'ProgramAssigned' : 'ProgramUpdated',
          title,
          message,
          entityType: 'Program',
          entityId: savedId,
          createdBy: userId,
          email: {
            subject: `${title}: ${program.name}`,
            template: {
              heading: title,
              preheader: message,
              paragraphs: [
                message,
                isAssignment
                  ? 'You can now view its budget and the requisitions raised against it.'
                  : 'Open the program to review the latest details.'
              ],
              details: [
                { label: 'Program', value: program.name },
                { label: 'Type', value: program.type === 'Admin' ? 'Administrative' : 'Activity' },
                { label: 'Budget', value: `UGX ${Number(program.budget_amount || 0).toLocaleString('en-US')}` },
                { label: 'Status', value: program.status }
              ],
              ...(clientUrl ? { action: { label: 'Open program', url: `${clientUrl}/projects` } } : {})
            }
          }
        });
      }

      return {
        success: true,
        message: saveId ? 'Program updated successfully.' : 'Program created successfully.',
        program: {
          id: String(program.id),
          name: program.name,
          description: program.description || '',
          budgetAmount: Number(program.budget_amount || 0),
          programManagerId: program.program_manager_id || null,
          programManagerName: program.program_manager_name || null,
          status: program.status,
          type: program.type || 'Activity',
          createdAt: program.created_at,
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

            // console.log('outputId', outputId)

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
              // console.log('activityId', activityId)

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
    uploadProgramBudget: async (_parent, { programId, file, dryRun = false }, context) => {
      const userPermissions = context?.req?.user?.permissions;
      checkPermission(
        userPermissions,
        'can_manage_programs',
        "You don't have permission to upload a program's budget."
      );

      const id = String(programId || '').trim();
      if (!id) {
        throw new GraphQLError('Program is required.', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      const [[program]] = await db.execute(
        `SELECT id, type FROM programs WHERE id = ? AND deleted = 0 LIMIT 1`,
        [id]
      );
      if (!program) {
        throw new GraphQLError('Program not found.', { extensions: { code: 'NOT_FOUND' } });
      }
      const programType = program.type || 'Activity';

      const uploaded = await saveUpload({
        file,
        subdir: 'budget_uploads',
        verifySignature: true,
        maxSize: 5 * 1024 * 1024,
      });
      const absolutePath = path.join(__dirname, '../../public', uploaded.path);

      if (!/\.xlsx$/i.test(uploaded.originalName || '')) {
        fs.unlink(absolutePath, () => {});
        throw new GraphQLError('Please upload an .xlsx file.', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      let parsed;
      try {
        parsed = await parseBudgetWorkbook(absolutePath, programType);
      } catch (error) {
        throw new GraphQLError(`Could not read the uploaded file: ${error.message}`);
      } finally {
        fs.unlink(absolutePath, () => {});
      }

      if (parsed.errors.length) {
        return {
          success: false,
          message: 'The file has errors and nothing was saved. Fix these and re-upload.',
          createdBudgetLines: 0,
          errors: parsed.errors,
        };
      }

      if (!parsed.lines.length) {
        return {
          success: false,
          message: 'No budget lines were found in the file.',
          createdBudgetLines: 0,
          errors: [],
        };
      }

      const tree = buildBudgetTree(parsed.lines);

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        // Merge the upload into the existing structure by name rather than
        // replacing it: requisitions reference these rows by id, so existing
        // outcomes/outputs/activities/budget lines are reused (and budget
        // line values updated where they changed). Nothing is deleted - rows
        // missing from the file are left as they are.
        //
        // With dryRun the exact same work runs inside the transaction and is
        // then rolled back, so the preview always matches what Save applies.
        const loadChildren = async (table, parentColumn, parentId, columns = 'id, name, sort_order') => {
          const [rows] = await connection.execute(
            `SELECT ${columns} FROM ${table}
             WHERE ${parentColumn} = ? AND deleted = 0
             ORDER BY sort_order ASC, created_at ASC`,
            [parentId]
          );
          const byName = new Map();
          for (const row of rows) {
            const key = nameKey(row.name);
            if (!byName.has(key)) byName.set(key, row);
          }
          return byName;
        };

        const changes = [];

        const upsertNode = async ({ table, level, path, parentColumn, parentId, existing, name, sortOrder }) => {
          const match = existing.get(nameKey(name));
          if (match) {
            if (Number(match.sort_order) !== sortOrder) {
              await connection.execute(`UPDATE ${table} SET sort_order = ? WHERE id = ?`, [sortOrder, match.id]);
            }
            return match.id;
          }
          const newId = await saveData({
            connection,
            table,
            id: null,
            data: { [parentColumn]: parentId, name, sort_order: sortOrder, deleted: 0 },
          });
          existing.set(nameKey(name), { id: newId, name, sort_order: sortOrder });
          changes.push({ level, action: 'new', path, name });
          return newId;
        };

        let createdBudgetLines = 0;
        let updatedBudgetLines = 0;
        let unchangedBudgetLines = 0;

        const existingOutcomes = await loadChildren('program_outcomes', 'program_id', id);
        for (const outcome of tree) {
          const outcomeId = await upsertNode({
            table: 'program_outcomes',
            level: 'outcome',
            path: null,
            parentColumn: 'program_id',
            parentId: id,
            existing: existingOutcomes,
            name: outcome.name,
            sortOrder: outcome.sortOrder,
          });

          const existingOutputs = await loadChildren('program_outputs', 'outcome_id', outcomeId);
          for (const output of outcome.outputs) {
            const outputId = await upsertNode({
              table: 'program_outputs',
              level: 'output',
              path: outcome.name,
              parentColumn: 'outcome_id',
              parentId: outcomeId,
              existing: existingOutputs,
              name: output.name,
              sortOrder: output.sortOrder,
            });

            const existingActivities = await loadChildren('program_activities', 'output_id', outputId);
            for (const activity of output.activities) {
              const activityId = await upsertNode({
                table: 'program_activities',
                level: 'activity',
                path: `${outcome.name} › ${output.name}`,
                parentColumn: 'output_id',
                parentId: outputId,
                existing: existingActivities,
                name: activity.name,
                sortOrder: activity.sortOrder,
              });

              const linePath = `${outcome.name} › ${output.name} › ${activity.name}`;
              const existingLines = await loadChildren(
                'program_budget_lines',
                'activity_id',
                activityId,
                'id, name, quantity, frequency, unit_price, units, total_amount, sort_order'
              );
              for (const line of activity.budgetLines) {
                const totalAmount = line.quantity * line.frequency * line.unitPrice;
                const match = existingLines.get(nameKey(line.name));
                const lineChange = {
                  level: 'budgetLine',
                  path: linePath,
                  name: line.name,
                  units: line.units,
                  unitPrice: line.unitPrice,
                  quantity: line.quantity,
                  frequency: line.frequency,
                  totalAmount,
                };

                if (!match) {
                  await saveData({
                    connection,
                    table: 'program_budget_lines',
                    id: null,
                    data: {
                      activity_id: activityId,
                      name: line.name,
                      quantity: line.quantity,
                      frequency: line.frequency,
                      unit_price: line.unitPrice,
                      units: line.units,
                      total_amount: totalAmount,
                      sort_order: line.sortOrder,
                      deleted: 0,
                    },
                  });
                  createdBudgetLines += 1;
                  changes.push({ ...lineChange, action: 'new' });
                  continue;
                }

                const previousUnits = String(match.units ?? '').trim();
                const valuesChanged =
                  previousUnits !== line.units ||
                  !sameNumber(match.unit_price, line.unitPrice) ||
                  !sameNumber(match.quantity, line.quantity) ||
                  !sameNumber(match.frequency, line.frequency) ||
                  !sameNumber(match.total_amount, totalAmount);

                if (valuesChanged) {
                  await connection.execute(
                    `UPDATE program_budget_lines
                     SET quantity = ?, frequency = ?, unit_price = ?, units = ?, total_amount = ?, sort_order = ?
                     WHERE id = ?`,
                    [line.quantity, line.frequency, line.unitPrice, line.units, totalAmount, line.sortOrder, match.id]
                  );
                  updatedBudgetLines += 1;
                  changes.push({
                    ...lineChange,
                    action: 'updated',
                    previousUnits,
                    previousUnitPrice: Number(match.unit_price || 0),
                    previousQuantity: Number(match.quantity || 0),
                    previousFrequency: Number(match.frequency || 0),
                    previousTotalAmount: Number(match.total_amount || 0),
                  });
                } else {
                  if (Number(match.sort_order) !== line.sortOrder) {
                    await connection.execute(
                      `UPDATE program_budget_lines SET sort_order = ? WHERE id = ?`,
                      [line.sortOrder, match.id]
                    );
                  }
                  unchangedBudgetLines += 1;
                  changes.push({ ...lineChange, action: 'unchanged' });
                }
              }
            }
          }
        }

        const plural = (count) => (count === 1 ? '' : 's');
        const summary = `${createdBudgetLines} new, ${updatedBudgetLines} updated, ${unchangedBudgetLines} unchanged budget line${plural(createdBudgetLines + updatedBudgetLines + unchangedBudgetLines)}`;

        if (dryRun) {
          await connection.rollback();
        } else {
          await connection.commit();
        }

        return {
          success: true,
          dryRun: Boolean(dryRun),
          message: dryRun ? `Preview - ${summary}.` : `Budget saved - ${summary}.`,
          createdBudgetLines,
          updatedBudgetLines,
          unchangedBudgetLines,
          changes,
          errors: [],
        };
      } catch (error) {
        await connection.rollback();
        throw new GraphQLError(error.message || 'Failed to upload budget.');
      } finally {
        connection.release();
      }
    },
    createProgramBudgetLine: async (_parent, { input }, context) => {
      const userPermissions = context?.req?.user?.permissions;
      checkPermission(
        userPermissions,
        'can_add_budget_lines',
        "You don't have permission to add a new budget line."
      );

      const activityId = String(input?.activityId || '').trim();
      const name = String(input?.name || '').trim();
      const units = String(input?.units || '').trim();

      if (!activityId) {
        throw new GraphQLError('Activity is required.', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      if (!name) {
        throw new GraphQLError('Budget line name is required.', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      if (!units) {
        throw new GraphQLError('Units is required.', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      const [[activity]] = await db.execute(
        `SELECT id FROM program_activities WHERE id = ? AND deleted = 0 LIMIT 1`,
        [activityId]
      );
      if (!activity) {
        throw new GraphQLError('Activity not found.', { extensions: { code: 'NOT_FOUND' } });
      }

      const [[existing]] = await db.execute(
        `SELECT id FROM program_budget_lines WHERE activity_id = ? AND deleted = 0 AND LOWER(name) = LOWER(?) LIMIT 1`,
        [activityId, name]
      );
      if (existing) {
        throw new GraphQLError('A budget line with this name already exists under this activity.', {
          extensions: { code: 'BAD_USER_INPUT' }
        });
      }

      const [[{ nextSortOrder }]] = await db.execute(
        `SELECT COUNT(*) AS nextSortOrder FROM program_budget_lines WHERE activity_id = ? AND deleted = 0`,
        [activityId]
      );

      const quantity = Number.isFinite(Number(input?.quantity)) && Number(input.quantity) > 0 ? Number(input.quantity) : 1;
      const frequency = Number.isFinite(Number(input?.frequency)) && Number(input.frequency) > 0 ? Number(input.frequency) : 1;
      const unitPrice = Number.isFinite(Number(input?.unitPrice)) ? Number(input.unitPrice) : 0;

      const budgetLineId = await saveData({
        table: 'program_budget_lines',
        id: null,
        data: {
          activity_id: activityId,
          name,
          quantity,
          frequency,
          unit_price: unitPrice,
          units,
          total_amount: quantity * frequency * unitPrice,
          sort_order: nextSortOrder,
          deleted: 0,
        },
        connection: null,
      });

      const [[row]] = await db.execute(
        `SELECT id, activity_id, name, quantity, frequency, unit_price, units, total_amount, sort_order
         FROM program_budget_lines WHERE id = ? LIMIT 1`,
        [budgetLineId]
      );

      return {
        success: true,
        message: 'Budget line added successfully.',
        budgetLine: mapProgramNode(row),
      };
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